/**
 * The Joker - Agentic Terminal
 * Data Extraction Utilities
 */

import { Page, ElementHandle } from 'puppeteer';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { ScrapeResult, ExtractedLink, ExtractedImage, SearchResult } from '../types';

/**
 * Extraction configuration
 */
export interface ExtractionConfig {
  /** CSS selectors for extraction */
  selectors?: Record<string, string>;
  /** Whether to extract all links */
  extractLinks?: boolean;
  /** Whether to extract all images */
  extractImages?: boolean;
  /** Whether to extract metadata */
  extractMetadata?: boolean;
  /** Maximum text length per field */
  maxTextLength?: number;
  /** Clean extracted text (remove extra whitespace) */
  cleanText?: boolean;
}

/**
 * Element data interface
 */
export interface ElementData {
  tagName: string;
  text: string;
  html: string;
  attributes: Record<string, string>;
  href?: string;
  src?: string;
}

/**
 * Default extraction config
 */
const DEFAULT_CONFIG: ExtractionConfig = {
  extractLinks: true,
  extractImages: false,
  extractMetadata: true,
  maxTextLength: 50000,
  cleanText: true,
};

/**
 * Clean and normalize text
 */
export function cleanText(text: string, maxLength?: number): string {
  let cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + '...';
  }

  return cleaned;
}

/**
 * Extract text content from the page
 */
export async function extractText(page: Page, selector?: string): Promise<string> {
  try {
    const text = await page.evaluate((sel) => {
      const element = sel ? document.querySelector(sel) : document.body;
      if (!element) return '';

      // Remove script and style elements
      const clone = element.cloneNode(true) as Element;
      clone.querySelectorAll('script, style, noscript').forEach((el) => el.remove());

      return clone.textContent || '';
    }, selector);

    return cleanText(text);
  } catch (error) {
    logger.error('Error extracting text', { selector, error });
    return '';
  }
}

/**
 * Extract structured data using CSS selectors
 */
export async function extractBySelectors(
  page: Page,
  selectors: Record<string, string>
): Promise<Record<string, string | string[]>> {
  const results: Record<string, string | string[]> = {};

  for (const [key, selector] of Object.entries(selectors)) {
    try {
      const data = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        if (elements.length === 0) return null;
        if (elements.length === 1) {
          return elements[0].textContent?.trim() || '';
        }
        return Array.from(elements).map((el) => el.textContent?.trim() || '');
      }, selector);

      if (data !== null) {
        results[key] = data;
      }
    } catch (error) {
      logger.warn('Error extracting selector', { key, selector, error });
    }
  }

  return results;
}

/**
 * Extract all links from the page
 */
export async function extractLinks(page: Page): Promise<ExtractedLink[]> {
  try {
    const currentUrl = page.url();
    const currentDomain = new URL(currentUrl).hostname;

    const links = await page.evaluate(() => {
      const anchors = document.querySelectorAll('a[href]');
      return Array.from(anchors).map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: a.textContent?.trim() || '',
        title: a.getAttribute('title') || '',
      }));
    });

    return links
      .filter((link) => {
        try {
          new URL(link.href);
          return true;
        } catch {
          return false;
        }
      })
      .map((link) => {
        const linkUrl = new URL(link.href);
        return {
          text: link.text,
          href: link.href,
          isExternal: linkUrl.hostname !== currentDomain,
        };
      });
  } catch (error) {
    logger.error('Error extracting links', { error });
    return [];
  }
}

/**
 * Extract all images from the page
 */
export async function extractImages(page: Page): Promise<ExtractedImage[]> {
  try {
    const images = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src]');
      return Array.from(imgs).map((img) => ({
        src: (img as HTMLImageElement).src,
        alt: img.getAttribute('alt') || '',
        width: (img as HTMLImageElement).naturalWidth || undefined,
        height: (img as HTMLImageElement).naturalHeight || undefined,
      }));
    });

    return images.filter((img) => img.src && !img.src.startsWith('data:'));
  } catch (error) {
    logger.error('Error extracting images', { error });
    return [];
  }
}

/**
 * Extract page metadata
 */
export async function extractMetadata(page: Page): Promise<Record<string, string>> {
  try {
    const metadata = await page.evaluate(() => {
      const meta: Record<string, string> = {};

      // Get meta tags
      document.querySelectorAll('meta').forEach((el) => {
        const name = el.getAttribute('name') || el.getAttribute('property');
        const content = el.getAttribute('content');
        if (name && content) {
          meta[name] = content;
        }
      });

      // Get title
      meta['title'] = document.title || '';

      // Get canonical URL
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        meta['canonical'] = canonical.getAttribute('href') || '';
      }

      // Get language
      meta['language'] = document.documentElement.lang || '';

      return meta;
    });

    return metadata;
  } catch (error) {
    logger.error('Error extracting metadata', { error });
    return {};
  }
}

/**
 * Extract elements using CSS selector
 */
export async function querySelectorAll(page: Page, selector: string): Promise<ElementData[]> {
  try {
    const elements = await page.evaluate((sel) => {
      const els = document.querySelectorAll(sel);
      return Array.from(els).map((el) => {
        const attributes: Record<string, string> = {};
        Array.from(el.attributes).forEach((attr) => {
          attributes[attr.name] = attr.value;
        });

        return {
          tagName: el.tagName.toLowerCase(),
          text: el.textContent?.trim() || '',
          html: el.innerHTML,
          attributes,
          href: (el as HTMLAnchorElement).href || undefined,
          src: (el as HTMLImageElement).src || undefined,
        };
      });
    }, selector);

    return elements;
  } catch (error) {
    logger.error('Error querying selector', { selector, error });
    return [];
  }
}

/**
 * Extract data using XPath
 */
export async function extractByXPath(page: Page, xpath: string): Promise<string[]> {
  try {
    const results = await page.evaluate((xp) => {
      const result = document.evaluate(
        xp,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      const texts: string[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node) {
          texts.push(node.textContent?.trim() || '');
        }
      }
      return texts;
    }, xpath);

    return results;
  } catch (error) {
    logger.error('Error extracting by XPath', { xpath, error });
    return [];
  }
}

/**
 * Extract table data
 */
export async function extractTable(
  page: Page,
  tableSelector: string
): Promise<string[][]> {
  try {
    const tableData = await page.evaluate((selector) => {
      const table = document.querySelector(selector);
      if (!table) return [];

      const rows: string[][] = [];
      table.querySelectorAll('tr').forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll('th, td').forEach((cell) => {
          cells.push(cell.textContent?.trim() || '');
        });
        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      return rows;
    }, tableSelector);

    return tableData;
  } catch (error) {
    logger.error('Error extracting table', { tableSelector, error });
    return [];
  }
}

/**
 * Full page scrape with all data
 */
export async function scrapePage(
  page: Page,
  config: ExtractionConfig = {}
): Promise<ScrapeResult> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const url = page.url();
  const title = await page.title();

  logger.debug('Scraping page', { url, config: opts });

  // Extract main content
  let content = await extractText(page);
  if (opts.cleanText) {
    content = cleanText(content, opts.maxTextLength);
  }

  // Extract custom selectors
  let selectorData: Record<string, string | string[]> = {};
  if (opts.selectors) {
    selectorData = await extractBySelectors(page, opts.selectors);
  }

  // Extract links
  let links: ExtractedLink[] = [];
  if (opts.extractLinks) {
    links = await extractLinks(page);
  }

  // Extract images
  let images: ExtractedImage[] = [];
  if (opts.extractImages) {
    images = await extractImages(page);
  }

  // Extract metadata
  let metadata: Record<string, string> = {};
  if (opts.extractMetadata) {
    metadata = await extractMetadata(page);
  }

  const result: ScrapeResult = {
    url,
    title,
    content,
    links,
    images,
    metadata,
    timestamp: new Date(),
  };

  logger.debug('Page scraped successfully', {
    url,
    contentLength: content.length,
    linksCount: links.length,
    imagesCount: images.length,
  });

  return result;
}

/**
 * Parse HTML string using Cheerio
 */
export function parseHtml(html: string) {
  return cheerio.load(html);
}

/**
 * Extract data from HTML string using Cheerio
 */
export function extractFromHtml(
  html: string,
  selectors: Record<string, string>
): Record<string, string | string[]> {
  const $ = parseHtml(html);
  const results: Record<string, string | string[]> = {};

  for (const [key, selector] of Object.entries(selectors)) {
    const elements = $(selector);
    if (elements.length === 0) continue;
    if (elements.length === 1) {
      results[key] = elements.text().trim();
    } else {
      results[key] = elements.map((_, el) => $(el).text().trim()).get();
    }
  }

  return results;
}

/**
 * Extract search results from Google
 */
export async function extractGoogleResults(page: Page): Promise<SearchResult[]> {
  try {
    const results = await page.evaluate(() => {
      const searchResults: { title: string; url: string; snippet: string }[] = [];
      
      // Main search results
      document.querySelectorAll('div.g').forEach((result) => {
        const titleEl = result.querySelector('h3');
        const linkEl = result.querySelector('a');
        const snippetEl = result.querySelector('div[data-sncf]') || 
                          result.querySelector('.VwiC3b');

        if (titleEl && linkEl) {
          searchResults.push({
            title: titleEl.textContent?.trim() || '',
            url: (linkEl as HTMLAnchorElement).href,
            snippet: snippetEl?.textContent?.trim() || '',
          });
        }
      });

      return searchResults;
    });

    return results.map((r, i) => ({
      ...r,
      position: i + 1,
    }));
  } catch (error) {
    logger.error('Error extracting Google results', { error });
    return [];
  }
}

/**
 * Data Extractor class for managing extractions
 */
export class DataExtractor {
  private page: Page;
  private config: ExtractionConfig;

  constructor(page: Page, config: ExtractionConfig = {}) {
    this.page = page;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Full page scrape
   */
  async scrape(): Promise<ScrapeResult> {
    return scrapePage(this.page, this.config);
  }

  /**
   * Extract text
   */
  async getText(selector?: string): Promise<string> {
    return extractText(this.page, selector);
  }

  /**
   * Extract links
   */
  async getLinks(): Promise<ExtractedLink[]> {
    return extractLinks(this.page);
  }

  /**
   * Extract images
   */
  async getImages(): Promise<ExtractedImage[]> {
    return extractImages(this.page);
  }

  /**
   * Extract by selectors
   */
  async getBySelectors(
    selectors: Record<string, string>
  ): Promise<Record<string, string | string[]>> {
    return extractBySelectors(this.page, selectors);
  }

  /**
   * Extract table
   */
  async getTable(selector: string): Promise<string[][]> {
    return extractTable(this.page, selector);
  }

  /**
   * Query elements
   */
  async query(selector: string): Promise<ElementData[]> {
    return querySelectorAll(this.page, selector);
  }

  /**
   * Extract metadata
   */
  async getMetadata(): Promise<Record<string, string>> {
    return extractMetadata(this.page);
  }
}

export default DataExtractor;

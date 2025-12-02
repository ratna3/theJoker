/**
 * Scrape Tool - Web page scraping capabilities for The Joker
 * Supports content extraction, screenshots, and data parsing
 */

import { Tool, ToolCategory, ToolResult, toolRegistry } from './registry';
import { browserManager } from '../scraper/browser';
import { navigateTo, scrollToBottom, captureScreenshot } from '../scraper/navigator';
import { 
  DataExtractor, 
  scrapePage, 
  extractText, 
  extractLinks,
  extractImages,
  extractMetadata,
  extractBySelectors,
  extractTable,
  parseHtml
} from '../scraper/extractor';
import { log } from '../utils/logger';
import { ScrapeResult } from '../types';
import path from 'path';
import fs from 'fs';

/**
 * Scrape a web page
 */
async function scrapeTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    url,
    extractLinks: shouldExtractLinks = true,
    extractImages: shouldExtractImages = false,
    extractMetadata: shouldExtractMetadata = true,
    selectors,
    scrollToLoad = false,
    timeout = 30000
  } = params;

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  try {
    log.info(`Scraping page: ${url}`);

    const browser = await browserManager.getBrowser();
    const page = await browserManager.createPage(browser);

    // Set timeout
    page.setDefaultTimeout(timeout);

    // Navigate to page
    const navResult = await navigateTo(page, url, {
      waitForNetworkIdle: true,
      scrollToLoad,
      timeout
    });

    if (!navResult.success) {
      await page.close();
      browserManager.releaseBrowser(browser);
      return { 
        success: false, 
        error: `Navigation failed: ${navResult.error || 'Unknown error'}`,
        data: { blocked: navResult.blocked, blockReason: navResult.blockReason }
      };
    }

    // Scrape the page
    const extractor = new DataExtractor(page, {
      extractLinks: shouldExtractLinks,
      extractImages: shouldExtractImages,
      extractMetadata: shouldExtractMetadata,
      selectors
    });

    const result = await extractor.scrape();

    // Get custom selector data if provided
    let selectorData = {};
    if (selectors && typeof selectors === 'object') {
      selectorData = await extractor.getBySelectors(selectors);
    }

    await page.close();
    browserManager.releaseBrowser(browser);

    return {
      success: true,
      data: {
        url: result.url,
        title: result.title,
        content: result.content,
        links: result.links,
        images: result.images,
        metadata: result.metadata,
        selectorData,
        timestamp: result.timestamp,
        loadTime: navResult.loadTime
      }
    };

  } catch (error: any) {
    log.error(`Scrape failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract specific content from a URL
 */
async function extractContent(params: Record<string, any>): Promise<ToolResult> {
  const {
    url,
    selector,
    attribute,
    multiple = false
  } = params;

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  if (!selector) {
    return { success: false, error: 'Selector is required' };
  }

  try {
    log.info(`Extracting content from: ${url}`);

    const browser = await browserManager.getBrowser();
    const page = await browserManager.createPage(browser);

    const navResult = await navigateTo(page, url);
    if (!navResult.success) {
      await page.close();
      browserManager.releaseBrowser(browser);
      return { success: false, error: `Navigation failed: ${navResult.error}` };
    }

    // Wait for selector
    try {
      await page.waitForSelector(selector, { timeout: 10000 });
    } catch {
      await page.close();
      browserManager.releaseBrowser(browser);
      return { success: false, error: `Selector not found: ${selector}` };
    }

    // Extract content
    const content = await page.evaluate((sel, attr, multi) => {
      const elements = document.querySelectorAll(sel);
      if (elements.length === 0) return null;

      const extractValue = (el: Element) => {
        if (attr) {
          return el.getAttribute(attr) || '';
        }
        return el.textContent?.trim() || '';
      };

      if (multi) {
        return Array.from(elements).map(extractValue);
      }
      return extractValue(elements[0]);
    }, selector, attribute, multiple);

    await page.close();
    browserManager.releaseBrowser(browser);

    return {
      success: true,
      data: {
        url,
        selector,
        content,
        count: Array.isArray(content) ? content.length : 1
      }
    };

  } catch (error: any) {
    log.error(`Extract failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Take a screenshot of a web page
 */
async function screenshotTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    url,
    fullPage = true,
    selector,
    outputPath,
    format = 'png',
    quality = 80
  } = params;

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  try {
    log.info(`Taking screenshot of: ${url}`);

    const browser = await browserManager.getBrowser();
    const page = await browserManager.createPage(browser);

    // Enable images for screenshots
    await page.setRequestInterception(false);

    const navResult = await navigateTo(page, url, {
      waitForNetworkIdle: true,
      scrollToLoad: fullPage
    });

    if (!navResult.success) {
      await page.close();
      browserManager.releaseBrowser(browser);
      return { success: false, error: `Navigation failed: ${navResult.error}` };
    }

    // Wait a bit for rendering
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Determine output path
    const timestamp = Date.now();
    const defaultPath = path.join(process.cwd(), 'screenshots', `screenshot_${timestamp}.${format}`);
    const finalPath = outputPath || defaultPath;

    // Ensure directory exists
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Take screenshot
    if (selector) {
      // Screenshot of specific element
      const element = await page.$(selector);
      if (!element) {
        await page.close();
        browserManager.releaseBrowser(browser);
        return { success: false, error: `Element not found: ${selector}` };
      }
      await element.screenshot({
        path: finalPath,
        type: format as 'png' | 'jpeg' | 'webp',
        quality: format === 'jpeg' ? quality : undefined
      });
    } else {
      // Full page screenshot
      await page.screenshot({
        path: finalPath,
        fullPage,
        type: format as 'png' | 'jpeg' | 'webp',
        quality: format === 'jpeg' ? quality : undefined
      });
    }

    await page.close();
    browserManager.releaseBrowser(browser);

    log.info(`Screenshot saved to: ${finalPath}`);

    return {
      success: true,
      data: {
        url,
        path: finalPath,
        fullPage,
        format,
        timestamp: new Date()
      }
    };

  } catch (error: any) {
    log.error(`Screenshot failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract table data from a web page
 */
async function extractTableTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    url,
    tableSelector = 'table',
    includeHeaders = true,
    format = 'array' // 'array' or 'object'
  } = params;

  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  try {
    log.info(`Extracting table from: ${url}`);

    const browser = await browserManager.getBrowser();
    const page = await browserManager.createPage(browser);

    const navResult = await navigateTo(page, url);
    if (!navResult.success) {
      await page.close();
      browserManager.releaseBrowser(browser);
      return { success: false, error: `Navigation failed: ${navResult.error}` };
    }

    // Extract table
    const extractor = new DataExtractor(page);
    const tableData = await extractor.getTable(tableSelector);

    await page.close();
    browserManager.releaseBrowser(browser);

    if (tableData.length === 0) {
      return {
        success: false,
        error: 'No table data found'
      };
    }

    // Format as objects if requested
    let formattedData: any = tableData;
    if (format === 'object' && tableData.length > 1) {
      const headers = tableData[0];
      formattedData = tableData.slice(1).map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] || '';
        });
        return obj;
      });
    }

    return {
      success: true,
      data: {
        url,
        tableSelector,
        rowCount: tableData.length,
        columnCount: tableData[0]?.length || 0,
        headers: includeHeaders ? tableData[0] : undefined,
        data: format === 'object' ? formattedData : tableData
      }
    };

  } catch (error: any) {
    log.error(`Table extraction failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Parse HTML content without fetching
 */
async function parseHtmlTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    html,
    selectors
  } = params;

  if (!html) {
    return { success: false, error: 'HTML content is required' };
  }

  if (!selectors || typeof selectors !== 'object') {
    return { success: false, error: 'Selectors object is required' };
  }

  try {
    log.info('Parsing HTML content');

    const $ = parseHtml(html);
    const results: Record<string, string | string[]> = {};

    for (const [key, selector] of Object.entries(selectors)) {
      const elements = $(selector as string);
      if (elements.length === 0) continue;
      if (elements.length === 1) {
        results[key] = elements.text().trim();
      } else {
        results[key] = elements.map((_, el) => $(el).text().trim()).get();
      }
    }

    return {
      success: true,
      data: {
        parsed: results,
        inputLength: html.length
      }
    };

  } catch (error: any) {
    log.error(`HTML parsing failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Define the scrape_page tool
export const scrapePageTool: Tool = {
  name: 'scrape_page',
  description: 'Scrape a web page and extract its content, links, images, and metadata.',
  category: ToolCategory.SCRAPE,
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'The URL to scrape',
      required: true
    },
    {
      name: 'extractLinks',
      type: 'boolean',
      description: 'Extract all links from the page',
      required: false,
      default: true
    },
    {
      name: 'extractImages',
      type: 'boolean',
      description: 'Extract all images from the page',
      required: false,
      default: false
    },
    {
      name: 'extractMetadata',
      type: 'boolean',
      description: 'Extract page metadata (title, description, etc.)',
      required: false,
      default: true
    },
    {
      name: 'selectors',
      type: 'object',
      description: 'Custom CSS selectors for extraction (key-value pairs)',
      required: false
    },
    {
      name: 'scrollToLoad',
      type: 'boolean',
      description: 'Scroll to bottom to load lazy content',
      required: false,
      default: false
    }
  ],
  execute: scrapeTool
};

// Define the extract_content tool
export const extractContentToolDef: Tool = {
  name: 'extract_content',
  description: 'Extract specific content from a web page using CSS selectors.',
  category: ToolCategory.SCRAPE,
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'The URL to extract from',
      required: true
    },
    {
      name: 'selector',
      type: 'string',
      description: 'CSS selector for the content to extract',
      required: true
    },
    {
      name: 'attribute',
      type: 'string',
      description: 'HTML attribute to extract (optional, defaults to text content)',
      required: false
    },
    {
      name: 'multiple',
      type: 'boolean',
      description: 'Extract all matching elements (not just the first)',
      required: false,
      default: false
    }
  ],
  execute: extractContent
};

// Define the screenshot tool
export const screenshotToolDef: Tool = {
  name: 'screenshot',
  description: 'Take a screenshot of a web page.',
  category: ToolCategory.SCRAPE,
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'The URL to screenshot',
      required: true
    },
    {
      name: 'fullPage',
      type: 'boolean',
      description: 'Capture the full page (not just viewport)',
      required: false,
      default: true
    },
    {
      name: 'selector',
      type: 'string',
      description: 'CSS selector for a specific element to screenshot',
      required: false
    },
    {
      name: 'outputPath',
      type: 'string',
      description: 'Path to save the screenshot',
      required: false
    },
    {
      name: 'format',
      type: 'string',
      description: 'Image format',
      required: false,
      default: 'png',
      enum: ['png', 'jpeg', 'webp']
    }
  ],
  execute: screenshotTool
};

// Define the extract_table tool
export const extractTableToolDef: Tool = {
  name: 'extract_table',
  description: 'Extract table data from a web page.',
  category: ToolCategory.SCRAPE,
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'The URL containing the table',
      required: true
    },
    {
      name: 'tableSelector',
      type: 'string',
      description: 'CSS selector for the table',
      required: false,
      default: 'table'
    },
    {
      name: 'includeHeaders',
      type: 'boolean',
      description: 'Include table headers in output',
      required: false,
      default: true
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format',
      required: false,
      default: 'array',
      enum: ['array', 'object']
    }
  ],
  execute: extractTableTool
};

// Define the parse_html tool
export const parseHtmlToolDef: Tool = {
  name: 'parse_html',
  description: 'Parse HTML content and extract data using CSS selectors (no web request).',
  category: ToolCategory.PROCESS,
  parameters: [
    {
      name: 'html',
      type: 'string',
      description: 'The HTML content to parse',
      required: true
    },
    {
      name: 'selectors',
      type: 'object',
      description: 'CSS selectors for extraction (key-value pairs)',
      required: true
    }
  ],
  execute: parseHtmlTool
};

/**
 * Register all scrape tools
 */
export function registerScrapeTools(): void {
  toolRegistry.register(scrapePageTool);
  toolRegistry.register(extractContentToolDef);
  toolRegistry.register(screenshotToolDef);
  toolRegistry.register(extractTableToolDef);
  toolRegistry.register(parseHtmlToolDef);
  log.info('Scrape tools registered');
}

export { 
  scrapeTool, 
  extractContent, 
  screenshotTool, 
  extractTableTool, 
  parseHtmlTool 
};

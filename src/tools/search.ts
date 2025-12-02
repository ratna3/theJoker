/**
 * Search Tool - Web search capabilities for The Joker
 * Supports multiple search engines and result parsing
 */

import { Tool, ToolCategory, ToolResult, toolRegistry } from './registry';
import { BrowserPool, browserManager } from '../scraper/browser';
import { PageNavigator, navigateTo } from '../scraper/navigator';
import { DataExtractor, parseHtml, extractFromHtml } from '../scraper/extractor';
import { log } from '../utils/logger';

// Search result interface
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  source: string;
}

// Search options
export interface SearchOptions {
  engine: 'google' | 'bing' | 'duckduckgo';
  maxResults: number;
  safeSearch: boolean;
  region?: string;
  language?: string;
}

// Search engine configurations
const SEARCH_ENGINES = {
  google: {
    url: 'https://www.google.com/search',
    queryParam: 'q',
    selectors: {
      results: '#search .g',
      title: 'h3',
      link: 'a[href^="http"]',
      snippet: '.VwiC3b, .st, [data-sncf]'
    }
  },
  bing: {
    url: 'https://www.bing.com/search',
    queryParam: 'q',
    selectors: {
      results: '#b_results .b_algo',
      title: 'h2',
      link: 'h2 a',
      snippet: '.b_caption p'
    }
  },
  duckduckgo: {
    url: 'https://html.duckduckgo.com/html/',
    queryParam: 'q',
    selectors: {
      results: '.result',
      title: '.result__title',
      link: '.result__url',
      snippet: '.result__snippet'
    }
  }
};

/**
 * Perform a web search
 */
async function performSearch(params: Record<string, any>): Promise<ToolResult> {
  const {
    query,
    engine = 'duckduckgo',
    maxResults = 10,
    safeSearch = true
  } = params;

  if (!query) {
    return { success: false, error: 'Query is required' };
  }

  const engineConfig = SEARCH_ENGINES[engine as keyof typeof SEARCH_ENGINES];
  if (!engineConfig) {
    return {
      success: false,
      error: `Unknown search engine: ${engine}`
    };
  }

  try {
    log.info(`Searching ${engine} for: ${query}`);
    
    // Get browser from pool
    const browser = await browserManager.getBrowser();
    const page = await browserManager.createPage(browser);

    // Build search URL
    const searchUrl = new URL(engineConfig.url);
    searchUrl.searchParams.set(engineConfig.queryParam, query);
    
    if (safeSearch && engine === 'google') {
      searchUrl.searchParams.set('safe', 'active');
    }

    // Navigate to search page
    const navResult = await navigateTo(page, searchUrl.toString());
    if (!navResult.success) {
      await page.close();
      browserManager.releaseBrowser(browser);
      return { success: false, error: `Navigation failed: ${navResult.error}` };
    }

    // Wait for results to load
    try {
      await page.waitForSelector(engineConfig.selectors.results, { timeout: 10000 });
    } catch {
      log.warn('Search results selector not found, trying to extract anyway');
    }

    // Get page content and parse with Cheerio
    const html = await page.content();
    const $ = parseHtml(html);

    // Extract search results
    const results: SearchResult[] = [];
    const resultElements = $(engineConfig.selectors.results);

    resultElements.each((i, el) => {
      if (i >= maxResults) return false;
      
      const $el = $(el);
      
      const titleEl = $el.find(engineConfig.selectors.title);
      const linkEl = $el.find(engineConfig.selectors.link);
      const snippetEl = $el.find(engineConfig.selectors.snippet);

      const title = titleEl.text().trim();
      let url = linkEl.attr('href') || '';
      const snippet = snippetEl.text().trim();

      // Clean up DuckDuckGo URLs
      if (engine === 'duckduckgo' && url.startsWith('//')) {
        url = 'https:' + url;
      }

      // Skip if no title or URL
      if (!title || !url) return;

      // Skip ads and non-http links
      if (!url.startsWith('http')) return;

      results.push({
        title,
        url,
        snippet,
        position: results.length + 1,
        source: engine
      });
    });

    // Cleanup
    await page.close();
    browserManager.releaseBrowser(browser);

    log.info(`Found ${results.length} search results`);

    return {
      success: true,
      data: {
        query,
        engine,
        resultCount: results.length,
        results
      }
    };

  } catch (error: any) {
    log.error(`Search failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Quick search without browser (using fetch)
 */
async function quickSearch(params: Record<string, any>): Promise<ToolResult> {
  const { query, maxResults = 5 } = params;

  if (!query) {
    return { success: false, error: 'Query is required' };
  }

  try {
    log.info(`Quick search for: ${query}`);

    // Use DuckDuckGo Instant Answer API
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract results from API response
    const results: SearchResult[] = [];

    // Abstract (main answer)
    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || '',
        snippet: data.Abstract,
        position: 1,
        source: 'duckduckgo-instant'
      });
    }

    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, maxResults - 1)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
            url: topic.FirstURL,
            snippet: topic.Text,
            position: results.length + 1,
            source: 'duckduckgo-instant'
          });
        }
      }
    }

    return {
      success: true,
      data: {
        query,
        engine: 'duckduckgo-instant',
        resultCount: results.length,
        results
      }
    };

  } catch (error: any) {
    log.error(`Quick search failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search for images
 */
async function imageSearch(params: Record<string, any>): Promise<ToolResult> {
  const { query, maxResults = 10, safeSearch = true } = params;

  if (!query) {
    return { success: false, error: 'Query is required' };
  }

  try {
    log.info(`Image search for: ${query}`);

    const browser = await browserManager.getBrowser();
    const page = await browserManager.createPage(browser);

    // Use DuckDuckGo images
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;

    await navigateTo(page, searchUrl);

    // Wait for images to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract image results
    const images = await page.evaluate((max) => {
      const results: Array<{
        url: string;
        thumbnail: string;
        title: string;
        source: string;
      }> = [];

      // DDG image selectors
      const imgElements = document.querySelectorAll('.tile--img__img, img[data-src]');
      
      imgElements.forEach((img, i) => {
        if (i >= max) return;
        
        const imgEl = img as HTMLImageElement;
        results.push({
          url: imgEl.dataset.src || imgEl.src || '',
          thumbnail: imgEl.src || '',
          title: imgEl.alt || '',
          source: 'duckduckgo-images'
        });
      });

      return results;
    }, maxResults);

    await page.close();
    browserManager.releaseBrowser(browser);

    return {
      success: true,
      data: {
        query,
        type: 'images',
        resultCount: images.length,
        results: images
      }
    };

  } catch (error: any) {
    log.error(`Image search failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Define the web_search tool
export const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web using various search engines. Returns titles, URLs, and snippets of search results.',
  category: ToolCategory.SEARCH,
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'The search query',
      required: true
    },
    {
      name: 'engine',
      type: 'string',
      description: 'Search engine to use',
      required: false,
      default: 'duckduckgo',
      enum: ['google', 'bing', 'duckduckgo']
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      default: 10
    },
    {
      name: 'safeSearch',
      type: 'boolean',
      description: 'Enable safe search filtering',
      required: false,
      default: true
    }
  ],
  execute: performSearch
};

// Define the quick_search tool (no browser needed)
export const quickSearchTool: Tool = {
  name: 'quick_search',
  description: 'Perform a quick search using DuckDuckGo Instant Answer API. Faster but returns fewer results.',
  category: ToolCategory.SEARCH,
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'The search query',
      required: true
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return',
      required: false,
      default: 5
    }
  ],
  execute: quickSearch
};

// Define the image_search tool
export const imageSearchTool: Tool = {
  name: 'image_search',
  description: 'Search for images on the web',
  category: ToolCategory.SEARCH,
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'The image search query',
      required: true
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of images to return',
      required: false,
      default: 10
    },
    {
      name: 'safeSearch',
      type: 'boolean',
      description: 'Enable safe search filtering',
      required: false,
      default: true
    }
  ],
  execute: imageSearch
};

/**
 * Register all search tools
 */
export function registerSearchTools(): void {
  toolRegistry.register(webSearchTool);
  toolRegistry.register(quickSearchTool);
  toolRegistry.register(imageSearchTool);
  log.info('Search tools registered');
}

export { performSearch, quickSearch, imageSearch };

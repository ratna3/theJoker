/**
 * The Joker - Agentic Terminal
 * Puppeteer Browser Setup with Stealth Mode
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page, LaunchOptions } from 'puppeteer';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { scraperConfig } from '../utils/config';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Browser launch configuration
 */
const DEFAULT_BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-blink-features=AutomationControlled',
  '--disable-infobars',
  '--ignore-certificate-errors',
  '--ignore-certificate-errors-spki-list',
];

/**
 * Browser pool statistics
 */
interface PoolStats {
  total: number;
  available: number;
  inUse: number;
  created: number;
  recycled: number;
}

/**
 * Browser instance wrapper
 */
interface BrowserInstance {
  browser: Browser;
  id: string;
  createdAt: Date;
  useCount: number;
  isAvailable: boolean;
}

/**
 * Browser Pool for managing multiple browser instances
 */
export class BrowserPool extends EventEmitter {
  private instances: Map<string, BrowserInstance> = new Map();
  private maxInstances: number;
  private maxUseCount: number;
  private stats: PoolStats;

  constructor(maxInstances = 3, maxUseCount = 10) {
    super();
    this.maxInstances = maxInstances;
    this.maxUseCount = maxUseCount;
    this.stats = {
      total: 0,
      available: 0,
      inUse: 0,
      created: 0,
      recycled: 0,
    };
    
    logger.debug('Browser pool initialized', { maxInstances, maxUseCount });
  }

  /**
   * Create a new browser instance
   */
  private async createBrowser(): Promise<Browser> {
    const launchOptions: LaunchOptions = {
      headless: scraperConfig.headless ? 'shell' : false,
      args: DEFAULT_BROWSER_ARGS,
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      timeout: scraperConfig.timeout,
    };

    logger.debug('Launching new browser instance', { headless: scraperConfig.headless });
    
    const browser = await puppeteer.launch(launchOptions);
    this.stats.created++;
    
    // Set up disconnect handler
    browser.on('disconnected', () => {
      logger.warn('Browser disconnected');
      this.removeInstance(browser);
    });

    return browser;
  }

  /**
   * Acquire a browser from the pool
   */
  async acquire(): Promise<Browser> {
    // Look for an available instance
    for (const [id, instance] of this.instances) {
      if (instance.isAvailable) {
        instance.isAvailable = false;
        instance.useCount++;
        this.stats.available--;
        this.stats.inUse++;
        
        // Check if instance should be recycled
        if (instance.useCount >= this.maxUseCount) {
          logger.debug('Recycling browser instance', { id, useCount: instance.useCount });
          await this.recycleInstance(id);
          return this.acquire();
        }
        
        logger.debug('Acquired browser from pool', { id, useCount: instance.useCount });
        return instance.browser;
      }
    }

    // Create new instance if pool not full
    if (this.instances.size < this.maxInstances) {
      const browser = await this.createBrowser();
      const id = `browser_${Date.now()}`;
      
      const instance: BrowserInstance = {
        browser,
        id,
        createdAt: new Date(),
        useCount: 1,
        isAvailable: false,
      };
      
      this.instances.set(id, instance);
      this.stats.total++;
      this.stats.inUse++;
      
      logger.debug('Created new browser instance', { id });
      return browser;
    }

    // Wait for an available instance
    logger.debug('Waiting for available browser instance');
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        for (const [id, instance] of this.instances) {
          if (instance.isAvailable) {
            clearInterval(checkInterval);
            instance.isAvailable = false;
            instance.useCount++;
            this.stats.available--;
            this.stats.inUse++;
            resolve(instance.browser);
            return;
          }
        }
      }, 100);
    });
  }

  /**
   * Release a browser back to the pool
   */
  release(browser: Browser): void {
    for (const [id, instance] of this.instances) {
      if (instance.browser === browser) {
        instance.isAvailable = true;
        this.stats.available++;
        this.stats.inUse--;
        logger.debug('Released browser to pool', { id });
        return;
      }
    }
    logger.warn('Browser not found in pool');
  }

  /**
   * Recycle a browser instance
   */
  private async recycleInstance(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (instance) {
      try {
        await instance.browser.close();
      } catch (error) {
        logger.error('Error closing browser', { error });
      }
      this.instances.delete(id);
      this.stats.total--;
      this.stats.recycled++;
    }
  }

  /**
   * Remove a browser instance from the pool
   */
  private removeInstance(browser: Browser): void {
    for (const [id, instance] of this.instances) {
      if (instance.browser === browser) {
        this.instances.delete(id);
        this.stats.total--;
        if (instance.isAvailable) {
          this.stats.available--;
        } else {
          this.stats.inUse--;
        }
        logger.debug('Removed browser from pool', { id });
        return;
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Close all browsers and shutdown the pool
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down browser pool');
    
    const closePromises: Promise<void>[] = [];
    
    for (const [id, instance] of this.instances) {
      closePromises.push(
        instance.browser.close().catch((error) => {
          logger.error('Error closing browser during shutdown', { id, error });
        })
      );
    }
    
    await Promise.all(closePromises);
    this.instances.clear();
    
    this.stats = {
      total: 0,
      available: 0,
      inUse: 0,
      created: this.stats.created,
      recycled: this.stats.recycled,
    };
    
    logger.info('Browser pool shutdown complete');
  }
}

/**
 * Browser Manager - Singleton for managing browser pool
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private pool: BrowserPool;

  private constructor() {
    this.pool = new BrowserPool(scraperConfig.maxConcurrent);
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Get a browser instance
   */
  async getBrowser(): Promise<Browser> {
    return this.pool.acquire();
  }

  /**
   * Release a browser instance
   */
  releaseBrowser(browser: Browser): void {
    this.pool.release(browser);
  }

  /**
   * Create a new page with common settings
   */
  async createPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent(scraperConfig.userAgent);
    
    // Set viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
    });
    
    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    // Block unnecessary resources for faster loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Set default navigation timeout
    page.setDefaultNavigationTimeout(scraperConfig.timeout);
    page.setDefaultTimeout(scraperConfig.timeout);
    
    logger.debug('Created new page with settings');
    return page;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    return this.pool.getStats();
  }

  /**
   * Shutdown the browser manager
   */
  async shutdown(): Promise<void> {
    await this.pool.shutdown();
  }
}

// Export singleton instance
export const browserManager = BrowserManager.getInstance();

export default browserManager;

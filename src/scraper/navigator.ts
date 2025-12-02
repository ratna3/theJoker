/**
 * The Joker - Agentic Terminal
 * Page Navigation Utilities
 */

import { Page, HTTPResponse } from 'puppeteer';
import { logger } from '../utils/logger';
import { scraperConfig } from '../utils/config';
import { randomDelay, handleCookieConsent, detectBlocking, humanScroll } from './stealth';

/**
 * Navigation options
 */
export interface NavigationOptions {
  /** Wait for network to be idle */
  waitForNetworkIdle?: boolean;
  /** Wait for specific selector to appear */
  waitForSelector?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Handle cookie consent automatically */
  handleCookies?: boolean;
  /** Scroll to load lazy content */
  scrollToLoad?: boolean;
  /** Take screenshot on error */
  screenshotOnError?: boolean;
}

/**
 * Navigation result
 */
export interface NavigationResult {
  success: boolean;
  url: string;
  finalUrl: string;
  status: number | null;
  redirected: boolean;
  loadTime: number;
  error?: string;
  blocked?: boolean;
  blockReason?: string;
}

/**
 * Default navigation options
 */
const DEFAULT_OPTIONS: NavigationOptions = {
  waitForNetworkIdle: true,
  timeout: scraperConfig.timeout,
  retries: 3,
  handleCookies: true,
  scrollToLoad: false,
  screenshotOnError: false,
};

/**
 * Navigate to a URL with retry logic
 */
export async function navigateTo(
  page: Page,
  url: string,
  options: NavigationOptions = {}
): Promise<NavigationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error | null = null;
  let response: HTTPResponse | null = null;

  for (let attempt = 1; attempt <= (opts.retries || 1); attempt++) {
    try {
      logger.debug('Navigating to URL', { url, attempt, maxAttempts: opts.retries });

      // Navigate to the URL
      response = await page.goto(url, {
        waitUntil: opts.waitForNetworkIdle ? 'networkidle2' : 'domcontentloaded',
        timeout: opts.timeout,
      });

      // Check for blocking
      const blockCheck = await detectBlocking(page);
      if (blockCheck.blocked) {
        logger.warn('Page appears to be blocked', { url, reason: blockCheck.reason });
        return {
          success: false,
          url,
          finalUrl: page.url(),
          status: response?.status() || null,
          redirected: url !== page.url(),
          loadTime: Date.now() - startTime,
          blocked: true,
          blockReason: blockCheck.reason,
        };
      }

      // Handle cookie consent
      if (opts.handleCookies) {
        await handleCookieConsent(page);
      }

      // Wait for specific selector if provided
      if (opts.waitForSelector) {
        await page.waitForSelector(opts.waitForSelector, { timeout: opts.timeout });
      }

      // Scroll to load lazy content
      if (opts.scrollToLoad) {
        await scrollToBottom(page);
      }

      const loadTime = Date.now() - startTime;
      logger.debug('Navigation successful', {
        url,
        finalUrl: page.url(),
        status: response?.status(),
        loadTime,
      });

      return {
        success: true,
        url,
        finalUrl: page.url(),
        status: response?.status() || null,
        redirected: url !== page.url(),
        loadTime,
      };
    } catch (error) {
      lastError = error as Error;
      logger.warn('Navigation attempt failed', {
        url,
        attempt,
        error: lastError.message,
      });

      if (attempt < (opts.retries || 1)) {
        // Wait before retrying
        await randomDelay(1000, 3000);
      }
    }
  }

  // All attempts failed
  logger.error('Navigation failed after all retries', {
    url,
    attempts: opts.retries,
    error: lastError?.message,
  });

  return {
    success: false,
    url,
    finalUrl: page.url(),
    status: response?.status() || null,
    redirected: false,
    loadTime: Date.now() - startTime,
    error: lastError?.message,
  };
}

/**
 * Wait for a selector to appear with custom timeout
 */
export async function waitForContent(
  page: Page,
  selector: string,
  timeout?: number
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, {
      timeout: timeout || scraperConfig.timeout,
      visible: true,
    });
    return true;
  } catch (error) {
    logger.warn('Timeout waiting for selector', { selector });
    return false;
  }
}

/**
 * Scroll to the bottom of the page to load lazy content
 */
export async function scrollToBottom(page: Page): Promise<void> {
  logger.debug('Scrolling to bottom of page');

  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  // Wait for any lazy-loaded content
  await randomDelay(500, 1000);
}

/**
 * Scroll down by a specific amount with human-like behavior
 */
export async function scrollDown(page: Page, pixels = 500): Promise<void> {
  await humanScroll(page, 'down', pixels);
  await randomDelay(200, 500);
}

/**
 * Scroll up by a specific amount with human-like behavior
 */
export async function scrollUp(page: Page, pixels = 500): Promise<void> {
  await humanScroll(page, 'up', pixels);
  await randomDelay(200, 500);
}

/**
 * Handle popups and new tabs
 */
export async function handlePopups(page: Page): Promise<number> {
  let closedCount = 0;

  // Close dialogs
  page.on('dialog', async (dialog) => {
    logger.debug('Dialog detected', { type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
    closedCount++;
  });

  // Handle new page targets (popups)
  const browser = page.browser();
  const pages = await browser.pages();
  
  for (const p of pages) {
    if (p !== page && p.url() !== 'about:blank') {
      await p.close();
      closedCount++;
      logger.debug('Closed popup page', { url: p.url() });
    }
  }

  return closedCount;
}

/**
 * Take a screenshot for debugging
 */
export async function captureScreenshot(
  page: Page,
  path: string,
  fullPage = true
): Promise<boolean> {
  try {
    await page.screenshot({
      path,
      fullPage,
      type: 'png',
    });
    logger.debug('Screenshot captured', { path });
    return true;
  } catch (error) {
    logger.error('Failed to capture screenshot', { path, error });
    return false;
  }
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    page.evaluate(() => {
      return new Promise<void>((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', () => resolve());
        }
      });
    }),
  ]);
}

/**
 * Check if page has specific content
 */
export async function hasContent(page: Page, text: string): Promise<boolean> {
  const content = await page.content();
  return content.toLowerCase().includes(text.toLowerCase());
}

/**
 * Get the current page title
 */
export async function getPageTitle(page: Page): Promise<string> {
  return page.title();
}

/**
 * Get the current page URL
 */
export function getCurrentUrl(page: Page): string {
  return page.url();
}

/**
 * Refresh the page
 */
export async function refreshPage(page: Page): Promise<NavigationResult> {
  const url = page.url();
  return navigateTo(page, url, { retries: 1 });
}

/**
 * Go back in history
 */
export async function goBack(page: Page): Promise<boolean> {
  try {
    await page.goBack({ waitUntil: 'networkidle2' });
    return true;
  } catch (error) {
    logger.warn('Failed to go back', { error });
    return false;
  }
}

/**
 * Go forward in history
 */
export async function goForward(page: Page): Promise<boolean> {
  try {
    await page.goForward({ waitUntil: 'networkidle2' });
    return true;
  } catch (error) {
    logger.warn('Failed to go forward', { error });
    return false;
  }
}

/**
 * Navigator class for managing page navigation
 */
export class PageNavigator {
  private page: Page;
  private history: string[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string, options?: NavigationOptions): Promise<NavigationResult> {
    const result = await navigateTo(this.page, url, options);
    if (result.success) {
      this.history.push(result.finalUrl);
    }
    return result;
  }

  /**
   * Get navigation history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Clear navigation history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get current URL
   */
  currentUrl(): string {
    return getCurrentUrl(this.page);
  }

  /**
   * Scroll to bottom
   */
  async scrollToBottom(): Promise<void> {
    return scrollToBottom(this.page);
  }

  /**
   * Take screenshot
   */
  async screenshot(path: string): Promise<boolean> {
    return captureScreenshot(this.page, path);
  }

  /**
   * Refresh page
   */
  async refresh(): Promise<NavigationResult> {
    return refreshPage(this.page);
  }
}

export default PageNavigator;

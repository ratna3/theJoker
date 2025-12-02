/**
 * The Joker - Agentic Terminal
 * Anti-Detection Stealth Utilities
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Page } from 'puppeteer';
import { logger } from '../utils/logger';

/**
 * Collection of user agents for rotation
 */
const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  // Chrome on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  // Firefox on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  // Safari on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

/**
 * Common screen resolutions for fingerprint variation
 */
const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
];

/**
 * Get a random user agent
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get a random screen resolution
 */
export function getRandomResolution(): { width: number; height: number } {
  return SCREEN_RESOLUTIONS[Math.floor(Math.random() * SCREEN_RESOLUTIONS.length)];
}

/**
 * Add a random delay to simulate human behavior
 */
export async function randomDelay(minMs = 500, maxMs = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Add a short random delay for typing simulation
 */
export async function typingDelay(): Promise<void> {
  await randomDelay(50, 150);
}

/**
 * Simulate human-like mouse movement to a position
 */
export async function humanMouseMove(
  page: Page,
  targetX: number,
  targetY: number,
  steps = 10
): Promise<void> {
  const mouse = page.mouse;
  
  // Get current position (start from center if first move)
  const startX = Math.random() * 500 + 200;
  const startY = Math.random() * 300 + 200;
  
  // Calculate step increments with some randomness
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Use easing function for more natural movement
    const easedProgress = easeInOutQuad(progress);
    
    const currentX = startX + (targetX - startX) * easedProgress + (Math.random() - 0.5) * 10;
    const currentY = startY + (targetY - startY) * easedProgress + (Math.random() - 0.5) * 10;
    
    await mouse.move(currentX, currentY);
    await randomDelay(10, 30);
  }
}

/**
 * Easing function for natural movement
 */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Simulate human-like clicking
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  try {
    const element = await page.$(selector);
    if (!element) {
      logger.warn('Element not found for click', { selector });
      return;
    }
    
    const box = await element.boundingBox();
    if (!box) {
      logger.warn('Could not get bounding box for element', { selector });
      return;
    }
    
    // Click at a random point within the element
    const x = box.x + Math.random() * box.width;
    const y = box.y + Math.random() * box.height;
    
    await humanMouseMove(page, x, y);
    await randomDelay(100, 300);
    await page.mouse.click(x, y);
    
    logger.debug('Human-like click performed', { selector, x, y });
  } catch (error) {
    logger.error('Error during human click', { error, selector });
    throw error;
  }
}

/**
 * Simulate human-like typing
 */
export async function humanType(page: Page, text: string): Promise<void> {
  for (const char of text) {
    await page.keyboard.type(char);
    await typingDelay();
  }
}

/**
 * Simulate human-like scrolling
 */
export async function humanScroll(
  page: Page,
  direction: 'up' | 'down' = 'down',
  amount = 300
): Promise<void> {
  const scrollAmount = direction === 'down' ? amount : -amount;
  
  // Scroll in smaller increments
  const steps = 5;
  const stepAmount = scrollAmount / steps;
  
  for (let i = 0; i < steps; i++) {
    await page.evaluate((delta) => {
      window.scrollBy(0, delta);
    }, stepAmount + (Math.random() - 0.5) * 50);
    await randomDelay(50, 150);
  }
}

/**
 * Handle cookie consent banners
 */
export async function handleCookieConsent(page: Page): Promise<boolean> {
  const cookieSelectors = [
    // Common cookie consent button selectors
    'button[id*="accept"]',
    'button[id*="cookie"]',
    'button[class*="accept"]',
    'button[class*="cookie"]',
    '[data-testid*="cookie"]',
    '#onetrust-accept-btn-handler',
    '.cc-accept',
    '.cc-allow',
    '.cookie-accept',
    '.accept-cookies',
    '#accept-cookies',
    '.gdpr-accept',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '.js-accept-cookies',
    '[aria-label*="Accept"]',
    '[aria-label*="accept"]',
  ];

  for (const selector of cookieSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isIntersectingViewport();
        if (isVisible) {
          await button.click();
          await randomDelay(500, 1000);
          logger.debug('Cookie consent handled', { selector });
          return true;
        }
      }
    } catch {
      // Ignore errors for individual selectors
    }
  }

  return false;
}

/**
 * Detect if we've been blocked or need to solve CAPTCHA
 */
export async function detectBlocking(page: Page): Promise<{
  blocked: boolean;
  reason?: 'captcha' | 'rate_limit' | 'access_denied' | 'unknown';
}> {
  const pageContent = await page.content();
  const pageTitle = await page.title();
  const url = page.url();

  // Check for CAPTCHA
  const captchaIndicators = [
    'recaptcha',
    'hcaptcha',
    'captcha',
    'challenge-running',
    'cf-browser-verification',
    'please verify you are human',
    'prove you are not a robot',
  ];

  for (const indicator of captchaIndicators) {
    if (
      pageContent.toLowerCase().includes(indicator) ||
      pageTitle.toLowerCase().includes(indicator)
    ) {
      logger.warn('CAPTCHA detected', { url });
      return { blocked: true, reason: 'captcha' };
    }
  }

  // Check for rate limiting
  const rateLimitIndicators = [
    'rate limit',
    'too many requests',
    '429',
    'slow down',
  ];

  for (const indicator of rateLimitIndicators) {
    if (pageContent.toLowerCase().includes(indicator)) {
      logger.warn('Rate limiting detected', { url });
      return { blocked: true, reason: 'rate_limit' };
    }
  }

  // Check for access denied
  const accessDeniedIndicators = [
    'access denied',
    'forbidden',
    '403',
    'blocked',
    'not authorized',
  ];

  for (const indicator of accessDeniedIndicators) {
    if (
      pageContent.toLowerCase().includes(indicator) ||
      pageTitle.toLowerCase().includes(indicator)
    ) {
      logger.warn('Access denied detected', { url });
      return { blocked: true, reason: 'access_denied' };
    }
  }

  return { blocked: false };
}

/**
 * Apply stealth settings to a page
 */
export async function applyStealthSettings(page: Page): Promise<void> {
  // Override navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  // Override navigator.plugins
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin' },
        { name: 'Chrome PDF Viewer' },
        { name: 'Native Client' },
      ],
    });
  });

  // Override navigator.languages
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  // Add chrome runtime
  await page.evaluateOnNewDocument(() => {
    (window as any).chrome = {
      runtime: {},
    };
  });

  // Override permissions
  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query;
    (window.navigator.permissions.query as any) = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
  });

  logger.debug('Stealth settings applied to page');
}

/**
 * Stealth manager for coordinating anti-detection measures
 */
export class StealthManager {
  private usedUserAgents: Set<string> = new Set();
  private lastRotation: Date = new Date();
  private rotationInterval = 5 * 60 * 1000; // 5 minutes

  /**
   * Get a fresh user agent, avoiding recently used ones
   */
  getNextUserAgent(): string {
    // Rotate if all have been used or enough time has passed
    const now = new Date();
    if (
      this.usedUserAgents.size >= USER_AGENTS.length ||
      now.getTime() - this.lastRotation.getTime() > this.rotationInterval
    ) {
      this.usedUserAgents.clear();
      this.lastRotation = now;
    }

    // Find an unused user agent
    let userAgent = getRandomUserAgent();
    let attempts = 0;
    while (this.usedUserAgents.has(userAgent) && attempts < USER_AGENTS.length) {
      userAgent = getRandomUserAgent();
      attempts++;
    }

    this.usedUserAgents.add(userAgent);
    return userAgent;
  }

  /**
   * Apply all stealth measures to a page
   */
  async preparePage(page: Page): Promise<void> {
    const userAgent = this.getNextUserAgent();
    const resolution = getRandomResolution();

    await page.setUserAgent(userAgent);
    await page.setViewport(resolution);
    await applyStealthSettings(page);

    logger.debug('Page prepared with stealth measures', {
      userAgent: userAgent.substring(0, 50) + '...',
      resolution,
    });
  }
}

// Export singleton
export const stealthManager = new StealthManager();

export default stealthManager;

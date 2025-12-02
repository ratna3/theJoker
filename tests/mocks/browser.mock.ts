/**
 * Browser/Scraper Mock Utilities
 * Phase 10: Testing & Optimization
 * 
 * Mock implementations for Puppeteer browser and page objects
 */

// ============================================
// Mock Page
// ============================================

export class MockPage {
  private _content: string = '<html><body>Mock content</body></html>';
  private _url: string = 'https://example.com';
  private _title: string = 'Mock Page';
  private _cookies: Array<{ name: string; value: string }> = [];
  private _closed: boolean = false;

  setContent(content: string): void {
    this._content = content;
  }

  setUrl(url: string): void {
    this._url = url;
  }

  setTitle(title: string): void {
    this._title = title;
  }

  async goto(url: string): Promise<void> {
    this._url = url;
  }

  async content(): Promise<string> {
    return this._content;
  }

  async url(): Promise<string> {
    return this._url;
  }

  async title(): Promise<string> {
    return this._title;
  }

  async evaluate<T>(fn: () => T): Promise<T> {
    // Simple evaluation mock - just return the function result
    return fn();
  }

  async $(selector: string): Promise<MockElement | null> {
    if (this._content.includes(selector.replace('.', '').replace('#', ''))) {
      return new MockElement(selector);
    }
    return null;
  }

  async $$(selector: string): Promise<MockElement[]> {
    return [new MockElement(selector)];
  }

  async $eval<T>(selector: string, fn: (el: Element) => T): Promise<T> {
    const mockElement = { textContent: 'Mock text', innerHTML: '<span>Mock</span>' };
    return fn(mockElement as unknown as Element);
  }

  async $$eval<T>(selector: string, fn: (els: Element[]) => T): Promise<T> {
    const mockElements = [
      { textContent: 'Mock text 1', innerHTML: '<span>Mock 1</span>' },
      { textContent: 'Mock text 2', innerHTML: '<span>Mock 2</span>' },
    ];
    return fn(mockElements as unknown as Element[]);
  }

  async waitForSelector(selector: string, options?: { timeout?: number }): Promise<MockElement> {
    return new MockElement(selector);
  }

  async waitForNavigation(): Promise<void> {
    // No-op
  }

  async waitForNetworkIdle(): Promise<void> {
    // No-op
  }

  async screenshot(options?: { path?: string }): Promise<Buffer> {
    return Buffer.from('mock screenshot');
  }

  async setCookie(...cookies: Array<{ name: string; value: string }>): Promise<void> {
    this._cookies.push(...cookies);
  }

  async cookies(): Promise<Array<{ name: string; value: string }>> {
    return this._cookies;
  }

  async close(): Promise<void> {
    this._closed = true;
  }

  isClosed(): boolean {
    return this._closed;
  }

  async setViewport(viewport: { width: number; height: number }): Promise<void> {
    // No-op
  }

  async setUserAgent(userAgent: string): Promise<void> {
    // No-op
  }

  async click(selector: string): Promise<void> {
    // No-op
  }

  async type(selector: string, text: string): Promise<void> {
    // No-op
  }
}

// ============================================
// Mock Element
// ============================================

export class MockElement {
  constructor(private selector: string) {}

  async click(): Promise<void> {
    // No-op
  }

  async type(text: string): Promise<void> {
    // No-op
  }

  async evaluate<T>(fn: (el: Element) => T): Promise<T> {
    const mockElement = { textContent: 'Mock text', innerHTML: '<span>Mock</span>' };
    return fn(mockElement as unknown as Element);
  }

  async getProperty(name: string): Promise<{ jsonValue: () => Promise<string> }> {
    return {
      jsonValue: async () => `Mock ${name}`,
    };
  }
}

// ============================================
// Mock Browser
// ============================================

export class MockBrowser {
  private _pages: MockPage[] = [];
  private _closed: boolean = false;

  async newPage(): Promise<MockPage> {
    const page = new MockPage();
    this._pages.push(page);
    return page;
  }

  async pages(): Promise<MockPage[]> {
    return this._pages;
  }

  async close(): Promise<void> {
    this._closed = true;
    for (const page of this._pages) {
      await page.close();
    }
  }

  isConnected(): boolean {
    return !this._closed;
  }
}

// ============================================
// Mock Browser Pool
// ============================================

export class MockBrowserPool {
  private browsers: MockBrowser[] = [];
  private maxBrowsers: number = 3;
  private currentIndex: number = 0;

  async acquire(): Promise<MockBrowser> {
    if (this.browsers.length < this.maxBrowsers) {
      const browser = new MockBrowser();
      this.browsers.push(browser);
      return browser;
    }
    // Round-robin reuse
    this.currentIndex = (this.currentIndex + 1) % this.browsers.length;
    return this.browsers[this.currentIndex];
  }

  async release(browser: MockBrowser): Promise<void> {
    // No-op in mock
  }

  async drain(): Promise<void> {
    for (const browser of this.browsers) {
      await browser.close();
    }
    this.browsers = [];
  }

  getStats() {
    return {
      total: this.browsers.length,
      active: this.browsers.filter(b => b.isConnected()).length,
      idle: 0,
    };
  }
}

// ============================================
// Mock Scraper Results
// ============================================

export interface MockScrapedData {
  title: string;
  url: string;
  content: string;
  links: string[];
}

export function createMockScrapedData(overrides: Partial<MockScrapedData> = {}): MockScrapedData {
  return {
    title: 'Mock Page Title',
    url: 'https://example.com/page',
    content: 'This is mock scraped content from the page.',
    links: [
      'https://example.com/link1',
      'https://example.com/link2',
      'https://example.com/link3',
    ],
    ...overrides,
  };
}

export function createMockSearchResults(count: number = 5): MockScrapedData[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Search Result ${i + 1}`,
    url: `https://example.com/result${i + 1}`,
    content: `Content for search result ${i + 1}`,
    links: [`https://example.com/result${i + 1}/detail`],
  }));
}

// ============================================
// Singleton Instances
// ============================================

export const mockBrowserPool = new MockBrowserPool();
export const mockBrowser = new MockBrowser();
export const mockPage = new MockPage();

// ============================================
// Factory Functions
// ============================================

export function createMockPage(content?: string): MockPage {
  const page = new MockPage();
  if (content) {
    page.setContent(content);
  }
  return page;
}

export function createMockBrowser(): MockBrowser {
  return new MockBrowser();
}

export function createMockBrowserPool(): MockBrowserPool {
  return new MockBrowserPool();
}

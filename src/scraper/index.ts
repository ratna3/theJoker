/**
 * The Joker - Agentic Terminal
 * Scraper Module Index
 */

// Browser management
export { BrowserPool, BrowserManager, browserManager } from './browser';

// Navigation utilities
export {
  navigateTo,
  waitForContent,
  scrollToBottom,
  scrollDown,
  scrollUp,
  handlePopups,
  captureScreenshot,
  waitForPageLoad,
  hasContent,
  getPageTitle,
  getCurrentUrl,
  refreshPage,
  goBack,
  goForward,
  PageNavigator,
  NavigationOptions,
  NavigationResult,
} from './navigator';

// Data extraction
export {
  cleanText,
  extractText,
  extractBySelectors,
  extractLinks,
  extractImages,
  extractMetadata,
  querySelectorAll,
  extractByXPath,
  extractTable,
  scrapePage,
  parseHtml,
  extractFromHtml,
  extractGoogleResults,
  DataExtractor,
  ExtractionConfig,
  ElementData,
} from './extractor';

// Stealth utilities
export {
  getRandomUserAgent,
  getRandomResolution,
  randomDelay,
  typingDelay,
  humanMouseMove,
  humanClick,
  humanType,
  humanScroll,
  handleCookieConsent,
  detectBlocking,
  applyStealthSettings,
  StealthManager,
  stealthManager,
} from './stealth';

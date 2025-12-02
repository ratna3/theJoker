/**
 * Utils Module - Utility functions and classes for The Joker
 */

// Configuration
export { 
    paths, 
    llmConfig, 
    logConfig, 
    scraperConfig, 
    agentConfig 
} from './config.js';

// Logger
export { logger, log } from './logger.js';

// Data Cleaner (Phase 8)
export {
    DataCleaner,
    stripHtml,
    normalizeWhitespace,
    deduplicate,
    cleanUrl,
    extractDomain,
    sanitize,
} from './cleaner.js';
export type { SanitizeOptions } from './cleaner.js';

// Link Validator (Phase 8)
export {
    LinkValidator,
    validateLink,
    validateLinks,
    isValidUrl,
    isRelativeUrl,
    extractLinks,
} from './links.js';
export type {
    ValidatedLink,
    ValidationOptions,
    BatchValidationResult,
} from './links.js';

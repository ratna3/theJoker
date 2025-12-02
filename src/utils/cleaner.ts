/**
 * Data Cleaner - Utilities for sanitizing and cleaning scraped data
 * Phase 8: Data Processing & Output Formatting
 */

/**
 * Options for text sanitization
 */
export interface SanitizeOptions {
    removeHtml?: boolean;
    normalizeWhitespace?: boolean;
    trimLines?: boolean;
    maxLength?: number;
    lowercase?: boolean;
    removeUrls?: boolean;
    removeEmails?: boolean;
    removeSpecialChars?: boolean;
}

/**
 * Default sanitization options
 */
const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = {
    removeHtml: true,
    normalizeWhitespace: true,
    trimLines: true,
    maxLength: undefined,
    lowercase: false,
    removeUrls: false,
    removeEmails: false,
    removeSpecialChars: false,
};

/**
 * DataCleaner class - Comprehensive data cleaning utilities
 */
export class DataCleaner {
    /**
     * Strip HTML tags from text
     * @param text - Text containing HTML
     * @returns Clean text without HTML tags
     */
    static stripHtml(text: string): string {
        if (!text) return '';

        return text
            // Remove script and style elements entirely
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            // Remove HTML comments
            .replace(/<!--[\s\S]*?-->/g, '')
            // Replace block elements with newlines
            .replace(/<\/?(p|div|br|hr|h[1-6]|ul|ol|li|table|tr|td|th|blockquote|pre|article|section|header|footer|nav|aside)[^>]*>/gi, '\n')
            // Remove remaining HTML tags
            .replace(/<[^>]+>/g, '')
            // Decode HTML entities
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&apos;/gi, "'")
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
            .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
            // Clean up extra whitespace
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
    }

    /**
     * Normalize whitespace in text
     * @param text - Text with irregular whitespace
     * @returns Text with normalized whitespace
     */
    static normalizeWhitespace(text: string): string {
        if (!text) return '';

        return text
            // Replace multiple spaces with single space
            .replace(/[ \t]+/g, ' ')
            // Replace multiple newlines with double newline
            .replace(/\n{3,}/g, '\n\n')
            // Trim each line
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            // Final trim
            .trim();
    }

    /**
     * Remove duplicate items from array based on a key
     * @param items - Array of items
     * @param key - Key to use for deduplication
     * @returns Deduplicated array
     */
    static deduplicate<T extends Record<string, unknown>>(items: T[], key: keyof T): T[] {
        if (!items || items.length === 0) return [];

        const seen = new Set<unknown>();
        return items.filter(item => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }

    /**
     * Deduplicate array of primitives
     * @param items - Array of primitive values
     * @returns Deduplicated array
     */
    static deduplicateSimple<T>(items: T[]): T[] {
        if (!items || items.length === 0) return [];
        return [...new Set(items)];
    }

    /**
     * Clean and normalize a URL
     * @param url - URL to clean
     * @returns Cleaned URL
     */
    static cleanUrl(url: string): string {
        if (!url) return '';

        try {
            // Handle relative URLs by just cleaning them
            if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
                return url
                    .replace(/\s+/g, '')
                    .replace(/([^:])\/+/g, '$1/')
                    .trim();
            }

            // Add protocol if missing
            let normalizedUrl = url.trim();
            if (!normalizedUrl.match(/^https?:\/\//i)) {
                normalizedUrl = 'https://' + normalizedUrl;
            }

            const urlObj = new URL(normalizedUrl);

            // Remove default ports
            if ((urlObj.protocol === 'https:' && urlObj.port === '443') ||
                (urlObj.protocol === 'http:' && urlObj.port === '80')) {
                urlObj.port = '';
            }

            // Remove trailing slashes from path (except root)
            if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
                urlObj.pathname = urlObj.pathname.slice(0, -1);
            }

            // Remove common tracking parameters
            const trackingParams = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'fbclid', 'gclid', 'msclkid', 'ref', 'source'
            ];
            trackingParams.forEach(param => urlObj.searchParams.delete(param));

            // Sort remaining params for consistency
            urlObj.searchParams.sort();

            return urlObj.toString();
        } catch {
            // If URL parsing fails, return cleaned original
            return url.trim().replace(/\s+/g, '');
        }
    }

    /**
     * Extract domain from URL
     * @param url - URL to extract domain from
     * @returns Domain name or empty string
     */
    static extractDomain(url: string): string {
        if (!url) return '';

        try {
            let normalizedUrl = url.trim();
            if (!normalizedUrl.match(/^https?:\/\//i)) {
                normalizedUrl = 'https://' + normalizedUrl;
            }

            const urlObj = new URL(normalizedUrl);
            return urlObj.hostname;
        } catch {
            // Try to extract domain manually
            const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
            return match ? match[1] : '';
        }
    }

    /**
     * Extract base domain (without subdomains)
     * @param url - URL to extract base domain from
     * @returns Base domain name
     */
    static extractBaseDomain(url: string): string {
        const domain = this.extractDomain(url);
        if (!domain) return '';

        // Common TLDs that have two parts (e.g., co.uk, com.au)
        const multiPartTlds = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.za'];
        
        const parts = domain.split('.');
        if (parts.length <= 2) return domain;

        // Check for multi-part TLDs
        const lastTwo = parts.slice(-2).join('.');
        if (multiPartTlds.includes(lastTwo)) {
            return parts.slice(-3).join('.');
        }

        return parts.slice(-2).join('.');
    }

    /**
     * Comprehensive text sanitization
     * @param text - Text to sanitize
     * @param options - Sanitization options
     * @returns Sanitized text
     */
    static sanitize(text: string, options: SanitizeOptions = {}): string {
        if (!text) return '';

        const opts = { ...DEFAULT_SANITIZE_OPTIONS, ...options };
        let result = text;

        // Remove HTML if requested
        if (opts.removeHtml) {
            result = this.stripHtml(result);
        }

        // Remove URLs if requested
        if (opts.removeUrls) {
            result = result.replace(/https?:\/\/[^\s]+/g, '');
        }

        // Remove emails if requested
        if (opts.removeEmails) {
            result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
        }

        // Remove special characters if requested
        if (opts.removeSpecialChars) {
            result = result.replace(/[^\w\s.,!?'"()-]/g, '');
        }

        // Normalize whitespace if requested
        if (opts.normalizeWhitespace) {
            result = this.normalizeWhitespace(result);
        }

        // Trim lines if requested
        if (opts.trimLines) {
            result = result.split('\n').map(line => line.trim()).join('\n');
        }

        // Lowercase if requested
        if (opts.lowercase) {
            result = result.toLowerCase();
        }

        // Truncate if max length specified
        if (opts.maxLength && result.length > opts.maxLength) {
            result = result.substring(0, opts.maxLength - 3) + '...';
        }

        return result.trim();
    }

    /**
     * Clean text for display (remove excessive newlines, normalize spacing)
     * @param text - Text to clean for display
     * @returns Display-ready text
     */
    static cleanForDisplay(text: string): string {
        if (!text) return '';

        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .split('\n')
            .map(line => line.trim())
            .filter((line, index, arr) => {
                // Remove duplicate empty lines
                if (line === '' && index > 0 && arr[index - 1] === '') {
                    return false;
                }
                return true;
            })
            .join('\n')
            .trim();
    }

    /**
     * Extract text content from mixed content (useful for scraped data)
     * @param content - Mixed content that may contain HTML, scripts, etc.
     * @returns Clean text content
     */
    static extractText(content: string): string {
        if (!content) return '';

        return this.sanitize(content, {
            removeHtml: true,
            normalizeWhitespace: true,
            trimLines: true,
        });
    }

    /**
     * Clean and validate JSON string
     * @param jsonString - JSON string to clean
     * @returns Cleaned JSON string or null if invalid
     */
    static cleanJson(jsonString: string): string | null {
        if (!jsonString) return null;

        try {
            // Try to extract JSON from markdown code blocks
            const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                jsonString = codeBlockMatch[1];
            }

            // Remove leading/trailing whitespace
            jsonString = jsonString.trim();

            // Try to find JSON object or array
            const jsonMatch = jsonString.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (jsonMatch) {
                jsonString = jsonMatch[1];
            }

            // Parse and re-stringify to ensure valid JSON
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed);
        } catch {
            return null;
        }
    }

    /**
     * Remove common boilerplate text from scraped content
     * @param text - Text with potential boilerplate
     * @param patterns - Additional patterns to remove
     * @returns Cleaned text
     */
    static removeBoilerplate(text: string, patterns: RegExp[] = []): string {
        if (!text) return '';

        let result = text;

        // Common boilerplate patterns
        const defaultPatterns = [
            /cookie\s+(policy|consent|notice)/gi,
            /accept\s+(all\s+)?cookies?/gi,
            /privacy\s+policy/gi,
            /terms\s+(of\s+)?(service|use)/gi,
            /subscribe\s+to\s+(?:our\s+)?newsletter/gi,
            /sign\s+up\s+for\s+(?:our\s+)?(?:free\s+)?newsletter/gi,
            /follow\s+us\s+on\s+(?:social\s+media|twitter|facebook|instagram)/gi,
            /share\s+(?:this\s+)?(?:on|to)\s+(?:facebook|twitter|linkedin)/gi,
            /©\s*\d{4}/g,
            /all\s+rights\s+reserved/gi,
        ];

        const allPatterns = [...defaultPatterns, ...patterns];
        
        for (const pattern of allPatterns) {
            result = result.replace(pattern, '');
        }

        return this.normalizeWhitespace(result);
    }

    /**
     * Truncate text intelligently (at word boundaries)
     * @param text - Text to truncate
     * @param maxLength - Maximum length
     * @param suffix - Suffix to add when truncated
     * @returns Truncated text
     */
    static truncate(text: string, maxLength: number, suffix: string = '...'): string {
        if (!text || text.length <= maxLength) return text;

        const targetLength = maxLength - suffix.length;
        let truncated = text.substring(0, targetLength);

        // Try to break at word boundary
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > targetLength * 0.8) {
            truncated = truncated.substring(0, lastSpace);
        }

        return truncated.trim() + suffix;
    }

    /**
     * Extract sentences from text
     * @param text - Text to extract sentences from
     * @returns Array of sentences
     */
    static extractSentences(text: string): string[] {
        if (!text) return [];

        const cleanText = this.normalizeWhitespace(text);
        
        // Split by sentence-ending punctuation
        const sentences = cleanText
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        return sentences;
    }

    /**
     * Extract keywords from text (simple implementation)
     * @param text - Text to extract keywords from
     * @param minLength - Minimum word length
     * @returns Array of keywords
     */
    static extractKeywords(text: string, minLength: number = 4): string[] {
        if (!text) return [];

        const cleanText = this.sanitize(text, {
            removeHtml: true,
            normalizeWhitespace: true,
            lowercase: true,
            removeUrls: true,
            removeSpecialChars: true,
        });

        // Common stop words to filter out
        const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
            'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been',
            'would', 'could', 'there', 'their', 'what', 'when', 'which', 'this',
            'that', 'with', 'from', 'they', 'will', 'more', 'some', 'than',
            'them', 'then', 'into', 'just', 'about', 'over', 'such', 'only',
        ]);

        const words = cleanText
            .split(/\s+/)
            .filter(word => word.length >= minLength && !stopWords.has(word));

        // Count word frequency
        const frequency = new Map<string, number>();
        for (const word of words) {
            frequency.set(word, (frequency.get(word) || 0) + 1);
        }

        // Sort by frequency and return unique keywords
        return Array.from(frequency.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([word]) => word);
    }
}

// Export convenience functions
export const stripHtml = DataCleaner.stripHtml;
export const normalizeWhitespace = DataCleaner.normalizeWhitespace;
export const deduplicate = DataCleaner.deduplicate;
export const cleanUrl = DataCleaner.cleanUrl;
export const extractDomain = DataCleaner.extractDomain;
export const sanitize = DataCleaner.sanitize;

/**
 * Link Validator - Utilities for validating and processing URLs
 * Phase 8: Data Processing & Output Formatting
 */

/**
 * Result of URL validation
 */
export interface ValidatedLink {
    url: string;
    originalUrl: string;
    isValid: boolean;
    isAccessible: boolean;
    statusCode: number | null;
    redirectedUrl: string | null;
    error: string | null;
    responseTime: number | null;
    contentType: string | null;
    lastChecked: Date;
}

/**
 * Options for link validation
 */
export interface ValidationOptions {
    timeout?: number;
    followRedirects?: boolean;
    maxRedirects?: number;
    checkAccessibility?: boolean;
    validateProtocol?: boolean;
    allowedProtocols?: string[];
    userAgent?: string;
}

/**
 * Default validation options
 */
const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
    timeout: 10000,
    followRedirects: true,
    maxRedirects: 5,
    checkAccessibility: true,
    validateProtocol: true,
    allowedProtocols: ['http:', 'https:'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * Batch validation result
 */
export interface BatchValidationResult {
    total: number;
    valid: number;
    invalid: number;
    accessible: number;
    inaccessible: number;
    results: ValidatedLink[];
    duration: number;
}

/**
 * LinkValidator class - Comprehensive URL validation utilities
 */
export class LinkValidator {
    private options: ValidationOptions;

    constructor(options: ValidationOptions = {}) {
        this.options = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    }

    /**
     * Validate a URL for proper format
     * @param url - URL to validate
     * @returns Validation result
     */
    async validate(url: string): Promise<ValidatedLink> {
        const startTime = Date.now();
        const result: ValidatedLink = {
            url: url,
            originalUrl: url,
            isValid: false,
            isAccessible: false,
            statusCode: null,
            redirectedUrl: null,
            error: null,
            responseTime: null,
            contentType: null,
            lastChecked: new Date(),
        };

        try {
            // Check if URL is empty
            if (!url || url.trim() === '') {
                result.error = 'Empty URL';
                return result;
            }

            // Try to parse the URL
            let parsedUrl: URL;
            try {
                // Handle relative URLs
                if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
                    result.isValid = true;
                    result.error = 'Relative URL - cannot validate accessibility';
                    return result;
                }

                // Add protocol if missing
                let normalizedUrl = url.trim();
                if (!normalizedUrl.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
                    normalizedUrl = 'https://' + normalizedUrl;
                }

                parsedUrl = new URL(normalizedUrl);
                result.url = parsedUrl.toString();
            } catch {
                result.error = 'Invalid URL format';
                return result;
            }

            // Validate protocol
            if (this.options.validateProtocol && this.options.allowedProtocols) {
                if (!this.options.allowedProtocols.includes(parsedUrl.protocol)) {
                    result.error = `Protocol not allowed: ${parsedUrl.protocol}`;
                    return result;
                }
            }

            // URL format is valid
            result.isValid = true;

            // Check accessibility if requested
            if (this.options.checkAccessibility) {
                const accessibilityResult = await this.checkAccessibilityInternal(
                    parsedUrl.toString()
                );
                result.isAccessible = accessibilityResult.accessible;
                result.statusCode = accessibilityResult.statusCode;
                result.redirectedUrl = accessibilityResult.finalUrl;
                result.contentType = accessibilityResult.contentType;
                result.responseTime = accessibilityResult.responseTime;
                if (accessibilityResult.error) {
                    result.error = accessibilityResult.error;
                }
            }
        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
        }

        result.responseTime = Date.now() - startTime;
        return result;
    }

    /**
     * Validate multiple URLs in batch
     * @param urls - Array of URLs to validate
     * @param concurrency - Number of concurrent validations
     * @returns Batch validation result
     */
    async validateBatch(urls: string[], concurrency: number = 5): Promise<BatchValidationResult> {
        const startTime = Date.now();
        const uniqueUrls = [...new Set(urls.filter(url => url && url.trim()))];
        
        const results: ValidatedLink[] = [];
        
        // Process in chunks for concurrency control
        for (let i = 0; i < uniqueUrls.length; i += concurrency) {
            const chunk = uniqueUrls.slice(i, i + concurrency);
            const chunkResults = await Promise.all(
                chunk.map(url => this.validate(url))
            );
            results.push(...chunkResults);
        }

        const valid = results.filter(r => r.isValid).length;
        const accessible = results.filter(r => r.isAccessible).length;

        return {
            total: results.length,
            valid,
            invalid: results.length - valid,
            accessible,
            inaccessible: results.length - accessible,
            results,
            duration: Date.now() - startTime,
        };
    }

    /**
     * Check if a URL is accessible
     * @param url - URL to check
     * @returns True if accessible
     */
    async checkAccessibility(url: string): Promise<boolean> {
        const result = await this.checkAccessibilityInternal(url);
        return result.accessible;
    }

    /**
     * Internal accessibility check with detailed results
     */
    private async checkAccessibilityInternal(url: string): Promise<{
        accessible: boolean;
        statusCode: number | null;
        finalUrl: string | null;
        contentType: string | null;
        responseTime: number;
        error: string | null;
    }> {
        const startTime = Date.now();
        
        try {
            // Use dynamic import for node-fetch if available, otherwise use native fetch
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.options.timeout);

            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    redirect: this.options.followRedirects ? 'follow' : 'manual',
                    signal: controller.signal,
                    headers: {
                        'User-Agent': this.options.userAgent || DEFAULT_VALIDATION_OPTIONS.userAgent!,
                    },
                });

                clearTimeout(timeout);

                const statusCode = response.status;
                const accessible = statusCode >= 200 && statusCode < 400;
                const contentType = response.headers.get('content-type');
                const finalUrl = response.url !== url ? response.url : null;

                return {
                    accessible,
                    statusCode,
                    finalUrl,
                    contentType,
                    responseTime: Date.now() - startTime,
                    error: accessible ? null : `HTTP ${statusCode}`,
                };
            } catch (fetchError) {
                clearTimeout(timeout);
                throw fetchError;
            }
        } catch (error) {
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    errorMessage = 'Request timeout';
                } else {
                    errorMessage = error.message;
                }
            }

            return {
                accessible: false,
                statusCode: null,
                finalUrl: null,
                contentType: null,
                responseTime: Date.now() - startTime,
                error: errorMessage,
            };
        }
    }

    /**
     * Resolve redirects and get final URL
     * @param url - URL to resolve
     * @returns Final URL after redirects
     */
    async resolveRedirects(url: string): Promise<string> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.options.timeout);

            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    redirect: 'follow',
                    signal: controller.signal,
                    headers: {
                        'User-Agent': this.options.userAgent || DEFAULT_VALIDATION_OPTIONS.userAgent!,
                    },
                });

                clearTimeout(timeout);
                return response.url;
            } catch (fetchError) {
                clearTimeout(timeout);
                throw fetchError;
            }
        } catch {
            return url;
        }
    }

    /**
     * Check if a URL is a valid http/https URL
     * @param url - URL to check
     * @returns True if valid http/https URL
     */
    static isValidHttpUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Check if a URL is a relative URL
     * @param url - URL to check
     * @returns True if relative URL
     */
    static isRelativeUrl(url: string): boolean {
        if (!url) return false;
        return url.startsWith('/') || url.startsWith('./') || url.startsWith('../') ||
            (!url.includes('://') && !url.startsWith('//'));
    }

    /**
     * Resolve a relative URL against a base URL
     * @param relativeUrl - Relative URL
     * @param baseUrl - Base URL
     * @returns Resolved absolute URL
     */
    static resolveRelativeUrl(relativeUrl: string, baseUrl: string): string {
        try {
            return new URL(relativeUrl, baseUrl).toString();
        } catch {
            return relativeUrl;
        }
    }

    /**
     * Extract all links from text
     * @param text - Text containing URLs
     * @returns Array of extracted URLs
     */
    static extractLinks(text: string): string[] {
        if (!text) return [];

        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
        const matches = text.match(urlRegex) || [];

        // Clean up URLs (remove trailing punctuation)
        return matches.map(url => {
            return url.replace(/[.,;:!?)]+$/, '');
        });
    }

    /**
     * Check if URL matches a domain pattern
     * @param url - URL to check
     * @param domain - Domain pattern (can include wildcards)
     * @returns True if matches
     */
    static matchesDomain(url: string, domain: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const pattern = domain.toLowerCase();

            if (pattern.startsWith('*.')) {
                const baseDomain = pattern.slice(2);
                return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
            }

            return hostname === pattern || hostname.endsWith('.' + pattern);
        } catch {
            return false;
        }
    }

    /**
     * Filter URLs by domain
     * @param urls - Array of URLs
     * @param domain - Domain to filter by
     * @param include - If true, include matching; if false, exclude matching
     * @returns Filtered URLs
     */
    static filterByDomain(urls: string[], domain: string, include: boolean = true): string[] {
        return urls.filter(url => {
            const matches = LinkValidator.matchesDomain(url, domain);
            return include ? matches : !matches;
        });
    }

    /**
     * Categorize URLs by domain
     * @param urls - Array of URLs
     * @returns Map of domain to URLs
     */
    static categorizeByDomain(urls: string[]): Map<string, string[]> {
        const result = new Map<string, string[]>();

        for (const url of urls) {
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname;
                
                if (!result.has(domain)) {
                    result.set(domain, []);
                }
                result.get(domain)!.push(url);
            } catch {
                // Skip invalid URLs
            }
        }

        return result;
    }

    /**
     * Check if URL is likely a file download
     * @param url - URL to check
     * @returns True if likely a file
     */
    static isLikelyFile(url: string): boolean {
        const fileExtensions = [
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.zip', '.rar', '.7z', '.tar', '.gz',
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp',
            '.mp3', '.mp4', '.avi', '.mkv', '.mov', '.wmv',
            '.exe', '.msi', '.dmg', '.app',
        ];

        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            return fileExtensions.some(ext => pathname.endsWith(ext));
        } catch {
            return fileExtensions.some(ext => url.toLowerCase().endsWith(ext));
        }
    }

    /**
     * Get URL file extension
     * @param url - URL to check
     * @returns File extension or null
     */
    static getFileExtension(url: string): string | null {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const lastDot = pathname.lastIndexOf('.');
            if (lastDot > pathname.lastIndexOf('/')) {
                return pathname.slice(lastDot);
            }
        } catch {
            const lastDot = url.lastIndexOf('.');
            const lastSlash = url.lastIndexOf('/');
            if (lastDot > lastSlash && lastDot < url.length - 1) {
                // Exclude query strings and fragments
                const ext = url.slice(lastDot).split(/[?#]/)[0];
                if (ext.length <= 5) return ext;
            }
        }
        return null;
    }
}

// Export convenience functions
export const validateLink = async (url: string, options?: ValidationOptions): Promise<ValidatedLink> => {
    const validator = new LinkValidator(options);
    return validator.validate(url);
};

export const validateLinks = async (urls: string[], options?: ValidationOptions): Promise<BatchValidationResult> => {
    const validator = new LinkValidator(options);
    return validator.validateBatch(urls);
};

export const isValidUrl = LinkValidator.isValidHttpUrl;
export const isRelativeUrl = LinkValidator.isRelativeUrl;
export const extractLinks = LinkValidator.extractLinks;

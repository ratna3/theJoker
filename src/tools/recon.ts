/**
 * Recon Tool - Automated Domain Reconnaissance & OSINT
 * Part of The Joker's agentic capabilities
 * 
 * Performs passive reconnaissance on a target domain including:
 * - DNS record enumeration
 * - WHOIS lookups
 * - HTTP header & security analysis
 * - SSL/TLS certificate inspection
 * - Tech stack detection (Wappalyzer-style)
 * - Email & social link extraction
 * - Screenshot capture
 */

import { EventEmitter } from 'events';
import { Tool, ToolCategory, ToolResult, toolRegistry } from './registry';
import { browserManager } from '../scraper/browser';
import { extractLinks, extractMetadata } from '../scraper/extractor';
import { log } from '../utils/logger';
import axios, { AxiosInstance } from 'axios';
import * as dns from 'dns';
import * as path from 'path';
import * as fs from 'fs';

// ============================================
// Types
// ============================================

interface MXRecord {
    exchange: string;
    priority: number;
}

interface SOARecord {
    nsname: string;
    hostmaster: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minttl: number;
}

interface DNSInfo {
    a: string[];
    aaaa: string[];
    mx: MXRecord[];
    txt: string[];
    ns: string[];
    cname: string[];
    soa: SOARecord | null;
}

interface WhoisInfo {
    registrar: string;
    createdDate: string;
    expiryDate: string;
    nameServers: string[];
    status: string[];
    dnssec: string;
    raw?: string;
}

interface SecurityHeaders {
    hsts: boolean | string;
    csp: boolean | string;
    xFrameOptions: string;
    xContentType: string;
    xXssProtection: string;
    referrerPolicy: string;
    permissionsPolicy: string;
}

interface HeaderAnalysis {
    server: string;
    poweredBy: string;
    contentType: string;
    security: SecurityHeaders;
    statusCode: number;
    responseTime: number;
    redirectChain: string[];
}

interface SSLInfo {
    valid: boolean;
    issuer: string;
    validFrom: string;
    validTo: string;
    daysRemaining: number;
    protocol: string;
}

interface TechDetection {
    name: string;
    category: string;
    confidence: number;
}

interface TechStackInfo {
    detected: TechDetection[];
    scripts: string[];
    stylesheets: string[];
    metaGenerators: string[];
}

interface SocialLinks {
    [platform: string]: string[];
}

interface LinkInfo {
    internal: number;
    external: number;
    totalLinks: number;
    externalDomains: string[];
}

export interface ReconResult {
    domain: string;
    timestamp: Date;
    dns: DNSInfo;
    whois: WhoisInfo;
    headers: HeaderAnalysis;
    ssl: SSLInfo;
    techStack: TechStackInfo;
    links: LinkInfo;
    emails: string[];
    socialLinks: SocialLinks;
    screenshot: string;
    securityScore: number;
}

// ============================================
// Tech Stack Signatures
// ============================================

interface TechSignature {
    name: string;
    category: string;
    scripts?: RegExp[];
    globals?: string[];
    headers?: { [key: string]: RegExp };
    meta?: { name: RegExp; content?: RegExp };
    stylesheets?: RegExp[];
    html?: RegExp[];
}

const TECH_SIGNATURES: TechSignature[] = [
    // Frontend Frameworks
    { name: 'React', category: 'Frontend Framework', globals: ['__REACT_DEVTOOLS_GLOBAL_HOOK__', '__NEXT_DATA__'], scripts: [/react\.production\.min\.js/i, /react-dom/i, /react\.development\.js/i] },
    { name: 'Next.js', category: 'Frontend Framework', globals: ['__NEXT_DATA__', '__NEXT_LOADED_PAGES__'], scripts: [/\/_next\//], html: [/<div id="__next"/i] },
    { name: 'Vue.js', category: 'Frontend Framework', globals: ['__VUE__', '__VUE_HMR_RUNTIME__'], scripts: [/vue\.global\.prod/i, /vue\.runtime/i, /vue@\d/i] },
    { name: 'Nuxt.js', category: 'Frontend Framework', globals: ['__NUXT__', '$nuxt'], scripts: [/\/_nuxt\//], html: [/<div id="__nuxt"/i] },
    { name: 'Angular', category: 'Frontend Framework', globals: ['ng'], scripts: [/angular\.min\.js/i, /angular\.js/i, /@angular\/core/i], html: [/ng-version/i] },
    { name: 'Svelte', category: 'Frontend Framework', html: [/class="svelte-/i, /svelte-[a-z0-9]+/i] },
    { name: 'Gatsby', category: 'Static Site Generator', html: [/id="___gatsby"/i], scripts: [/gatsby-/i] },
    { name: 'Astro', category: 'Static Site Generator', html: [/astro-island/i], meta: { name: /generator/i, content: /Astro/i } },

    // CSS Frameworks
    { name: 'Tailwind CSS', category: 'CSS Framework', stylesheets: [/tailwindcss/i, /tailwind\.min\.css/i] },
    { name: 'Bootstrap', category: 'CSS Framework', stylesheets: [/bootstrap\.min\.css/i, /bootstrap\.css/i], scripts: [/bootstrap\.bundle/i, /bootstrap\.min\.js/i] },
    { name: 'Material UI', category: 'CSS Framework', stylesheets: [/mui/i], scripts: [/@mui\//i] },

    // CMS
    { name: 'WordPress', category: 'CMS', html: [/wp-content\//i, /wp-includes\//i], meta: { name: /generator/i, content: /WordPress/i } },
    { name: 'Shopify', category: 'Ecommerce', scripts: [/cdn\.shopify\.com/i], html: [/Shopify\.theme/i] },
    { name: 'Wix', category: 'Website Builder', scripts: [/static\.wixstatic\.com/i], html: [/wix-/i] },
    { name: 'Squarespace', category: 'Website Builder', scripts: [/squarespace\.com/i, /sqsp/i] },

    // JavaScript Libraries
    { name: 'jQuery', category: 'JavaScript Library', globals: ['jQuery', '$'], scripts: [/jquery\.min\.js/i, /jquery-\d/i] },
    { name: 'Lodash', category: 'JavaScript Library', scripts: [/lodash\.min\.js/i, /lodash/i] },

    // Analytics & Tracking
    { name: 'Google Analytics', category: 'Analytics', scripts: [/google-analytics\.com\/analytics/i, /googletagmanager\.com/i, /gtag\//i] },
    { name: 'Hotjar', category: 'Analytics', scripts: [/hotjar\.com/i, /static\.hotjar\.com/i] },
    { name: 'Mixpanel', category: 'Analytics', scripts: [/mixpanel/i, /cdn\.mxpnl\.com/i] },

    // Hosting / CDN / Infrastructure
    { name: 'Cloudflare', category: 'CDN/Security', headers: { 'cf-ray': /.*/, 'server': /cloudflare/i } },
    { name: 'Vercel', category: 'Hosting', headers: { 'x-vercel-id': /.*/, 'server': /Vercel/i } },
    { name: 'Netlify', category: 'Hosting', headers: { 'x-nf-request-id': /.*/, 'server': /Netlify/i } },
    { name: 'AWS', category: 'Cloud', headers: { 'x-amz-request-id': /.*/, 'server': /AmazonS3|CloudFront/i } },
    { name: 'Nginx', category: 'Web Server', headers: { 'server': /nginx/i } },
    { name: 'Apache', category: 'Web Server', headers: { 'server': /Apache/i } },
];

// ============================================
// Social Media URL Patterns
// ============================================

const SOCIAL_PATTERNS: Record<string, RegExp> = {
    twitter: /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+/g,
    linkedin: /https?:\/\/(www\.)?linkedin\.com\/[a-zA-Z0-9_/.\-]+/g,
    github: /https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_\-]+/g,
    instagram: /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+/g,
    youtube: /https?:\/\/(www\.)?youtube\.com\/[a-zA-Z0-9_@/.\-]+/g,
    facebook: /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+/g,
    discord: /https?:\/\/(www\.)?discord\.(gg|com)\/[a-zA-Z0-9]+/g,
    tiktok: /https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+/g,
};

// ============================================
// Recon Pipeline
// ============================================

/**
 * ReconPipeline — Orchestrates passive domain reconnaissance
 */
export class ReconPipeline extends EventEmitter {
    private httpClient: AxiosInstance;

    constructor() {
        super();
        this.httpClient = axios.create({
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
    }

    /**
     * Run full reconnaissance on a domain
     */
    async recon(domain: string): Promise<ReconResult> {
        const startTime = Date.now();
        const cleanDomain = this.cleanDomain(domain);
        log.info(`[Recon] Starting reconnaissance on: ${cleanDomain}`);

        // Run independent modules in parallel for speed
        this.emit('module:start', 'DNS Lookup');
        this.emit('module:start', 'WHOIS Lookup');
        this.emit('module:start', 'HTTP Headers');
        this.emit('module:start', 'SSL/TLS Check');

        const [dnsResult, whoisResult, headersResult, sslResult] = await Promise.allSettled([
            this.dnsLookup(cleanDomain),
            this.whoisLookup(cleanDomain),
            this.analyzeHeaders(cleanDomain),
            this.checkSSL(cleanDomain),
        ]);

        const dnsInfo = dnsResult.status === 'fulfilled' ? dnsResult.value : this.emptyDNS();
        const whoisInfo = whoisResult.status === 'fulfilled' ? whoisResult.value : this.emptyWhois();
        const headersInfo = headersResult.status === 'fulfilled' ? headersResult.value : this.emptyHeaders();
        const sslInfo = sslResult.status === 'fulfilled' ? sslResult.value : this.emptySSL();

        this.emit('module:complete', 'DNS Lookup');
        this.emit('module:complete', 'WHOIS Lookup');
        this.emit('module:complete', 'HTTP Headers');
        this.emit('module:complete', 'SSL/TLS Check');

        // Browser-dependent modules (sequential to share browser instance)
        this.emit('module:start', 'Tech Stack Detection');
        const techStack = await this.detectTechStack(cleanDomain, headersInfo);
        this.emit('module:complete', 'Tech Stack Detection');

        this.emit('module:start', 'Content Extraction');
        const [emailsResult, socialResult, linksResult, screenshotResult] = await Promise.allSettled([
            this.extractEmails(cleanDomain),
            this.findSocialLinks(cleanDomain),
            this.extractLinkInfo(cleanDomain),
            this.takeScreenshot(cleanDomain),
        ]);
        this.emit('module:complete', 'Content Extraction');

        const emails = emailsResult.status === 'fulfilled' ? emailsResult.value : [];
        const socialLinks = socialResult.status === 'fulfilled' ? socialResult.value : {};
        const links = linksResult.status === 'fulfilled' ? linksResult.value : { internal: 0, external: 0, totalLinks: 0, externalDomains: [] };
        const screenshot = screenshotResult.status === 'fulfilled' ? screenshotResult.value : '';

        const partialResult: Omit<ReconResult, 'securityScore'> = {
            domain: cleanDomain,
            timestamp: new Date(),
            dns: dnsInfo,
            whois: whoisInfo,
            headers: headersInfo,
            ssl: sslInfo,
            techStack,
            links,
            emails,
            socialLinks,
            screenshot,
        };

        const securityScore = this.calculateSecurityScore(partialResult);

        const result: ReconResult = { ...partialResult, securityScore };

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        log.info(`[Recon] Completed in ${totalTime}s — Score: ${securityScore}/100`);
        this.emit('recon:complete', result);

        return result;
    }

    // ============================================
    // DNS Module
    // ============================================

    async dnsLookup(domain: string): Promise<DNSInfo> {
        const resolver = new dns.promises.Resolver();
        resolver.setServers(['8.8.8.8', '1.1.1.1']);

        const [aResult, aaaaResult, mxResult, txtResult, nsResult, cnameResult, soaResult] = await Promise.allSettled([
            resolver.resolve4(domain),
            resolver.resolve6(domain),
            resolver.resolveMx(domain),
            resolver.resolveTxt(domain),
            resolver.resolveNs(domain),
            resolver.resolveCname(domain),
            resolver.resolveSoa(domain),
        ]);

        return {
            a: aResult.status === 'fulfilled' ? aResult.value : [],
            aaaa: aaaaResult.status === 'fulfilled' ? aaaaResult.value : [],
            mx: mxResult.status === 'fulfilled' ? (mxResult.value as any[]).map(r => ({ exchange: r.exchange, priority: r.priority })) : [],
            txt: txtResult.status === 'fulfilled' ? txtResult.value.map(t => t.join('')) : [],
            ns: nsResult.status === 'fulfilled' ? nsResult.value : [],
            cname: cnameResult.status === 'fulfilled' ? cnameResult.value : [],
            soa: soaResult.status === 'fulfilled' ? soaResult.value as unknown as SOARecord : null,
        };
    }

    // ============================================
    // WHOIS Module
    // ============================================

    async whoisLookup(domain: string): Promise<WhoisInfo> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const whoisLookup = require('whois-json') as (domain: string) => Promise<any>;
            const data = await whoisLookup(domain);

            // whois-json can return an array or object depending on the TLD
            const record = Array.isArray(data) ? data[0] : data;

            return {
                registrar: record?.registrar || record?.registrarName || 'Unknown',
                createdDate: record?.creationDate || record?.createdDate || record?.created || 'Unknown',
                expiryDate: record?.registrarRegistrationExpirationDate || record?.expirationDate || record?.expires || 'Unknown',
                nameServers: this.normalizeArray(record?.nameServer || record?.nameServers || []),
                status: this.normalizeArray(record?.domainStatus || record?.status || []),
                dnssec: record?.dnssec || 'Unknown',
            };
        } catch (error: any) {
            log.warn(`[Recon] WHOIS lookup failed: ${error.message}`);
            return this.emptyWhois();
        }
    }

    // ============================================
    // HTTP Headers Module
    // ============================================

    async analyzeHeaders(domain: string): Promise<HeaderAnalysis> {
        const startTime = Date.now();
        const redirectChain: string[] = [];

        try {
            const response = await this.httpClient.get(`https://${domain}`, {
                maxRedirects: 10,
                beforeRedirect: (options: any) => {
                    redirectChain.push(options.href || '');
                },
            });

            const headers = response.headers;
            const responseTime = Date.now() - startTime;

            return {
                server: (headers['server'] as string) || 'Not disclosed',
                poweredBy: (headers['x-powered-by'] as string) || 'Not disclosed',
                contentType: (headers['content-type'] as string) || 'Unknown',
                security: {
                    hsts: headers['strict-transport-security'] || false,
                    csp: headers['content-security-policy'] || false,
                    xFrameOptions: (headers['x-frame-options'] as string) || 'MISSING',
                    xContentType: (headers['x-content-type-options'] as string) || 'MISSING',
                    xXssProtection: (headers['x-xss-protection'] as string) || 'MISSING',
                    referrerPolicy: (headers['referrer-policy'] as string) || 'MISSING',
                    permissionsPolicy: (headers['permissions-policy'] as string) || 'MISSING',
                },
                statusCode: response.status,
                responseTime,
                redirectChain,
            };
        } catch (error: any) {
            log.warn(`[Recon] Header analysis failed: ${error.message}`);
            return this.emptyHeaders();
        }
    }

    // ============================================
    // SSL/TLS Module
    // ============================================

    async checkSSL(domain: string): Promise<SSLInfo> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const sslCheck = require('ssl-checker') as (domain: string) => Promise<any>;
            const result = await sslCheck(domain);

            return {
                valid: result.valid,
                issuer: result.issuer || 'Unknown',
                validFrom: result.validFrom || 'Unknown',
                validTo: result.validTo || 'Unknown',
                daysRemaining: result.daysRemaining || 0,
                protocol: result.protocol || 'Unknown',
            };
        } catch (error: any) {
            log.warn(`[Recon] SSL check failed: ${error.message}`);
            return this.emptySSL();
        }
    }

    // ============================================
    // Tech Stack Detection Module
    // ============================================

    async detectTechStack(domain: string, headers: HeaderAnalysis): Promise<TechStackInfo> {
        const detected: TechDetection[] = [];
        let scripts: string[] = [];
        let stylesheets: string[] = [];
        let metaGenerators: string[] = [];

        try {
            const browser = await browserManager.getBrowser();
            const page = await browserManager.createPage(browser);

            await page.goto(`https://${domain}`, { waitUntil: 'networkidle2', timeout: 20000 });

            // Extract script sources
            scripts = await page.$$eval('script[src]', els =>
                els.map(el => el.getAttribute('src') || '').filter(Boolean)
            );

            // Extract stylesheet sources
            stylesheets = await page.$$eval('link[rel="stylesheet"]', els =>
                els.map(el => el.getAttribute('href') || '').filter(Boolean)
            );

            // Extract meta generators
            metaGenerators = await page.$$eval('meta[name="generator"]', els =>
                els.map(el => el.getAttribute('content') || '').filter(Boolean)
            );

            // Check global JS objects
            const globals = await page.evaluate(() => {
                const w = window as any;
                return {
                    __REACT_DEVTOOLS_GLOBAL_HOOK__: !!w.__REACT_DEVTOOLS_GLOBAL_HOOK__,
                    __NEXT_DATA__: !!w.__NEXT_DATA__,
                    __NEXT_LOADED_PAGES__: !!w.__NEXT_LOADED_PAGES__,
                    __VUE__: !!w.__VUE__,
                    __VUE_HMR_RUNTIME__: !!w.__VUE_HMR_RUNTIME__,
                    __NUXT__: !!w.__NUXT__,
                    $nuxt: !!w.$nuxt,
                    ng: !!w.ng,
                    jQuery: !!w.jQuery,
                    $: typeof w.$ === 'function' && !!w.$.fn,
                    ___gatsby: !!document.getElementById('___gatsby'),
                };
            });

            // Get page HTML for pattern matching
            const html = await page.content();

            // Match against signatures
            for (const sig of TECH_SIGNATURES) {
                let confidence = 0;
                let matches = 0;
                let checks = 0;

                // Check globals
                if (sig.globals) {
                    for (const g of sig.globals) {
                        checks++;
                        if ((globals as any)[g]) {
                            matches++;
                            confidence += 40;
                        }
                    }
                }

                // Check scripts
                if (sig.scripts) {
                    for (const pattern of sig.scripts) {
                        checks++;
                        if (scripts.some(s => pattern.test(s))) {
                            matches++;
                            confidence += 30;
                        }
                    }
                }

                // Check stylesheets
                if (sig.stylesheets) {
                    for (const pattern of sig.stylesheets) {
                        checks++;
                        if (stylesheets.some(s => pattern.test(s))) {
                            matches++;
                            confidence += 25;
                        }
                    }
                }

                // Check HTML patterns
                if (sig.html) {
                    for (const pattern of sig.html) {
                        checks++;
                        if (pattern.test(html)) {
                            matches++;
                            confidence += 30;
                        }
                    }
                }

                // Check meta tags
                if (sig.meta) {
                    checks++;
                    for (const gen of metaGenerators) {
                        if (sig.meta.content && sig.meta.content.test(gen)) {
                            matches++;
                            confidence += 35;
                        }
                    }
                }

                // Check headers
                if (sig.headers) {
                    for (const [headerKey, pattern] of Object.entries(sig.headers)) {
                        checks++;
                        const headerVal = headerKey === 'server' ? headers.server :
                            headerKey === 'x-powered-by' ? headers.poweredBy : '';
                        if (pattern.test(headerVal)) {
                            matches++;
                            confidence += 35;
                        }
                    }
                }

                if (matches > 0) {
                    detected.push({
                        name: sig.name,
                        category: sig.category,
                        confidence: Math.min(confidence, 100),
                    });
                }
            }

            browserManager.releaseBrowser(browser);
        } catch (error: any) {
            log.warn(`[Recon] Tech stack detection failed: ${error.message}`);
        }

        // Sort by confidence descending
        detected.sort((a, b) => b.confidence - a.confidence);

        return { detected, scripts, stylesheets, metaGenerators };
    }

    // ============================================
    // Content Extraction Modules
    // ============================================

    async extractEmails(domain: string): Promise<string[]> {
        const emails = new Set<string>();
        const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

        const pagesToCheck = [
            `https://${domain}`,
            `https://${domain}/contact`,
            `https://${domain}/about`,
            `https://${domain}/team`,
            `https://${domain}/impressum`,
        ];

        for (const url of pagesToCheck) {
            try {
                const response = await this.httpClient.get(url, { timeout: 8000 });
                if (typeof response.data === 'string') {
                    const found = response.data.match(emailRegex) || [];
                    found.forEach(e => emails.add(e.toLowerCase()));
                }
            } catch {
                // Page doesn't exist or failed, skip
            }
        }

        // Filter out common false positives
        const filtered = [...emails].filter(e =>
            !e.endsWith('.png') &&
            !e.endsWith('.jpg') &&
            !e.endsWith('.svg') &&
            !e.includes('example.com') &&
            !e.includes('sentry.io') &&
            !e.includes('wixpress.com') &&
            !e.startsWith('noreply@')
        );

        return filtered;
    }

    async findSocialLinks(domain: string): Promise<SocialLinks> {
        const socialLinks: SocialLinks = {};

        try {
            const response = await this.httpClient.get(`https://${domain}`, { timeout: 10000 });
            const html = typeof response.data === 'string' ? response.data : '';

            for (const [platform, regex] of Object.entries(SOCIAL_PATTERNS)) {
                // Reset global regex lastIndex
                regex.lastIndex = 0;
                const matches = [...new Set(html.match(regex) || [])];
                if (matches.length > 0) {
                    socialLinks[platform] = matches.slice(0, 5); // limit to 5 per platform
                }
            }
        } catch (error: any) {
            log.warn(`[Recon] Social link extraction failed: ${error.message}`);
        }

        return socialLinks;
    }

    async extractLinkInfo(domain: string): Promise<LinkInfo> {
        try {
            const browser = await browserManager.getBrowser();
            const page = await browserManager.createPage(browser);
            await page.goto(`https://${domain}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

            const links = await extractLinks(page);
            browserManager.releaseBrowser(browser);

            const externalDomains = new Set<string>();
            let internal = 0;
            let external = 0;

            for (const link of links) {
                if (link.isExternal) {
                    external++;
                    try {
                        const url = new URL(link.href);
                        externalDomains.add(url.hostname);
                    } catch { /* invalid URL, skip */ }
                } else {
                    internal++;
                }
            }

            return {
                internal,
                external,
                totalLinks: links.length,
                externalDomains: [...externalDomains].slice(0, 20),
            };
        } catch (error: any) {
            log.warn(`[Recon] Link extraction failed: ${error.message}`);
            return { internal: 0, external: 0, totalLinks: 0, externalDomains: [] };
        }
    }

    async takeScreenshot(domain: string): Promise<string> {
        try {
            const browser = await browserManager.getBrowser();
            const page = await browserManager.createPage(browser);
            await page.setViewport({ width: 1280, height: 800 });
            await page.goto(`https://${domain}`, { waitUntil: 'networkidle2', timeout: 20000 });

            // Ensure reports directory exists
            const reportsDir = path.resolve(process.cwd(), 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const screenshotPath = path.join(reportsDir, `${domain.replace(/[^a-zA-Z0-9.-]/g, '_')}-screenshot.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            browserManager.releaseBrowser(browser);

            log.info(`[Recon] Screenshot saved: ${screenshotPath}`);
            return screenshotPath;
        } catch (error: any) {
            log.warn(`[Recon] Screenshot failed: ${error.message}`);
            return '';
        }
    }

    // ============================================
    // Security Score Calculator
    // ============================================

    calculateSecurityScore(result: Omit<ReconResult, 'securityScore'>): number {
        let score = 0;
        const maxScore = 100;

        // SSL (25 points)
        if (result.ssl.valid) {
            score += 15;
            if (result.ssl.daysRemaining > 30) score += 5;
            if (result.ssl.daysRemaining > 90) score += 5;
        }

        // Security Headers (50 points)
        const sh = result.headers.security;
        if (sh.hsts) score += 10;
        if (sh.csp) score += 10;
        if (sh.xFrameOptions !== 'MISSING') score += 7;
        if (sh.xContentType !== 'MISSING') score += 7;
        if (sh.xXssProtection !== 'MISSING') score += 5;
        if (sh.referrerPolicy !== 'MISSING') score += 6;
        if (sh.permissionsPolicy !== 'MISSING') score += 5;

        // DNS (15 points)
        const hasSPF = result.dns.txt.some(t => t.includes('v=spf'));
        const hasDMARC = result.dns.txt.some(t => t.includes('v=DMARC'));
        const hasDKIM = result.dns.txt.some(t => t.includes('DKIM'));
        if (hasSPF) score += 5;
        if (hasDMARC) score += 5;
        if (hasDKIM) score += 5;

        // Response (10 points)
        if (result.headers.statusCode === 200) score += 5;
        if (result.headers.responseTime < 2000) score += 3;
        if (result.headers.responseTime < 500) score += 2;

        return Math.min(score, maxScore);
    }

    // ============================================
    // Report Generator
    // ============================================

    generateReport(result: ReconResult): string {
        const scoreBar = '█'.repeat(Math.round(result.securityScore / 10)) + '░'.repeat(10 - Math.round(result.securityScore / 10));
        const scoreEmoji = result.securityScore >= 80 ? '🟢' : result.securityScore >= 50 ? '🟡' : '🔴';

        let report = `# 🔍 Recon Report: ${result.domain}
> Generated by **The Joker 🃏** on ${result.timestamp.toISOString()}

---

## ${scoreEmoji} Security Score: ${result.securityScore}/100

\`\`\`
${scoreBar}  ${result.securityScore}/100
\`\`\`

---

## 🌐 DNS Records

| Type | Value |
|------|-------|
`;
        result.dns.a.forEach(ip => report += `| A | \`${ip}\` |\n`);
        result.dns.aaaa.forEach(ip => report += `| AAAA | \`${ip}\` |\n`);
        result.dns.mx.forEach(mx => report += `| MX | \`${mx.exchange}\` (priority: ${mx.priority}) |\n`);
        result.dns.ns.forEach(ns => report += `| NS | \`${ns}\` |\n`);
        result.dns.cname.forEach(cn => report += `| CNAME | \`${cn}\` |\n`);
        if (result.dns.txt.length > 0) {
            result.dns.txt.forEach(txt => {
                const truncated = txt.length > 80 ? txt.substring(0, 80) + '...' : txt;
                report += `| TXT | \`${truncated}\` |\n`;
            });
        }
        if (result.dns.soa) {
            report += `| SOA | \`${result.dns.soa.nsname}\` (hostmaster: ${result.dns.soa.hostmaster}) |\n`;
        }

        report += `
---

## 🏢 WHOIS Information

| Field | Value |
|-------|-------|
| Registrar | ${result.whois.registrar} |
| Created | ${result.whois.createdDate} |
| Expires | ${result.whois.expiryDate} |
| DNSSEC | ${result.whois.dnssec} |
`;
        if (result.whois.nameServers.length > 0) {
            report += `| Name Servers | ${result.whois.nameServers.join(', ')} |\n`;
        }
        if (result.whois.status.length > 0) {
            report += `| Status | ${result.whois.status.slice(0, 3).join(', ')} |\n`;
        }

        report += `
---

## 🔒 SSL/TLS Certificate

| Field | Value |
|-------|-------|
| Valid | ${result.ssl.valid ? '✅ Yes' : '❌ No'} |
| Issuer | ${result.ssl.issuer} |
| Valid From | ${result.ssl.validFrom} |
| Valid To | ${result.ssl.validTo} |
| Days Remaining | ${result.ssl.daysRemaining} |
| Protocol | ${result.ssl.protocol} |

---

## 🛡️ Security Headers

| Header | Status |
|--------|--------|
| Strict-Transport-Security (HSTS) | ${result.headers.security.hsts ? '✅' : '❌ Missing'} |
| Content-Security-Policy (CSP) | ${result.headers.security.csp ? '✅' : '❌ Missing'} |
| X-Frame-Options | ${result.headers.security.xFrameOptions === 'MISSING' ? '❌ Missing' : '✅ ' + result.headers.security.xFrameOptions} |
| X-Content-Type-Options | ${result.headers.security.xContentType === 'MISSING' ? '❌ Missing' : '✅ ' + result.headers.security.xContentType} |
| X-XSS-Protection | ${result.headers.security.xXssProtection === 'MISSING' ? '❌ Missing' : '✅ ' + result.headers.security.xXssProtection} |
| Referrer-Policy | ${result.headers.security.referrerPolicy === 'MISSING' ? '❌ Missing' : '✅ ' + result.headers.security.referrerPolicy} |
| Permissions-Policy | ${result.headers.security.permissionsPolicy === 'MISSING' ? '❌ Missing' : '✅ ' + result.headers.security.permissionsPolicy} |

**Server:** ${result.headers.server} | **Powered By:** ${result.headers.poweredBy} | **Response Time:** ${result.headers.responseTime}ms

---

## 💻 Tech Stack
`;

        if (result.techStack.detected.length > 0) {
            report += `\n| Technology | Category | Confidence |\n|------------|----------|------------|\n`;
            result.techStack.detected.forEach(t => {
                const bar = '█'.repeat(Math.round(t.confidence / 10)) + '░'.repeat(10 - Math.round(t.confidence / 10));
                report += `| **${t.name}** | ${t.category} | ${bar} ${t.confidence}% |\n`;
            });
        } else {
            report += `\n_No technologies detected._\n`;
        }

        report += `
---

## 🔗 Links Analysis

| Metric | Count |
|--------|-------|
| Internal Links | ${result.links.internal} |
| External Links | ${result.links.external} |
| Total Links | ${result.links.totalLinks} |
`;
        if (result.links.externalDomains.length > 0) {
            report += `\n**External Domains:** ${result.links.externalDomains.slice(0, 10).join(', ')}`;
            if (result.links.externalDomains.length > 10) {
                report += ` _(+${result.links.externalDomains.length - 10} more)_`;
            }
            report += '\n';
        }

        report += `
---

## 📧 Emails Found
`;
        if (result.emails.length > 0) {
            result.emails.forEach(e => report += `- \`${e}\`\n`);
        } else {
            report += `_No email addresses found._\n`;
        }

        report += `
---

## 🌍 Social Links
`;
        const socialEntries = Object.entries(result.socialLinks);
        if (socialEntries.length > 0) {
            socialEntries.forEach(([platform, links]) => {
                const icon = platform === 'twitter' ? '🐦' : platform === 'github' ? '🐙' : platform === 'linkedin' ? '💼' : platform === 'instagram' ? '📸' : platform === 'youtube' ? '🎬' : platform === 'facebook' ? '📘' : platform === 'discord' ? '💬' : '🔗';
                report += `- ${icon} **${platform}:** ${links.join(', ')}\n`;
            });
        } else {
            report += `_No social media links found._\n`;
        }

        if (result.screenshot) {
            report += `
---

## 📸 Screenshot

![Homepage Screenshot](${result.screenshot})
`;
        }

        report += `
---

*Report generated by 🃏 **The Joker** — Agentic Terminal*
*Scan duration: passive reconnaissance only — no active port/vulnerability scanning*
`;

        return report;
    }

    // ============================================
    // Helpers
    // ============================================

    private cleanDomain(input: string): string {
        return input
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, '')
            .trim()
            .toLowerCase();
    }

    private normalizeArray(val: unknown): string[] {
        if (Array.isArray(val)) return val.map(v => String(v));
        if (typeof val === 'string') return val.split(/[\s,;]+/).filter(Boolean);
        return [];
    }

    private emptyDNS(): DNSInfo {
        return { a: [], aaaa: [], mx: [], txt: [], ns: [], cname: [], soa: null };
    }

    private emptyWhois(): WhoisInfo {
        return { registrar: 'Unknown', createdDate: 'Unknown', expiryDate: 'Unknown', nameServers: [], status: [], dnssec: 'Unknown' };
    }

    private emptyHeaders(): HeaderAnalysis {
        return {
            server: 'Unknown', poweredBy: 'Unknown', contentType: 'Unknown',
            security: { hsts: false, csp: false, xFrameOptions: 'MISSING', xContentType: 'MISSING', xXssProtection: 'MISSING', referrerPolicy: 'MISSING', permissionsPolicy: 'MISSING' },
            statusCode: 0, responseTime: 0, redirectChain: [],
        };
    }

    private emptySSL(): SSLInfo {
        return { valid: false, issuer: 'Unknown', validFrom: 'Unknown', validTo: 'Unknown', daysRemaining: 0, protocol: 'Unknown' };
    }
}

// ============================================
// Tool Definitions
// ============================================

/**
 * Execute domain recon as a standalone function
 */
export async function domainRecon(params: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();
    const domain = params.domain;

    if (!domain || typeof domain !== 'string') {
        return {
            success: false,
            error: 'Domain is required. Usage: recon <domain>',
            metadata: { executionTime: 0, toolName: 'domain_recon', timestamp: new Date() },
        };
    }

    try {
        const pipeline = new ReconPipeline();
        const result = await pipeline.recon(domain);
        const report = pipeline.generateReport(result);

        // Save report to file
        const reportsDir = path.resolve(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const cleanDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
        const reportPath = path.join(reportsDir, `${cleanDomain}-recon.md`);
        fs.writeFileSync(reportPath, report, 'utf-8');

        return {
            success: true,
            data: {
                result,
                report,
                reportPath,
                summary: `Recon complete for ${domain} — Security Score: ${result.securityScore}/100 — ${result.techStack.detected.length} technologies detected — ${result.emails.length} emails found`,
            },
            metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'domain_recon',
                timestamp: new Date(),
            },
        };
    } catch (error: any) {
        return {
            success: false,
            error: `Recon failed: ${error.message}`,
            metadata: {
                executionTime: Date.now() - startTime,
                toolName: 'domain_recon',
                timestamp: new Date(),
            },
        };
    }
}

/**
 * Tool definition for domain_recon
 */
export const domainReconTool: Tool = {
    name: 'domain_recon',
    description: 'Run passive reconnaissance on a domain — DNS records, WHOIS, SSL/TLS, security headers, tech stack detection, email & social link extraction, and screenshot capture. Generates a comprehensive markdown report.',
    category: ToolCategory.SCRAPE,
    parameters: [
        {
            name: 'domain',
            type: 'string',
            description: 'The domain to perform reconnaissance on (e.g., example.com)',
            required: true,
        },
    ],
    execute: domainRecon,
};

/**
 * Register recon tools in the global registry
 */
export function registerReconTools(): void {
    log.info('[Tools] Registering recon tools...');
    toolRegistry.register(domainReconTool);
    log.info('[Tools] ✅ Registered: domain_recon');
}

/**
 * The Joker - Agentic Terminal
 * Chrome/Chromium Auto-Detection Utility
 *
 * Finds a locally installed Chrome, Edge, or Brave executable
 * so puppeteer-core can launch it without bundling Chromium.
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Common Chrome/Chromium executable paths by platform
 */
const CHROME_PATHS: Record<string, string[]> = {
    win32: [
        // Google Chrome
        path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['LOCALAPPDATA'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        // Microsoft Edge
        path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        // Brave
        path.join(process.env['PROGRAMFILES'] || 'C:\\Program Files', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
        path.join(process.env['LOCALAPPDATA'] || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ],
    darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        '/usr/bin/microsoft-edge',
        '/usr/bin/brave-browser',
    ],
};

/**
 * Find a locally installed Chrome/Chromium/Edge/Brave executable.
 *
 * @returns Absolute path to the browser executable
 * @throws Error if no browser is found
 */
export function findChrome(): string {
    const platform = process.platform;
    const candidates = CHROME_PATHS[platform] || CHROME_PATHS['linux'];

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                logger.debug('Found Chrome-compatible browser', { path: candidate });
                return candidate;
            }
        } catch {
            // Skip inaccessible paths
        }
    }

    const message = [
        'Could not find a Chrome-compatible browser on your system.',
        'Please install Google Chrome, Microsoft Edge, or Brave, or set',
        'the CHROME_PATH environment variable in your .env file.',
        '',
        `  Searched (${platform}):`,
        ...candidates.map((p) => `    - ${p}`),
    ].join('\n');

    throw new Error(message);
}

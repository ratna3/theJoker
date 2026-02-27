/**
 * The Joker - Electron Desktop App
 * Main Process — Window creation and app lifecycle
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, cleanupBackend } from './ipc-handlers';
import { loadEnvIntoProcess } from './config-store';

let mainWindow: BrowserWindow | null = null;

/**
 * In packaged mode, backend modules need access to the parent project's node_modules.
 * We set MODULE_PATHS so require() can find dependencies like axios, cheerio, etc.
 */
function setupModulePaths(): void {
    if (app.isPackaged) {
        const backendModules = path.join(process.resourcesPath, 'backend-modules');
        const Module = require('module');
        const fs = require('fs');
        const originalResolveFilename = Module._resolveFilename;
        Module._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
            try {
                return originalResolveFilename.call(this, request, parent, isMain, options);
            } catch (e: any) {
                // If not found, try backend-modules
                if (e.code === 'MODULE_NOT_FOUND') {
                    const backendPath = path.join(backendModules, request);
                    // Check if this is an ESM package that needs CJS resolution
                    try {
                        const pkgPath = path.join(backendPath, 'package.json');
                        if (fs.existsSync(pkgPath)) {
                            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                            if (pkg.type === 'module') {
                                const cjsPath = findCjsEntry(pkg, backendPath, request);
                                if (cjsPath) {
                                    return originalResolveFilename.call(this, cjsPath, parent, isMain, options);
                                }
                            }
                        }
                    } catch { /* fall through to default resolution */ }
                    return originalResolveFilename.call(this, backendPath, parent, isMain, options);
                }
                throw e;
            }
        };
    }
}

/**
 * Find a CommonJS entry point for an ESM package.
 * Checks the "exports" field in package.json for CJS paths,
 * then falls back to common CJS file naming conventions.
 */
function findCjsEntry(pkg: any, pkgDir: string, pkgName: string): string | null {
    const fs = require('fs');
    const exports = pkg.exports?.['.'];
    if (!exports) return null;

    // Try exports["."].default.require  (e.g. axios)
    if (exports.default?.require) {
        const cjs = path.join(pkgDir, exports.default.require);
        if (fs.existsSync(cjs)) return cjs;
    }
    // Try exports["."].require  (e.g. chalk)
    if (typeof exports.require === 'string') {
        const cjs = path.join(pkgDir, exports.require);
        if (fs.existsSync(cjs)) return cjs;
    }
    // Try common CJS file patterns
    const baseName = pkgName.replace(/^@.*\//, '');
    const candidates = [
        path.join(pkgDir, `dist/node/${baseName}.cjs`),
        path.join(pkgDir, `dist/${baseName}.cjs`),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return null;
}

function createWindow(): void {
    // Resolve paths differently for dev vs packaged
    let rendererPath: string;
    let iconPath: string;

    if (app.isPackaged) {
        // In packaged: __dirname = app.asar/dist/main/
        // renderer/ and assets/ are at app.asar/ root — go up 2 levels
        const asarRoot = path.join(__dirname, '..', '..');
        rendererPath = path.join(asarRoot, 'renderer', 'index.html');
        iconPath = path.join(asarRoot, 'assets', 'theJoker.png');
    } else {
        // In dev: __dirname = electron/dist/main/, go up to electron/
        const electronRoot = path.resolve(__dirname, '..', '..');
        rendererPath = path.join(electronRoot, 'renderer', 'index.html');
        iconPath = path.join(electronRoot, 'assets', 'theJoker.png');
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'The Joker',
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#0a0a1a',
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        show: false,
    });

    // Load renderer HTML
    mainWindow.loadFile(rendererPath);

    // Show when ready to avoid flash
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Register IPC handlers
    registerIpcHandlers(mainWindow);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── App Lifecycle ──

app.whenReady().then(() => {
    // Set up module resolution for packaged backend
    setupModulePaths();

    // Load env before anything
    loadEnvIntoProcess();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    cleanupBackend();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    cleanupBackend();
});

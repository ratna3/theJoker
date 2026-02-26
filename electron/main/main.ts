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
        const originalResolveFilename = Module._resolveFilename;
        Module._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
            try {
                return originalResolveFilename.call(this, request, parent, isMain, options);
            } catch (e: any) {
                // If not found, try backend-modules
                if (e.code === 'MODULE_NOT_FOUND') {
                    const backendPath = path.join(backendModules, request);
                    return originalResolveFilename.call(this, backendPath, parent, isMain, options);
                }
                throw e;
            }
        };
    }
}

function createWindow(): void {
    // Resolve paths differently for dev vs packaged
    let rendererPath: string;
    let iconPath: string;

    if (app.isPackaged) {
        // In packaged: renderer/ and assets/ are inside the asar
        rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
        iconPath = path.join(__dirname, '..', 'assets', 'theJoker.png');
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

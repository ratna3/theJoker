/**
 * The Joker - Electron Desktop App
 * Main Process — Window creation and app lifecycle
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, cleanupBackend } from './ipc-handlers';
import { loadEnvIntoProcess } from './config-store';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
    // __dirname at runtime = electron/dist/main/
    // renderer files are at electron/renderer/ (not compiled)
    const electronRoot = path.resolve(__dirname, '..', '..');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'The Joker',
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#0a0a1a',
        icon: path.join(electronRoot, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        show: false,
    });

    // Load renderer HTML
    mainWindow.loadFile(path.join(electronRoot, 'renderer', 'index.html'));

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

/**
 * The Joker - Electron Desktop App
 * Main Process — Window creation, native menu, and app lifecycle
 */

import { app, BrowserWindow, dialog, Menu } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, cleanupBackend } from './ipc-handlers';
import { loadEnvIntoProcess } from './config-store';

let mainWindow: BrowserWindow | null = null;

/**
 * In packaged mode, backend modules need access to the parent project's node_modules.
 * We add the backend-modules directory to NODE_PATH so require() resolves
 * packages properly (respecting their package.json "exports" field).
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
                if (e.code === 'MODULE_NOT_FOUND') {
                    const backendPath = path.join(backendModules, request);
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
                    } catch { /* fall through */ }
                    return originalResolveFilename.call(this, backendPath, parent, isMain, options);
                }
                throw e;
            }
        };
    }
}

function findCjsEntry(pkg: any, pkgDir: string, pkgName: string): string | null {
    const fs = require('fs');
    const exports = pkg.exports?.['.'];
    if (!exports) return null;

    if (exports.default?.require) {
        const cjs = path.join(pkgDir, exports.default.require);
        if (fs.existsSync(cjs)) return cjs;
    }
    if (typeof exports.require === 'string') {
        const cjs = path.join(pkgDir, exports.require);
        if (fs.existsSync(cjs)) return cjs;
    }
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

// ── Window State Persistence ──
function getWindowState(): { width: number; height: number; x?: number; y?: number } {
    try {
        const fs = require('fs');
        const statePath = path.join(app.getPath('userData'), 'window-state.json');
        if (fs.existsSync(statePath)) {
            return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        }
    } catch { }
    return { width: 1400, height: 900 };
}

function saveWindowState(win: BrowserWindow): void {
    try {
        const fs = require('fs');
        const bounds = win.getBounds();
        const statePath = path.join(app.getPath('userData'), 'window-state.json');
        fs.writeFileSync(statePath, JSON.stringify(bounds));
    } catch { }
}

function createWindow(): void {
    const windowState = getWindowState();

    // Resolve paths differently for dev vs packaged
    let rendererPath: string;
    let iconPath: string;

    if (app.isPackaged) {
        const asarRoot = path.join(__dirname, '..', '..');
        rendererPath = path.join(asarRoot, 'renderer', 'dist', 'index.html');
        iconPath = path.join(asarRoot, 'assets', 'theJoker.png');
    } else {
        const electronRoot = path.resolve(__dirname, '..', '..');
        rendererPath = path.join(electronRoot, 'renderer', 'dist', 'index.html');
        iconPath = path.join(electronRoot, 'assets', 'theJoker.png');
    }

    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        minWidth: 900,
        minHeight: 600,
        title: 'The Joker — Vibe Coding IDE',
        frame: true,
        backgroundColor: '#0d0d1a',
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
        },
        show: false,
    });

    // Load renderer HTML
    mainWindow.loadFile(rendererPath);

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Save window state on close
    mainWindow.on('close', () => {
        if (mainWindow) saveWindowState(mainWindow);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Register IPC handlers
    registerIpcHandlers(mainWindow);

    // Build native menu
    buildMenu();
}

// ── Native Menu ──
function buildMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Folder',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow!, {
                            properties: ['openDirectory'],
                        });
                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow?.webContents.send('folder-opened', result.filePaths[0]);
                        }
                    },
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => mainWindow?.webContents.send('menu-save'),
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => app.quit(),
                },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle File Explorer',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => mainWindow?.webContents.send('toggle-sidebar'),
                },
                {
                    label: 'Toggle Terminal',
                    accelerator: 'CmdOrCtrl+`',
                    click: () => mainWindow?.webContents.send('toggle-terminal'),
                },
                {
                    label: 'Toggle Chat',
                    accelerator: 'CmdOrCtrl+J',
                    click: () => mainWindow?.webContents.send('toggle-chat'),
                },
                { type: 'separator' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
                { type: 'separator' },
                { role: 'toggleDevTools' },
            ],
        },
        {
            label: 'Terminal',
            submenu: [
                {
                    label: 'New Terminal',
                    accelerator: 'CmdOrCtrl+Shift+`',
                    click: () => mainWindow?.webContents.send('new-terminal'),
                },
                {
                    label: 'Clear Terminal',
                    click: () => mainWindow?.webContents.send('clear-terminal'),
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About The Joker',
                    click: () => {
                        dialog.showMessageBox(mainWindow!, {
                            type: 'info',
                            title: 'About The Joker — Vibe Coding IDE',
                            message: 'The Joker — Vibe Coding IDE v1.1.1',
                            detail: 'AI-powered desktop IDE built with Electron, React, and TypeScript.\nPowered by LM Studio.\n\nBy Ratna Kirti',
                        });
                    },
                },
                {
                    label: 'Check LM Studio Connection',
                    click: () => mainWindow?.webContents.send('check-lm-connection'),
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ── App Lifecycle ──

app.whenReady().then(() => {
    setupModulePaths();
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

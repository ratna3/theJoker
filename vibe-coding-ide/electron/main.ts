/**
 * Vibe Coding IDE — Electron Main Process
 * Handles window creation, IPC registration, and app lifecycle
 */

import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'path';
import os from 'os';

// Managers will be imported from their respective modules
import { TerminalManager } from './terminal';
import { FileSystemManager } from './fileSystem';
import { AIAgent } from './aiAgent';
import { ProjectManager } from './projectManager';
import { DependencyInstaller } from './dependencyInstaller';

let mainWindow: BrowserWindow | null = null;

// Initialize managers
const terminalManager = new TerminalManager();
const fileSystemManager = new FileSystemManager();
const aiAgent = new AIAgent();
const dependencyInstaller = new DependencyInstaller();
const projectManager = new ProjectManager(fileSystemManager, dependencyInstaller);

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

// ── Window Creation ──
function createWindow(): void {
    const windowState = getWindowState();

    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        minWidth: 900,
        minHeight: 600,
        title: 'The Joker — Vibe Coding IDE',
        frame: true,
        backgroundColor: '#0a0e0c',
        icon: path.join(__dirname, '../public/theJoker.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
        },
        show: false,
    });

    // Dev or prod URL
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

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
                            message: 'The Joker — Vibe Coding IDE v1.0.0',
                            detail: 'AI-powered desktop IDE built with Electron, React, and TypeScript.\nPowered by LM Studio.',
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

// ── IPC Handlers ──
function registerIpcHandlers(): void {
    // ── Terminal IPC ──
    ipcMain.handle('terminal-create', async (_event, id: string, cwd?: string) => {
        try {
            terminalManager.create(id, cwd || os.homedir());
            // Forward terminal data to renderer
            terminalManager.onData(id, (data: string) => {
                mainWindow?.webContents.send(`terminal-data-${id}`, data);
            });
            terminalManager.onExit(id, (exitCode: number) => {
                mainWindow?.webContents.send(`terminal-exit-${id}`, exitCode);
            });
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('terminal-write', async (_event, id: string, data: string) => {
        terminalManager.write(id, data);
    });

    ipcMain.handle('terminal-resize', async (_event, id: string, cols: number, rows: number) => {
        terminalManager.resize(id, cols, rows);
    });

    ipcMain.handle('terminal-destroy', async (_event, id: string) => {
        terminalManager.destroy(id);
    });

    // ── File System IPC ──
    ipcMain.handle('fs-read-dir', async (_event, dirPath: string) => {
        return fileSystemManager.readDirectory(dirPath);
    });

    ipcMain.handle('fs-read-file', async (_event, filePath: string) => {
        return fileSystemManager.readFile(filePath);
    });

    ipcMain.handle('fs-write-file', async (_event, filePath: string, content: string) => {
        return fileSystemManager.writeFile(filePath, content);
    });

    ipcMain.handle('fs-delete', async (_event, itemPath: string) => {
        return fileSystemManager.deleteItem(itemPath);
    });

    ipcMain.handle('fs-rename', async (_event, oldPath: string, newPath: string) => {
        return fileSystemManager.renameItem(oldPath, newPath);
    });

    ipcMain.handle('fs-create', async (_event, parentPath: string, name: string, type: 'file' | 'directory') => {
        return fileSystemManager.createItem(parentPath, name, type);
    });

    ipcMain.handle('fs-watch-start', async (_event, dirPath: string) => {
        fileSystemManager.watchDirectory(dirPath, (event) => {
            mainWindow?.webContents.send('fs-change', event);
        });
    });

    ipcMain.handle('fs-watch-stop', async () => {
        fileSystemManager.stopWatching();
    });

    // ── AI IPC ──
    ipcMain.handle('ai-stream-start', async (_event, config: any) => {
        try {
            await aiAgent.streamMessage({
                ...config,
                onToken: (token: string) => {
                    mainWindow?.webContents.send('ai-token', token);
                },
                onComplete: (fullResponse: string) => {
                    mainWindow?.webContents.send('ai-complete', fullResponse);
                },
                onError: (error: string) => {
                    mainWindow?.webContents.send('ai-error', error);
                },
            });
        } catch (err: any) {
            mainWindow?.webContents.send('ai-error', err.message);
        }
    });

    ipcMain.handle('ai-stream-stop', async () => {
        aiAgent.abortStream();
    });

    ipcMain.handle('ai-plan-project', async (_event, prompt: string, template: string) => {
        try {
            const plan = await aiAgent.planProject(prompt, template, (step: any) => {
                mainWindow?.webContents.send('build-step-update', step);
            });
            return { success: true, plan };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('ai-generate-files', async (_event, plan: any) => {
        try {
            const files = await aiAgent.generateProjectFiles(plan, (progress: any) => {
                mainWindow?.webContents.send('build-step-update', progress);
            });
            return { success: true, files: Object.fromEntries(files) };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // ── Project IPC ──
    ipcMain.handle('project-create', async (_event, config: any) => {
        try {
            return await projectManager.createProject(config, (step: any) => {
                mainWindow?.webContents.send('build-step-update', step);
            });
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('install-dependencies', async (_event, projectPath: string, terminalId: string) => {
        try {
            return await dependencyInstaller.install(projectPath, terminalId, (progress: any) => {
                mainWindow?.webContents.send('build-step-update', progress);
            }, terminalManager);
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // ── Dialog IPC ──
    ipcMain.handle('open-folder-dialog', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    // ── System IPC ──
    ipcMain.handle('get-home-dir', () => os.homedir());
    ipcMain.handle('get-platform', () => process.platform);

    ipcMain.handle('get-lmstudio-models', async (_event, baseUrl: string) => {
        return aiAgent.getLMStudioModels(baseUrl);
    });

    ipcMain.handle('test-lmstudio-connection', async (_event, baseUrl: string) => {
        return aiAgent.testConnection(baseUrl);
    });

    // ── External links ──
    ipcMain.handle('open-external', async (_event, url: string) => {
        shell.openExternal(url);
    });
}

// ── App Lifecycle ──
app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    terminalManager.destroyAll();
    fileSystemManager.stopWatching();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    terminalManager.destroyAll();
    fileSystemManager.stopWatching();
});

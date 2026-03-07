/**
 * ENDj0K3R — Electron Main Process
 * Handles window creation, IPC registration, and app lifecycle
 */

import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Managers will be imported from their respective modules
import { TerminalManager } from './terminal';
import { FileSystemManager } from './fileSystem';
import { AIAgent } from './aiAgent';
import { ProjectManager } from './projectManager';
import { DependencyInstaller } from './dependencyInstaller';
import { sanitizeFilePath } from './responseParser';
import { getPentestController } from './pentestAgent';

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
        title: 'The Joker — ENDj0K3R',
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
                            title: 'About The Joker — ENDj0K3R',
                            message: 'The Joker — ENDj0K3R v1.0.0',
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

    ipcMain.handle('ai-plan-project', async (_event, prompt: string, template: string, baseUrl?: string, model?: string) => {
        try {
            const plan = await aiAgent.planProject(prompt, template, (step: any) => {
                mainWindow?.webContents.send('build-step-update', step);
            }, baseUrl, model);
            return { success: true, plan };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('ai-generate-files', async (_event, plan: any, baseUrl?: string, model?: string) => {
        try {
            const files = await aiAgent.generateProjectFiles(plan, (progress: any) => {
                mainWindow?.webContents.send('build-step-update', progress);
            }, baseUrl, model);
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

    // ── AI File Apply IPC ──
    ipcMain.handle('ai-apply-file', async (_event, projectRoot: string, relativePath: string, content: string) => {
        try {
            const resolvedPath = sanitizeFilePath(projectRoot, relativePath);
            if (!resolvedPath) {
                return { success: false, error: 'Invalid file path — cannot write outside project directory', resolvedPath: '' };
            }

            // Ensure directory exists
            const dir = path.dirname(resolvedPath);
            await fs.promises.mkdir(dir, { recursive: true });

            // Write the file
            await fs.promises.writeFile(resolvedPath, content, 'utf-8');

            // Notify the file watcher
            mainWindow?.webContents.send('fs-change', { type: 'change', path: resolvedPath });

            return { success: true, resolvedPath };
        } catch (err: any) {
            return { success: false, error: err.message, resolvedPath: '' };
        }
    });

    // ── AI Terminal IPC ──
    ipcMain.handle('ai-run-terminal', async (_event, terminalId: string, command: string) => {
        try {
            const success = terminalManager.executeCommand(terminalId, command);
            if (!success) {
                return { success: false, error: 'Terminal session not found' };
            }
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('ai-read-terminal-output', async (_event, terminalId: string, maxLines?: number) => {
        try {
            const output = terminalManager.getRecentOutput(terminalId, maxLines || 100);
            return { success: true, output };
        } catch (err: any) {
            return { success: false, output: '', error: err.message };
        }
    });

    // ── AI List Project Files IPC ──
    ipcMain.handle('ai-list-project-files', async (_event, projectRoot: string) => {
        try {
            const files: string[] = [];
            const IGNORE = new Set(['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv', 'coverage', '.cache']);

            async function walk(dir: string, depth = 0): Promise<void> {
                if (depth > 5) return; // Limit depth
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');
                    if (entry.isDirectory()) {
                        await walk(fullPath, depth + 1);
                    } else {
                        files.push(relativePath);
                    }
                }
            }

            await walk(projectRoot);
            return { success: true, files };
        } catch (err: any) {
            return { success: false, files: [], error: err.message };
        }
    });

    // ── Terminal Execute (blocking) ──
    ipcMain.handle('terminal-execute', async (_event, options: { command: string; cwd: string; sessionId?: string; timeout?: number }) => {
        try {
            const sessionId = options.sessionId || '';
            return await terminalManager.executeBlocking(
                sessionId,
                options.command,
                options.cwd,
                options.timeout || 60000,
            );
        } catch (err: any) {
            return { success: false, output: '', exitCode: -1, error: err.message };
        }
    });

    ipcMain.handle('terminal-launch-dev-server', async (_event, options: { command: string; cwd: string; sessionId?: string; port: number; timeout?: number }) => {
        try {
            const sessionId = options.sessionId || '';
            return await terminalManager.startDevServer(
                sessionId,
                options.command,
                options.cwd,
                options.port,
                options.timeout || 60000,
            );
        } catch (err: any) {
            return { success: false, url: '', error: err.message };
        }
    });

    // ── Pentest (ENDj0K3R) IPC ──
    ipcMain.handle('pentest-start', async (_event, config: any) => {
        try {
            const controller = getPentestController();
            if (mainWindow) {
                // Run in background — don't await (it runs the agent loop)
                controller.start(config, mainWindow).catch((err: any) => {
                    mainWindow?.webContents.send('pentest-activity', {
                        id: 'err-' + Date.now(),
                        type: 'message',
                        content: `Agent error: ${err.message}`,
                        messageType: 'error',
                        timestamp: Date.now(),
                    });
                });
            }
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('pentest-pause', async () => {
        const controller = getPentestController();
        return controller.pause(mainWindow!);
    });

    ipcMain.handle('pentest-resume', async (_event, instruction?: string) => {
        const controller = getPentestController();
        return controller.resume(mainWindow!, instruction);
    });

    ipcMain.handle('pentest-stop', async () => {
        const controller = getPentestController();
        return controller.stop(mainWindow!);
    });

    ipcMain.handle('pentest-inject', async (_event, text: string) => {
        const controller = getPentestController();
        return controller.inject(text, mainWindow!);
    });

    ipcMain.handle('pentest-get-state', async () => {
        const controller = getPentestController();
        return controller.getState();
    });

    ipcMain.handle('pentest-list-sessions', async () => {
        const controller = getPentestController();
        return controller.listSessions();
    });

    ipcMain.handle('pentest-load-session', async (_event, id: string) => {
        const controller = getPentestController();
        return controller.loadSession(id);
    });

    ipcMain.handle('pentest-delete-session', async (_event, id: string) => {
        const controller = getPentestController();
        return controller.deleteSession(id);
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

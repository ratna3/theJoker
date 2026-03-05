/**
 * The Joker - Electron Desktop App
 * Main Process — Window creation, IPC registration, and app lifecycle
 */

import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import * as path from 'path';
import os from 'os';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { TerminalManager } from './terminal';
import { FileSystemManager } from './fileSystem';
import { AIAgent } from './aiAgent';
import { ProjectManager } from './projectManager';
import { DependencyInstaller } from './dependencyInstaller';

// Track running commands for status checks
const runningCommands = new Map<string, { process: ChildProcess; running: boolean; exitCode: number | null; output: string }>();

let mainWindow: BrowserWindow | null = null;

// Initialize managers
const terminalManager = new TerminalManager();
const fileSystemManager = new FileSystemManager();
const aiAgent = new AIAgent();
const dependencyInstaller = new DependencyInstaller();
const projectManager = new ProjectManager(fileSystemManager, dependencyInstaller);

// ── Window State ──
function getWindowState(): { width: number; height: number; x?: number; y?: number } {
    try {
        const fs = require('fs');
        const statePath = path.join(app.getPath('userData'), 'window-state.json');
        if (fs.existsSync(statePath)) return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    } catch { }
    return { width: 1400, height: 900 };
}

function saveWindowState(win: BrowserWindow): void {
    try {
        const fs = require('fs');
        const statePath = path.join(app.getPath('userData'), 'window-state.json');
        fs.writeFileSync(statePath, JSON.stringify(win.getBounds()));
    } catch { }
}

function createWindow(): void {
    const windowState = getWindowState();

    // Resolve paths for dev vs packaged
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
        title: 'The Joker',
        frame: true,
        backgroundColor: '#0a0e0c',
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

    mainWindow.loadFile(rendererPath);

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('close', () => {
        if (mainWindow) saveWindowState(mainWindow);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

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
                        const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow?.webContents.send('folder-opened', result.filePaths[0]);
                        }
                    },
                },
                { type: 'separator' },
                { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu-save') },
                { type: 'separator' },
                { label: 'Exit', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click: () => app.quit() },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
                { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { label: 'Toggle File Explorer', accelerator: 'CmdOrCtrl+B', click: () => mainWindow?.webContents.send('toggle-sidebar') },
                { label: 'Toggle Terminal', accelerator: 'CmdOrCtrl+`', click: () => mainWindow?.webContents.send('toggle-terminal') },
                { label: 'Toggle Chat', accelerator: 'CmdOrCtrl+J', click: () => mainWindow?.webContents.send('toggle-chat') },
                { type: 'separator' },
                { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' },
                { type: 'separator' },
                { role: 'toggleDevTools' },
            ],
        },
        {
            label: 'Terminal',
            submenu: [
                { label: 'New Terminal', accelerator: 'CmdOrCtrl+Shift+`', click: () => mainWindow?.webContents.send('new-terminal') },
                { label: 'Clear Terminal', click: () => mainWindow?.webContents.send('clear-terminal') },
            ],
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About The Joker',
                    click: () => {
                        dialog.showMessageBox(mainWindow!, {
                            type: 'info', title: 'About The Joker',
                            message: 'The Joker v1.1.1',
                            detail: 'AI-powered desktop IDE built with Electron, React, and TypeScript.\nPowered by LM Studio.',
                        });
                    },
                },
                { label: 'Check LM Studio Connection', click: () => mainWindow?.webContents.send('check-lm-connection') },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC Handlers ──
function registerIpcHandlers(): void {
    // Terminal
    ipcMain.handle('terminal-create', async (_event, id: string, cwd?: string) => {
        try {
            terminalManager.create(id, cwd || os.homedir());
            terminalManager.onData(id, (data: string) => { mainWindow?.webContents.send(`terminal-data-${id}`, data); });
            terminalManager.onExit(id, (exitCode: number) => { mainWindow?.webContents.send(`terminal-exit-${id}`, exitCode); });
            return { success: true };
        } catch (err: any) { return { success: false, error: err.message }; }
    });
    ipcMain.handle('terminal-write', async (_event, id: string, data: string) => { terminalManager.write(id, data); });
    ipcMain.handle('terminal-resize', async (_event, id: string, cols: number, rows: number) => { terminalManager.resize(id, cols, rows); });
    ipcMain.handle('terminal-destroy', async (_event, id: string) => { terminalManager.destroy(id); });

    // File System
    ipcMain.handle('fs-read-dir', async (_event, dirPath: string) => fileSystemManager.readDirectory(dirPath));
    ipcMain.handle('fs-read-file', async (_event, filePath: string) => fileSystemManager.readFile(filePath));
    ipcMain.handle('fs-write-file', async (_event, filePath: string, content: string) => fileSystemManager.writeFile(filePath, content));
    ipcMain.handle('fs-delete', async (_event, itemPath: string) => fileSystemManager.deleteItem(itemPath));
    ipcMain.handle('fs-rename', async (_event, oldPath: string, newPath: string) => fileSystemManager.renameItem(oldPath, newPath));
    ipcMain.handle('fs-create', async (_event, parentPath: string, name: string, type: 'file' | 'directory') => fileSystemManager.createItem(parentPath, name, type));
    ipcMain.handle('fs-watch-start', async (_event, dirPath: string) => {
        fileSystemManager.watchDirectory(dirPath, (event) => { mainWindow?.webContents.send('fs-change', event); });
    });
    ipcMain.handle('fs-watch-stop', async () => { fileSystemManager.stopWatching(); });

    // AI
    ipcMain.handle('ai-stream-start', async (_event, config: any) => {
        try {
            if (config.baseUrl) aiAgent.setUrl(config.baseUrl);
            await aiAgent.streamMessage({
                ...config,
                onToken: (token: string) => { mainWindow?.webContents.send('ai-token', token); },
                onComplete: (fullResponse: string) => { mainWindow?.webContents.send('ai-complete', fullResponse); },
                onError: (error: string) => { mainWindow?.webContents.send('ai-error', error); },
            });
        } catch (err: any) { mainWindow?.webContents.send('ai-error', err.message); }
    });
    ipcMain.handle('ai-stream-stop', async () => { aiAgent.abortStream(); });
    ipcMain.handle('ai-plan-project', async (_event, prompt: string, template: string, baseUrl?: string) => {
        try {
            if (baseUrl) aiAgent.setUrl(baseUrl);
            const plan = await aiAgent.planProject(prompt, template, (step: any) => { mainWindow?.webContents.send('build-step-update', step); }, baseUrl);
            return { success: true, plan };
        } catch (err: any) { return { success: false, error: err.message }; }
    });
    ipcMain.handle('ai-generate-files', async (_event, plan: any, baseUrl?: string) => {
        try {
            if (baseUrl) aiAgent.setUrl(baseUrl);
            const files = await aiAgent.generateProjectFiles(plan, (progress: any) => { mainWindow?.webContents.send('build-step-update', progress); }, baseUrl);
            return { success: true, files: Object.fromEntries(files) };
        } catch (err: any) { return { success: false, error: err.message }; }
    });

    // Project
    ipcMain.handle('project-create', async (_event, config: any) => {
        try {
            return await projectManager.createProject(config, (step: any) => { mainWindow?.webContents.send('build-step-update', step); });
        } catch (err: any) { return { success: false, error: err.message }; }
    });
    ipcMain.handle('install-dependencies', async (_event, projectPath: string, terminalId: string) => {
        try {
            return await dependencyInstaller.install(projectPath, terminalId, (progress: any) => {
                mainWindow?.webContents.send('build-step-update', progress);
            }, terminalManager);
        } catch (err: any) { return { success: false, error: err.message }; }
    });

    // Dialog
    ipcMain.handle('open-folder-dialog', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
        return null;
    });

    // Terminal: Execute command with output streaming
    ipcMain.handle('terminal-execute', async (_event, options: { command: string; cwd: string; sessionId?: string; timeout?: number }) => {
        const { command, cwd, sessionId, timeout = 180000 } = options;
        const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        return new Promise<{ success: boolean; output: string; exitCode: number; commandId: string; error?: string }>((resolve) => {
            let output = '';
            let resolved = false;

            // Ensure cwd exists
            const fs = require('fs');
            if (!fs.existsSync(cwd)) {
                try { fs.mkdirSync(cwd, { recursive: true }); } catch { }
            }

            const child = spawn(command, [], {
                shell: true,
                cwd,
                env: { ...process.env, FORCE_COLOR: '1' },
                windowsHide: true,
            });

            runningCommands.set(commandId, { process: child, running: true, exitCode: null, output: '' });

            const timer = timeout > 0 ? setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    try { child.kill(); } catch { }
                    const entry = runningCommands.get(commandId);
                    if (entry) { entry.running = false; entry.exitCode = -1; }
                    resolve({ success: false, output, exitCode: -1, commandId, error: 'Command timed out' });
                }
            }, timeout) : null;

            child.stdout?.on('data', (data: Buffer) => {
                const str = data.toString();
                output += str;
                const entry = runningCommands.get(commandId);
                if (entry) entry.output += str;
                if (sessionId && mainWindow) {
                    mainWindow.webContents.send(`terminal-data-${sessionId}`, str);
                }
            });

            child.stderr?.on('data', (data: Buffer) => {
                const str = data.toString();
                output += str;
                const entry = runningCommands.get(commandId);
                if (entry) entry.output += str;
                if (sessionId && mainWindow) {
                    mainWindow.webContents.send(`terminal-data-${sessionId}`, str);
                }
            });

            child.on('close', (code: number | null) => {
                if (!resolved) {
                    resolved = true;
                    if (timer) clearTimeout(timer);
                    const exitCode = code ?? -1;
                    const entry = runningCommands.get(commandId);
                    if (entry) { entry.running = false; entry.exitCode = exitCode; }
                    if (sessionId && mainWindow) {
                        mainWindow.webContents.send(`terminal-data-${sessionId}`,
                            `\r\n\x1b[${exitCode === 0 ? '32' : '31'}m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
                    }
                    resolve({ success: exitCode === 0, output, exitCode, commandId });
                }
            });

            child.on('error', (err: Error) => {
                if (!resolved) {
                    resolved = true;
                    if (timer) clearTimeout(timer);
                    const entry = runningCommands.get(commandId);
                    if (entry) { entry.running = false; entry.exitCode = -1; }
                    if (sessionId && mainWindow) {
                        mainWindow.webContents.send(`terminal-data-${sessionId}`,
                            `\r\n\x1b[31m[Error: ${err.message}]\x1b[0m\r\n`);
                    }
                    resolve({ success: false, output: err.message, exitCode: -1, commandId, error: err.message });
                }
            });
        });
    });

    // Terminal: Check command status
    ipcMain.handle('terminal-command-status', async (_event, commandId: string) => {
        const cmd = runningCommands.get(commandId);
        if (!cmd) return { found: false, running: false, exitCode: null };
        return { found: true, running: cmd.running, exitCode: cmd.exitCode, output: cmd.output };
    });

    // Terminal: Kill a running command
    ipcMain.handle('terminal-kill-command', async (_event, commandId: string) => {
        const cmd = runningCommands.get(commandId);
        if (cmd && cmd.running) {
            try { cmd.process.kill(); } catch { }
            cmd.running = false;
            cmd.exitCode = -1;
            return { success: true };
        }
        return { success: false, error: 'Command not found or already finished' };
    });

    // Terminal: Launch a long-running dev server
    ipcMain.handle('terminal-launch-dev-server', async (_event, options: { command: string; cwd: string; sessionId?: string; port: number; timeout?: number }) => {
        const { command, cwd, sessionId, port, timeout = 60000 } = options;

        return new Promise<{ success: boolean; url: string; error?: string }>((resolve) => {
            let resolved = false;

            const fs = require('fs');
            if (!fs.existsSync(cwd)) {
                resolve({ success: false, url: '', error: `Directory not found: ${cwd}` });
                return;
            }

            const child = spawn(command, [], {
                shell: true,
                cwd,
                env: { ...process.env, FORCE_COLOR: '1', BROWSER: 'none' },
                windowsHide: true,
            });

            // Store reference so it can be cleaned up on app quit
            const commandId = `dev-server-${Date.now()}`;
            runningCommands.set(commandId, { process: child, running: true, exitCode: null, output: '' });

            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    // Server didn't start in time — but process may still be starting
                    // Don't kill it, just report timeout
                    resolve({ success: false, url: '', error: `Dev server did not start within ${timeout / 1000}s` });
                }
            }, timeout);

            // Ready signal patterns from various dev servers
            const readyPatterns = [
                /ready in/i,
                /local:\s*http/i,
                /started server on/i,
                /listening on/i,
                /compiled successfully/i,
                /webpack compiled/i,
                /server running at/i,
                /localhost:\d+/i,
                /\son port\s+\d+/i,
            ];

            function checkOutput(str: string) {
                if (resolved) return;
                for (const pattern of readyPatterns) {
                    if (pattern.test(str)) {
                        // Give the server a moment to fully bind
                        setTimeout(() => {
                            if (!resolved) {
                                resolved = true;
                                clearTimeout(timer);
                                resolve({ success: true, url: `http://localhost:${port}` });
                            }
                        }, 1500);
                        return;
                    }
                }
            }

            // Also poll the port as a fallback
            const pollInterval = setInterval(() => {
                if (resolved) { clearInterval(pollInterval); return; }
                const sock = new net.Socket();
                sock.setTimeout(500);
                sock.once('connect', () => {
                    sock.destroy();
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        clearInterval(pollInterval);
                        resolve({ success: true, url: `http://localhost:${port}` });
                    }
                });
                sock.once('error', () => sock.destroy());
                sock.once('timeout', () => sock.destroy());
                sock.connect(port, '127.0.0.1');
            }, 2000);

            child.stdout?.on('data', (data: Buffer) => {
                const str = data.toString();
                const entry = runningCommands.get(commandId);
                if (entry) entry.output += str;
                if (sessionId && mainWindow) {
                    mainWindow.webContents.send(`terminal-data-${sessionId}`, str);
                }
                checkOutput(str);
            });

            child.stderr?.on('data', (data: Buffer) => {
                const str = data.toString();
                const entry = runningCommands.get(commandId);
                if (entry) entry.output += str;
                if (sessionId && mainWindow) {
                    mainWindow.webContents.send(`terminal-data-${sessionId}`, str);
                }
                checkOutput(str);
            });

            child.on('close', (code: number | null) => {
                clearInterval(pollInterval);
                const entry = runningCommands.get(commandId);
                if (entry) { entry.running = false; entry.exitCode = code ?? -1; }
                if (sessionId && mainWindow) {
                    mainWindow.webContents.send(`terminal-data-${sessionId}`,
                        `\r\n\x1b[${code === 0 ? '32' : '31'}m[Dev server exited with code ${code}]\x1b[0m\r\n`);
                }
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    resolve({ success: false, url: '', error: `Dev server exited with code ${code}` });
                }
            });

            child.on('error', (err: Error) => {
                clearInterval(pollInterval);
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    resolve({ success: false, url: '', error: err.message });
                }
            });
        });
    });

    // System
    ipcMain.handle('get-home-dir', () => os.homedir());
    ipcMain.handle('get-platform', () => process.platform);
    ipcMain.handle('get-lmstudio-models', async (_event, baseUrl: string) => aiAgent.getLMStudioModels(baseUrl));
    ipcMain.handle('test-lmstudio-connection', async (_event, baseUrl: string) => aiAgent.testConnection(baseUrl));
    ipcMain.handle('open-external', async (_event, url: string) => { shell.openExternal(url); });
}

// ── App Lifecycle ──
app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    terminalManager.destroyAll();
    fileSystemManager.stopWatching();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    terminalManager.destroyAll();
    fileSystemManager.stopWatching();
    // Kill any running commands (dev servers, etc.)
    for (const [, entry] of runningCommands) {
        if (entry.running) {
            try { entry.process.kill(); } catch { }
        }
    }
    runningCommands.clear();
});

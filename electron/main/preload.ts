/**
 * The Joker - Electron Desktop App
 * Preload Script — Secure context bridge for renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
    // ── Terminal ──
    terminal: {
        create: (id: string, cwd?: string) => ipcRenderer.invoke('terminal-create', id, cwd),
        write: (id: string, data: string) => ipcRenderer.invoke('terminal-write', id, data),
        resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal-resize', id, cols, rows),
        destroy: (id: string) => ipcRenderer.invoke('terminal-destroy', id),
        execute: (options: { command: string; cwd: string; sessionId?: string; timeout?: number }) =>
            ipcRenderer.invoke('terminal-execute', options),
        launchDevServer: (options: { command: string; cwd: string; sessionId?: string; port: number; timeout?: number }) =>
            ipcRenderer.invoke('terminal-launch-dev-server', options),
        checkCommandStatus: (commandId: string) =>
            ipcRenderer.invoke('terminal-command-status', commandId),
        killCommand: (commandId: string) =>
            ipcRenderer.invoke('terminal-kill-command', commandId),
        onData: (id: string, callback: (data: string) => void) => {
            const channel = `terminal-data-${id}`;
            const handler = (_event: any, data: string) => callback(data);
            ipcRenderer.on(channel, handler);
            return () => ipcRenderer.removeListener(channel, handler);
        },
        onExit: (id: string, callback: (exitCode: number) => void) => {
            const channel = `terminal-exit-${id}`;
            const handler = (_event: any, exitCode: number) => callback(exitCode);
            ipcRenderer.on(channel, handler);
            return () => ipcRenderer.removeListener(channel, handler);
        },
    },

    // ── File System ──
    fs: {
        readDir: (dirPath: string) => ipcRenderer.invoke('fs-read-dir', dirPath),
        readFile: (filePath: string) => ipcRenderer.invoke('fs-read-file', filePath),
        writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs-write-file', filePath, content),
        deleteItem: (itemPath: string) => ipcRenderer.invoke('fs-delete', itemPath),
        rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs-rename', oldPath, newPath),
        createItem: (parentPath: string, name: string, type: 'file' | 'directory') =>
            ipcRenderer.invoke('fs-create', parentPath, name, type),
        watchStart: (dirPath: string) => ipcRenderer.invoke('fs-watch-start', dirPath),
        watchStop: () => ipcRenderer.invoke('fs-watch-stop'),
        onFileChange: (callback: (event: any) => void) => {
            const handler = (_event: any, data: any) => callback(data);
            ipcRenderer.on('fs-change', handler);
            return () => ipcRenderer.removeListener('fs-change', handler);
        },
    },

    // ── AI ──
    ai: {
        streamStart: (config: any) => ipcRenderer.invoke('ai-stream-start', config),
        streamStop: () => ipcRenderer.invoke('ai-stream-stop'),
        planProject: (prompt: string, template: string, baseUrl?: string) => ipcRenderer.invoke('ai-plan-project', prompt, template, baseUrl),
        generateFiles: (plan: any, baseUrl?: string) => ipcRenderer.invoke('ai-generate-files', plan, baseUrl),
        onToken: (callback: (token: string) => void) => {
            const handler = (_event: any, token: string) => callback(token);
            ipcRenderer.on('ai-token', handler);
            return () => ipcRenderer.removeListener('ai-token', handler);
        },
        onComplete: (callback: (response: string) => void) => {
            const handler = (_event: any, response: string) => callback(response);
            ipcRenderer.on('ai-complete', handler);
            return () => ipcRenderer.removeListener('ai-complete', handler);
        },
        onError: (callback: (error: string) => void) => {
            const handler = (_event: any, error: string) => callback(error);
            ipcRenderer.on('ai-error', handler);
            return () => ipcRenderer.removeListener('ai-error', handler);
        },
    },

    // ── Project ──
    project: {
        create: (config: any) => ipcRenderer.invoke('project-create', config),
        installDependencies: (projectPath: string, terminalId: string) =>
            ipcRenderer.invoke('install-dependencies', projectPath, terminalId),
        onProgress: (callback: (step: any) => void) => {
            const handler = (_event: any, step: any) => callback(step);
            ipcRenderer.on('build-step-update', handler);
            return () => ipcRenderer.removeListener('build-step-update', handler);
        },
    },

    // ── Dialog ──
    dialog: {
        openFolder: () => ipcRenderer.invoke('open-folder-dialog'),
    },

    // ── System ──
    system: {
        getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
        getPlatform: () => ipcRenderer.invoke('get-platform'),
        getLMStudioModels: (baseUrl: string) => ipcRenderer.invoke('get-lmstudio-models', baseUrl),
        testLMConnection: (baseUrl: string) => ipcRenderer.invoke('test-lmstudio-connection', baseUrl),
        openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    },

    // ── Menu events from main process ──
    onMenuEvent: (event: string, callback: () => void) => {
        const handler = () => callback();
        ipcRenderer.on(event, handler);
        return () => ipcRenderer.removeListener(event, handler);
    },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

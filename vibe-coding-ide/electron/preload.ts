/**
 * Vibe Coding IDE — Electron Preload Script
 * Exposes a safe API to the renderer via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

// ── Type-safe API for the renderer ──
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
        onData: (id: string, callback: (data: string) => void) => {
            const channel = `terminal-data-${id}`;
            const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
            ipcRenderer.on(channel, handler);
            return () => ipcRenderer.removeListener(channel, handler);
        },
        onExit: (id: string, callback: (exitCode: number) => void) => {
            const channel = `terminal-exit-${id}`;
            const handler = (_event: Electron.IpcRendererEvent, exitCode: number) => callback(exitCode);
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
            const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
            ipcRenderer.on('fs-change', handler);
            return () => ipcRenderer.removeListener('fs-change', handler);
        },
    },

    // ── AI ──
    ai: {
        streamStart: (config: any) => ipcRenderer.invoke('ai-stream-start', config),
        streamStop: () => ipcRenderer.invoke('ai-stream-stop'),
        planProject: (prompt: string, template: string, baseUrl?: string, model?: string) =>
            ipcRenderer.invoke('ai-plan-project', prompt, template, baseUrl, model),
        generateFiles: (plan: any, baseUrl?: string, model?: string) =>
            ipcRenderer.invoke('ai-generate-files', plan, baseUrl, model),
        applyFile: (projectRoot: string, relativePath: string, content: string) =>
            ipcRenderer.invoke('ai-apply-file', projectRoot, relativePath, content),
        runTerminal: (terminalId: string, command: string) =>
            ipcRenderer.invoke('ai-run-terminal', terminalId, command),
        readTerminalOutput: (terminalId: string, maxLines?: number) =>
            ipcRenderer.invoke('ai-read-terminal-output', terminalId, maxLines),
        listProjectFiles: (projectRoot: string) =>
            ipcRenderer.invoke('ai-list-project-files', projectRoot),
        onToken: (callback: (token: string) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, token: string) => callback(token);
            ipcRenderer.on('ai-token', handler);
            return () => ipcRenderer.removeListener('ai-token', handler);
        },
        onComplete: (callback: (response: string) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, response: string) => callback(response);
            ipcRenderer.on('ai-complete', handler);
            return () => ipcRenderer.removeListener('ai-complete', handler);
        },
        onError: (callback: (error: string) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
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
            const handler = (_event: Electron.IpcRendererEvent, step: any) => callback(step);
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

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for use in renderer
export type ElectronAPI = typeof electronAPI;

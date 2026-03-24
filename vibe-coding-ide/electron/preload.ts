/**
 * ENDj0K3R — Electron Preload Script v2.0
 * Exposes a safe API to the renderer via contextBridge
 * Includes new pentest channels: approval, KB, streaming, report, resume, payload
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

    // ── Pentest (ENDj0K3R) v2.0 ──
    pentest: {
        // Session lifecycle
        startSession: (config: { target: string; customInstruction?: string; model?: string; baseUrl?: string; mode?: string }) =>
            ipcRenderer.invoke('pentest-start', config),
        pauseSession: () => ipcRenderer.invoke('pentest-pause'),
        resumeSession: (instruction?: string) => ipcRenderer.invoke('pentest-resume', instruction),
        stopSession: () => ipcRenderer.invoke('pentest-stop'),
        injectInstruction: (text: string) => ipcRenderer.invoke('pentest-inject', text),
        getState: () => ipcRenderer.invoke('pentest-get-state'),

        // Session management
        listSessions: () => ipcRenderer.invoke('pentest-list-sessions'),
        loadSession: (id: string) => ipcRenderer.invoke('pentest-load-session', id),
        deleteSession: (id: string) => ipcRenderer.invoke('pentest-delete-session', id),
        resumeSavedSession: (id: string) => ipcRenderer.invoke('pentest-resume-session', id),

        // Execution mode
        setMode: (mode: string) => ipcRenderer.invoke('pentest-set-mode', mode),
        getMode: () => ipcRenderer.invoke('pentest-get-mode'),

        // Human-in-the-loop
        approveCommand: (editedCommand?: string) => ipcRenderer.invoke('pentest-approve-command', editedCommand),
        rejectCommand: () => ipcRenderer.invoke('pentest-reject-command'),

        // Knowledge base
        getKB: () => ipcRenderer.invoke('pentest-get-kb'),

        // Report
        generateReport: () => ipcRenderer.invoke('pentest-generate-report'),

        // Payload generator
        generatePayload: (config: { type: string; language: string; lhost: string; lport: number; encoding?: string }) =>
            ipcRenderer.invoke('pentest-generate-payload', config),

        // Events
        onActivity: (callback: (item: any) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, item: any) => callback(item);
            ipcRenderer.on('pentest-activity', handler);
            return () => ipcRenderer.removeListener('pentest-activity', handler);
        },
        onStateChange: (callback: (state: string) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, state: string) => callback(state);
            ipcRenderer.on('pentest-state-change', handler);
            return () => ipcRenderer.removeListener('pentest-state-change', handler);
        },
        onFlagFound: (callback: (flag: any) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, flag: any) => callback(flag);
            ipcRenderer.on('pentest-flag-found', handler);
            return () => ipcRenderer.removeListener('pentest-flag-found', handler);
        },
        onStreamingToken: (callback: (data: { token: string; agentRole: string; fullContent: string }) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
            ipcRenderer.on('pentest-streaming-token', handler);
            return () => ipcRenderer.removeListener('pentest-streaming-token', handler);
        },
        onCommandApproval: (callback: (approval: any) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, approval: any) => callback(approval);
            ipcRenderer.on('pentest-command-approval', handler);
            return () => ipcRenderer.removeListener('pentest-command-approval', handler);
        },
        onKBUpdate: (callback: (kb: any) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, kb: any) => callback(kb);
            ipcRenderer.on('pentest-kb-update', handler);
            return () => ipcRenderer.removeListener('pentest-kb-update', handler);
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

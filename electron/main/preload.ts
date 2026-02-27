/**
 * The Joker - Electron Desktop App
 * Preload Script — Secure context bridge for renderer
 * Exposes both the original jokerAPI and the new electronAPI for IDE features
 */

const { contextBridge, ipcRenderer } = require('electron');

// ── Original Joker API (existing functionality) ──
contextBridge.exposeInMainWorld('jokerAPI', {
    // Config
    isFirstRun: () => ipcRenderer.invoke('config:isFirstRun'),
    saveConfig: (config: Record<string, string>) => ipcRenderer.invoke('config:save', config),
    getConfig: () => ipcRenderer.invoke('config:get'),

    // Connection
    testConnection: (baseUrl?: string) => ipcRenderer.invoke('connection:test', baseUrl),
    getConnectionStatus: () => ipcRenderer.invoke('connection:status'),
    connectBackend: () => ipcRenderer.invoke('backend:connect'),

    // Chat
    sendMessage: (message: string) => ipcRenderer.invoke('chat:send', message),
    onStreamChunk: (callback: (chunk: string) => void) => {
        ipcRenderer.on('chat:stream', (_: any, chunk: string) => callback(chunk));
    },
    onStreamEnd: (callback: (fullResponse: string) => void) => {
        ipcRenderer.on('chat:stream-end', (_: any, full: string) => callback(full));
    },
    onStreamError: (callback: (error: string) => void) => {
        ipcRenderer.on('chat:stream-error', (_: any, error: string) => callback(error));
    },

    // Agent Events
    onAgentStateChange: (callback: (data: any) => void) => {
        ipcRenderer.on('agent:state-change', (_: any, data: any) => callback(data));
    },
    onAgentThought: (callback: (data: any) => void) => {
        ipcRenderer.on('agent:thought', (_: any, data: any) => callback(data));
    },
    onAgentPlan: (callback: (data: any) => void) => {
        ipcRenderer.on('agent:plan', (_: any, data: any) => callback(data));
    },
    onAgentStepComplete: (callback: (data: any) => void) => {
        ipcRenderer.on('agent:step-complete', (_: any, data: any) => callback(data));
    },
    onAgentCorrection: (callback: (data: any) => void) => {
        ipcRenderer.on('agent:correction', (_: any, data: any) => callback(data));
    },
    onAgentGoalAchieved: (callback: (data: any) => void) => {
        ipcRenderer.on('agent:goal-achieved', (_: any, data: any) => callback(data));
    },
    onAgentGoalFailed: (callback: (data: any) => void) => {
        ipcRenderer.on('agent:goal-failed', (_: any, data: any) => callback(data));
    },

    // Tools
    runRecon: (domain: string) => ipcRenderer.invoke('tool:recon', domain),
    onReconProgress: (callback: (data: any) => void) => {
        ipcRenderer.on('recon:progress', (_: any, data: any) => callback(data));
    },
    runVibe: (prompt: string) => ipcRenderer.invoke('tool:vibe', prompt),
    refineVibe: (prompt: string) => ipcRenderer.invoke('tool:vibe-refine', prompt),
    stopVibe: () => ipcRenderer.invoke('tool:vibe-stop'),
    onVibeProgress: (callback: (data: any) => void) => {
        ipcRenderer.on('vibe:progress', (_: any, data: any) => callback(data));
    },

    // Window Controls
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
});

// ── IDE Feature API (new Vibe Coding IDE functionality) ──
contextBridge.exposeInMainWorld('electronAPI', {
    // Terminal
    terminal: {
        create: (id: string, cwd?: string) => ipcRenderer.invoke('terminal-create', id, cwd),
        write: (id: string, data: string) => ipcRenderer.invoke('terminal-write', id, data),
        resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal-resize', id, cols, rows),
        destroy: (id: string) => ipcRenderer.invoke('terminal-destroy', id),
        onData: (id: string, callback: (data: string) => void) => {
            const handler = (_: any, data: string) => callback(data);
            ipcRenderer.on(`terminal-data-${id}`, handler);
            return () => ipcRenderer.removeListener(`terminal-data-${id}`, handler);
        },
        onExit: (id: string, callback: (code: number) => void) => {
            const handler = (_: any, code: number) => callback(code);
            ipcRenderer.on(`terminal-exit-${id}`, handler);
            return () => ipcRenderer.removeListener(`terminal-exit-${id}`, handler);
        },
    },

    // File System
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
            const handler = (_: any, event: any) => callback(event);
            ipcRenderer.on('fs-change', handler);
            return () => ipcRenderer.removeListener('fs-change', handler);
        },
    },

    // AI
    ai: {
        streamStart: (config: any) => ipcRenderer.invoke('ai-stream-start', config),
        streamStop: () => ipcRenderer.invoke('ai-stream-stop'),
        planProject: (prompt: string, template: string) => ipcRenderer.invoke('ai-plan-project', prompt, template),
        generateFiles: (plan: any) => ipcRenderer.invoke('ai-generate-files', plan),
        onToken: (callback: (token: string) => void) => {
            const handler = (_: any, token: string) => callback(token);
            ipcRenderer.on('ai-token', handler);
            return () => ipcRenderer.removeListener('ai-token', handler);
        },
        onComplete: (callback: (response: string) => void) => {
            const handler = (_: any, response: string) => callback(response);
            ipcRenderer.on('ai-complete', handler);
            return () => ipcRenderer.removeListener('ai-complete', handler);
        },
        onError: (callback: (error: string) => void) => {
            const handler = (_: any, error: string) => callback(error);
            ipcRenderer.on('ai-error', handler);
            return () => ipcRenderer.removeListener('ai-error', handler);
        },
    },

    // Project
    project: {
        create: (config: any) => ipcRenderer.invoke('project-create', config),
        installDependencies: (projectPath: string, terminalId: string) =>
            ipcRenderer.invoke('install-dependencies', projectPath, terminalId),
    },

    // Dialog
    dialog: {
        openFolder: () => ipcRenderer.invoke('open-folder-dialog'),
    },

    // System
    system: {
        getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
        getPlatform: () => ipcRenderer.invoke('get-platform'),
        getLMStudioModels: (baseUrl: string) => ipcRenderer.invoke('get-lmstudio-models', baseUrl),
        testLMConnection: (baseUrl: string) => ipcRenderer.invoke('test-lmstudio-connection', baseUrl),
    },

    // Menu events
    onMenuEvent: (event: string, callback: () => void) => {
        const handler = () => callback();
        ipcRenderer.on(event, handler);
        return () => ipcRenderer.removeListener(event, handler);
    },
});

/**
 * The Joker - Electron Desktop App
 * Preload Script — Secure context bridge for renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jokerAPI', {
    // ── Config ──
    isFirstRun: () => ipcRenderer.invoke('config:isFirstRun'),
    saveConfig: (config: Record<string, string>) => ipcRenderer.invoke('config:save', config),
    getConfig: () => ipcRenderer.invoke('config:get'),

    // ── Connection ──
    testConnection: (baseUrl?: string) => ipcRenderer.invoke('connection:test', baseUrl),
    getConnectionStatus: () => ipcRenderer.invoke('connection:status'),
    connectBackend: () => ipcRenderer.invoke('backend:connect'),

    // ── Chat ──
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

    // ── Agent Events ──
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

    // ── Tools ──
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

    // ── Window Controls ──
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
});

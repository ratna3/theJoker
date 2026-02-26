/**
 * The Joker - Electron Desktop App
 * IPC Handlers — Bridge between renderer and backend
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import { isFirstRun, getConfig, saveConfig, loadEnvIntoProcess } from './config-store';

// We load from compiled dist
const BACKEND_PATH = path.resolve(__dirname, '..', '..', '..', 'dist');

let llmClient: any = null;
let agent: any = null;
let reconPipeline: any = null;
let vibePipeline: any = null;

/**
 * Initialize the backend by importing compiled modules
 */
function getBackendModules() {
    // Ensure env is loaded before importing backend modules
    loadEnvIntoProcess();

    const { LMStudioClient } = require(path.join(BACKEND_PATH, 'llm', 'client'));
    const { getAgent, getMemory } = require(path.join(BACKEND_PATH, 'agents'));
    const { ReconPipeline } = require(path.join(BACKEND_PATH, 'tools', 'recon'));
    const { VibeCodingPipeline } = require(path.join(BACKEND_PATH, 'agents', 'vibe-coder'));

    return { LMStudioClient, getAgent, getMemory, ReconPipeline, VibeCodingPipeline };
}

/**
 * Initialize the LLM client and agent
 */
function initializeBackend(mainWindow: BrowserWindow) {
    const config = getConfig();
    const { LMStudioClient, getAgent } = getBackendModules();

    // Create client with current config
    llmClient = new LMStudioClient({
        baseUrl: config.LM_STUDIO_BASE_URL,
        model: config.LM_STUDIO_MODEL,
        apiKey: config.LM_STUDIO_API_KEY || 'not-needed',
    });

    // Create agent
    agent = getAgent(llmClient, {
        maxIterations: 10,
        maxCorrections: 3,
        enableLearning: true,
        verboseMode: false,
    });

    // Forward agent events to renderer
    setupAgentEvents(mainWindow);

    return { llmClient, agent };
}

/**
 * Wire agent events to the renderer via IPC
 */
function setupAgentEvents(mainWindow: BrowserWindow) {
    if (!agent) return;

    agent.on('state:change', (data: any) => {
        mainWindow.webContents.send('agent:state-change', data);
    });

    agent.on('thought', (data: any) => {
        mainWindow.webContents.send('agent:thought', {
            reasoning: data.reasoning,
            confidence: data.confidence,
        });
    });

    agent.on('plan:created', (plan: any) => {
        mainWindow.webContents.send('agent:plan', {
            id: plan.id,
            intent: plan.intent,
            query: plan.query,
            steps: plan.steps.map((s: any) => ({
                id: s.id,
                description: s.description,
                tool: s.tool,
            })),
        });
    });

    agent.on('step:complete', (data: any) => {
        mainWindow.webContents.send('agent:step-complete', {
            stepId: data.step.id,
            description: data.step.description,
            success: data.result.success,
            time: data.result.metadata?.executionTime,
        });
    });

    agent.on('correction', (data: any) => {
        mainWindow.webContents.send('agent:correction', data);
    });

    agent.on('goal:achieved', (data: any) => {
        mainWindow.webContents.send('agent:goal-achieved', data);
    });

    agent.on('goal:failed', (data: any) => {
        mainWindow.webContents.send('agent:goal-failed', data);
    });
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
    // ── Config Handlers ──
    ipcMain.handle('config:isFirstRun', () => isFirstRun());

    ipcMain.handle('config:get', () => getConfig());

    ipcMain.handle('config:save', (_event, config: Record<string, string>) => {
        saveConfig(config);
        return { success: true };
    });

    // ── Connection Handlers ──
    ipcMain.handle('connection:test', async (_event, baseUrl?: string) => {
        try {
            const { LMStudioClient } = getBackendModules();
            const testClient = new LMStudioClient({
                baseUrl: baseUrl || getConfig().LM_STUDIO_BASE_URL,
            });
            const connected = await testClient.testConnection();
            let models: string[] = [];
            if (connected) {
                try {
                    models = await testClient.getModelNames();
                } catch { /* ignore */ }
            }
            testClient.destroy();
            return { connected, models };
        } catch (error: any) {
            return { connected: false, error: error.message, models: [] };
        }
    });

    ipcMain.handle('connection:status', () => {
        if (!llmClient) return { connected: false, model: null };
        return {
            connected: llmClient.isHealthy(),
            model: llmClient.getConfig().model,
            baseUrl: llmClient.getConfig().baseUrl,
        };
    });

    ipcMain.handle('backend:connect', async () => {
        try {
            initializeBackend(mainWindow);
            const connected = await llmClient.testConnection();
            return { success: connected };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // ── Chat Handlers ──
    ipcMain.handle('chat:send', async (_event, message: string) => {
        if (!agent) {
            try {
                initializeBackend(mainWindow);
            } catch (error: any) {
                mainWindow.webContents.send('chat:stream-error', error.message);
                return { success: false, error: error.message };
            }
        }

        try {
            // Use the agent for processing
            const result = await agent.run(message);

            // Send final answer
            mainWindow.webContents.send('chat:stream-end', result.finalAnswer);

            return {
                success: true,
                answer: result.finalAnswer,
                iterations: result.iterations,
                corrections: result.corrections?.length || 0,
                totalTime: result.totalTime,
            };
        } catch (error: any) {
            mainWindow.webContents.send('chat:stream-error', error.message);
            return { success: false, error: error.message };
        }
    });

    // ── Recon Handler ──
    ipcMain.handle('tool:recon', async (_event, domain: string) => {
        try {
            const { ReconPipeline } = getBackendModules();
            reconPipeline = new ReconPipeline();

            reconPipeline.on('module:start', (name: string) => {
                mainWindow.webContents.send('recon:progress', { type: 'start', name });
            });
            reconPipeline.on('module:complete', (name: string) => {
                mainWindow.webContents.send('recon:progress', { type: 'complete', name });
            });

            const result = await reconPipeline.recon(domain);
            const report = reconPipeline.generateReport(result);

            return { success: true, result, report };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    // ── Vibe Coding Handlers ──
    ipcMain.handle('tool:vibe', async (_event, prompt: string) => {
        try {
            if (!llmClient) initializeBackend(mainWindow);
            const { VibeCodingPipeline } = getBackendModules();
            vibePipeline = new VibeCodingPipeline(llmClient);

            vibePipeline.on('step:detail', (data: any) => {
                mainWindow.webContents.send('vibe:progress', { type: 'detail', ...data });
            });
            vibePipeline.on('step:complete', (step: string) => {
                mainWindow.webContents.send('vibe:progress', { type: 'complete', step });
            });
            vibePipeline.on('pipeline:error', (data: any) => {
                mainWindow.webContents.send('vibe:progress', { type: 'error', ...data });
            });

            const result = await vibePipeline.run(prompt);
            return { success: result.success, ...result };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('tool:vibe-refine', async (_event, prompt: string) => {
        if (!vibePipeline || !vibePipeline.isLiveSession()) {
            return { success: false, error: 'No vibe session running' };
        }
        try {
            const result = await vibePipeline.refine(prompt);
            return { success: result.success, ...result };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('tool:vibe-stop', async () => {
        if (vibePipeline && vibePipeline.isLiveSession()) {
            await vibePipeline.cleanup();
            vibePipeline = null;
            return { success: true };
        }
        return { success: false, error: 'No session running' };
    });

    // ── Window Controls ──
    ipcMain.handle('window:minimize', () => mainWindow.minimize());
    ipcMain.handle('window:maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.handle('window:close', () => mainWindow.close());
}

/**
 * Cleanup backend resources
 */
export function cleanupBackend(): void {
    try {
        if (agent) {
            agent.cancel();
        }
        if (llmClient) {
            llmClient.destroy();
        }
        if (vibePipeline) {
            vibePipeline.cleanup().catch(() => { });
        }
        const { getMemory } = getBackendModules();
        const memory = getMemory();
        memory.persist();
    } catch { /* ignore cleanup errors */ }
}

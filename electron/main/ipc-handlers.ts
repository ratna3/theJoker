/**
 * The Joker - Electron Desktop App
 * IPC Handlers — Bridge between renderer and backend + IDE features
 */

import { ipcMain, BrowserWindow, app, dialog, Menu, shell } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { isFirstRun, getConfig, saveConfig, loadEnvIntoProcess } from './config-store';
import { TerminalManager } from './terminal-manager';
import { FileSystemManager } from './filesystem-manager';

/**
 * Resolve backend dist path:
 * - Dev:      e:\theJoker\dist\
 * - Packaged: resources\backend\   (set by extraResources in electron-builder)
 */
function getBackendPath(): string {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'backend');
    }
    return path.resolve(__dirname, '..', '..', '..', 'dist');
}

let llmClient: any = null;
let agent: any = null;
let reconPipeline: any = null;
let vibePipeline: any = null;
let vibeTerminalShell: ChildProcess | null = null;
let vibeProjectPath: string | null = null;

/**
 * Spawn an interactive terminal shell in the project directory.
 * This gives users the ability to run commands manually (npm, git, etc.)
 */
function spawnVibeTerminal(projectPath: string, mainWindow: BrowserWindow): void {
    // Kill any existing terminal
    if (vibeTerminalShell) {
        try { vibeTerminalShell.kill(); } catch { /* ignore */ }
        vibeTerminalShell = null;
    }

    const isWin = process.platform === 'win32';
    const shellCmd = isWin ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe') : (process.env.SHELL || '/bin/bash');
    const shellArgs = isWin ? [] : [];

    try {
        vibeTerminalShell = spawn(shellCmd, shellArgs, {
            cwd: projectPath,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, FORCE_COLOR: '1' },
        });

        vibeTerminalShell.stdout?.on('data', (data: Buffer) => {
            mainWindow.webContents.send('vibe:terminal-data', data.toString());
        });

        vibeTerminalShell.stderr?.on('data', (data: Buffer) => {
            mainWindow.webContents.send('vibe:terminal-data', data.toString());
        });

        vibeTerminalShell.on('exit', (code) => {
            mainWindow.webContents.send('vibe:terminal-data', `\r\n[Terminal exited with code ${code}]\r\n`);
            vibeTerminalShell = null;
        });

        vibeTerminalShell.on('error', (err) => {
            mainWindow.webContents.send('vibe:terminal-data', `\r\n[Terminal error: ${err.message}]\r\n`);
            vibeTerminalShell = null;
        });
    } catch (err: any) {
        mainWindow.webContents.send('vibe:terminal-data', `\r\n[Failed to start terminal: ${err.message}]\r\n`);
    }
}

/**
 * Direct HTTP connection test using Node.js built-in http/https.
 * Does NOT require backend modules or axios — safe for packaged builds.
 */
function directTestConnection(baseUrl: string): Promise<{ connected: boolean; models: string[]; error?: string }> {
    return new Promise((resolve) => {
        try {
            const parsed = new URL('/v1/models', baseUrl);
            const mod = parsed.protocol === 'https:' ? https : http;

            const req = mod.get(parsed.toString(), { timeout: 8000 }, (res) => {
                let data = '';
                res.on('data', (chunk: Buffer | string) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const models = (json.data || []).map((m: any) => m.id);
                        resolve({ connected: true, models });
                    } catch {
                        resolve({ connected: true, models: [] });
                    }
                });
            });

            req.on('error', (err: Error) => {
                resolve({ connected: false, models: [], error: err.message });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ connected: false, models: [], error: 'Connection timed out' });
            });
        } catch (err: any) {
            resolve({ connected: false, models: [], error: err.message });
        }
    });
}

// IDE managers
const terminalManager = new TerminalManager();
const fileSystemManager = new FileSystemManager();

/**
 * Initialize the backend by importing compiled modules
 */
function getBackendModules() {
    // Ensure env is loaded before importing backend modules
    loadEnvIntoProcess();

    const bp = getBackendPath();
    const { LMStudioClient } = require(path.join(bp, 'llm', 'client'));
    const { getAgent, getMemory } = require(path.join(bp, 'agents'));
    const { ReconPipeline } = require(path.join(bp, 'tools', 'recon'));
    const { VibeCodingPipeline } = require(path.join(bp, 'agents', 'vibe-coder'));

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
 * Register all IPC handlers (existing + IDE)
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
    // Direct HTTP test — avoids loading backend modules (no axios dependency)
    ipcMain.handle('connection:test', async (_event, baseUrl?: string) => {
        const url = baseUrl || getConfig().LM_STUDIO_BASE_URL;
        return directTestConnection(url);
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
            const result = await agent.run(message);
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
            vibePipeline.on('file:written', (filePath: string) => {
                mainWindow.webContents.send('vibe:file-changed', { type: 'created', filePath });
            });
            vibePipeline.on('install:output', (line: string) => {
                mainWindow.webContents.send('vibe:terminal-data', line + '\r\n');
            });
            // Listen for project path being set (emitted after scaffold)
            vibePipeline.on('project:path', (projectPath: string) => {
                vibeProjectPath = projectPath;
                mainWindow.webContents.send('vibe:project-path', projectPath);
                // Spawn interactive terminal in project dir
                spawnVibeTerminal(projectPath, mainWindow);
            });

            // Use user Documents folder for projects (not process.cwd() which fails in packaged apps)
            const projectsDir = path.join(app.getPath('documents'), 'TheJoker', 'projects');
            // Ensure directory exists
            if (!fs.existsSync(projectsDir)) {
                fs.mkdirSync(projectsDir, { recursive: true });
            }

            const result = await vibePipeline.run(prompt, projectsDir);

            // Track project path for file explorer
            if (result.projectPath) {
                vibeProjectPath = result.projectPath;
            }

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
        // Cleanup terminal
        if (vibeTerminalShell) {
            try { vibeTerminalShell.kill(); } catch { /* ignore */ }
            vibeTerminalShell = null;
        }
        if (vibePipeline && vibePipeline.isLiveSession()) {
            await vibePipeline.cleanup();
            vibePipeline = null;
            return { success: true };
        }
        return { success: false, error: 'No session running' };
    });

    // ── Vibe IDE: File System Handlers ──
    ipcMain.handle('vibe:read-file', async (_event, filePath: string) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return { success: true, content };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('vibe:list-dir', async (_event, dirPath: string) => {
        try {
            const targetPath = dirPath || vibeProjectPath;
            if (!targetPath) return { success: false, error: 'No project path' };

            const entries = fs.readdirSync(targetPath, { withFileTypes: true });
            const items = entries
                .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
                .sort((a, b) => {
                    // Folders first, then files
                    if (a.isDirectory() && !b.isDirectory()) return -1;
                    if (!a.isDirectory() && b.isDirectory()) return 1;
                    return a.name.localeCompare(b.name);
                })
                .map(e => ({
                    name: e.name,
                    path: path.join(targetPath, e.name),
                    isDir: e.isDirectory(),
                }));
            return { success: true, items, rootPath: targetPath };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // ── Vibe IDE: Terminal Handlers ──
    ipcMain.on('vibe:terminal-write', (_event, data: string) => {
        if (vibeTerminalShell && vibeTerminalShell.stdin) {
            vibeTerminalShell.stdin.write(data);
        }
    });

    ipcMain.on('vibe:terminal-resize', (_event, _cols: number, _rows: number) => {
        // Resize not supported with basic spawn; requires node-pty for proper resize
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

    // ═══════════════════════════════════════════════════════
    // ══ IDE Feature IPC Handlers ══════════════════════════
    // ═══════════════════════════════════════════════════════

    // ── Terminal IPC ──
    ipcMain.handle('terminal-create', async (_event, id: string, cwd?: string) => {
        try {
            terminalManager.create(id, cwd || os.homedir());
            terminalManager.onData(id, (data: string) => {
                mainWindow.webContents.send(`terminal-data-${id}`, data);
            });
            terminalManager.onExit(id, (exitCode: number) => {
                mainWindow.webContents.send(`terminal-exit-${id}`, exitCode);
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
            mainWindow.webContents.send('fs-change', event);
        });
    });

    ipcMain.handle('fs-watch-stop', async () => {
        fileSystemManager.stopWatching();
    });

    // ── AI Streaming IPC (for IDE chat) ──
    ipcMain.handle('ai-stream-start', async (_event, config: any) => {
        try {
            if (!llmClient) initializeBackend(mainWindow);
            // Use the backend's LLM client for streaming
            const url = config.baseUrl || getConfig().LM_STUDIO_BASE_URL;
            const model = config.model || getConfig().LM_STUDIO_MODEL;
            const messages = config.messages || [];

            const response = await fetch(`${url}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: true,
                    temperature: config.temperature ?? 0.7,
                    max_tokens: config.maxTokens ?? 4096,
                }),
            });

            if (!response.ok) {
                mainWindow.webContents.send('ai-error', `LM Studio error: ${response.statusText}`);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter((l: string) => l.startsWith('data: '));

                for (const line of lines) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const token = parsed.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullResponse += token;
                            mainWindow.webContents.send('ai-token', token);
                        }
                    } catch { /* skip parse errors */ }
                }
            }

            mainWindow.webContents.send('ai-complete', fullResponse);
        } catch (err: any) {
            mainWindow.webContents.send('ai-error', err.message);
        }
    });

    ipcMain.handle('ai-stream-stop', async () => {
        // AbortController would be needed for a full implementation
    });

    ipcMain.handle('ai-plan-project', async (_event, prompt: string, template: string) => {
        try {
            if (!llmClient) initializeBackend(mainWindow);
            const url = getConfig().LM_STUDIO_BASE_URL;
            const model = getConfig().LM_STUDIO_MODEL;

            const response = await fetch(`${url}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages: [{
                        role: 'system',
                        content: 'You are a project planning assistant. Respond with JSON only.',
                    }, {
                        role: 'user',
                        content: `Plan a ${template} project for: "${prompt}". Respond with JSON: { "projectName": "string", "description": "string", "files": [{"path":"string","description":"string"}], "dependencies": ["string"] }`,
                    }],
                    temperature: 0.3,
                    max_tokens: 2048,
                }),
            });

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const plan = JSON.parse(jsonMatch[0]);
                return { success: true, plan };
            }
            return { success: false, error: 'Failed to parse plan' };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('ai-generate-files', async (_event, plan: any) => {
        try {
            return { success: true, files: {} };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // ── Project IPC ──
    ipcMain.handle('project-create', async (_event, config: any) => {
        try {
            const fs = require('fs');
            const projectPath = path.join(config.targetDir, config.name);
            if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true });
            }
            return { success: true, projectPath };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('install-dependencies', async (_event, projectPath: string, terminalId: string) => {
        try {
            terminalManager.write(terminalId, 'npm install\n');
            return { success: true, packageManager: 'npm' };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // ── Dialog IPC ──
    ipcMain.handle('open-folder-dialog', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
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
        try {
            const response = await fetch(`${baseUrl}/v1/models`);
            const data = await response.json();
            return (data.data || []).map((m: any) => m.id);
        } catch {
            return [];
        }
    });

    ipcMain.handle('test-lmstudio-connection', async (_event, baseUrl: string) => {
        try {
            const response = await fetch(`${baseUrl}/v1/models`);
            return { connected: response.ok };
        } catch {
            return { connected: false };
        }
    });

    // ── External links ──
    ipcMain.handle('open-external', async (_event, url: string) => {
        shell.openExternal(url);
    });
}

/**
 * Cleanup backend resources + IDE resources
 */
export function cleanupBackend(): void {
    try {
        if (agent) agent.cancel();
        if (llmClient) llmClient.destroy();
        if (vibePipeline) vibePipeline.cleanup().catch(() => { });
        const { getMemory } = getBackendModules();
        const memory = getMemory();
        memory.persist();
    } catch { /* ignore cleanup errors */ }

    // Cleanup IDE resources
    try {
        terminalManager.destroyAll();
        fileSystemManager.stopWatching();
    } catch { /* ignore */ }
}

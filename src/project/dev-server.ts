/**
 * Dev Server Manager — Start, monitor, and stop dev servers
 * Part of the Vibe Coding pipeline
 * 
 * Handles:
 * - Port detection (find available port)
 * - Process spawning (npm run dev)
 * - Readiness polling (wait for HTTP response)
 * - Browser opening (cross-platform)
 * - Graceful shutdown (kill process tree)
 */

import { EventEmitter } from 'events';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export interface DevServerInfo {
    url: string;
    port: number;
    process: ChildProcess;
    projectPath: string;
    framework: string;
    startedAt: number;
}

export interface DevServerOptions {
    preferredPort?: number;
    framework?: string;
    command?: string;
    env?: Record<string, string>;
    openBrowser?: boolean;
}

// ============================================
// DevServerManager
// ============================================

export class DevServerManager extends EventEmitter {
    private server: DevServerInfo | null = null;
    private ready: boolean = false;

    constructor() {
        super();
    }

    /**
     * Find an available port starting from the preferred port
     */
    async findPort(preferred: number = 3000): Promise<number> {
        try {
            // detect-port v2 may export as default or as a function
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod = require('detect-port');
            const detectPort = (typeof mod === 'function' ? mod : mod.default) as (port: number) => Promise<number>;
            const port = await detectPort(preferred);
            logger.info(`[DevServer] Available port: ${port}`);
            return port;
        } catch (err: any) {
            logger.warn(`[DevServer] detect-port failed (${err.message}), using preferred port ${preferred}`);
            return preferred;
        }
    }

    /**
     * Start the dev server
     */
    async start(projectPath: string, options: DevServerOptions = {}): Promise<DevServerInfo> {
        if (this.server) {
            logger.warn('[DevServer] Server already running, stopping previous instance');
            await this.stop();
        }

        const port = await this.findPort(options.preferredPort || 3000);
        const command = options.command || 'npm';
        const args = options.command ? [] : ['run', 'dev'];
        const framework = options.framework || 'unknown';

        this.emit('starting', { port, projectPath });

        // Determine the right env var for the port
        const portEnv = this.getPortEnvVar(framework);
        const env = {
            ...process.env,
            [portEnv]: String(port),
            PORT: String(port),
            BROWSER: 'none', // prevent CRA from auto-opening browser
            ...(options.env || {}),
        };

        const child = spawn(command, args, {
            cwd: projectPath,
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            detached: false,
        });

        const serverInfo: DevServerInfo = {
            url: `http://localhost:${port}`,
            port,
            process: child,
            projectPath,
            framework,
            startedAt: Date.now(),
        };

        this.server = serverInfo;

        // Capture output
        child.stdout?.on('data', (data: Buffer) => {
            const output = data.toString().trim();
            if (output) {
                this.emit('output', output);
                logger.debug(`[DevServer] stdout: ${output.slice(0, 200)}`);
            }
        });

        child.stderr?.on('data', (data: Buffer) => {
            const output = data.toString().trim();
            if (output) {
                this.emit('error-output', output);
                logger.debug(`[DevServer] stderr: ${output.slice(0, 200)}`);
            }
        });

        child.on('exit', (code) => {
            logger.info(`[DevServer] Process exited with code: ${code}`);
            this.ready = false;
            this.server = null;
            this.emit('exit', code);
        });

        child.on('error', (err) => {
            logger.error(`[DevServer] Process error: ${err.message}`);
            this.emit('process-error', err);
        });

        // Wait for server to be ready
        const isReady = await this.waitForReady(serverInfo.url, 45000);

        if (isReady) {
            this.ready = true;
            this.emit('ready', serverInfo);
            logger.info(`[DevServer] Ready at ${serverInfo.url}`);

            // Open browser if requested
            if (options.openBrowser !== false) {
                await this.openBrowser(serverInfo.url);
            }
        } else {
            this.emit('timeout', serverInfo);
            logger.warn(`[DevServer] Timed out waiting for server at ${serverInfo.url}`);
        }

        return serverInfo;
    }

    /**
     * Wait for the dev server to respond to HTTP requests
     */
    async waitForReady(url: string, timeoutMs: number = 30000): Promise<boolean> {
        const startTime = Date.now();
        const pollInterval = 800;
        let attempt = 0;

        while (Date.now() - startTime < timeoutMs) {
            attempt++;
            try {
                // Use dynamic import to avoid top-level axios dependency issues
                const http = await import('http');
                const ready = await new Promise<boolean>((resolve) => {
                    const req = http.get(url, (res) => {
                        resolve(res.statusCode !== undefined && res.statusCode < 500);
                        res.resume(); // consume response
                    });
                    req.on('error', () => resolve(false));
                    req.setTimeout(2000, () => {
                        req.destroy();
                        resolve(false);
                    });
                });

                if (ready) {
                    logger.info(`[DevServer] Ready after ${attempt} attempts (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);
                    return true;
                }
            } catch {
                // Server not ready yet
            }

            await this.delay(pollInterval);
        }

        return false;
    }

    /**
     * Open URL in default browser
     */
    async openBrowser(url: string): Promise<void> {
        try {
            const open = (await import('open')).default;
            await open(url);
            logger.info(`[DevServer] Opened browser: ${url}`);
            this.emit('browser-opened', url);
        } catch (error: any) {
            logger.warn(`[DevServer] Failed to open browser: ${error.message}`);
        }
    }

    /**
     * Stop the running dev server
     */
    async stop(): Promise<void> {
        if (!this.server) {
            logger.debug('[DevServer] No server to stop');
            return;
        }

        const pid = this.server.process.pid;
        if (!pid) {
            this.server = null;
            this.ready = false;
            return;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const treeKill = require('tree-kill') as (pid: number, signal?: string, callback?: (err?: Error) => void) => void;

            await new Promise<void>((resolve, reject) => {
                treeKill(pid, 'SIGTERM', (err) => {
                    if (err) {
                        logger.warn(`[DevServer] tree-kill failed, force killing: ${err.message}`);
                        try {
                            this.server?.process.kill('SIGKILL');
                        } catch { /* ignore */ }
                    }
                    resolve();
                });
            });

            logger.info(`[DevServer] Stopped server (PID: ${pid})`);
            this.emit('stopped', this.server);
        } catch (error: any) {
            logger.error(`[DevServer] Error stopping server: ${error.message}`);
        } finally {
            this.server = null;
            this.ready = false;
        }
    }

    /**
     * Check if a server is currently running
     */
    isRunning(): boolean {
        return this.server !== null && this.ready;
    }

    /**
     * Get current server info
     */
    getInfo(): DevServerInfo | null {
        return this.server;
    }

    /**
     * Get the correct environment variable name for the port based on the framework
     */
    private getPortEnvVar(framework: string): string {
        switch (framework.toLowerCase()) {
            case 'react':
            case 'cra':
                return 'PORT';
            case 'nextjs':
            case 'next':
                return 'PORT';
            case 'vue':
            case 'vite':
                return 'VITE_PORT';
            case 'express':
            case 'node':
                return 'PORT';
            default:
                return 'PORT';
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// Export singleton
// ============================================

export const devServerManager = new DevServerManager();
export default DevServerManager;

/**
 * The Joker - Agentic Terminal
 * AirLLM Bridge
 *
 * Manages the Python AirLLM sidecar server lifecycle and provides
 * an LMStudioClient instance proxied through it. This enables
 * 70B-parameter model inference on 4GB RAM via layer-wise loading.
 *
 * Citation:
 *   Li, G. (2023). AirLLM: scaling large language models on low-end
 *   commodity computers [Computer software].
 *   https://github.com/lyogavin/airllm/
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import axios from 'axios';
import { AirLLMConfig } from '../types';
import { airllmConfig } from '../utils/config';
import { logger } from '../utils/logger';
import LMStudioClient from './client';

// ============================================
// AirLLM Bridge Events
// ============================================

export interface AirLLMBridgeEvents {
    'sidecar:starting': void;
    'sidecar:ready': { pid: number; port: number };
    'sidecar:output': string;
    'sidecar:error': string;
    'sidecar:exit': { code: number | null; signal: string | null };
}

// ============================================
// AirLLM Bridge
// ============================================

/**
 * AirLLMBridge manages the Python sidecar server and provides
 * a proxied LMStudioClient that talks to AirLLM.
 */
export class AirLLMBridge extends EventEmitter {
    private config: AirLLMConfig;
    private sidecar: ChildProcess | null = null;
    private client: LMStudioClient | null = null;
    private baseUrl: string;
    private ready: boolean = false;

    constructor(config?: Partial<AirLLMConfig>) {
        super();
        this.config = { ...airllmConfig, ...config };
        this.baseUrl = `http://127.0.0.1:${this.config.port}`;
    }

    /**
     * Start the AirLLM sidecar server.
     * Spawns the Python process and waits until it's healthy.
     */
    async start(): Promise<void> {
        if (this.sidecar) {
            logger.warn('AirLLM sidecar is already running');
            return;
        }

        this.emit('sidecar:starting');
        logger.info('Starting AirLLM sidecar server...', {
            model: this.config.model,
            port: this.config.port,
            compression: this.config.compression,
        });

        // Resolve path to the sidecar script
        const scriptPath = path.resolve(__dirname, '../../airllm_server.py');

        // Build CLI args
        const args = [
            scriptPath,
            '--model', this.config.model,
            '--port', String(this.config.port),
            '--max-length', String(this.config.maxLength),
            '--compression', this.config.compression,
        ];

        // Spawn the Python process
        this.sidecar = spawn(this.config.pythonPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        // Wire stdout
        this.sidecar.stdout?.on('data', (data: Buffer) => {
            const output = data.toString().trim();
            if (output) {
                logger.debug('[AirLLM sidecar]', { output });
                this.emit('sidecar:output', output);
            }
        });

        // Wire stderr
        this.sidecar.stderr?.on('data', (data: Buffer) => {
            const output = data.toString().trim();
            if (output) {
                logger.debug('[AirLLM sidecar stderr]', { output });
                this.emit('sidecar:output', output);
            }
        });

        // Handle exit
        this.sidecar.on('exit', (code, signal) => {
            logger.info('AirLLM sidecar exited', { code, signal });
            this.emit('sidecar:exit', { code, signal });
            this.sidecar = null;
            this.ready = false;
        });

        // Handle error (e.g., python not found)
        this.sidecar.on('error', (err) => {
            logger.error('AirLLM sidecar spawn error', { error: err.message });
            this.emit('sidecar:error', err.message);
            this.sidecar = null;
            this.ready = false;
        });

        // Wait for the sidecar to become healthy
        await this.waitForHealth();
    }

    /**
     * Poll the sidecar's /v1/models endpoint until it responds.
     */
    private async waitForHealth(
        maxAttempts: number = 120,
        intervalMs: number = 5000
    ): Promise<void> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Check if sidecar died during startup
            if (!this.sidecar) {
                throw new Error(
                    'AirLLM sidecar process exited during startup. ' +
                    'Make sure Python 3.9+ is installed and `pip install airllm fastapi uvicorn` has been run.'
                );
            }

            try {
                const response = await axios.get(`${this.baseUrl}/v1/models`, {
                    timeout: 3000,
                });
                if (response.status === 200) {
                    this.ready = true;
                    this.client = new LMStudioClient({
                        baseUrl: this.baseUrl,
                        model: this.config.model,
                        apiKey: 'not-needed',
                        timeout: 300000, // 5 min — AirLLM is slow
                    });

                    logger.info('AirLLM sidecar is ready', {
                        pid: this.sidecar.pid,
                        port: this.config.port,
                    });
                    this.emit('sidecar:ready', {
                        pid: this.sidecar.pid!,
                        port: this.config.port,
                    });
                    return;
                }
            } catch {
                // Server not ready yet
                if (attempt % 10 === 0) {
                    logger.debug(`Still waiting for AirLLM sidecar... (attempt ${attempt}/${maxAttempts})`);
                }
            }

            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        // Cleanup on timeout
        this.stop();
        throw new Error(
            `AirLLM sidecar did not become healthy after ${maxAttempts * intervalMs / 1000}s. ` +
            'The model may be too large to load, or there was an error during startup.'
        );
    }

    /**
     * Get the proxied LMStudioClient.
     * This client talks to the AirLLM sidecar instead of LM Studio.
     */
    getClient(): LMStudioClient {
        if (!this.client || !this.ready) {
            throw new Error('AirLLM sidecar is not running. Call start() first.');
        }
        return this.client;
    }

    /**
     * Check if the sidecar is running and ready.
     */
    isReady(): boolean {
        return this.ready && this.sidecar !== null;
    }

    /**
     * Get sidecar process ID.
     */
    getPid(): number | null {
        return this.sidecar?.pid ?? null;
    }

    /**
     * Get the base URL of the sidecar.
     */
    getBaseUrl(): string {
        return this.baseUrl;
    }

    /**
     * Get current config.
     */
    getConfig(): AirLLMConfig {
        return { ...this.config };
    }

    /**
     * Stop the AirLLM sidecar server.
     */
    stop(): void {
        if (this.sidecar) {
            logger.info('Stopping AirLLM sidecar...');
            this.sidecar.kill('SIGTERM');

            // Force kill after 5 seconds if still alive
            const forceKillTimeout = setTimeout(() => {
                if (this.sidecar) {
                    logger.warn('Force-killing AirLLM sidecar');
                    this.sidecar.kill('SIGKILL');
                }
            }, 5000);

            this.sidecar.on('exit', () => {
                clearTimeout(forceKillTimeout);
            });

            this.sidecar = null;
        }

        if (this.client) {
            this.client.destroy();
            this.client = null;
        }

        this.ready = false;
    }

    /**
     * Alias for stop() — cleanup resources.
     */
    destroy(): void {
        this.stop();
        this.removeAllListeners();
    }
}

export default AirLLMBridge;

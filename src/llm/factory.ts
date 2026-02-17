/**
 * The Joker - Agentic Terminal
 * LLM Client Factory
 *
 * Creates the appropriate LLM client based on the selected backend.
 * Supports LM Studio (default) and AirLLM (70B on 4GB RAM).
 */

import { LLMBackend } from '../types';
import LMStudioClient, { lmStudioClient } from './client';
import { AirLLMBridge } from './airllm-bridge';
import { logger } from '../utils/logger';

// ============================================
// LLM Client Factory
// ============================================

/**
 * Factory for creating LLM client instances based on the selected backend.
 */
export class LLMClientFactory {
    private airllmBridge: AirLLMBridge | null = null;
    private currentBackend: LLMBackend = 'lmstudio';

    /**
     * Get the current backend type.
     */
    getBackend(): LLMBackend {
        return this.currentBackend;
    }

    /**
     * Get the default LM Studio client.
     */
    getLMStudioClient(): LMStudioClient {
        return lmStudioClient;
    }

    /**
     * Start the AirLLM backend and return the proxied client.
     */
    async startAirLLM(
        onOutput?: (message: string) => void
    ): Promise<LMStudioClient> {
        if (this.airllmBridge?.isReady()) {
            logger.info('AirLLM bridge already running');
            return this.airllmBridge.getClient();
        }

        this.airllmBridge = new AirLLMBridge();

        // Forward sidecar output if callback provided
        if (onOutput) {
            this.airllmBridge.on('sidecar:output', onOutput);
        }

        await this.airllmBridge.start();
        this.currentBackend = 'airllm';

        return this.airllmBridge.getClient();
    }

    /**
     * Stop the AirLLM backend and revert to LM Studio.
     */
    stopAirLLM(): void {
        if (this.airllmBridge) {
            this.airllmBridge.destroy();
            this.airllmBridge = null;
        }
        this.currentBackend = 'lmstudio';
    }

    /**
     * Check if AirLLM is currently active.
     */
    isAirLLMActive(): boolean {
        return this.airllmBridge?.isReady() ?? false;
    }

    /**
     * Get AirLLM bridge instance (if active).
     */
    getAirLLMBridge(): AirLLMBridge | null {
        return this.airllmBridge;
    }

    /**
     * Get the active client for the current backend.
     */
    getActiveClient(): LMStudioClient {
        if (this.currentBackend === 'airllm' && this.airllmBridge?.isReady()) {
            return this.airllmBridge.getClient();
        }
        return lmStudioClient;
    }

    /**
     * Cleanup all resources.
     */
    destroy(): void {
        this.stopAirLLM();
    }
}

/**
 * Singleton factory instance.
 */
export const llmClientFactory = new LLMClientFactory();

export default LLMClientFactory;

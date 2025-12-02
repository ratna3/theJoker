/**
 * The Joker - Agentic Terminal
 * LM Studio Client
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import { LLMConfig, ChatMessage, LLMResponse, StreamChunk } from '../types';
import { llmConfig } from '../utils/config';
import { logger } from '../utils/logger';

// ============================================
// Health Check Types
// ============================================

export interface HealthCheckResult {
  connected: boolean;
  modelLoaded: boolean;
  modelName: string | null;
  responseTime: number;
  error: string | null;
  timestamp: Date;
}

export interface ModelInfo {
  id: string;
  object: string;
  owned_by: string;
}

// ============================================
// LM Studio Client
// ============================================

/**
 * LM Studio Client for communicating with the local LLM
 */
export class LMStudioClient extends EventEmitter {
  private config: LLMConfig;
  private client: AxiosInstance;
  private lastHealthCheck: HealthCheckResult | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(config?: Partial<LLMConfig>) {
    super();
    this.config = { ...llmConfig, ...config };
    
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey !== 'not-needed' && {
          'Authorization': `Bearer ${this.config.apiKey}`,
        }),
      },
    });

    logger.debug('LM Studio client initialized', {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
    });
  }

  // ============================================
  // Health Check Methods
  // ============================================

  /**
   * Perform a comprehensive health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      connected: false,
      modelLoaded: false,
      modelName: null,
      responseTime: 0,
      error: null,
      timestamp: new Date()
    };

    try {
      // Step 1: Check connection
      const modelsResponse = await this.client.get('/v1/models', { timeout: 5000 });
      result.connected = true;

      // Step 2: Check if model is loaded
      const models = modelsResponse.data?.data || [];
      if (models.length > 0) {
        result.modelLoaded = true;
        result.modelName = models[0].id;
      }

      // Step 3: Test completion (quick test)
      if (result.modelLoaded) {
        try {
          await this.client.post('/v1/chat/completions', {
            model: result.modelName,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
            temperature: 0
          }, { timeout: 10000 });
        } catch (testError) {
          // Model might be slow but still functional
          logger.debug('Health check test completion slow/failed', { error: (testError as Error).message });
        }
      }

      result.responseTime = Date.now() - startTime;
      this.lastHealthCheck = result;
      this.retryCount = 0;
      this.emit('health', result);

      logger.info('Health check passed', {
        connected: result.connected,
        model: result.modelName,
        responseTime: result.responseTime
      });

    } catch (error) {
      const axiosError = error as AxiosError;
      result.error = axiosError.message;
      result.responseTime = Date.now() - startTime;
      this.lastHealthCheck = result;
      this.emit('health', result);

      logger.error('Health check failed', {
        error: axiosError.message,
        code: axiosError.code
      });
    }

    return result;
  }

  /**
   * Start periodic health checks
   */
  startHealthCheck(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      this.stopHealthCheck();
    }

    // Run immediately
    this.healthCheck();

    // Then run periodically
    this.healthCheckInterval = setInterval(() => {
      this.healthCheck();
    }, intervalMs);

    logger.debug('Health check started', { intervalMs });
  }

  /**
   * Stop periodic health checks
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.debug('Health check stopped');
    }
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck(): HealthCheckResult | null {
    return this.lastHealthCheck;
  }

  /**
   * Check if client is healthy
   */
  isHealthy(): boolean {
    return this.lastHealthCheck?.connected && this.lastHealthCheck?.modelLoaded || false;
  }

  // ============================================
  // Connection Methods
  // ============================================

  /**
   * Test connection to LM Studio
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/models');
      logger.info('Connected to LM Studio', { models: response.data });
      return true;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error('Failed to connect to LM Studio', {
        error: axiosError.message,
        code: axiosError.code,
      });
      return false;
    }
  }

  /**
   * Get available models from LM Studio
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get('/v1/models');
      return response.data.data || [];
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error('Failed to get models', { error: axiosError.message });
      throw new Error(`Failed to get models: ${axiosError.message}`);
    }
  }

  /**
   * Get model names only
   */
  async getModelNames(): Promise<string[]> {
    const models = await this.getModels();
    return models.map(model => model.id);
  }

  /**
   * Wait for connection with retries
   */
  async waitForConnection(maxAttempts: number = 10, delayMs: number = 2000): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.info(`Connection attempt ${attempt}/${maxAttempts}...`);
      
      const health = await this.healthCheck();
      if (health.connected && health.modelLoaded) {
        logger.info('Successfully connected to LM Studio');
        return true;
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    logger.error('Failed to connect after maximum attempts');
    return false;
  }

  // ============================================
  // Chat Methods
  // ============================================

  /**
   * Send a chat completion request with retry logic
   */
  async chat(messages: ChatMessage[], options?: Partial<LLMConfig>): Promise<LLMResponse> {
    const config = { ...this.config, ...options };
    
    const requestBody = {
      model: config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: false,
    };

    logger.debug('Sending chat request', {
      model: config.model,
      messageCount: messages.length,
    });

    const executeRequest = async (): Promise<LLMResponse> => {
      const startTime = Date.now();
      const response = await this.client.post('/v1/chat/completions', requestBody);
      const endTime = Date.now();

      const result: LLMResponse = {
        content: response.data.choices[0].message.content,
        role: 'assistant',
        usage: response.data.usage ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens
        } : undefined,
        finishReason: response.data.choices[0].finish_reason,
        model: response.data.model,
        latencyMs: endTime - startTime,
      };

      logger.debug('Chat response received', {
        tokens: result.usage,
        latencyMs: result.latencyMs,
        finishReason: result.finishReason,
      });

      return result;
    };

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.retryCount = attempt;
        return await executeRequest();
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;
        
        logger.warn(`Chat request failed (attempt ${attempt + 1}/${this.maxRetries + 1})`, {
          error: axiosError.message,
          status: axiosError.response?.status,
        });

        // Don't retry on certain errors
        if (axiosError.response?.status === 400) {
          throw new Error(`Chat request failed: ${axiosError.message}`);
        }

        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Chat request failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Send a streaming chat completion request
   */
  async *chatStream(messages: ChatMessage[], options?: Partial<LLMConfig>): AsyncGenerator<StreamChunk> {
    const config = { ...this.config, ...options };
    
    const requestBody = {
      model: config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
      })),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    };

    logger.debug('Starting streaming chat request', {
      model: config.model,
      messageCount: messages.length,
    });

    try {
      const response = await this.client.post('/v1/chat/completions', requestBody, {
        responseType: 'stream',
      });

      let buffer = '';
      let totalContent = '';
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { content: '', done: true };
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;
              
              if (delta?.content) {
                totalContent += delta.content;
                const streamChunk: StreamChunk = {
                  content: delta.content,
                  done: false,
                };
                this.emit('chunk', streamChunk);
                yield streamChunk;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      yield { content: '', done: true };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error('Streaming chat request failed', {
        error: axiosError.message,
        status: axiosError.response?.status,
      });
      throw new Error(`Streaming chat request failed: ${axiosError.message}`);
    }
  }

  /**
   * Simple completion without chat history
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages);
    return response.content;
  }

  /**
   * Complete with JSON response
   */
  async completeJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const messages: ChatMessage[] = [];
    
    const jsonSystemPrompt = systemPrompt 
      ? `${systemPrompt}\n\nAlways respond with valid JSON only. No markdown, no code blocks.`
      : 'Respond with valid JSON only. No markdown, no code blocks.';
    
    messages.push({ role: 'system', content: jsonSystemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages);
    
    // Try to parse JSON
    try {
      return JSON.parse(response.content) as T;
    } catch {
      // Try to extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error('Response was not valid JSON');
    }
  }

  // ============================================
  // Configuration Methods
  // ============================================

  /**
   * Update client configuration
   */
  updateConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Recreate axios client with new config
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey !== 'not-needed' && {
          'Authorization': `Bearer ${this.config.apiKey}`,
        }),
      },
    });

    logger.debug('LM Studio client config updated', config);
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHealthCheck();
    this.removeAllListeners();
  }
}

// Default client instance
export const lmStudioClient = new LMStudioClient();

export default LMStudioClient;

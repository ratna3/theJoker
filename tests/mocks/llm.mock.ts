/**
 * LLM Mock Utilities
 * Phase 10: Testing & Optimization
 * 
 * Mock implementations for LLM client and responses
 */

import { LLMResponse, ChatMessage } from '../../src/types';

// ============================================
// Mock Response Generator
// ============================================

/**
 * Create a mock LLM response
 */
export function createMockLLMResponse(
  content: string,
  options: Partial<LLMResponse> = {}
): LLMResponse {
  return {
    content,
    role: 'assistant',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    finishReason: 'stop',
    model: 'test-model',
    latencyMs: 100,
    ...options,
  };
}

/**
 * Create mock JSON response for intent parsing
 */
export function createMockIntentResponse(intent: string, topic: string) {
  return createMockLLMResponse(
    JSON.stringify({
      intent,
      topic,
      entities: [],
      confidence: 0.95,
    })
  );
}

/**
 * Create mock action plan response
 */
export function createMockPlanResponse(steps: string[]) {
  return createMockLLMResponse(
    JSON.stringify({
      plan: steps.map((step, index) => ({
        order: index + 1,
        action: step,
        tool: 'mock_tool',
        params: {},
      })),
      estimatedTime: steps.length * 1000,
    })
  );
}

// ============================================
// Mock LLM Client
// ============================================

export class MockLLMClient {
  private responses: Map<string, string> = new Map();
  private callCount: number = 0;
  private lastMessages: ChatMessage[] = [];
  private shouldFail: boolean = false;
  private failureMessage: string = 'Mock LLM error';
  private responseDelay: number = 0;

  /**
   * Set a canned response for a query pattern
   */
  setResponse(pattern: string, response: string): void {
    this.responses.set(pattern, response);
  }

  /**
   * Configure to fail on next call
   */
  setFailure(shouldFail: boolean, message?: string): void {
    this.shouldFail = shouldFail;
    if (message) this.failureMessage = message;
  }

  /**
   * Set response delay for testing timeouts
   */
  setDelay(ms: number): void {
    this.responseDelay = ms;
  }

  /**
   * Get call count
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Get last messages sent
   */
  getLastMessages(): ChatMessage[] {
    return this.lastMessages;
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.callCount = 0;
    this.lastMessages = [];
    this.shouldFail = false;
    this.responses.clear();
  }

  /**
   * Mock chat method
   */
  async chat(messages: ChatMessage[]): Promise<LLMResponse> {
    this.callCount++;
    this.lastMessages = messages;

    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }

    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    // Find matching response
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    for (const [pattern, response] of this.responses) {
      if (userMessage.includes(pattern)) {
        return createMockLLMResponse(response);
      }
    }

    // Default response
    return createMockLLMResponse('Mock response for: ' + userMessage.substring(0, 50));
  }

  /**
   * Mock streaming chat
   */
  async *chatStream(messages: ChatMessage[]): AsyncGenerator<{ content: string; done: boolean }> {
    const response = await this.chat(messages);
    const words = response.content.split(' ');
    
    for (const word of words) {
      yield { content: word + ' ', done: false };
    }
    yield { content: '', done: true };
  }

  /**
   * Mock complete method
   */
  async complete(prompt: string): Promise<string> {
    const response = await this.chat([{ role: 'user', content: prompt }]);
    return response.content;
  }

  /**
   * Mock JSON completion
   */
  async completeJSON<T>(prompt: string): Promise<T> {
    const content = await this.complete(prompt);
    try {
      return JSON.parse(content) as T;
    } catch {
      // Return a default object if parsing fails
      return {} as T;
    }
  }

  /**
   * Mock health check
   */
  async healthCheck() {
    if (this.shouldFail) {
      return {
        connected: false,
        modelLoaded: false,
        modelName: null,
        responseTime: 0,
        error: this.failureMessage,
        timestamp: new Date(),
      };
    }
    return {
      connected: true,
      modelLoaded: true,
      modelName: 'test-model',
      responseTime: 50,
      error: null,
      timestamp: new Date(),
    };
  }

  /**
   * Mock connection test
   */
  async testConnection(): Promise<boolean> {
    return !this.shouldFail;
  }

  /**
   * Mock wait for connection
   */
  async waitForConnection(): Promise<boolean> {
    return !this.shouldFail;
  }

  /**
   * Check if healthy
   */
  isHealthy(): boolean {
    return !this.shouldFail;
  }
}

// ============================================
// Singleton Mock Instance
// ============================================

export const mockLLMClient = new MockLLMClient();

// ============================================
// Factory Functions
// ============================================

/**
 * Create a fresh mock client
 */
export function createMockLLMClient(): MockLLMClient {
  return new MockLLMClient();
}

/**
 * Create mock client with preset responses
 */
export function createConfiguredMockLLM(responses: Record<string, string>): MockLLMClient {
  const client = new MockLLMClient();
  for (const [pattern, response] of Object.entries(responses)) {
    client.setResponse(pattern, response);
  }
  return client;
}

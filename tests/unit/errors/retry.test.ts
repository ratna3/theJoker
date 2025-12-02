/**
 * The Joker - Agentic Terminal
 * Retry Utilities Unit Tests
 * Phase 10: Testing & Optimization
 */

import {
  withRetry,
  withFastRetry,
  withAggressiveRetry,
  withLinearRetry,
  retryable,
  calculateBackoff,
  sleep,
  networkRetryConfig,
  llmRetryConfig,
  scrapingRetryConfig,
  fileRetryConfig,
  createRetryWrapper,
  retryAll,
  retrySequential,
  RetryConfig,
} from '../../../src/errors/retry';
import { JokerError, NetworkError } from '../../../src/types/errors';

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the error handler
jest.mock('../../../src/errors/handler', () => ({
  getErrorHandler: () => ({
    handleSilent: (error: unknown) => {
      if (error instanceof JokerError) {
        return error;
      }
      return new JokerError(
        error instanceof Error ? error.message : String(error),
        { recoverable: true, retryable: true }
      );
    },
    markRecovered: jest.fn(),
  }),
}));

describe('Retry Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // sleep
  // ============================================

  describe('sleep', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      
      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });

    it('should resolve after 0ms delay', async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50);
    });
  });

  // ============================================
  // calculateBackoff
  // ============================================

  describe('calculateBackoff', () => {
    const baseConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      useJitter: false,
      jitterFactor: 0.25,
      logRetries: true,
    };

    it('should calculate exponential delay', () => {
      expect(calculateBackoff(1, baseConfig)).toBe(1000);
      expect(calculateBackoff(2, baseConfig)).toBe(2000);
      expect(calculateBackoff(3, baseConfig)).toBe(4000);
      expect(calculateBackoff(4, baseConfig)).toBe(8000);
    });

    it('should cap at maxDelay', () => {
      const config = { ...baseConfig, maxDelay: 5000 };
      expect(calculateBackoff(5, config)).toBe(5000);
      expect(calculateBackoff(10, config)).toBe(5000);
    });

    it('should add jitter when enabled', () => {
      const config = { ...baseConfig, useJitter: true };
      const delays: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        delays.push(calculateBackoff(2, config));
      }
      
      // With jitter, not all delays should be exactly 2000
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
      
      // All delays should be within jitter range
      delays.forEach(delay => {
        expect(delay).toBeGreaterThan(1000);
        expect(delay).toBeLessThan(3000);
      });
    });

    it('should respect jitterFactor', () => {
      const config = { ...baseConfig, useJitter: true, jitterFactor: 0.5 };
      const delays: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        delays.push(calculateBackoff(2, config));
      }
      
      // With 50% jitter on 2000ms, range should be 1000-3000
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(4000);
      });
    });
  });

  // ============================================
  // withRetry
  // ============================================

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn, { logRetries: false });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError('First fail'))
        .mockRejectedValueOnce(new NetworkError('Second fail'))
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        logRetries: false,
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new NetworkError('Always fail'));
      
      const result = await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        logRetries: false,
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new JokerError('Not retryable', {
        recoverable: false,
        retryable: false,
      });
      const fn = jest.fn().mockRejectedValue(nonRetryableError);
      
      const result = await withRetry(fn, {
        maxAttempts: 5,
        baseDelay: 10,
        logRetries: false,
      });
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use custom shouldRetry function', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new JokerError('Retry this'))
        .mockRejectedValueOnce(new JokerError('Stop here', { code: 'STOP' }))
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, {
        maxAttempts: 5,
        baseDelay: 10,
        logRetries: false,
        shouldRetry: (error) => error.code !== 'STOP',
      });
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Fail 1'))
        .mockResolvedValue('success');
      
      await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        logRetries: false,
        onRetry,
      });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(JokerError),
        1,
        expect.any(Number)
      );
    });

    it('should call onExhausted callback', async () => {
      const onExhausted = jest.fn();
      const fn = jest.fn().mockRejectedValue(new NetworkError('Always fail'));
      
      await withRetry(fn, {
        maxAttempts: 2,
        baseDelay: 10,
        logRetries: false,
        onExhausted,
      });
      
      expect(onExhausted).toHaveBeenCalledTimes(1);
      expect(onExhausted).toHaveBeenCalledWith(
        expect.any(JokerError),
        2
      );
    });

    it('should track retry delays', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Fail 1'))
        .mockRejectedValueOnce(new NetworkError('Fail 2'))
        .mockResolvedValue('success');
      
      const result = await withRetry(fn, {
        maxAttempts: 5,
        baseDelay: 10,
        useJitter: false,
        logRetries: false,
      });
      
      expect(result.retryDelays).toHaveLength(2);
      expect(result.retryDelays[0]).toBe(10);
      expect(result.retryDelays[1]).toBe(20);
    });

    it('should respect attempt timeout', async () => {
      const fn = jest.fn().mockImplementation(async () => {
        await sleep(500);
        return 'success';
      });
      
      const result = await withRetry(fn, {
        maxAttempts: 2,
        baseDelay: 10,
        attemptTimeout: 50,
        logRetries: false,
      });
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
    });
  });

  // ============================================
  // Specialized Retry Functions
  // ============================================

  describe('withFastRetry', () => {
    it('should use fast configuration', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withFastRetry(fn, { logRetries: false });
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });
  });

  describe('withAggressiveRetry', () => {
    it('should use aggressive configuration', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Fail'))
        .mockResolvedValue('success');
      
      const result = await withAggressiveRetry(fn, {
        baseDelay: 10,
        logRetries: false,
      });
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });

  describe('withLinearRetry', () => {
    it('should use constant delay', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Fail 1'))
        .mockRejectedValueOnce(new NetworkError('Fail 2'))
        .mockResolvedValue('success');
      
      const result = await withLinearRetry(fn, 10, 5);
      
      expect(result.success).toBe(true);
      expect(result.retryDelays).toEqual([10, 10]);
    });
  });

  describe('retryable', () => {
    it('should return data on success', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await retryable(fn, { logRetries: false });
      
      expect(result).toBe('success');
    });

    it('should throw on failure', async () => {
      const fn = jest.fn().mockRejectedValue(new JokerError('Always fail', {
        recoverable: false,
      }));
      
      await expect(retryable(fn, {
        maxAttempts: 2,
        baseDelay: 10,
        logRetries: false,
      })).rejects.toThrow();
    });
  });

  // ============================================
  // Retry Policy Builders
  // ============================================

  describe('networkRetryConfig', () => {
    it('should return network-specific config', () => {
      const config = networkRetryConfig();
      
      expect(config.maxAttempts).toBe(3);
      expect(config.baseDelay).toBe(1000);
      expect(config.shouldRetry).toBeDefined();
      
      // Test shouldRetry function
      const networkError = new NetworkError('Network fail');
      expect(config.shouldRetry!(networkError, 1)).toBe(true);
      
      const otherError = new JokerError('Other', { category: 'internal' });
      expect(config.shouldRetry!(otherError, 1)).toBe(false);
    });
  });

  describe('llmRetryConfig', () => {
    it('should return LLM-specific config', () => {
      const config = llmRetryConfig();
      
      expect(config.maxAttempts).toBe(2);
      expect(config.shouldRetry).toBeDefined();
      
      // Should not retry token limit errors
      const tokenError = new JokerError('Token limit', {
        code: 'LLM_TOKEN_LIMIT',
        category: 'llm',
        recoverable: true,
      });
      expect(config.shouldRetry!(tokenError, 1)).toBe(false);
    });
  });

  describe('scrapingRetryConfig', () => {
    it('should return scraping-specific config', () => {
      const config = scrapingRetryConfig();
      
      expect(config.maxAttempts).toBe(3);
      expect(config.shouldRetry).toBeDefined();
      
      // Should not retry blocked errors
      const blockedError = new JokerError('Blocked', {
        code: 'SCRAPE_BLOCKED',
        category: 'scraping',
        recoverable: true,
      });
      expect(config.shouldRetry!(blockedError, 1)).toBe(false);
    });
  });

  describe('fileRetryConfig', () => {
    it('should return file-specific config', () => {
      const config = fileRetryConfig();
      
      expect(config.maxAttempts).toBe(2);
      expect(config.baseDelay).toBe(500);
    });
  });

  // ============================================
  // createRetryWrapper
  // ============================================

  describe('createRetryWrapper', () => {
    it('should create wrapper function', async () => {
      const originalFn = jest.fn().mockResolvedValue('result');
      const wrapped = createRetryWrapper(originalFn, { logRetries: false });
      
      const result = await wrapped('arg1', 'arg2');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('result');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle failures', async () => {
      const originalFn = jest.fn().mockRejectedValue(new JokerError('Fail', {
        recoverable: false,
      }));
      const wrapped = createRetryWrapper(originalFn, {
        maxAttempts: 2,
        baseDelay: 10,
        logRetries: false,
      });
      
      const result = await wrapped();
      
      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // Batch Retry Utilities
  // ============================================

  describe('retryAll', () => {
    it('should retry all operations in parallel', async () => {
      const operations = [
        jest.fn().mockResolvedValue('result1'),
        jest.fn().mockResolvedValue('result2'),
        jest.fn().mockResolvedValue('result3'),
      ];
      
      const results = await retryAll(operations, { logRetries: false });
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[0].data).toBe('result1');
      expect(results[1].data).toBe('result2');
      expect(results[2].data).toBe('result3');
    });

    it('should handle mixed success/failure', async () => {
      const operations = [
        jest.fn().mockResolvedValue('success'),
        jest.fn().mockRejectedValue(new JokerError('Fail', { recoverable: false })),
      ];
      
      const results = await retryAll(operations, {
        maxAttempts: 1,
        logRetries: false,
      });
      
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('retrySequential', () => {
    it('should retry operations sequentially', async () => {
      const order: number[] = [];
      const operations = [
        jest.fn().mockImplementation(async () => { order.push(1); return 'r1'; }),
        jest.fn().mockImplementation(async () => { order.push(2); return 'r2'; }),
        jest.fn().mockImplementation(async () => { order.push(3); return 'r3'; }),
      ];
      
      const results = await retrySequential(operations, { logRetries: false });
      
      expect(order).toEqual([1, 2, 3]);
      expect(results).toHaveLength(3);
    });

    it('should add delay between operations', async () => {
      const operations = [
        jest.fn().mockResolvedValue('r1'),
        jest.fn().mockResolvedValue('r2'),
      ];
      
      const start = Date.now();
      await retrySequential(operations, { logRetries: false }, 50);
      const elapsed = Date.now() - start;
      
      // Should have at least one 50ms delay
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});

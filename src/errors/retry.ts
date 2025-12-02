/**
 * The Joker - Agentic Terminal
 * Retry Utilities with Exponential Backoff
 * 
 * Provides configurable retry logic for handling transient failures
 * with exponential backoff, jitter, and custom retry policies.
 */

import {
  JokerError,
} from '../types/errors';
import { logger } from '../utils/logger';
import { getErrorHandler } from './handler';

// ============================================
// Types
// ============================================

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;
  /** Initial delay in milliseconds (default: 1000) */
  baseDelay: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  useJitter: boolean;
  /** Maximum jitter percentage (default: 0.25 = 25%) */
  jitterFactor: number;
  /** Custom function to determine if error should be retried */
  shouldRetry?: (error: JokerError, attempt: number) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (error: JokerError, attempt: number, delay: number) => void;
  /** Callback called when all retries exhausted */
  onExhausted?: (error: JokerError, attempts: number) => void;
  /** Whether to log retry attempts (default: true) */
  logRetries: boolean;
  /** Timeout for each attempt in milliseconds (optional) */
  attemptTimeout?: number;
}

/**
 * Retry result with attempt information
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: JokerError;
  attempts: number;
  totalDuration: number;
  retryDelays: number[];
}

/**
 * Retry state for tracking
 */
interface RetryState {
  attempt: number;
  startTime: number;
  delays: number[];
  lastError: JokerError | null;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  useJitter: true,
  jitterFactor: 0.25,
  logRetries: true,
};

// ============================================
// Utility Functions
// ============================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig
): number {
  // Calculate base exponential delay
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  
  // Cap at max delay
  let delay = Math.min(exponentialDelay, config.maxDelay);
  
  // Add jitter if enabled
  if (config.useJitter) {
    const jitterRange = delay * config.jitterFactor;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    delay = Math.max(0, delay + jitter);
  }
  
  return Math.round(delay);
}

/**
 * Default retry decision function
 */
function defaultShouldRetry(error: JokerError, _attempt: number): boolean {
  // Only retry recoverable/retryable errors
  return error.recoverable || error.retryable;
}

/**
 * Create a timeout wrapper
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ============================================
// Main Retry Function
// ============================================

/**
 * Execute function with retry logic and exponential backoff
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(url),
 *   { maxAttempts: 5, baseDelay: 500 }
 * );
 * 
 * if (result.success) {
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts');
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const config: RetryConfig = { ...DEFAULT_CONFIG, ...options };
  const errorHandler = getErrorHandler();
  
  const state: RetryState = {
    attempt: 0,
    startTime: Date.now(),
    delays: [],
    lastError: null,
  };
  
  while (state.attempt < config.maxAttempts) {
    state.attempt++;
    
    try {
      // Execute with optional timeout
      let result: T;
      if (config.attemptTimeout) {
        result = await withTimeout(fn(), config.attemptTimeout);
      } else {
        result = await fn();
      }
      
      // Success - mark as recovered if there were previous failures
      if (state.lastError) {
        errorHandler.markRecovered(state.lastError);
      }
      
      return {
        success: true,
        data: result,
        attempts: state.attempt,
        totalDuration: Date.now() - state.startTime,
        retryDelays: state.delays,
      };
      
    } catch (error) {
      // Normalize error
      const jokerError = errorHandler.handleSilent(error);
      state.lastError = jokerError;
      
      // Check if we should retry
      const shouldRetry = config.shouldRetry
        ? config.shouldRetry(jokerError, state.attempt)
        : defaultShouldRetry(jokerError, state.attempt);
      
      // If not retryable or max attempts reached, fail
      if (!shouldRetry || state.attempt >= config.maxAttempts) {
        if (config.onExhausted) {
          config.onExhausted(jokerError, state.attempt);
        }
        
        if (config.logRetries) {
          logger.error(
            `Retry exhausted after ${state.attempt} attempts: ${jokerError.message}`,
            {
              code: jokerError.code,
              attempts: state.attempt,
              totalDuration: Date.now() - state.startTime,
            }
          );
        }
        
        return {
          success: false,
          error: jokerError,
          attempts: state.attempt,
          totalDuration: Date.now() - state.startTime,
          retryDelays: state.delays,
        };
      }
      
      // Calculate delay for this retry
      const delay = calculateBackoff(state.attempt, config);
      state.delays.push(delay);
      
      // Notify about retry
      if (config.onRetry) {
        config.onRetry(jokerError, state.attempt, delay);
      }
      
      if (config.logRetries) {
        logger.warn(
          `Retry attempt ${state.attempt}/${config.maxAttempts} after ${delay}ms: ${jokerError.message}`,
          {
            code: jokerError.code,
            delay,
            recoverable: jokerError.recoverable,
          }
        );
      }
      
      // Wait before next attempt
      await sleep(delay);
    }
  }
  
  // Should not reach here, but safety return
  return {
    success: false,
    error: state.lastError || undefined,
    attempts: state.attempt,
    totalDuration: Date.now() - state.startTime,
    retryDelays: state.delays,
  };
}

// ============================================
// Specialized Retry Functions
// ============================================

/**
 * Retry with fast config for quick operations
 */
export async function withFastRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  return withRetry(fn, {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    backoffMultiplier: 1.5,
    ...options,
  });
}

/**
 * Retry with aggressive config for important operations
 */
export async function withAggressiveRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  return withRetry(fn, {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    ...options,
  });
}

/**
 * Retry with linear backoff (constant delay)
 */
export async function withLinearRetry<T>(
  fn: () => Promise<T>,
  delay: number = 1000,
  maxAttempts: number = 3
): Promise<RetryResult<T>> {
  return withRetry(fn, {
    maxAttempts,
    baseDelay: delay,
    maxDelay: delay,
    backoffMultiplier: 1,
    useJitter: false,
  });
}

/**
 * Simple retry that just returns the data or throws
 * (Simpler interface for cases where RetryResult is not needed)
 */
export async function retryable<T>(
  fn: () => Promise<T>,
  options: Partial<RetryConfig> = {}
): Promise<T> {
  const result = await withRetry(fn, options);
  
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  
  throw result.error || new Error('Retry failed with no error details');
}

// ============================================
// Retry Policy Builders
// ============================================

/**
 * Create retry config for network operations
 */
export function networkRetryConfig(): Partial<RetryConfig> {
  return {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      return error.category === 'network' && error.recoverable;
    },
  };
}

/**
 * Create retry config for LLM operations
 */
export function llmRetryConfig(): Partial<RetryConfig> {
  return {
    maxAttempts: 2,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // Don't retry token limit errors
      if (error.code === 'LLM_TOKEN_LIMIT' || error.code === 'LLM_CONTEXT_LENGTH') {
        return false;
      }
      return error.category === 'llm' && error.recoverable;
    },
  };
}

/**
 * Create retry config for scraping operations
 */
export function scrapingRetryConfig(): Partial<RetryConfig> {
  return {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2.5,
    shouldRetry: (error) => {
      // Don't retry blocked or captcha errors
      if (error.code === 'SCRAPE_BLOCKED' || error.code === 'SCRAPE_CAPTCHA') {
        return false;
      }
      return error.category === 'scraping' && error.recoverable;
    },
  };
}

/**
 * Create retry config for file operations
 */
export function fileRetryConfig(): Partial<RetryConfig> {
  return {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // Only retry transient file errors (e.g., locked files)
      return error.category === 'filesystem' && error.recoverable;
    },
  };
}

// ============================================
// Retry Decorator (for classes)
// ============================================

/**
 * Create a retry wrapper for a method
 * 
 * @example
 * ```typescript
 * class ApiClient {
 *   private fetchWithRetry = createRetryWrapper(
 *     this.fetch.bind(this),
 *     networkRetryConfig()
 *   );
 *   
 *   async fetch(url: string) { ... }
 *   
 *   async safeFetch(url: string) {
 *     return this.fetchWithRetry(url);
 *   }
 * }
 * ```
 */
export function createRetryWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: Partial<RetryConfig> = {}
): (...args: TArgs) => Promise<RetryResult<TResult>> {
  return async (...args: TArgs): Promise<RetryResult<TResult>> => {
    return withRetry(() => fn(...args), config);
  };
}

// ============================================
// Batch Retry Utilities
// ============================================

/**
 * Retry multiple operations with shared config
 */
export async function retryAll<T>(
  operations: Array<() => Promise<T>>,
  config: Partial<RetryConfig> = {}
): Promise<Array<RetryResult<T>>> {
  return Promise.all(
    operations.map(op => withRetry(op, config))
  );
}

/**
 * Retry operations sequentially (useful for rate-limited APIs)
 */
export async function retrySequential<T>(
  operations: Array<() => Promise<T>>,
  config: Partial<RetryConfig> = {},
  delayBetween: number = 0
): Promise<Array<RetryResult<T>>> {
  const results: Array<RetryResult<T>> = [];
  
  for (const op of operations) {
    const result = await withRetry(op, config);
    results.push(result);
    
    if (delayBetween > 0) {
      await sleep(delayBetween);
    }
  }
  
  return results;
}

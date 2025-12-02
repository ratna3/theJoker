/**
 * The Joker - Agentic Terminal
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascade failures by monitoring failure rates
 * and temporarily disabling operations that are likely to fail.
 */

import { JokerError } from '../types/errors';
import { logger } from '../utils/logger';
import { getErrorHandler } from './handler';

// ============================================
// Types
// ============================================

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Name/identifier for the circuit breaker */
  name: string;
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms before attempting to close the circuit (default: 30000) */
  resetTimeout: number;
  /** Number of successes needed in half-open to close (default: 2) */
  successThreshold: number;
  /** Time window in ms to count failures (default: 60000) */
  failureWindow: number;
  /** Whether to log state changes (default: true) */
  logStateChanges: boolean;
  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Callback when circuit opens */
  onOpen?: (error: JokerError, failureCount: number) => void;
  /** Callback when circuit closes */
  onClose?: (successCount: number) => void;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  stateChangedAt: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Failure record for tracking
 */
interface FailureRecord {
  timestamp: number;
  error: JokerError;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 2,
  failureWindow: 60000,
  logStateChanges: true,
};

// ============================================
// Circuit Breaker Error
// ============================================

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends JokerError {
  readonly circuitName: string;
  readonly resetAt: Date;

  constructor(circuitName: string, resetAt: Date) {
    super(`Circuit '${circuitName}' is open. Will reset at ${resetAt.toISOString()}`, {
      code: 'CIRCUIT_OPEN',
      category: 'internal',
      recoverable: true,
      severity: 'medium',
      suggestion: `The service is temporarily unavailable. Try again after ${Math.ceil((resetAt.getTime() - Date.now()) / 1000)} seconds.`,
      retryable: true,
      retryAfterMs: resetAt.getTime() - Date.now(),
    });
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.resetAt = resetAt;
  }
}

// ============================================
// Circuit Breaker Class
// ============================================

/**
 * Circuit breaker implementation for resilient service calls
 * 
 * States:
 * - CLOSED: Normal operation, failures are counted
 * - OPEN: Requests fail immediately, waiting for reset
 * - HALF-OPEN: Limited requests to test if service recovered
 * 
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({ name: 'llm-api' });
 * 
 * const result = await breaker.execute(async () => {
 *   return await llmClient.complete(prompt);
 * });
 * ```
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failures: FailureRecord[] = [];
  private halfOpenSuccesses: number = 0;
  private stateChangedAt: Date = new Date();
  private resetTimer: NodeJS.Timeout | null = null;
  private stats: {
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    lastSuccess: Date | null;
    lastFailure: Date | null;
  };

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastSuccess: null,
      lastFailure: null,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.stats.totalRequests++;

    // Check if circuit is open
    if (this.state === 'open') {
      const resetAt = new Date(this.stateChangedAt.getTime() + this.config.resetTimeout);
      throw new CircuitOpenError(this.config.name, resetAt);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.stats.totalSuccesses++;
    this.stats.lastSuccess = new Date();

    if (this.state === 'half-open') {
      this.halfOpenSuccesses++;
      
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    const errorHandler = getErrorHandler();
    const jokerError = errorHandler.handleSilent(error);

    this.stats.totalFailures++;
    this.stats.lastFailure = new Date();

    // Record failure
    const now = Date.now();
    this.failures.push({ timestamp: now, error: jokerError });

    // Clean old failures outside the window
    this.cleanOldFailures();

    // Check if we should open the circuit
    if (this.state === 'closed' || this.state === 'half-open') {
      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo('open');
        
        if (this.config.onOpen) {
          this.config.onOpen(jokerError, this.failures.length);
        }
      }
    }
  }

  /**
   * Clean failures outside the time window
   */
  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.config.failureWindow;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    
    if (oldState === newState) return;

    this.state = newState;
    this.stateChangedAt = new Date();

    // Reset counters based on new state
    if (newState === 'closed') {
      this.failures = [];
      this.halfOpenSuccesses = 0;
      this.clearResetTimer();
      
      if (this.config.onClose) {
        this.config.onClose(this.halfOpenSuccesses);
      }
    } else if (newState === 'open') {
      this.halfOpenSuccesses = 0;
      this.scheduleReset();
    } else if (newState === 'half-open') {
      this.halfOpenSuccesses = 0;
    }

    // Notify of state change
    if (this.config.logStateChanges) {
      logger.info(`Circuit breaker '${this.config.name}' transitioned: ${oldState} -> ${newState}`);
    }

    if (this.config.onStateChange) {
      this.config.onStateChange(oldState, newState);
    }
  }

  /**
   * Schedule reset timer
   */
  private scheduleReset(): void {
    this.clearResetTimer();
    
    this.resetTimer = setTimeout(() => {
      this.transitionTo('half-open');
    }, this.config.resetTimeout);
  }

  /**
   * Clear reset timer
   */
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === 'half-open';
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitStats {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failures.length,
      successes: this.halfOpenSuccesses,
      lastFailure: this.stats.lastFailure,
      lastSuccess: this.stats.lastSuccess,
      stateChangedAt: this.stateChangedAt,
      totalRequests: this.stats.totalRequests,
      totalFailures: this.stats.totalFailures,
      totalSuccesses: this.stats.totalSuccesses,
    };
  }

  /**
   * Force circuit to open state
   */
  forceOpen(): void {
    this.transitionTo('open');
  }

  /**
   * Force circuit to closed state
   */
  forceClose(): void {
    this.transitionTo('closed');
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.clearResetTimer();
    this.failures = [];
    this.halfOpenSuccesses = 0;
    this.state = 'closed';
    this.stateChangedAt = new Date();
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastSuccess: null,
      lastFailure: null,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.clearResetTimer();
  }
}

// ============================================
// Circuit Breaker Manager
// ============================================

/**
 * Manages multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager | null = null;
  private breakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Get or create a circuit breaker
   */
  getBreaker(
    name: string,
    config?: Partial<Omit<CircuitBreakerConfig, 'name'>>
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...config }));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get stats for all breakers
   */
  getAllStats(): CircuitStats[] {
    return Array.from(this.breakers.values()).map(b => b.getStats());
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    this.breakers.forEach(b => b.reset());
  }

  /**
   * Dispose all breakers
   */
  disposeAll(): void {
    this.breakers.forEach(b => b.dispose());
    this.breakers.clear();
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Get global circuit breaker manager
 */
export function getCircuitBreakerManager(): CircuitBreakerManager {
  return CircuitBreakerManager.getInstance();
}

/**
 * Get or create a circuit breaker by name
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<Omit<CircuitBreakerConfig, 'name'>>
): CircuitBreaker {
  return getCircuitBreakerManager().getBreaker(name, config);
}

/**
 * Execute function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config?: Partial<Omit<CircuitBreakerConfig, 'name'>>
): Promise<T> {
  return getCircuitBreaker(name, config).execute(fn);
}

// ============================================
// Pre-configured Circuit Breakers
// ============================================

/**
 * Get LLM circuit breaker
 */
export function getLLMCircuitBreaker(): CircuitBreaker {
  return getCircuitBreaker('llm', {
    failureThreshold: 3,
    resetTimeout: 60000,
    successThreshold: 2,
  });
}

/**
 * Get scraping circuit breaker
 */
export function getScrapingCircuitBreaker(): CircuitBreaker {
  return getCircuitBreaker('scraping', {
    failureThreshold: 5,
    resetTimeout: 30000,
    successThreshold: 3,
  });
}

/**
 * Get network circuit breaker
 */
export function getNetworkCircuitBreaker(): CircuitBreaker {
  return getCircuitBreaker('network', {
    failureThreshold: 5,
    resetTimeout: 15000,
    successThreshold: 2,
  });
}

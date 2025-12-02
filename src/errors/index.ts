/**
 * The Joker - Agentic Terminal
 * Error Handling Module
 * 
 * Exports all error handling utilities:
 * - Error types (from types/errors)
 * - Error handler (centralized handling)
 * - Retry utilities (exponential backoff)
 * - Circuit breaker (cascade failure prevention)
 */

// Re-export all error types
export * from '../types/errors';

// Export error handler
export {
  ErrorHandler,
  ErrorHandlerConfig,
  ErrorMetrics,
  FormattedError,
  getErrorHandler,
  handleError,
  handleAndDisplayError,
  handleErrorSilent,
  canRecover,
  withErrorHandling,
  errorBoundary,
} from './handler';

// Export retry utilities
export {
  RetryConfig,
  RetryResult,
  sleep,
  calculateBackoff,
  withRetry,
  withFastRetry,
  withAggressiveRetry,
  withLinearRetry,
  retryable,
  networkRetryConfig,
  llmRetryConfig,
  scrapingRetryConfig,
  fileRetryConfig,
  createRetryWrapper,
  retryAll,
  retrySequential,
} from './retry';

// Export circuit breaker
export {
  CircuitState,
  CircuitBreakerConfig,
  CircuitStats,
  CircuitOpenError,
  CircuitBreaker,
  CircuitBreakerManager,
  getCircuitBreakerManager,
  getCircuitBreaker,
  withCircuitBreaker,
  getLLMCircuitBreaker,
  getScrapingCircuitBreaker,
  getNetworkCircuitBreaker,
} from './circuit-breaker';

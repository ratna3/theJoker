/**
 * The Joker - Agentic Terminal
 * Global Error Handler
 * 
 * Centralized error handling with user-friendly messages,
 * recovery suggestions, and logging integration.
 */

import chalk from 'chalk';
import {
  JokerError,
  NetworkError,
  LLMConnectionError,
  LLMResponseError,
  ScrapingError,
  FileSystemError,
  ValidationError,
  AgentError,
  TimeoutError,
  RateLimitError,
  ConfigurationError,
  AuthenticationError,
  BrowserError,
  CancellationError,
  ErrorSeverity,
  ErrorCategory,
  isJokerError,
  wrapError,
} from '../types/errors';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Whether to show detailed error info (stack traces, etc.) */
  verbose: boolean;
  /** Whether to log errors to file */
  logToFile: boolean;
  /** Whether to show recovery suggestions */
  showSuggestions: boolean;
  /** Whether to track error metrics */
  trackMetrics: boolean;
  /** Custom error handler callback */
  onError?: (error: JokerError) => void;
  /** Custom recovery callback */
  onRecovery?: (error: JokerError, attempt: number) => void;
}

/**
 * Error metrics tracking
 */
export interface ErrorMetrics {
  total: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  recovered: number;
  unrecovered: number;
  lastError: JokerError | null;
  lastErrorTime: Date | null;
}

/**
 * Formatted error output
 */
export interface FormattedError {
  title: string;
  message: string;
  details?: string;
  suggestion?: string;
  recoverable: boolean;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: ErrorHandlerConfig = {
  verbose: false,
  logToFile: true,
  showSuggestions: true,
  trackMetrics: true,
};

// ============================================
// Error Handler Class
// ============================================

/**
 * Global error handler for The Joker
 * 
 * Provides centralized error handling with:
 * - User-friendly error formatting
 * - Recovery suggestions
 * - Error metrics tracking
 * - Logging integration
 */
export class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private config: ErrorHandlerConfig;
  private metrics: ErrorMetrics;

  private constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    } else if (config) {
      ErrorHandler.instance.updateConfig(config);
    }
    return ErrorHandler.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ErrorHandler.instance = null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Initialize error metrics
   */
  private initializeMetrics(): ErrorMetrics {
    return {
      total: 0,
      byCategory: {
        network: 0,
        llm: 0,
        scraping: 0,
        validation: 0,
        filesystem: 0,
        timeout: 0,
        rateLimit: 0,
        authentication: 0,
        configuration: 0,
        internal: 0,
      },
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      recovered: 0,
      unrecovered: 0,
      lastError: null,
      lastErrorTime: null,
    };
  }

  /**
   * Handle any error - converts to JokerError if needed
   */
  handle(error: unknown): JokerError {
    const jokerError = this.normalizeError(error);
    this.trackError(jokerError);
    this.logError(jokerError);

    if (this.config.onError) {
      this.config.onError(jokerError);
    }

    return jokerError;
  }

  /**
   * Handle error and display to user
   */
  handleAndDisplay(error: unknown): JokerError {
    const jokerError = this.handle(error);
    this.displayError(jokerError);
    return jokerError;
  }

  /**
   * Handle error silently (log only, no display)
   */
  handleSilent(error: unknown): JokerError {
    const jokerError = this.normalizeError(error);
    this.trackError(jokerError);
    this.logError(jokerError);
    return jokerError;
  }

  /**
   * Normalize any error to JokerError
   */
  normalizeError(error: unknown): JokerError {
    // Already a JokerError
    if (isJokerError(error)) {
      return error;
    }

    // Standard Error
    if (error instanceof Error) {
      return this.convertStandardError(error);
    }

    // String error
    if (typeof error === 'string') {
      return new JokerError(error, { code: 'UNKNOWN_ERROR' });
    }

    // Unknown error type
    return new JokerError(
      'An unknown error occurred',
      {
        code: 'UNKNOWN_ERROR',
        context: { originalError: String(error) },
      }
    );
  }

  /**
   * Convert standard Error to appropriate JokerError subclass
   */
  private convertStandardError(error: Error): JokerError {
    const message = error.message.toLowerCase();

    // Network-related errors
    if (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('network') ||
      message.includes('fetch failed')
    ) {
      return new NetworkError(error.message, { cause: error });
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      if (message.includes('llm') || message.includes('model')) {
        return new TimeoutError(`LLM timeout: ${error.message}`, { 
          timeoutMs: 30000, 
          operation: 'llm', 
          cause: error 
        });
      }
      if (message.includes('navigation') || message.includes('page')) {
        return new TimeoutError(`Page load timeout: ${error.message}`, { 
          timeoutMs: 30000, 
          operation: 'navigation', 
          cause: error 
        });
      }
      return new TimeoutError(error.message, { 
        timeoutMs: 30000, 
        operation: 'unknown', 
        cause: error 
      });
    }

    // File system errors
    if (
      message.includes('enoent') ||
      message.includes('no such file') ||
      message.includes('file not found')
    ) {
      return new FileSystemError(error.message, { 
        operation: 'read', 
        cause: error 
      });
    }
    if (message.includes('eacces') || message.includes('permission denied')) {
      return new FileSystemError(error.message, { 
        operation: 'read', 
        cause: error 
      });
    }

    // Parse/JSON errors
    if (
      message.includes('json') ||
      message.includes('parse') ||
      message.includes('unexpected token')
    ) {
      return new ValidationError(error.message, { 
        field: 'json', 
        cause: error 
      });
    }

    // LLM errors
    if (
      message.includes('llm') ||
      message.includes('model') ||
      message.includes('lm studio')
    ) {
      return new LLMConnectionError(error.message, { cause: error });
    }

    // Default - wrap with wrapError utility
    return wrapError(error);
  }

  /**
   * Track error in metrics
   */
  private trackError(error: JokerError): void {
    if (!this.config.trackMetrics) return;

    this.metrics.total++;
    this.metrics.byCategory[error.category]++;
    this.metrics.bySeverity[error.severity]++;
    this.metrics.lastError = error;
    this.metrics.lastErrorTime = new Date();

    if (!error.recoverable) {
      this.metrics.unrecovered++;
    }
  }

  /**
   * Mark error as recovered
   */
  markRecovered(error: JokerError): void {
    if (!this.config.trackMetrics) return;
    
    this.metrics.recovered++;
    
    if (this.config.onRecovery) {
      this.config.onRecovery(error, 1);
    }
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: JokerError): void {
    if (!this.config.logToFile) return;

    const logData = {
      code: error.code,
      category: error.category,
      severity: error.severity,
      recoverable: error.recoverable,
      context: error.context,
    };

    switch (error.severity) {
      case 'critical':
        logger.error(`[CRITICAL] ${error.message}`, logData);
        break;
      case 'high':
        logger.error(error.message, logData);
        break;
      case 'medium':
        logger.warn(error.message, logData);
        break;
      case 'low':
        logger.info(error.message, logData);
        break;
    }
  }

  /**
   * Display error to user with formatting
   */
  displayError(error: JokerError): void {
    const formatted = this.formatError(error);
    
    console.log();
    
    // Error icon and title
    const icon = this.getErrorIcon(error.severity);
    const titleColor = this.getTitleColor(error.severity);
    console.log(titleColor(`${icon} ${formatted.title}`));
    
    // Main message
    console.log(chalk.white(formatted.message));
    
    // Details (if verbose)
    if (this.config.verbose && formatted.details) {
      console.log();
      console.log(chalk.gray('Details:'));
      console.log(chalk.gray(formatted.details));
    }
    
    // Suggestion
    if (this.config.showSuggestions && formatted.suggestion) {
      console.log();
      console.log(chalk.cyan('💡 Suggestion:'), chalk.white(formatted.suggestion));
    }
    
    // Recovery status
    if (formatted.recoverable) {
      console.log(chalk.green('✓ This error may be recoverable'));
    }
    
    console.log();
  }

  /**
   * Format error for display
   */
  formatError(error: JokerError): FormattedError {
    const title = this.getErrorTitle(error);
    const message = error.message;
    const details = this.config.verbose ? this.getErrorDetails(error) : undefined;
    const suggestion = error.suggestion;
    
    return {
      title,
      message,
      details,
      suggestion,
      recoverable: error.recoverable,
    };
  }

  /**
   * Get error title based on type
   */
  private getErrorTitle(error: JokerError): string {
    if (error instanceof NetworkError) {
      return 'Network Error';
    }
    if (error instanceof LLMConnectionError) {
      return 'LLM Connection Error';
    }
    if (error instanceof LLMResponseError) {
      return 'LLM Response Error';
    }
    if (error instanceof ScrapingError) {
      return 'Scraping Error';
    }
    if (error instanceof BrowserError) {
      return 'Browser Error';
    }
    if (error instanceof FileSystemError) {
      return 'File System Error';
    }
    if (error instanceof ValidationError) {
      return 'Validation Error';
    }
    if (error instanceof AgentError) {
      return 'Agent Error';
    }
    if (error instanceof TimeoutError) {
      return 'Timeout Error';
    }
    if (error instanceof RateLimitError) {
      return 'Rate Limit Error';
    }
    if (error instanceof ConfigurationError) {
      return 'Configuration Error';
    }
    if (error instanceof AuthenticationError) {
      return 'Authentication Error';
    }
    if (error instanceof CancellationError) {
      return 'Operation Cancelled';
    }
    return 'Error';
  }

  /**
   * Get error details for verbose mode
   */
  private getErrorDetails(error: JokerError): string {
    const parts: string[] = [];
    
    parts.push(`Code: ${error.code}`);
    parts.push(`Category: ${error.category}`);
    parts.push(`Severity: ${error.severity}`);
    parts.push(`Time: ${error.timestamp.toISOString()}`);
    
    if (error.context && Object.keys(error.context).length > 0) {
      parts.push(`Context: ${JSON.stringify(error.context, null, 2)}`);
    }
    
    if (error.stack && this.config.verbose) {
      parts.push(`Stack:\n${error.stack}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Get error icon based on severity
   */
  private getErrorIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '❌';
      case 'medium':
        return '⚠️';
      case 'low':
        return 'ℹ️';
    }
  }

  /**
   * Get title color based on severity
   */
  private getTitleColor(severity: ErrorSeverity): (text: string) => string {
    switch (severity) {
      case 'critical':
        return (text: string) => chalk.bgRed.white.bold(text);
      case 'high':
        return (text: string) => chalk.red.bold(text);
      case 'medium':
        return (text: string) => chalk.yellow.bold(text);
      case 'low':
        return (text: string) => chalk.blue.bold(text);
    }
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset error metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Get error summary for logging/display
   */
  getErrorSummary(): string {
    const m = this.metrics;
    const parts: string[] = [];
    
    parts.push(`Total Errors: ${m.total}`);
    parts.push(`Recovered: ${m.recovered}`);
    parts.push(`Unrecovered: ${m.unrecovered}`);
    
    parts.push('\nBy Category:');
    for (const [category, count] of Object.entries(m.byCategory)) {
      if (count > 0) {
        parts.push(`  ${category}: ${count}`);
      }
    }
    
    parts.push('\nBy Severity:');
    for (const [severity, count] of Object.entries(m.bySeverity)) {
      if (count > 0) {
        parts.push(`  ${severity}: ${count}`);
      }
    }
    
    if (m.lastError) {
      parts.push(`\nLast Error: ${m.lastError.message}`);
      parts.push(`  Time: ${m.lastErrorTime?.toISOString()}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: unknown): boolean {
    const jokerError = this.normalizeError(error);
    return jokerError.recoverable;
  }

  /**
   * Wrap async function with error handling
   */
  async wrap<T>(
    fn: () => Promise<T>,
    options: { silent?: boolean; rethrow?: boolean } = {}
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      const jokerError = options.silent
        ? this.handleSilent(error)
        : this.handleAndDisplay(error);
      
      if (options.rethrow) {
        throw jokerError;
      }
      
      return null;
    }
  }

  /**
   * Create error boundary for synchronous code
   */
  boundary<T>(fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch (error) {
      this.handleSilent(error);
      return fallback;
    }
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Get global error handler instance
 */
export function getErrorHandler(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
  return ErrorHandler.getInstance(config);
}

/**
 * Handle error using global handler
 */
export function handleError(error: unknown): JokerError {
  return getErrorHandler().handle(error);
}

/**
 * Handle and display error using global handler
 */
export function handleAndDisplayError(error: unknown): JokerError {
  return getErrorHandler().handleAndDisplay(error);
}

/**
 * Handle error silently using global handler
 */
export function handleErrorSilent(error: unknown): JokerError {
  return getErrorHandler().handleSilent(error);
}

/**
 * Check if error is recoverable
 */
export function canRecover(error: unknown): boolean {
  return getErrorHandler().isRecoverable(error);
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options?: { silent?: boolean; rethrow?: boolean }
): Promise<T | null> {
  return getErrorHandler().wrap(fn, options);
}

/**
 * Create error boundary for synchronous code
 */
export function errorBoundary<T>(fn: () => T, fallback: T): T {
  return getErrorHandler().boundary(fn, fallback);
}

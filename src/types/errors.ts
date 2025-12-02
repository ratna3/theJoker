/**
 * The Joker - Agentic Terminal
 * Custom Error Types
 * Phase 9: Error Handling & Resilience
 */

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for grouping and handling
 */
export type ErrorCategory = 
    | 'network'
    | 'llm'
    | 'scraping'
    | 'validation'
    | 'filesystem'
    | 'timeout'
    | 'rateLimit'
    | 'authentication'
    | 'configuration'
    | 'internal';

/**
 * Base error class for all Joker errors
 */
export class JokerError extends Error {
    /** Unique error code for identification */
    readonly code: string;
    
    /** Error category for grouping */
    readonly category: ErrorCategory;
    
    /** Whether the error can be recovered from */
    readonly recoverable: boolean;
    
    /** Severity level of the error */
    readonly severity: ErrorSeverity;
    
    /** User-friendly suggestion for resolution */
    readonly suggestion?: string;
    
    /** Additional context data */
    readonly context?: Record<string, unknown>;
    
    /** Original error if this wraps another error */
    readonly cause?: Error;
    
    /** Timestamp when error occurred */
    readonly timestamp: Date;
    
    /** Retry information */
    readonly retryable: boolean;
    readonly retryAfterMs?: number;

    constructor(
        message: string,
        options: {
            code?: string;
            category?: ErrorCategory;
            recoverable?: boolean;
            severity?: ErrorSeverity;
            suggestion?: string;
            context?: Record<string, unknown>;
            cause?: Error;
            retryable?: boolean;
            retryAfterMs?: number;
        } = {}
    ) {
        super(message);
        this.name = 'JokerError';
        this.code = options.code || 'JOKER_ERROR';
        this.category = options.category || 'internal';
        this.recoverable = options.recoverable ?? true;
        this.severity = options.severity || 'medium';
        this.suggestion = options.suggestion;
        this.context = options.context;
        this.cause = options.cause;
        this.retryable = options.retryable ?? false;
        this.retryAfterMs = options.retryAfterMs;
        this.timestamp = new Date();

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Create a JSON representation of the error
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            category: this.category,
            message: this.message,
            recoverable: this.recoverable,
            severity: this.severity,
            suggestion: this.suggestion,
            context: this.context,
            retryable: this.retryable,
            retryAfterMs: this.retryAfterMs,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
            cause: this.cause?.message,
        };
    }

    /**
     * Get a user-friendly error message
     */
    getUserMessage(): string {
        let msg = this.message;
        if (this.suggestion) {
            msg += `\n💡 ${this.suggestion}`;
        }
        return msg;
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends JokerError {
    readonly statusCode?: number;
    readonly url?: string;

    constructor(
        message: string,
        options: {
            statusCode?: number;
            url?: string;
            cause?: Error;
            context?: Record<string, unknown>;
            retryAfterMs?: number;
        } = {}
    ) {
        super(message, {
            code: 'NETWORK_ERROR',
            category: 'network',
            recoverable: true,
            severity: 'medium',
            suggestion: 'Check your internet connection and try again.',
            cause: options.cause,
            context: { ...options.context, statusCode: options.statusCode, url: options.url },
            retryable: true,
            retryAfterMs: options.retryAfterMs || 1000,
        });
        this.name = 'NetworkError';
        this.statusCode = options.statusCode;
        this.url = options.url;
    }
}

/**
 * LLM connection and communication errors
 */
export class LLMConnectionError extends JokerError {
    readonly endpoint?: string;
    readonly model?: string;

    constructor(
        message: string = 'Failed to connect to LM Studio',
        options: {
            endpoint?: string;
            model?: string;
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'LLM_CONNECTION_ERROR',
            category: 'llm',
            recoverable: false,
            severity: 'high',
            suggestion: 'Please ensure LM Studio is running at http://192.168.56.1:1234 with a model loaded.',
            cause: options.cause,
            context: { ...options.context, endpoint: options.endpoint, model: options.model },
            retryable: true,
            retryAfterMs: 5000,
        });
        this.name = 'LLMConnectionError';
        this.endpoint = options.endpoint;
        this.model = options.model;
    }
}

/**
 * LLM response errors (invalid response, parsing issues, etc.)
 */
export class LLMResponseError extends JokerError {
    readonly response?: string;

    constructor(
        message: string,
        options: {
            response?: string;
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'LLM_RESPONSE_ERROR',
            category: 'llm',
            recoverable: true,
            severity: 'medium',
            suggestion: 'The LLM response was unexpected. Try rephrasing your request.',
            cause: options.cause,
            context: { ...options.context, responsePreview: options.response?.substring(0, 200) },
            retryable: true,
            retryAfterMs: 1000,
        });
        this.name = 'LLMResponseError';
        this.response = options.response;
    }
}

/**
 * Web scraping errors
 */
export class ScrapingError extends JokerError {
    readonly url?: string;
    readonly selector?: string;

    constructor(
        message: string,
        options: {
            url?: string;
            selector?: string;
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'SCRAPING_ERROR',
            category: 'scraping',
            recoverable: true,
            severity: 'medium',
            suggestion: 'The page structure may have changed. Try a different approach.',
            cause: options.cause,
            context: { ...options.context, url: options.url, selector: options.selector },
            retryable: true,
            retryAfterMs: 2000,
        });
        this.name = 'ScrapingError';
        this.url = options.url;
        this.selector = options.selector;
    }
}

/**
 * Browser/Puppeteer errors
 */
export class BrowserError extends JokerError {
    constructor(
        message: string,
        options: {
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'BROWSER_ERROR',
            category: 'scraping',
            recoverable: true,
            severity: 'high',
            suggestion: 'Browser encountered an issue. Try restarting the browser pool.',
            cause: options.cause,
            context: options.context,
            retryable: true,
            retryAfterMs: 3000,
        });
        this.name = 'BrowserError';
    }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends JokerError {
    readonly limit?: number;
    readonly remaining?: number;
    readonly resetAt?: Date;

    constructor(
        message: string = 'Rate limit exceeded',
        options: {
            limit?: number;
            remaining?: number;
            resetAt?: Date;
            retryAfterMs?: number;
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        const retryAfter = options.retryAfterMs || 
            (options.resetAt ? options.resetAt.getTime() - Date.now() : 60000);

        super(message, {
            code: 'RATE_LIMIT_ERROR',
            category: 'rateLimit',
            recoverable: true,
            severity: 'low',
            suggestion: `Please wait ${Math.ceil(retryAfter / 1000)} seconds before trying again.`,
            cause: options.cause,
            context: { 
                ...options.context, 
                limit: options.limit, 
                remaining: options.remaining,
                resetAt: options.resetAt?.toISOString(),
            },
            retryable: true,
            retryAfterMs: retryAfter,
        });
        this.name = 'RateLimitError';
        this.limit = options.limit;
        this.remaining = options.remaining;
        this.resetAt = options.resetAt;
    }
}

/**
 * Timeout errors
 */
export class TimeoutError extends JokerError {
    readonly timeoutMs: number;
    readonly operation?: string;

    constructor(
        message: string,
        options: {
            timeoutMs: number;
            operation?: string;
            cause?: Error;
            context?: Record<string, unknown>;
        }
    ) {
        super(message, {
            code: 'TIMEOUT_ERROR',
            category: 'timeout',
            recoverable: true,
            severity: 'medium',
            suggestion: 'The operation took too long. Try again or simplify your request.',
            cause: options.cause,
            context: { ...options.context, timeoutMs: options.timeoutMs, operation: options.operation },
            retryable: true,
            retryAfterMs: 1000,
        });
        this.name = 'TimeoutError';
        this.timeoutMs = options.timeoutMs;
        this.operation = options.operation;
    }
}

/**
 * Validation errors
 */
export class ValidationError extends JokerError {
    readonly field?: string;
    readonly value?: unknown;
    readonly constraint?: string;

    constructor(
        message: string,
        options: {
            field?: string;
            value?: unknown;
            constraint?: string;
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'VALIDATION_ERROR',
            category: 'validation',
            recoverable: false,
            severity: 'low',
            suggestion: 'Please check your input and try again.',
            cause: options.cause,
            context: { ...options.context, field: options.field, constraint: options.constraint },
            retryable: false,
        });
        this.name = 'ValidationError';
        this.field = options.field;
        this.value = options.value;
        this.constraint = options.constraint;
    }
}

/**
 * File system errors
 */
export class FileSystemError extends JokerError {
    readonly path?: string;
    readonly operation?: 'read' | 'write' | 'delete' | 'create' | 'exists';

    constructor(
        message: string,
        options: {
            path?: string;
            operation?: 'read' | 'write' | 'delete' | 'create' | 'exists';
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'FILESYSTEM_ERROR',
            category: 'filesystem',
            recoverable: false,
            severity: 'medium',
            suggestion: 'Check file permissions and path validity.',
            cause: options.cause,
            context: { ...options.context, path: options.path, operation: options.operation },
            retryable: false,
        });
        this.name = 'FileSystemError';
        this.path = options.path;
        this.operation = options.operation;
    }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends JokerError {
    readonly configKey?: string;

    constructor(
        message: string,
        options: {
            configKey?: string;
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'CONFIGURATION_ERROR',
            category: 'configuration',
            recoverable: false,
            severity: 'high',
            suggestion: 'Please check your configuration settings.',
            cause: options.cause,
            context: { ...options.context, configKey: options.configKey },
            retryable: false,
        });
        this.name = 'ConfigurationError';
        this.configKey = options.configKey;
    }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends JokerError {
    constructor(
        message: string = 'Authentication failed',
        options: {
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'AUTHENTICATION_ERROR',
            category: 'authentication',
            recoverable: false,
            severity: 'high',
            suggestion: 'Please check your credentials and try again.',
            cause: options.cause,
            context: options.context,
            retryable: false,
        });
        this.name = 'AuthenticationError';
    }
}

/**
 * Agent execution errors
 */
export class AgentError extends JokerError {
    readonly step?: number;
    readonly action?: string;

    constructor(
        message: string,
        options: {
            step?: number;
            action?: string;
            cause?: Error;
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'AGENT_ERROR',
            category: 'internal',
            recoverable: true,
            severity: 'medium',
            suggestion: 'The agent encountered an issue. It will attempt to recover.',
            cause: options.cause,
            context: { ...options.context, step: options.step, action: options.action },
            retryable: true,
            retryAfterMs: 1000,
        });
        this.name = 'AgentError';
        this.step = options.step;
        this.action = options.action;
    }
}

/**
 * Cancellation error (user cancelled operation)
 */
export class CancellationError extends JokerError {
    constructor(
        message: string = 'Operation cancelled by user',
        options: {
            context?: Record<string, unknown>;
        } = {}
    ) {
        super(message, {
            code: 'CANCELLATION_ERROR',
            category: 'internal',
            recoverable: false,
            severity: 'low',
            context: options.context,
            retryable: false,
        });
        this.name = 'CancellationError';
    }
}

/**
 * Type guard to check if an error is a JokerError
 */
export function isJokerError(error: unknown): error is JokerError {
    return error instanceof JokerError;
}

/**
 * Wrap any error as a JokerError
 */
export function wrapError(error: unknown, defaults?: Partial<JokerError>): JokerError {
    if (error instanceof JokerError) {
        return error;
    }

    if (error instanceof Error) {
        return new JokerError(error.message, {
            cause: error,
            code: defaults?.code || 'WRAPPED_ERROR',
            category: defaults?.category || 'internal',
            severity: defaults?.severity || 'medium',
            recoverable: defaults?.recoverable ?? true,
            context: defaults?.context,
        });
    }

    return new JokerError(String(error), {
        code: defaults?.code || 'UNKNOWN_ERROR',
        category: defaults?.category || 'internal',
        severity: defaults?.severity || 'medium',
        recoverable: defaults?.recoverable ?? false,
    });
}

/**
 * Create error from HTTP status code
 */
export function createHttpError(statusCode: number, message?: string, url?: string): JokerError {
    const defaultMessages: Record<number, string> = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        408: 'Request Timeout',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout',
    };

    const errorMessage = message || defaultMessages[statusCode] || `HTTP Error ${statusCode}`;

    if (statusCode === 429) {
        return new RateLimitError(errorMessage, { context: { url } });
    }

    if (statusCode === 408 || statusCode === 504) {
        return new TimeoutError(errorMessage, { timeoutMs: 0, context: { url, statusCode } });
    }

    if (statusCode === 401 || statusCode === 403) {
        return new AuthenticationError(errorMessage, { context: { url, statusCode } });
    }

    return new NetworkError(errorMessage, { statusCode, url });
}

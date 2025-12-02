/**
 * The Joker - Agentic Terminal
 * Error Types Unit Tests
 * Phase 10: Testing & Optimization
 */

import {
  JokerError,
  NetworkError,
  LLMConnectionError,
  LLMResponseError,
  ScrapingError,
  BrowserError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  FileSystemError,
  ConfigurationError,
  AuthenticationError,
  AgentError,
  CancellationError,
  isJokerError,
  wrapError,
  createHttpError,
} from '../../../src/types/errors';

describe('Error Types', () => {
  // ============================================
  // JokerError Base Class
  // ============================================

  describe('JokerError', () => {
    it('should create error with message and code', () => {
      const error = new JokerError('Test error', { code: 'TEST_ERROR' });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('JokerError');
    });

    it('should have default properties', () => {
      const error = new JokerError('Test');
      expect(error.recoverable).toBe(true);
      expect(error.severity).toBe('medium');
      expect(error.category).toBe('internal');
      expect(error.retryable).toBe(false);
      expect(error.code).toBe('JOKER_ERROR');
    });

    it('should accept custom options', () => {
      const error = new JokerError('Test', {
        code: 'TEST',
        recoverable: false,
        severity: 'high',
        category: 'network',
        suggestion: 'Try again',
        retryable: true,
        retryAfterMs: 5000,
      });
      expect(error.recoverable).toBe(false);
      expect(error.severity).toBe('high');
      expect(error.category).toBe('network');
      expect(error.suggestion).toBe('Try again');
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBe(5000);
    });

    it('should have timestamp', () => {
      const before = new Date();
      const error = new JokerError('Test');
      const after = new Date();
      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should serialize to JSON', () => {
      const error = new JokerError('Test', {
        code: 'TEST',
        context: { key: 'value' },
      });
      const json = error.toJSON();
      expect(json.message).toBe('Test');
      expect(json.code).toBe('TEST');
      expect(json.context).toEqual({ key: 'value' });
    });

    it('should include cause in serialization', () => {
      const cause = new Error('Original error');
      const error = new JokerError('Wrapped', { code: 'WRAPPED', cause });
      const json = error.toJSON();
      expect(json.cause).toBe('Original error');
    });

    it('should be instance of Error', () => {
      const error = new JokerError('Test');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof JokerError).toBe(true);
    });

    it('should provide user-friendly message', () => {
      const error = new JokerError('Something went wrong', {
        suggestion: 'Try restarting the service',
      });
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Something went wrong');
      expect(userMessage).toContain('Try restarting the service');
    });
  });

  // ============================================
  // NetworkError
  // ============================================

  describe('NetworkError', () => {
    it('should have correct defaults', () => {
      const error = new NetworkError('Network failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.category).toBe('network');
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(true);
    });

    it('should accept status code', () => {
      const error = new NetworkError('Server error', { statusCode: 500 });
      expect(error.statusCode).toBe(500);
    });

    it('should accept URL', () => {
      const error = new NetworkError('Request failed', { 
        statusCode: 404, 
        url: 'https://example.com/api' 
      });
      expect(error.url).toBe('https://example.com/api');
      expect(error.statusCode).toBe(404);
    });
  });

  // ============================================
  // LLMConnectionError
  // ============================================

  describe('LLMConnectionError', () => {
    it('should have correct defaults', () => {
      const error = new LLMConnectionError();
      expect(error.code).toBe('LLM_CONNECTION_ERROR');
      expect(error.category).toBe('llm');
      expect(error.recoverable).toBe(false);
      expect(error.suggestion).toContain('LM Studio');
    });

    it('should accept custom message', () => {
      const error = new LLMConnectionError('LLM not available');
      expect(error.message).toBe('LLM not available');
    });

    it('should accept endpoint and model', () => {
      const error = new LLMConnectionError('Connection failed', {
        endpoint: 'http://localhost:1234',
        model: 'test-model',
      });
      expect(error.endpoint).toBe('http://localhost:1234');
      expect(error.model).toBe('test-model');
    });
  });

  // ============================================
  // LLMResponseError
  // ============================================

  describe('LLMResponseError', () => {
    it('should have correct defaults', () => {
      const error = new LLMResponseError('Invalid response');
      expect(error.code).toBe('LLM_RESPONSE_ERROR');
      expect(error.category).toBe('llm');
    });

    it('should accept response preview', () => {
      const error = new LLMResponseError('Invalid JSON', {
        response: 'This is not valid JSON',
      });
      expect(error.response).toBe('This is not valid JSON');
    });
  });

  // ============================================
  // ScrapingError
  // ============================================

  describe('ScrapingError', () => {
    it('should have correct defaults', () => {
      const error = new ScrapingError('Scraping failed', { url: 'https://example.com' });
      expect(error.code).toBe('SCRAPING_ERROR');
      expect(error.category).toBe('scraping');
      expect(error.url).toBe('https://example.com');
    });

    it('should accept selector', () => {
      const error = new ScrapingError('Element not found', {
        url: 'https://example.com',
        selector: '.content',
      });
      expect(error.selector).toBe('.content');
    });
  });

  // ============================================
  // BrowserError
  // ============================================

  describe('BrowserError', () => {
    it('should have correct defaults', () => {
      const error = new BrowserError('Browser crashed');
      expect(error.code).toBe('BROWSER_ERROR');
      expect(error.category).toBe('scraping');
    });

    it('should accept cause', () => {
      const cause = new Error('Original error');
      const error = new BrowserError('Browser failed', { cause });
      expect(error.cause).toBe(cause);
    });
  });

  // ============================================
  // RateLimitError
  // ============================================

  describe('RateLimitError', () => {
    it('should have correct defaults', () => {
      const error = new RateLimitError();
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.category).toBe('rateLimit');
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(true);
    });

    it('should accept retry after', () => {
      const error = new RateLimitError('Rate limited', { retryAfterMs: 60000 });
      expect(error.retryAfterMs).toBe(60000);
    });

    it('should accept limit information', () => {
      const resetAt = new Date(Date.now() + 60000);
      const error = new RateLimitError('Rate limited', {
        limit: 100,
        remaining: 0,
        resetAt,
      });
      expect(error.limit).toBe(100);
      expect(error.remaining).toBe(0);
      expect(error.resetAt).toBe(resetAt);
    });
  });

  // ============================================
  // TimeoutError
  // ============================================

  describe('TimeoutError', () => {
    it('should have correct defaults', () => {
      const error = new TimeoutError('Operation timed out', { timeoutMs: 30000 });
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.category).toBe('timeout');
      expect(error.timeoutMs).toBe(30000);
      expect(error.recoverable).toBe(true);
    });

    it('should accept operation name', () => {
      const error = new TimeoutError('Request timed out', {
        timeoutMs: 5000,
        operation: 'API call',
      });
      expect(error.operation).toBe('API call');
    });
  });

  // ============================================
  // ValidationError
  // ============================================

  describe('ValidationError', () => {
    it('should have correct defaults', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.category).toBe('validation');
      expect(error.field).toBe('email');
      expect(error.recoverable).toBe(false);
    });

    it('should accept value and constraint', () => {
      const error = new ValidationError('Invalid email', {
        field: 'email',
        value: 'not-an-email',
        constraint: 'Must be a valid email address',
      });
      expect(error.value).toBe('not-an-email');
      expect(error.constraint).toBe('Must be a valid email address');
    });
  });

  // ============================================
  // FileSystemError
  // ============================================

  describe('FileSystemError', () => {
    it('should have correct defaults', () => {
      const error = new FileSystemError('File not found', {
        path: '/path/to/file',
        operation: 'read',
      });
      expect(error.code).toBe('FILESYSTEM_ERROR');
      expect(error.category).toBe('filesystem');
      expect(error.path).toBe('/path/to/file');
      expect(error.operation).toBe('read');
    });

    it('should accept different operations', () => {
      const error = new FileSystemError('Permission denied', {
        path: '/path/to/file',
        operation: 'write',
      });
      expect(error.operation).toBe('write');
    });
  });

  // ============================================
  // ConfigurationError
  // ============================================

  describe('ConfigurationError', () => {
    it('should have correct defaults', () => {
      const error = new ConfigurationError('Missing config', { configKey: 'apiKey' });
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.category).toBe('configuration');
      expect(error.configKey).toBe('apiKey');
    });
  });

  // ============================================
  // AuthenticationError
  // ============================================

  describe('AuthenticationError', () => {
    it('should have correct defaults', () => {
      const error = new AuthenticationError();
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.category).toBe('authentication');
      expect(error.recoverable).toBe(false);
      expect(error.message).toBe('Authentication failed');
    });

    it('should accept custom message', () => {
      const error = new AuthenticationError('Invalid credentials');
      expect(error.message).toBe('Invalid credentials');
    });
  });

  // ============================================
  // AgentError
  // ============================================

  describe('AgentError', () => {
    it('should have correct defaults', () => {
      const error = new AgentError('Agent failed', { action: 'plan' });
      expect(error.code).toBe('AGENT_ERROR');
      expect(error.category).toBe('internal');
      expect(error.action).toBe('plan');
    });

    it('should accept step number', () => {
      const error = new AgentError('Step failed', {
        step: 3,
        action: 'execute',
      });
      expect(error.step).toBe(3);
      expect(error.action).toBe('execute');
    });
  });

  // ============================================
  // CancellationError
  // ============================================

  describe('CancellationError', () => {
    it('should have correct defaults', () => {
      const error = new CancellationError();
      expect(error.code).toBe('CANCELLATION_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.retryable).toBe(false);
      expect(error.message).toBe('Operation cancelled by user');
    });

    it('should accept custom message', () => {
      const error = new CancellationError('User cancelled');
      expect(error.message).toBe('User cancelled');
    });
  });

  // ============================================
  // Helper Functions
  // ============================================

  describe('isJokerError', () => {
    it('should return true for JokerError instances', () => {
      const error = new JokerError('Test');
      expect(isJokerError(error)).toBe(true);
    });

    it('should return true for subclass instances', () => {
      const error = new NetworkError('Network failed');
      expect(isJokerError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Regular error');
      expect(isJokerError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isJokerError('string')).toBe(false);
      expect(isJokerError(null)).toBe(false);
      expect(isJokerError(undefined)).toBe(false);
      expect(isJokerError(123)).toBe(false);
      expect(isJokerError({})).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should return JokerError as-is', () => {
      const original = new NetworkError('Network failed');
      const wrapped = wrapError(original);
      expect(wrapped).toBe(original);
    });

    it('should wrap regular Error', () => {
      const original = new Error('Regular error');
      const wrapped = wrapError(original);
      expect(wrapped instanceof JokerError).toBe(true);
      expect(wrapped.cause).toBe(original);
      expect(wrapped.message).toBe('Regular error');
    });

    it('should wrap string', () => {
      const wrapped = wrapError('String error');
      expect(wrapped instanceof JokerError).toBe(true);
      expect(wrapped.message).toBe('String error');
    });

    it('should wrap unknown values', () => {
      const wrapped = wrapError({ custom: 'object' });
      expect(wrapped instanceof JokerError).toBe(true);
    });

    it('should accept default options', () => {
      const wrapped = wrapError(new Error('Test'), { code: 'CUSTOM_CODE' });
      expect(wrapped.code).toBe('CUSTOM_CODE');
    });

    it('should accept default category', () => {
      const wrapped = wrapError(new Error('Test'), { category: 'network' });
      expect(wrapped.category).toBe('network');
    });

    it('should accept default severity', () => {
      const wrapped = wrapError(new Error('Test'), { severity: 'high' });
      expect(wrapped.severity).toBe('high');
    });
  });

  describe('createHttpError', () => {
    it('should create NetworkError for 500 status', () => {
      const error = createHttpError(500, 'Internal Server Error');
      expect(error instanceof NetworkError).toBe(true);
      expect((error as NetworkError).statusCode).toBe(500);
    });

    it('should create RateLimitError for 429 status', () => {
      const error = createHttpError(429, 'Too Many Requests');
      expect(error instanceof RateLimitError).toBe(true);
    });

    it('should create AuthenticationError for 401 status', () => {
      const error = createHttpError(401, 'Unauthorized');
      expect(error instanceof AuthenticationError).toBe(true);
    });

    it('should create AuthenticationError for 403 status', () => {
      const error = createHttpError(403, 'Forbidden');
      expect(error instanceof AuthenticationError).toBe(true);
    });

    it('should create TimeoutError for 408 status', () => {
      const error = createHttpError(408, 'Request Timeout');
      expect(error instanceof TimeoutError).toBe(true);
    });

    it('should create TimeoutError for 504 status', () => {
      const error = createHttpError(504, 'Gateway Timeout');
      expect(error instanceof TimeoutError).toBe(true);
    });

    it('should create NetworkError for other status codes', () => {
      const error = createHttpError(503, 'Service Unavailable');
      expect(error instanceof NetworkError).toBe(true);
    });

    it('should use default message when not provided', () => {
      const error = createHttpError(500);
      expect(error.message).toBe('Internal Server Error');
    });

    it('should include URL in error', () => {
      const error = createHttpError(404, 'Not Found', 'https://example.com');
      expect(error instanceof NetworkError).toBe(true);
    });
  });
});

/**
 * The Joker - Agentic Terminal
 * Integration Tests - Workflow Scenarios
 * Phase 10: Testing & Optimization
 */

import { DataCleaner } from '../../src/utils/cleaner';
import {
  JokerError,
  NetworkError,
  RateLimitError,
  wrapError,
  createHttpError,
} from '../../src/types/errors';
import { withRetry, RetryConfig } from '../../src/errors/retry';
import { CircuitBreaker, CircuitOpenError } from '../../src/errors/circuit-breaker';

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the error handler
jest.mock('../../src/errors/handler', () => ({
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

describe('Integration: Error Handling Workflow', () => {
  describe('Retry with Circuit Breaker', () => {
    it('should handle transient failures with retry', async () => {
      let attempts = 0;
      const flakeyOperation = async (): Promise<string> => {
        attempts++;
        if (attempts < 3) {
          throw new NetworkError('Connection reset');
        }
        return 'success';
      };

      const result = await withRetry(flakeyOperation, {
        maxAttempts: 5,
        baseDelay: 10,
        logRetries: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
    });

    it('should trip circuit breaker after repeated failures', async () => {
      const breaker = new CircuitBreaker({
        name: 'test-service',
        failureThreshold: 3,
        resetTimeout: 5000,
        logStateChanges: false,
      });

      const failingOperation = async (): Promise<string> => {
        throw new NetworkError('Service unavailable');
      };

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch {
          // Expected
        }
      }

      // Circuit should now be open
      expect(breaker.isOpen()).toBe(true);

      // Subsequent calls should fail fast
      await expect(
        breaker.execute(async () => 'should not run')
      ).rejects.toThrow(CircuitOpenError);

      breaker.dispose();
    });

    it('should integrate retry with circuit breaker', async () => {
      const breaker = new CircuitBreaker({
        name: 'integrated-service',
        failureThreshold: 5,
        resetTimeout: 5000,
        logStateChanges: false,
      });

      let callCount = 0;
      const operationWithBreaker = async (): Promise<string> => {
        return breaker.execute(async () => {
          callCount++;
          if (callCount < 3) {
            throw new NetworkError('Transient failure');
          }
          return 'success';
        });
      };

      const result = await withRetry(operationWithBreaker, {
        maxAttempts: 5,
        baseDelay: 10,
        logRetries: false,
      });

      expect(result.success).toBe(true);
      expect(callCount).toBe(3);
      expect(breaker.isClosed()).toBe(true);

      breaker.dispose();
    });
  });

  describe('Data Processing Pipeline', () => {
    it('should clean and process scraped HTML data', () => {
      const rawHtml = `
        <html>
          <head>
            <title>Test Page</title>
            <script>console.log('track');</script>
            <style>body { color: red; }</style>
          </head>
          <body>
            <nav>Menu items here</nav>
            <main>
              <h1>Welcome to Our Site</h1>
              <p>This is the    main   content with &amp; special chars.</p>
              <p>Visit us at https://example.com?utm_source=test</p>
              <div class="cookie-notice">Please accept our cookie policy</div>
            </main>
            <footer>© 2024 All Rights Reserved</footer>
          </body>
        </html>
      `;

      // Step 1: Strip HTML
      const textContent = DataCleaner.stripHtml(rawHtml);
      expect(textContent).toContain('Welcome to Our Site');
      expect(textContent).toContain('main'); // Content may have extra whitespace
      expect(textContent).toContain('content');
      expect(textContent).not.toContain('<script>');
      expect(textContent).not.toContain('console.log');

      // Step 2: Normalize whitespace - collapses multiple spaces, preserves single newlines
      const normalized = DataCleaner.normalizeWhitespace(textContent);
      // Check that there are no more than 2 consecutive newlines (collapsed from multiple)
      expect(normalized).not.toMatch(/\n{3,}/);
      // Check that inline spaces are collapsed
      expect(normalized).not.toMatch(/[ ]{2,}/);
      expect(normalized).toContain('main content');

      // Step 3: Remove boilerplate (cookie policy, copyright, etc.)
      const cleaned = DataCleaner.removeBoilerplate(normalized);
      expect(cleaned).not.toContain('cookie policy');
      expect(cleaned).not.toContain('All Rights Reserved');

      // Step 4: Extract keywords
      const keywords = DataCleaner.extractKeywords(cleaned, 3);
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should handle URL cleaning in scraped data', () => {
      const urls = [
        'https://example.com/page?utm_source=google&utm_medium=cpc',
        'http://example.com/path/',
        'www.example.com/test',
        'https://example.com/page#anchor',
      ];

      const cleanedUrls = urls.map(url => DataCleaner.cleanUrl(url));

      expect(cleanedUrls[0]).toBe('https://example.com/page');
      expect(cleanedUrls[1]).toBe('http://example.com/path');
      expect(cleanedUrls[2]).toBe('https://www.example.com/test');
      // cleanUrl preserves anchors as they are part of the URL structure
      expect(cleanedUrls[3]).toBe('https://example.com/page#anchor');
    });

    it('should extract and clean JSON from LLM response', () => {
      const llmResponse = `
        Based on my analysis, here is the structured data:
        
        \`\`\`json
        {
          "title": "Test Article",
          "author": "John Doe",
          "tags": ["tech", "ai"]
        }
        \`\`\`
        
        I hope this helps!
      `;

      const cleaned = DataCleaner.cleanJson(llmResponse);
      expect(cleaned).not.toBeNull();
      
      // cleanJson returns the cleaned JSON string, so we parse it
      const parsed = JSON.parse(cleaned!) as { title: string; author: string; tags: string[] };

      expect(parsed.title).toBe('Test Article');
      expect(parsed.author).toBe('John Doe');
      expect(parsed.tags).toEqual(['tech', 'ai']);
    });
  });

  describe('Error Transformation Flow', () => {
    it('should transform HTTP errors to appropriate types', () => {
      const httpErrors = [
        { status: 429, expected: RateLimitError },
        { status: 500, expected: NetworkError },
        { status: 404, expected: NetworkError },
      ];

      httpErrors.forEach(({ status, expected }) => {
        const error = createHttpError(status, `HTTP ${status} error`);
        expect(error).toBeInstanceOf(expected);
      });
    });

    it('should wrap unknown errors appropriately', () => {
      const testCases = [
        { input: new Error('Standard error'), expectedMessage: 'Standard error' },
        { input: 'String error', expectedMessage: 'String error' },
        { input: { custom: 'object' }, expectedMessage: '[object Object]' },
        { input: null, expectedMessage: 'null' },
      ];

      testCases.forEach(({ input, expectedMessage }) => {
        const wrapped = wrapError(input);
        expect(wrapped).toBeInstanceOf(JokerError);
        expect(wrapped.message).toBe(expectedMessage);
      });
    });

    it('should preserve JokerError instances', () => {
      const original = new NetworkError('Network issue', { statusCode: 503 });
      const wrapped = wrapError(original);

      expect(wrapped).toBe(original);
      expect(wrapped instanceof NetworkError).toBe(true);
    });
  });

  describe('Resilience Pattern: Rate Limiting', () => {
    it('should handle rate limit with proper backoff', async () => {
      const rateLimiter = {
        remaining: 2,
        async request(): Promise<string> {
          if (this.remaining <= 0) {
            throw new RateLimitError('Rate limited', { retryAfterMs: 100 });
          }
          this.remaining--;
          return 'success';
        },
      };

      // First two requests should succeed
      const result1 = await rateLimiter.request();
      const result2 = await rateLimiter.request();
      expect(result1).toBe('success');
      expect(result2).toBe('success');

      // Third request should fail with rate limit
      await expect(rateLimiter.request()).rejects.toThrow(RateLimitError);
    });

    it('should respect retryAfterMs in rate limit errors', () => {
      const resetTime = new Date(Date.now() + 60000);
      const error = new RateLimitError('Rate limited', {
        resetAt: resetTime,
        limit: 100,
        remaining: 0,
      });

      expect(error.retryAfterMs).toBeGreaterThan(0);
      expect(error.retryAfterMs).toBeLessThanOrEqual(60000);
      expect(error.limit).toBe(100);
      expect(error.remaining).toBe(0);
    });
  });

  describe('End-to-End: Search Workflow Simulation', () => {
    interface SearchResult {
      title: string;
      url: string;
      snippet: string;
    }

    const mockSearchEngine = {
      failureCount: 0,
      async search(query: string): Promise<SearchResult[]> {
        // Simulate occasional failures
        this.failureCount++;
        if (this.failureCount <= 2) {
          throw new NetworkError('Connection timeout');
        }

        return [
          {
            title: `Result for "${query}"`,
            url: 'https://example.com/result?utm_source=test',
            snippet: '<p>This is a <b>snippet</b> with HTML</p>',
          },
        ];
      },
    };

    it('should complete search workflow with retry and data cleaning', async () => {
      mockSearchEngine.failureCount = 0;

      // Execute search with retry
      const result = await withRetry(
        () => mockSearchEngine.search('test query'),
        {
          maxAttempts: 5,
          baseDelay: 10,
          logRetries: false,
        }
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3); // Failed twice, succeeded on third

      // Clean the results using static methods
      const cleanedResults = result.data!.map(item => ({
        title: DataCleaner.stripHtml(item.title),
        url: DataCleaner.cleanUrl(item.url),
        snippet: DataCleaner.stripHtml(item.snippet),
      }));

      expect(cleanedResults[0].url).not.toContain('utm_source');
      expect(cleanedResults[0].snippet).not.toContain('<p>');
      expect(cleanedResults[0].snippet).toContain('snippet');
    });
  });
});

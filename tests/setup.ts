/**
 * Jest Test Setup
 * Phase 10: Testing & Optimization
 * 
 * Global setup and configuration for all tests
 */

import { jest } from '@jest/globals';

// ============================================
// Environment Setup
// ============================================

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DEBUG_MODE = 'false';
process.env.LM_STUDIO_ENDPOINT = 'http://localhost:1234';
process.env.LM_STUDIO_MODEL = 'test-model';

// ============================================
// Global Mocks
// ============================================

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless DEBUG_TESTS is set
  if (!process.env.DEBUG_TESTS) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    // Keep error and warn for debugging failed tests
    // jest.spyOn(console, 'warn').mockImplementation(() => {});
    // jest.spyOn(console, 'error').mockImplementation(() => {});
  }
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

// ============================================
// Custom Matchers
// ============================================

expect.extend({
  /**
   * Check if value is a valid URL
   */
  toBeValidUrl(received: string) {
    try {
      new URL(received);
      return {
        pass: true,
        message: () => `expected ${received} not to be a valid URL`,
      };
    } catch {
      return {
        pass: false,
        message: () => `expected ${received} to be a valid URL`,
      };
    }
  },

  /**
   * Check if value is within range
   */
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },

  /**
   * Check if error has specific code
   */
  toHaveErrorCode(received: unknown, expectedCode: string) {
    const error = received as { code?: string };
    const pass = error?.code === expectedCode;
    return {
      pass,
      message: () =>
        pass
          ? `expected error not to have code ${expectedCode}`
          : `expected error to have code ${expectedCode}, but got ${error?.code}`,
    };
  },

  /**
   * Check if promise resolves within timeout
   */
  async toResolveWithin(received: Promise<unknown>, timeoutMs: number) {
    const start = Date.now();
    try {
      await Promise.race([
        received,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        ),
      ]);
      const elapsed = Date.now() - start;
      return {
        pass: true,
        message: () =>
          `expected promise not to resolve within ${timeoutMs}ms (resolved in ${elapsed}ms)`,
      };
    } catch (error) {
      const elapsed = Date.now() - start;
      if ((error as Error).message === 'Timeout') {
        return {
          pass: false,
          message: () =>
            `expected promise to resolve within ${timeoutMs}ms (still pending after ${elapsed}ms)`,
        };
      }
      return {
        pass: true,
        message: () =>
          `expected promise not to resolve within ${timeoutMs}ms (rejected in ${elapsed}ms)`,
      };
    }
  },
});

// ============================================
// Type Declarations for Custom Matchers
// ============================================

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidUrl(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveErrorCode(expectedCode: string): R;
      toResolveWithin(timeoutMs: number): Promise<R>;
    }
  }
}

// ============================================
// Global Test Utilities
// ============================================

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock function that resolves after delay
 */
export function createDelayedMock<T>(value: T, delayMs: number): jest.Mock {
  return jest.fn().mockImplementation(() =>
    new Promise(resolve => setTimeout(() => resolve(value), delayMs))
  );
}

/**
 * Create a mock function that fails N times then succeeds
 */
export function createFailingMock<T>(
  successValue: T,
  failCount: number,
  errorMessage: string = 'Mock error'
): jest.Mock {
  let attempts = 0;
  return jest.fn().mockImplementation(() => {
    attempts++;
    if (attempts <= failCount) {
      return Promise.reject(new Error(`${errorMessage} (attempt ${attempts})`));
    }
    return Promise.resolve(successValue);
  });
}

// ============================================
// Global Cleanup
// ============================================

afterEach(() => {
  // Clear all mocks after each test
  jest.clearAllMocks();
});

// Export for use in tests
export { jest };

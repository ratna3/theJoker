/**
 * Jest Configuration
 * Phase 10: Testing & Optimization
 */

/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',
  
  // Test environment
  testEnvironment: 'node',
  
  // Root directories
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
  ],
  
  // Module path aliases (matching tsconfig)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@agents/(.*)$': '<rootDir>/src/agents/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@llm/(.*)$': '<rootDir>/src/llm/$1',
    '^@scraper/(.*)$': '<rootDir>/src/scraper/$1',
    '^@tools/(.*)$': '<rootDir>/src/tools/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@errors/(.*)$': '<rootDir>/src/errors/$1',
  },
  
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  
  coverageDirectory: 'coverage',
  
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 10,
      lines: 7,
      statements: 7,
    },
    // Higher thresholds for specific well-tested modules
    './src/errors/circuit-breaker.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/errors/retry.ts': {
      branches: 50,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/utils/cleaner.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Timeout for async tests
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Collect coverage only when explicitly requested
  collectCoverage: false,
  
  // Max workers for parallel testing
  maxWorkers: '50%',
  
  // Reporter configuration
  reporters: [
    'default',
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

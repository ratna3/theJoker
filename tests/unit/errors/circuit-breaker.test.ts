/**
 * The Joker - Agentic Terminal
 * Circuit Breaker Unit Tests
 * Phase 10: Testing & Optimization
 */

import {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitOpenError,
  CircuitState,
  getCircuitBreaker,
  getCircuitBreakerManager,
  withCircuitBreaker,
  getLLMCircuitBreaker,
  getScrapingCircuitBreaker,
  getNetworkCircuitBreaker,
} from '../../../src/errors/circuit-breaker';
import { JokerError } from '../../../src/types/errors';

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
        { recoverable: true }
      );
    },
  }),
}));

describe('Circuit Breaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset the manager singleton
    getCircuitBreakerManager().disposeAll();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================
  // CircuitOpenError
  // ============================================

  describe('CircuitOpenError', () => {
    it('should create error with circuit info', () => {
      const resetAt = new Date(Date.now() + 30000);
      const error = new CircuitOpenError('test-circuit', resetAt);
      
      expect(error.name).toBe('CircuitOpenError');
      expect(error.code).toBe('CIRCUIT_OPEN');
      expect(error.circuitName).toBe('test-circuit');
      expect(error.resetAt).toBe(resetAt);
      expect(error.message).toContain('test-circuit');
    });

    it('should have retry information', () => {
      const resetAt = new Date(Date.now() + 30000);
      const error = new CircuitOpenError('test', resetAt);
      
      expect(error.retryable).toBe(true);
      expect(error.retryAfterMs).toBeGreaterThan(0);
    });
  });

  // ============================================
  // CircuitBreaker
  // ============================================

  describe('CircuitBreaker', () => {
    describe('initialization', () => {
      it('should start in closed state', () => {
        const breaker = new CircuitBreaker({ name: 'test' });
        
        expect(breaker.getState()).toBe('closed');
        expect(breaker.isClosed()).toBe(true);
        expect(breaker.isOpen()).toBe(false);
        expect(breaker.isHalfOpen()).toBe(false);
      });

      it('should have initial stats', () => {
        const breaker = new CircuitBreaker({ name: 'test' });
        const stats = breaker.getStats();
        
        expect(stats.name).toBe('test');
        expect(stats.state).toBe('closed');
        expect(stats.failures).toBe(0);
        expect(stats.successes).toBe(0);
        expect(stats.totalRequests).toBe(0);
      });
    });

    describe('execute', () => {
      it('should execute function successfully', async () => {
        const breaker = new CircuitBreaker({ name: 'test' });
        const fn = jest.fn().mockResolvedValue('result');
        
        const result = await breaker.execute(fn);
        
        expect(result).toBe('result');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should track successful executions', async () => {
        const breaker = new CircuitBreaker({ name: 'test' });
        
        await breaker.execute(async () => 'success');
        const stats = breaker.getStats();
        
        expect(stats.totalRequests).toBe(1);
        expect(stats.totalSuccesses).toBe(1);
        expect(stats.lastSuccess).toBeDefined();
      });

      it('should track failed executions', async () => {
        const breaker = new CircuitBreaker({ name: 'test', logStateChanges: false });
        
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        const stats = breaker.getStats();
        expect(stats.totalRequests).toBe(1);
        expect(stats.totalFailures).toBe(1);
        expect(stats.lastFailure).toBeDefined();
      });

      it('should propagate errors', async () => {
        const breaker = new CircuitBreaker({ name: 'test', logStateChanges: false });
        
        await expect(
          breaker.execute(async () => {
            throw new Error('test error');
          })
        ).rejects.toThrow('test error');
      });
    });

    describe('state transitions', () => {
      it('should open after failure threshold', async () => {
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 3,
          logStateChanges: false,
        });
        
        // Trigger failures
        for (let i = 0; i < 3; i++) {
          try {
            await breaker.execute(async () => {
              throw new Error('fail');
            });
          } catch {
            // Expected
          }
        }
        
        expect(breaker.getState()).toBe('open');
        expect(breaker.isOpen()).toBe(true);
      });

      it('should throw CircuitOpenError when open', async () => {
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          logStateChanges: false,
        });
        
        // Open the circuit
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        await expect(
          breaker.execute(async () => 'should not run')
        ).rejects.toThrow(CircuitOpenError);
      });

      it('should transition to half-open after reset timeout', async () => {
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          resetTimeout: 5000,
          logStateChanges: false,
        });
        
        // Open the circuit
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        expect(breaker.getState()).toBe('open');
        
        // Advance time past reset timeout
        jest.advanceTimersByTime(5001);
        
        expect(breaker.getState()).toBe('half-open');
        expect(breaker.isHalfOpen()).toBe(true);
      });

      it('should close after successes in half-open', async () => {
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          resetTimeout: 1000,
          successThreshold: 2,
          logStateChanges: false,
        });
        
        // Open the circuit
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        // Transition to half-open
        jest.advanceTimersByTime(1001);
        expect(breaker.getState()).toBe('half-open');
        
        // Successes in half-open
        await breaker.execute(async () => 'success1');
        expect(breaker.getState()).toBe('half-open');
        
        await breaker.execute(async () => 'success2');
        expect(breaker.getState()).toBe('closed');
      });

      it('should reopen on failure in half-open', async () => {
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          resetTimeout: 1000,
          logStateChanges: false,
        });
        
        // Open the circuit
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        // Transition to half-open
        jest.advanceTimersByTime(1001);
        expect(breaker.getState()).toBe('half-open');
        
        // Fail in half-open
        try {
          await breaker.execute(async () => {
            throw new Error('fail again');
          });
        } catch {
          // Expected
        }
        
        expect(breaker.getState()).toBe('open');
      });
    });

    describe('callbacks', () => {
      it('should call onStateChange', async () => {
        const onStateChange = jest.fn();
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          logStateChanges: false,
          onStateChange,
        });
        
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        expect(onStateChange).toHaveBeenCalledWith('closed', 'open');
      });

      it('should call onOpen', async () => {
        const onOpen = jest.fn();
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          logStateChanges: false,
          onOpen,
        });
        
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        expect(onOpen).toHaveBeenCalledWith(
          expect.any(JokerError),
          1
        );
      });

      it('should call onClose', async () => {
        const onClose = jest.fn();
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          resetTimeout: 1000,
          successThreshold: 1,
          logStateChanges: false,
          onClose,
        });
        
        // Open then close
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        jest.advanceTimersByTime(1001);
        await breaker.execute(async () => 'success');
        
        expect(onClose).toHaveBeenCalled();
      });
    });

    describe('force methods', () => {
      it('should force open', () => {
        const breaker = new CircuitBreaker({ name: 'test', logStateChanges: false });
        
        breaker.forceOpen();
        
        expect(breaker.getState()).toBe('open');
      });

      it('should force close', async () => {
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          logStateChanges: false,
        });
        
        // Open first
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        breaker.forceClose();
        
        expect(breaker.getState()).toBe('closed');
      });
    });

    describe('reset', () => {
      it('should reset to initial state', async () => {
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 1,
          logStateChanges: false,
        });
        
        // Create some state
        await breaker.execute(async () => 'success');
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
        
        breaker.reset();
        
        const stats = breaker.getStats();
        expect(stats.state).toBe('closed');
        expect(stats.totalRequests).toBe(0);
        expect(stats.totalFailures).toBe(0);
        expect(stats.failures).toBe(0);
      });
    });

    describe('failure window', () => {
      it('should only count failures within window', async () => {
        const breaker = new CircuitBreaker({
          name: 'test',
          failureThreshold: 3,
          failureWindow: 5000,
          logStateChanges: false,
        });
        
        // First failure
        try {
          await breaker.execute(async () => {
            throw new Error('fail 1');
          });
        } catch {
          // Expected
        }
        
        // Advance past failure window
        jest.advanceTimersByTime(6000);
        
        // Two more failures (shouldn't open because first failure expired)
        try {
          await breaker.execute(async () => {
            throw new Error('fail 2');
          });
        } catch {
          // Expected
        }
        try {
          await breaker.execute(async () => {
            throw new Error('fail 3');
          });
        } catch {
          // Expected
        }
        
        // Should still be closed (only 2 failures in window)
        expect(breaker.getState()).toBe('closed');
      });
    });
  });

  // ============================================
  // CircuitBreakerManager
  // ============================================

  describe('CircuitBreakerManager', () => {
    it('should be singleton', () => {
      const manager1 = CircuitBreakerManager.getInstance();
      const manager2 = CircuitBreakerManager.getInstance();
      
      expect(manager1).toBe(manager2);
    });

    it('should get or create breakers', () => {
      const manager = getCircuitBreakerManager();
      
      const breaker1 = manager.getBreaker('test');
      const breaker2 = manager.getBreaker('test');
      
      expect(breaker1).toBe(breaker2);
    });

    it('should create breakers with config', () => {
      const manager = getCircuitBreakerManager();
      
      const breaker = manager.getBreaker('custom', {
        failureThreshold: 10,
        resetTimeout: 60000,
      });
      
      expect(breaker.getStats().name).toBe('custom');
    });

    it('should get all breakers', () => {
      const manager = getCircuitBreakerManager();
      
      manager.getBreaker('breaker1');
      manager.getBreaker('breaker2');
      
      const all = manager.getAllBreakers();
      
      expect(all.size).toBe(2);
      expect(all.has('breaker1')).toBe(true);
      expect(all.has('breaker2')).toBe(true);
    });

    it('should get all stats', () => {
      const manager = getCircuitBreakerManager();
      
      manager.getBreaker('b1');
      manager.getBreaker('b2');
      
      const stats = manager.getAllStats();
      
      expect(stats).toHaveLength(2);
      expect(stats[0].name).toBe('b1');
      expect(stats[1].name).toBe('b2');
    });

    it('should reset all breakers', () => {
      const manager = getCircuitBreakerManager();
      
      const b1 = manager.getBreaker('b1', { logStateChanges: false });
      b1.forceOpen();
      
      manager.resetAll();
      
      expect(b1.getState()).toBe('closed');
    });

    it('should dispose all breakers', () => {
      const manager = getCircuitBreakerManager();
      
      manager.getBreaker('b1');
      manager.getBreaker('b2');
      
      manager.disposeAll();
      
      expect(manager.getAllBreakers().size).toBe(0);
    });
  });

  // ============================================
  // Convenience Functions
  // ============================================

  describe('getCircuitBreaker', () => {
    it('should get or create circuit breaker', () => {
      const breaker1 = getCircuitBreaker('test');
      const breaker2 = getCircuitBreaker('test');
      
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('withCircuitBreaker', () => {
    it('should execute with circuit breaker protection', async () => {
      const result = await withCircuitBreaker('test', async () => 'result');
      
      expect(result).toBe('result');
    });

    it('should throw on circuit open', async () => {
      const breaker = getCircuitBreaker('test-open', {
        failureThreshold: 1,
        logStateChanges: false,
      });
      breaker.forceOpen();
      
      await expect(
        withCircuitBreaker('test-open', async () => 'result')
      ).rejects.toThrow(CircuitOpenError);
    });
  });

  // ============================================
  // Pre-configured Breakers
  // ============================================

  describe('Pre-configured Circuit Breakers', () => {
    it('should get LLM circuit breaker', () => {
      const breaker = getLLMCircuitBreaker();
      
      expect(breaker.getStats().name).toBe('llm');
    });

    it('should get scraping circuit breaker', () => {
      const breaker = getScrapingCircuitBreaker();
      
      expect(breaker.getStats().name).toBe('scraping');
    });

    it('should get network circuit breaker', () => {
      const breaker = getNetworkCircuitBreaker();
      
      expect(breaker.getStats().name).toBe('network');
    });
  });
});

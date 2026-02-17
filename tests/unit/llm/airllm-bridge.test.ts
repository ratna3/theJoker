/**
 * AirLLM Bridge Unit Tests
 *
 * Tests for the AirLLMBridge class that manages the Python
 * AirLLM sidecar server lifecycle.
 *
 * These tests mock child_process.spawn and axios — no actual
 * Python or GPU required.
 */

// ============================================
// Mocks — must be before imports
// ============================================

const mockSpawn = jest.fn();
const mockAxiosGet = jest.fn();
const mockKill = jest.fn();

jest.mock('child_process', () => ({
    spawn: (...args: unknown[]) => mockSpawn(...args),
}));

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: (...args: unknown[]) => mockAxiosGet(...args),
        create: jest.fn(() => ({
            get: mockAxiosGet,
            post: jest.fn(),
        })),
    },
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('../../../src/utils/config', () => ({
    airllmConfig: {
        enabled: false,
        model: 'test-model/test-70b',
        port: 9999,
        maxLength: 256,
        compression: 'none' as const,
        pythonPath: 'python',
    },
    llmConfig: {
        baseUrl: 'http://localhost:1234',
        model: 'test-model',
        apiKey: 'not-needed',
        temperature: 0.7,
        maxTokens: 4096,
        timeout: 60000,
    },
}));

// ============================================
// Imports
// ============================================

import { EventEmitter } from 'events';
import { AirLLMBridge } from '../../../src/llm/airllm-bridge';

// ============================================
// Helper
// ============================================

function createMockProcess() {
    const proc = new EventEmitter();
    (proc as any).pid = 12345;
    (proc as any).stdout = new EventEmitter();
    (proc as any).stderr = new EventEmitter();
    (proc as any).kill = mockKill;
    (proc as any).stdin = null;
    return proc;
}

// ============================================
// Tests
// ============================================

describe('AirLLMBridge', () => {
    let bridge: AirLLMBridge;
    let mockProcess: ReturnType<typeof createMockProcess>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockProcess = createMockProcess();
        mockSpawn.mockReturnValue(mockProcess);
    });

    afterEach(() => {
        if (bridge) {
            try { bridge.destroy(); } catch { /* ignore */ }
        }
    });

    // ------------------------------------------
    // Construction
    // ------------------------------------------

    describe('constructor', () => {
        it('should create bridge with default config', () => {
            bridge = new AirLLMBridge();
            expect(bridge.isReady()).toBe(false);
            expect(bridge.getPid()).toBeNull();
        });

        it('should allow config overrides', () => {
            bridge = new AirLLMBridge({ port: 7777, model: 'custom/model' });
            const cfg = bridge.getConfig();
            expect(cfg.port).toBe(7777);
            expect(cfg.model).toBe('custom/model');
        });

        it('should set base URL from port', () => {
            bridge = new AirLLMBridge({ port: 7777 });
            expect(bridge.getBaseUrl()).toBe('http://127.0.0.1:7777');
        });
    });

    // ------------------------------------------
    // Start
    // ------------------------------------------

    describe('start()', () => {
        it('should spawn the Python sidecar process', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

            await bridge.start();

            expect(mockSpawn).toHaveBeenCalledTimes(1);
            expect(mockSpawn).toHaveBeenCalledWith(
                'python',
                expect.arrayContaining(['--port', '9999']),
                expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
            );
        });

        it('should emit sidecar:ready when healthy', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

            const readyHandler = jest.fn();
            bridge.on('sidecar:ready', readyHandler);

            await bridge.start();

            expect(readyHandler).toHaveBeenCalledWith(
                expect.objectContaining({ pid: 12345, port: 9999 })
            );
        });

        it('should set ready state after successful start', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

            await bridge.start();

            expect(bridge.isReady()).toBe(true);
            expect(bridge.getPid()).toBe(12345);
        });

        it('should not spawn again if already running', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

            await bridge.start();
            await bridge.start();

            expect(mockSpawn).toHaveBeenCalledTimes(1);
        });

        it('should throw if sidecar process exits during startup', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockRejectedValue(new Error('Connection refused'));

            // Simulate process exit shortly after spawn
            setTimeout(() => {
                mockProcess.emit('exit', 1, null);
                (bridge as any).sidecar = null;
            }, 50);

            await expect(bridge.start()).rejects.toThrow('sidecar process exited during startup');
        });
    });

    // ------------------------------------------
    // getClient
    // ------------------------------------------

    describe('getClient()', () => {
        it('should return a client after start', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

            await bridge.start();
            const client = bridge.getClient();

            expect(client).toBeDefined();
        });

        it('should throw if not started', () => {
            bridge = new AirLLMBridge();
            expect(() => bridge.getClient()).toThrow('not running');
        });
    });

    // ------------------------------------------
    // Stop
    // ------------------------------------------

    describe('stop()', () => {
        it('should kill the sidecar process', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });
            await bridge.start();

            bridge.stop();

            expect(mockKill).toHaveBeenCalledWith('SIGTERM');
            expect(bridge.isReady()).toBe(false);
        });

        it('should handle stop when not running', () => {
            bridge = new AirLLMBridge();
            expect(() => bridge.stop()).not.toThrow();
        });
    });

    // ------------------------------------------
    // Events
    // ------------------------------------------

    describe('events', () => {
        it('should emit sidecar:output for stdout', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

            const outputHandler = jest.fn();
            bridge.on('sidecar:output', outputHandler);

            await bridge.start();

            (mockProcess as any).stdout.emit('data', Buffer.from('[AirLLM] Loading model...'));

            expect(outputHandler).toHaveBeenCalledWith('[AirLLM] Loading model...');
        });

        it('should emit sidecar:exit on process exit', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });

            const exitHandler = jest.fn();
            bridge.on('sidecar:exit', exitHandler);

            await bridge.start();

            mockProcess.emit('exit', 0, null);

            expect(exitHandler).toHaveBeenCalledWith({ code: 0, signal: null });
            expect(bridge.isReady()).toBe(false);
        });
    });

    // ------------------------------------------
    // Destroy
    // ------------------------------------------

    describe('destroy()', () => {
        it('should stop sidecar and remove all listeners', async () => {
            bridge = new AirLLMBridge();
            mockAxiosGet.mockResolvedValue({ status: 200, data: { data: [] } });
            await bridge.start();

            bridge.destroy();

            expect(mockKill).toHaveBeenCalled();
            expect(bridge.isReady()).toBe(false);
            expect(bridge.listenerCount('sidecar:ready')).toBe(0);
        });
    });
});

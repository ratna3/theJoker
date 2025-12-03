/**
 * The Joker - Agentic Terminal
 * Build Manager Tests
 */

import { EventEmitter } from 'events';
import * as path from 'path';

// Mock child_process
const mockSpawn = jest.fn();
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  exec: (...args: unknown[]) => mockExec(...args)
}));

// Mock fs/promises
const mockFs = {
  readFile: jest.fn(),
  access: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn()
};
jest.mock('fs/promises', () => mockFs);

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import {
  BuildManager,
  DevServerManager,
  getBuildManager,
  createBuildManager,
  getDevServerManager,
  type BuildResult,
  type DevServerInfo,
  type BuildError
} from '../../../src/project/builder';

describe('BuildManager', () => {
  let builder: BuildManager;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.access.mockRejectedValue(new Error('Not found'));
    mockFs.readFile.mockResolvedValue(JSON.stringify({
      name: 'test-project',
      scripts: {
        build: 'tsc',
        dev: 'ts-node src/index.ts',
        test: 'jest',
        lint: 'eslint src/'
      }
    }));

    builder = new BuildManager({
      projectPath: testProjectPath
    });
  });

  afterEach(async () => {
    await builder.cleanup();
  });

  describe('Initialization', () => {
    it('should create a new build manager', () => {
      expect(builder).toBeInstanceOf(BuildManager);
      expect(builder).toBeInstanceOf(EventEmitter);
    });

    it('should initialize and detect scripts', async () => {
      await builder.initialize();
      // Scripts should be detected from package.json
    });

    it('should detect package manager from lock files', async () => {
      // Test npm detection
      mockFs.access.mockImplementation(async (filePath: string) => {
        if (filePath.includes('package-lock.json')) {
          return;
        }
        throw new Error('Not found');
      });

      await builder.initialize();
    });

    it('should detect pnpm from lock file', async () => {
      mockFs.access.mockImplementation(async (filePath: string) => {
        if (filePath.includes('pnpm-lock.yaml')) {
          return;
        }
        throw new Error('Not found');
      });

      await builder.initialize();
    });

    it('should detect yarn from lock file', async () => {
      mockFs.access.mockImplementation(async (filePath: string) => {
        if (filePath.includes('yarn.lock')) {
          return;
        }
        throw new Error('Not found');
      });

      await builder.initialize();
    });
  });

  describe('Script Detection', () => {
    it('should detect build scripts from package.json', async () => {
      const scripts = await builder.detectScripts();
      
      expect(scripts).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'build', type: 'build' }),
        expect.objectContaining({ name: 'dev', type: 'dev' }),
        expect.objectContaining({ name: 'test', type: 'test' }),
        expect.objectContaining({ name: 'lint', type: 'lint' })
      ]));
    });

    it('should handle missing package.json', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      
      const scripts = await builder.detectScripts();
      expect(scripts).toEqual([]);
    });

    it('should handle package.json without scripts', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        name: 'test-project'
      }));
      
      const scripts = await builder.detectScripts();
      expect(scripts).toEqual([]);
    });
  });

  describe('Framework Detection', () => {
    it('should detect Next.js', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { next: '^13.0.0' }
      }));

      const framework = await builder.detectFramework();
      expect(framework).toBe('nextjs');
    });

    it('should detect React', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { react: '^18.0.0' }
      }));

      const framework = await builder.detectFramework();
      expect(framework).toBe('react');
    });

    it('should detect Vue', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { vue: '^3.0.0' }
      }));

      const framework = await builder.detectFramework();
      expect(framework).toBe('vue');
    });

    it('should detect NestJS', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { '@nestjs/core': '^9.0.0' }
      }));

      const framework = await builder.detectFramework();
      expect(framework).toBe('nestjs');
    });

    it('should detect Express', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { express: '^4.0.0' }
      }));

      const framework = await builder.detectFramework();
      expect(framework).toBe('express');
    });

    it('should default to node for generic projects', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { lodash: '^4.0.0' }
      }));

      const framework = await builder.detectFramework();
      expect(framework).toBe('node');
    });
  });

  describe('Build Operations', () => {
    let mockProcess: MockChildProcess;

    beforeEach(() => {
      mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
    });

    it('should run build command', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      // Simulate successful build
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      const result = await buildPromise;
      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.command).toBe('npm run build');
    });

    it('should handle build failure', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      // Simulate failed build
      process.nextTick(() => {
        mockProcess.emit('close', 1);
      });

      const result = await buildPromise;
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.exitCode).toBe(1);
    });

    it('should emit build:start event', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const startHandler = jest.fn();
      customBuilder.on('build:start', startHandler);

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await buildPromise;
      expect(startHandler).toHaveBeenCalledWith({
        command: 'npm run build',
        projectPath: testProjectPath
      });
    });

    it('should emit build:complete event', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const completeHandler = jest.fn();
      customBuilder.on('build:complete', completeHandler);

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await buildPromise;
      expect(completeHandler).toHaveBeenCalledWith({
        result: expect.objectContaining({
          success: true,
          status: 'success'
        })
      });
    });

    it('should emit build:progress events', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const progressHandler = jest.fn();
      customBuilder.on('build:progress', progressHandler);

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Building...'));
        mockProcess.emit('close', 0);
      });

      await buildPromise;
      expect(progressHandler).toHaveBeenCalledWith({
        message: 'Building...',
        type: 'stdout'
      });
    });

    it('should track build duration', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      const result = await buildPromise;
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
    });

    it('should cancel running build', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      // Cancel build
      customBuilder.cancelBuild();

      process.nextTick(() => {
        mockProcess.emit('close', null);
      });

      await buildPromise;
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle process errors', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      process.nextTick(() => {
        mockProcess.emit('error', new Error('ENOENT'));
      });

      const result = await buildPromise;
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('ENOENT');
    });
  });

  describe('Error Parsing', () => {
    let mockProcess: MockChildProcess;

    beforeEach(() => {
      mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
    });

    it('should parse TypeScript errors', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from(
          'src/index.ts(10,5): error TS2304: Cannot find name "foo".\n'
        ));
        mockProcess.emit('close', 1);
      });

      const result = await buildPromise;
      expect(result.errors).toContainEqual(expect.objectContaining({
        file: 'src/index.ts',
        line: 10,
        column: 5,
        code: 'TS2304',
        message: expect.stringContaining('Cannot find name')
      }));
    });

    it('should parse module not found errors', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      process.nextTick(() => {
        mockProcess.stderr.emit('data', Buffer.from(
          "Module not found: Can't resolve 'some-package'\n"
        ));
        mockProcess.emit('close', 1);
      });

      const result = await buildPromise;
      expect(result.errors).toContainEqual(expect.objectContaining({
        message: 'Module not found: some-package',
        code: 'MODULE_NOT_FOUND',
        suggestion: expect.stringContaining('npm install')
      }));
    });

    it('should emit build:error events', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const errorHandler = jest.fn();
      customBuilder.on('build:error', errorHandler);

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      
      process.nextTick(() => {
        mockProcess.stderr.emit('data', Buffer.from(
          "Module not found: Can't resolve 'missing-module'\n"
        ));
        mockProcess.emit('close', 1);
      });

      await buildPromise;
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Dev Server', () => {
    let mockProcess: MockChildProcess;

    beforeEach(() => {
      mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
    });

    it('should start dev server', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        devCommand: 'npm run dev'
      });

      const serverPromise = customBuilder.startDevServer();
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Server running at http://localhost:3000'));
      });

      const info = await serverPromise;
      expect(info.status).toBe('running');
      expect(info.url).toBe('http://localhost:3000');
      expect(info.port).toBe(3000);
    });

    it('should detect Next.js server URL', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        devCommand: 'npm run dev'
      });

      const serverPromise = customBuilder.startDevServer();
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('ready on http://localhost:3000'));
      });

      const info = await serverPromise;
      expect(info.url).toBe('http://localhost:3000');
    });

    it('should emit server:start event', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        devCommand: 'npm run dev'
      });

      const startHandler = jest.fn();
      customBuilder.on('server:start', startHandler);

      const serverPromise = customBuilder.startDevServer();
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Server running at http://localhost:3000'));
      });

      await serverPromise;
      expect(startHandler).toHaveBeenCalled();
    });

    it('should emit server:ready event', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        devCommand: 'npm run dev'
      });

      const readyHandler = jest.fn();
      customBuilder.on('server:ready', readyHandler);

      const serverPromise = customBuilder.startDevServer();
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Server running at http://localhost:3000'));
      });

      await serverPromise;
      expect(readyHandler).toHaveBeenCalledWith({
        url: 'http://localhost:3000',
        port: 3000
      });
    });

    it('should stop dev server', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        devCommand: 'npm run dev'
      });

      const serverPromise = customBuilder.startDevServer();
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Server running at http://localhost:3000'));
      });

      await serverPromise;

      const stopPromise = customBuilder.stopDevServer();
      
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await stopPromise;
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should get server info', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        devCommand: 'npm run dev'
      });

      const serverPromise = customBuilder.startDevServer();
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Server running at http://localhost:3000'));
      });

      await serverPromise;

      const info = customBuilder.getServerInfo();
      expect(info.status).toBe('running');
      expect(info.url).toBe('http://localhost:3000');
    });

    it('should prevent multiple servers', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        devCommand: 'npm run dev'
      });

      const serverPromise = customBuilder.startDevServer();
      
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Server running at http://localhost:3000'));
      });

      await serverPromise;

      await expect(customBuilder.startDevServer()).rejects.toThrow('already running');
    });
  });

  describe('Hot Reload', () => {
    it('should detect hot reload support for React', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { react: '^18.0.0' }
      }));

      const hasHotReload = await builder.hasHotReload();
      expect(hasHotReload).toBe(true);
    });

    it('should detect hot reload support for Next.js', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { next: '^13.0.0' }
      }));

      const hasHotReload = await builder.hasHotReload();
      expect(hasHotReload).toBe(true);
    });

    it('should not support hot reload for Express', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        dependencies: { express: '^4.0.0' }
      }));

      const hasHotReload = await builder.hasHotReload();
      expect(hasHotReload).toBe(false);
    });
  });

  describe('Build Statistics', () => {
    let mockProcess: MockChildProcess;

    beforeEach(() => {
      mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
    });

    it('should track build history', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      // Run multiple builds
      for (let i = 0; i < 3; i++) {
        const buildPromise = customBuilder.runCommand('npm run build', 'build');
        process.nextTick(() => {
          mockProcess.emit('close', i === 1 ? 1 : 0);
        });
        await buildPromise;
        mockProcess = createMockChildProcess();
        mockSpawn.mockReturnValue(mockProcess);
      }

      const history = customBuilder.getBuildHistory();
      expect(history).toHaveLength(3);
    });

    it('should get last build', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });
      await buildPromise;

      const lastBuild = customBuilder.getLastBuild();
      expect(lastBuild).not.toBeNull();
      expect(lastBuild?.success).toBe(true);
    });

    it('should calculate build stats', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      // Run successful build
      let buildPromise = customBuilder.runCommand('npm run build', 'build');
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });
      await buildPromise;

      mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);

      // Run failed build
      buildPromise = customBuilder.runCommand('npm run build', 'build');
      process.nextTick(() => {
        mockProcess.emit('close', 1);
      });
      await buildPromise;

      const stats = customBuilder.getStats();
      expect(stats.totalBuilds).toBe(2);
      expect(stats.successfulBuilds).toBe(1);
      expect(stats.failedBuilds).toBe(1);
      expect(stats.successRate).toBe(50);
    });

    it('should limit build history', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      // Run multiple builds
      for (let i = 0; i < 5; i++) {
        const buildPromise = customBuilder.runCommand('npm run build', 'build');
        process.nextTick(() => {
          mockProcess.emit('close', 0);
        });
        await buildPromise;
        mockProcess = createMockChildProcess();
        mockSpawn.mockReturnValue(mockProcess);
      }

      const history = customBuilder.getBuildHistory(3);
      expect(history).toHaveLength(3);
    });

    it('should clear build history', async () => {
      const customBuilder = new BuildManager({
        projectPath: testProjectPath,
        buildCommand: 'npm run build'
      });

      const buildPromise = customBuilder.runCommand('npm run build', 'build');
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });
      await buildPromise;

      customBuilder.clearHistory();
      expect(customBuilder.getBuildHistory()).toHaveLength(0);
      expect(customBuilder.getLastBuild()).toBeNull();
    });
  });

  describe('Watch Mode', () => {
    let mockProcess: MockChildProcess;

    beforeEach(() => {
      mockProcess = createMockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
    });

    it('should check watch status', () => {
      expect(builder.isWatching()).toBe(false);
    });

    it('should stop watch mode', () => {
      builder.stopWatch();
      expect(builder.isWatching()).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all resources', async () => {
      await builder.cleanup();
      // Should not throw
    });
  });
});

describe('DevServerManager', () => {
  let manager: DevServerManager;

  beforeEach(() => {
    manager = new DevServerManager();
  });

  afterEach(async () => {
    await manager.stopAll();
  });

  it('should create manager for project', () => {
    const builder = manager.getManager('/test/project1');
    expect(builder).toBeInstanceOf(BuildManager);
  });

  it('should cache managers by path', () => {
    const builder1 = manager.getManager('/test/project1');
    const builder2 = manager.getManager('/test/project1');
    expect(builder1).toBe(builder2);
  });

  it('should create different managers for different paths', () => {
    const builder1 = manager.getManager('/test/project1');
    const builder2 = manager.getManager('/test/project2');
    expect(builder1).not.toBe(builder2);
  });

  it('should list running servers', () => {
    const running = manager.listRunningServers();
    expect(Array.isArray(running)).toBe(true);
  });

  it('should get total stats', () => {
    const stats = manager.getTotalStats();
    expect(stats).toEqual({
      runningServers: 0,
      totalBuilds: 0,
      successfulBuilds: 0,
      failedBuilds: 0
    });
  });
});

describe('Factory Functions', () => {
  it('should get default build manager', () => {
    const manager = getBuildManager();
    expect(manager).toBeInstanceOf(BuildManager);
  });

  it('should get build manager for specific path', () => {
    const manager = getBuildManager('/test/path');
    expect(manager).toBeInstanceOf(BuildManager);
  });

  it('should create new build manager', () => {
    const manager = createBuildManager({ projectPath: '/test/path' });
    expect(manager).toBeInstanceOf(BuildManager);
  });

  it('should get dev server manager singleton', () => {
    const manager1 = getDevServerManager();
    const manager2 = getDevServerManager();
    expect(manager1).toBe(manager2);
  });
});

// ============================================
// Mock Helpers
// ============================================

interface MockChildProcess extends EventEmitter {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: jest.Mock };
  kill: jest.Mock;
}

function createMockChildProcess(): MockChildProcess {
  const proc = new EventEmitter() as MockChildProcess;
  proc.pid = 12345;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: jest.fn() };
  proc.kill = jest.fn();
  return proc;
}

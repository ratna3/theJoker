/**
 * Tests for File System Watcher
 * 
 * Tests the FileSystemWatcher class that provides real-time file system
 * monitoring with debouncing and batch change aggregation using chokidar.
 */

import { FileSystemWatcher, fileWatcher, createWatcher } from '../../../src/filesystem/watcher';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock chokidar first before any imports
const mockChokidarWatcher = {
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockResolvedValue(undefined),
  add: jest.fn(),
  unwatch: jest.fn().mockResolvedValue(undefined),
  getWatched: jest.fn().mockReturnValue({})
};

jest.mock('chokidar', () => ({
  watch: jest.fn(() => mockChokidarWatcher)
}));

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

import chokidar from 'chokidar';

describe('FileSystemWatcher', () => {
  let watcher: FileSystemWatcher;

  beforeEach(() => {
    watcher = new FileSystemWatcher();
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockChokidarWatcher.on.mockReturnThis();
    mockChokidarWatcher.close.mockResolvedValue(undefined);
    mockChokidarWatcher.getWatched.mockReturnValue({});
    
    // Default mocks
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false
    } as any);
    mockFs.readdir.mockResolvedValue([]);
  });

  afterEach(async () => {
    await watcher.close();
  });

  describe('constructor', () => {
    it('should create watcher with default options', () => {
      const w = new FileSystemWatcher();
      expect(w).toBeInstanceOf(FileSystemWatcher);
    });

    it('should accept custom options', () => {
      const w = new FileSystemWatcher({
        debounceMs: 500,
        maxBatchSize: 100,
        ignorePatterns: ['*.log']
      });
      expect(w).toBeInstanceOf(FileSystemWatcher);
    });

    it('should set recursive option', () => {
      const w = new FileSystemWatcher({ recursive: false });
      expect(w).toBeInstanceOf(FileSystemWatcher);
    });

    it('should set polling options', () => {
      const w = new FileSystemWatcher({
        usePolling: true,
        pollingInterval: 2000
      });
      expect(w).toBeInstanceOf(FileSystemWatcher);
    });

    it('should set depth option', () => {
      const w = new FileSystemWatcher({ depth: 3 });
      expect(w).toBeInstanceOf(FileSystemWatcher);
    });
  });

  describe('watch', () => {
    it('should start watching a directory', async () => {
      await watcher.watch('/project/src');

      expect(mockFs.access).toHaveBeenCalled();
      expect(chokidar.watch).toHaveBeenCalled();
    });

    it('should throw if directory does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(watcher.watch('/nonexistent')).rejects.toThrow('Directory does not exist');
    });

    it('should throw if path is not a directory', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true
      } as any);

      await expect(watcher.watch('/file.txt')).rejects.toThrow('Path is not a directory');
    });

    it('should emit ready event when started', async () => {
      const readyHandler = jest.fn();
      watcher.on('ready', readyHandler);

      await watcher.watch('/project');

      expect(readyHandler).toHaveBeenCalledWith(
        expect.objectContaining({ rootPath: expect.any(String) })
      );
    });

    it('should close previous watcher when called again', async () => {
      await watcher.watch('/project1');
      await watcher.watch('/project2');

      expect(mockChokidarWatcher.close).toHaveBeenCalled();
    });

    it('should configure chokidar with correct options', async () => {
      const customWatcher = new FileSystemWatcher({
        ignoreInitial: false,
        usePolling: true,
        pollingInterval: 500,
        depth: 5
      });

      await customWatcher.watch('/project');

      expect(chokidar.watch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ignoreInitial: false,
          usePolling: true,
          interval: 500,
          depth: 5
        })
      );

      await customWatcher.close();
    });
  });

  describe('close', () => {
    it('should stop watching', async () => {
      await watcher.watch('/project');
      await watcher.close();

      expect(mockChokidarWatcher.close).toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      await watcher.close();
      await watcher.close();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should update state to not watching', async () => {
      await watcher.watch('/project');
      await watcher.close();

      const state = watcher.getState();
      expect(state.isWatching).toBe(false);
    });

    it('should emit close event', async () => {
      const closeHandler = jest.fn();
      watcher.on('close', closeHandler);

      await watcher.watch('/project');
      await watcher.close();

      expect(closeHandler).toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return watcher state', async () => {
      await watcher.watch('/project');

      const state = watcher.getState();

      expect(state).toHaveProperty('isWatching');
      expect(state).toHaveProperty('rootPath');
      expect(state).toHaveProperty('watchedPaths');
      expect(state).toHaveProperty('changeCount');
      expect(state.isWatching).toBe(true);
    });

    it('should show not watching when closed', () => {
      const state = watcher.getState();
      expect(state.isWatching).toBe(false);
    });

    it('should return a copy of state', async () => {
      await watcher.watch('/project');

      const state1 = watcher.getState();
      const state2 = watcher.getState();

      expect(state1).not.toBe(state2);
      expect(state1.watchedPaths).not.toBe(state2.watchedPaths);
    });

    it('should include startTime when watching', async () => {
      await watcher.watch('/project');

      const state = watcher.getState();
      expect(state.startTime).toBeInstanceOf(Date);
    });
  });

  describe('addPath', () => {
    it('should add path to watcher', async () => {
      await watcher.watch('/project');
      await watcher.addPath('/project/newdir');

      expect(mockChokidarWatcher.add).toHaveBeenCalled();
    });

    it('should throw if watcher not running', async () => {
      await expect(watcher.addPath('/some/path')).rejects.toThrow(
        'Watcher is not running'
      );
    });
  });

  describe('unwatch', () => {
    it('should remove path from watcher', async () => {
      await watcher.watch('/project');
      await watcher.unwatch('/project/somedir');

      expect(mockChokidarWatcher.unwatch).toHaveBeenCalled();
    });

    it('should not throw if watcher not running', async () => {
      await expect(watcher.unwatch('/some/path')).resolves.not.toThrow();
    });
  });

  describe('isWatched', () => {
    it('should return false when not watching', () => {
      expect(watcher.isWatched('/some/path')).toBe(false);
    });
  });

  describe('getWatchedPathsCount', () => {
    it('should return 0 when not watching', () => {
      expect(watcher.getWatchedPathsCount()).toBe(0);
    });
  });

  describe('getWatchedPaths', () => {
    it('should return empty object when not watching', () => {
      expect(watcher.getWatchedPaths()).toEqual({});
    });

    it('should return watched paths from chokidar', async () => {
      mockChokidarWatcher.getWatched.mockReturnValue({
        '/project': ['file1.ts', 'file2.ts']
      });

      await watcher.watch('/project');
      const paths = watcher.getWatchedPaths();

      expect(paths).toEqual({
        '/project': ['file1.ts', 'file2.ts']
      });
    });
  });

  describe('shouldIgnore', () => {
    it('should ignore node_modules', () => {
      expect(watcher.shouldIgnore('/project/node_modules/file.js')).toBe(true);
    });

    it('should ignore .git', () => {
      expect(watcher.shouldIgnore('/project/.git/config')).toBe(true);
    });

    it('should ignore log files', () => {
      expect(watcher.shouldIgnore('/project/app.log')).toBe(true);
    });

    it('should not ignore regular files', () => {
      const customWatcher = new FileSystemWatcher({ ignorePatterns: [] });
      expect(customWatcher.shouldIgnore('/project/src/index.ts')).toBe(false);
    });
  });

  describe('event emissions', () => {
    it('should extend EventEmitter', () => {
      expect(typeof watcher.on).toBe('function');
      expect(typeof watcher.emit).toBe('function');
      expect(typeof watcher.removeListener).toBe('function');
    });

    it('should allow registering change handlers', async () => {
      const changeHandler = jest.fn();
      watcher.on('change', changeHandler);

      await watcher.watch('/project');

      expect(watcher.listenerCount('change')).toBe(1);
    });

    it('should allow registering error handlers', () => {
      const errorHandler = jest.fn();
      watcher.on('error', errorHandler);

      expect(watcher.listenerCount('error')).toBe(1);
    });

    it('should allow registering batch handlers', () => {
      const batchHandler = jest.fn();
      watcher.on('batch', batchHandler);

      expect(watcher.listenerCount('batch')).toBe(1);
    });

    it('should allow registering added handlers', () => {
      const addedHandler = jest.fn();
      watcher.on('added', addedHandler);

      expect(watcher.listenerCount('added')).toBe(1);
    });

    it('should allow registering removed handlers', () => {
      const removedHandler = jest.fn();
      watcher.on('removed', removedHandler);

      expect(watcher.listenerCount('removed')).toBe(1);
    });
  });

  describe('chokidar event handlers', () => {
    it('should register all chokidar event handlers', async () => {
      await watcher.watch('/project');

      expect(mockChokidarWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockChokidarWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockChokidarWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
      expect(mockChokidarWatcher.on).toHaveBeenCalledWith('addDir', expect.any(Function));
      expect(mockChokidarWatcher.on).toHaveBeenCalledWith('unlinkDir', expect.any(Function));
      expect(mockChokidarWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockChokidarWatcher.on).toHaveBeenCalledWith('ready', expect.any(Function));
    });
  });
});

describe('fileWatcher singleton', () => {
  it('should export a singleton instance', () => {
    expect(fileWatcher).toBeInstanceOf(FileSystemWatcher);
  });
});

describe('createWatcher factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false
    } as any);
    mockChokidarWatcher.on.mockReturnThis();
  });

  it('should create a watcher instance', () => {
    const watcher = createWatcher('/project');
    expect(watcher).toBeInstanceOf(FileSystemWatcher);
  });

  it('should accept array of paths', () => {
    const watcher = createWatcher(['/project1', '/project2']);
    expect(watcher).toBeInstanceOf(FileSystemWatcher);
  });

  it('should accept options', () => {
    const watcher = createWatcher('/project', { debounceMs: 500 });
    expect(watcher).toBeInstanceOf(FileSystemWatcher);
  });
});

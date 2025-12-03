/**
 * Tests for File System Watcher
 * 
 * Tests the FileSystemWatcher class that provides real-time file system
 * monitoring with debouncing and batch change aggregation.
 */

import { FileSystemWatcher, fileWatcher } from '../../../src/filesystem/watcher';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
    add: jest.fn(),
    unwatch: jest.fn()
  }))
}));

describe('FileSystemWatcher', () => {
  let watcher: FileSystemWatcher;

  beforeEach(() => {
    watcher = new FileSystemWatcher();
    jest.clearAllMocks();
    
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
  });

  describe('watch', () => {
    it('should start watching a directory', async () => {
      await watcher.watch('/project/src');

      // Should not throw
      expect(mockFs.access).toHaveBeenCalledWith(expect.stringContaining('src'));
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
  });

  describe('close', () => {
    it('should stop watching', async () => {
      await watcher.watch('/project');
      await watcher.close();

      // Should not throw and be idempotent
      await expect(watcher.close()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      // Close without watching - should not throw
      await expect(watcher.close()).resolves.not.toThrow();
      await expect(watcher.close()).resolves.not.toThrow();
    });
  });

  describe('getState', () => {
    it('should return watcher state', async () => {
      await watcher.watch('/project');

      const state = watcher.getState();

      expect(state).toHaveProperty('isWatching');
      expect(state).toHaveProperty('rootPath');
      expect(state.isWatching).toBe(true);
    });

    it('should show not watching when closed', async () => {
      const state = watcher.getState();
      expect(state.isWatching).toBe(false);
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

      // Handler registered successfully
      expect(watcher.listenerCount('change')).toBe(1);
    });

    it('should allow registering error handlers', () => {
      const errorHandler = jest.fn();
      watcher.on('error', errorHandler);

      expect(watcher.listenerCount('error')).toBe(1);
    });
  });
});

describe('fileWatcher singleton', () => {
  it('should export a singleton instance', () => {
    expect(fileWatcher).toBeInstanceOf(FileSystemWatcher);
  });
});

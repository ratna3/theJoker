/**
 * The Joker - Agentic Terminal
 * File System Watcher
 * 
 * Real-time file system monitoring with debouncing,
 * intelligent filtering, and change batching.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { watch, FSWatcher } from 'fs';
import { logger } from '../utils/logger';

// ============================================
// Watcher Types
// ============================================

/**
 * File change event types
 */
export type ChangeType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

/**
 * File change event
 */
export interface FileChangeEvent {
  type: ChangeType;
  path: string;
  relativePath: string;
  timestamp: Date;
  stats?: {
    size: number;
    mtime: Date;
    isDirectory: boolean;
  };
}

/**
 * Batch of changes
 */
export interface ChangeBatch {
  changes: FileChangeEvent[];
  startTime: Date;
  endTime: Date;
}

/**
 * Watcher options
 */
export interface WatcherOptions {
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Maximum batch size before forcing emission */
  maxBatchSize?: number;
  /** File patterns to ignore */
  ignorePatterns?: string[];
  /** File extensions to watch (empty = all) */
  watchExtensions?: string[];
  /** Watch subdirectories recursively */
  recursive?: boolean;
  /** Ignore initial scan events */
  ignoreInitial?: boolean;
  /** Use polling (for network drives) */
  usePolling?: boolean;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  /** Follow symlinks */
  followSymlinks?: boolean;
  /** Maximum directory depth */
  depth?: number;
}

/**
 * Watcher state
 */
export interface WatcherState {
  isWatching: boolean;
  rootPath: string;
  watchedPaths: Set<string>;
  fileHashes: Map<string, string>;
  startTime?: Date;
  changeCount: number;
}

// ============================================
// File System Watcher Class
// ============================================

/**
 * Advanced file system watcher with batching and debouncing
 */
export class FileSystemWatcher extends EventEmitter {
  private options: Required<WatcherOptions>;
  private watchers: Map<string, FSWatcher> = new Map();
  private state: WatcherState;
  private pendingChanges: FileChangeEvent[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  private static readonly DEFAULT_IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    '.cache',
    'coverage',
    '__pycache__',
    '.pytest_cache',
    'vendor',
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '*.lock',
    '*.tmp',
    '*.temp',
    '*.swp',
    '*~'
  ];

  constructor(options: WatcherOptions = {}) {
    super();
    this.options = {
      debounceMs: options.debounceMs ?? 100,
      maxBatchSize: options.maxBatchSize ?? 50,
      ignorePatterns: options.ignorePatterns ?? FileSystemWatcher.DEFAULT_IGNORE_PATTERNS,
      watchExtensions: options.watchExtensions ?? [],
      recursive: options.recursive ?? true,
      ignoreInitial: options.ignoreInitial ?? true,
      usePolling: options.usePolling ?? false,
      pollingInterval: options.pollingInterval ?? 1000,
      followSymlinks: options.followSymlinks ?? true,
      depth: options.depth ?? Infinity
    };

    this.state = {
      isWatching: false,
      rootPath: '',
      watchedPaths: new Set(),
      fileHashes: new Map(),
      changeCount: 0
    };
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Start watching a directory
   */
  async watch(rootPath: string): Promise<void> {
    if (this.state.isWatching) {
      await this.close();
    }

    const resolvedPath = path.resolve(rootPath);
    
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new Error(`Directory does not exist: ${resolvedPath}`);
    }

    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    this.state.rootPath = resolvedPath;
    this.state.isWatching = true;
    this.state.startTime = new Date();
    this.state.changeCount = 0;
    this.isShuttingDown = false;

    logger.info('Starting file system watcher', { rootPath: resolvedPath });
    this.emit('ready', { rootPath: resolvedPath });

    await this.setupWatchers(resolvedPath, 0);
  }

  /**
   * Stop watching
   */
  async close(): Promise<void> {
    if (!this.state.isWatching) return;

    this.isShuttingDown = true;
    
    // Clear pending debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Flush any pending changes
    if (this.pendingChanges.length > 0) {
      this.flushChanges();
    }

    // Close all watchers
    for (const [watchPath, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        logger.warn('Error closing watcher', { path: watchPath, error });
      }
    }

    this.watchers.clear();
    this.state.isWatching = false;
    this.state.watchedPaths.clear();
    this.state.fileHashes.clear();

    logger.info('File system watcher closed');
    this.emit('close');
  }

  /**
   * Get current watcher state
   */
  getState(): WatcherState {
    return { ...this.state };
  }

  /**
   * Check if a path is being watched
   */
  isWatched(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    return this.state.watchedPaths.has(resolved);
  }

  /**
   * Add a path to watch
   */
  async addPath(filePath: string): Promise<void> {
    if (!this.state.isWatching) {
      throw new Error('Watcher is not running. Call watch() first.');
    }

    const resolved = path.resolve(filePath);
    const stats = await fs.stat(resolved);

    if (stats.isDirectory()) {
      await this.setupWatchers(resolved, 0);
    }
  }

  /**
   * Remove a path from watching
   */
  removePath(filePath: string): void {
    const resolved = path.resolve(filePath);
    const watcher = this.watchers.get(resolved);

    if (watcher) {
      watcher.close();
      this.watchers.delete(resolved);
      this.state.watchedPaths.delete(resolved);
    }
  }

  /**
   * Get watched paths count
   */
  getWatchedPathsCount(): number {
    return this.state.watchedPaths.size;
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Set up watchers recursively
   */
  private async setupWatchers(dirPath: string, depth: number): Promise<void> {
    if (depth > this.options.depth) return;
    if (this.shouldIgnore(dirPath)) return;
    if (this.isShuttingDown) return;

    try {
      // Watch this directory
      await this.watchDirectory(dirPath);

      // Recursively watch subdirectories
      if (this.options.recursive) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (this.isShuttingDown) return;
          if (this.shouldIgnore(entry.name)) continue;

          if (entry.isDirectory()) {
            const subPath = path.join(dirPath, entry.name);
            await this.setupWatchers(subPath, depth + 1);
          }
        }
      }
    } catch (error) {
      logger.warn('Error setting up watcher', { dirPath, error });
    }
  }

  /**
   * Watch a single directory
   */
  private async watchDirectory(dirPath: string): Promise<void> {
    if (this.watchers.has(dirPath)) return;

    try {
      const watcher = watch(
        dirPath,
        { persistent: true, recursive: false },
        (eventType, filename) => {
          if (filename && !this.isShuttingDown) {
            this.handleFileEvent(eventType, path.join(dirPath, filename));
          }
        }
      );

      watcher.on('error', (error) => {
        logger.warn('Watcher error', { dirPath, error });
        this.emit('error', { path: dirPath, error });
      });

      this.watchers.set(dirPath, watcher);
      this.state.watchedPaths.add(dirPath);
    } catch (error) {
      logger.warn('Failed to watch directory', { dirPath, error });
    }
  }

  /**
   * Handle a file system event
   */
  private async handleFileEvent(eventType: string, filePath: string): Promise<void> {
    if (this.shouldIgnore(filePath)) return;

    const relativePath = path.relative(this.state.rootPath, filePath);
    
    // Check file extensions filter
    if (this.options.watchExtensions.length > 0) {
      const ext = path.extname(filePath);
      if (!this.options.watchExtensions.includes(ext)) {
        return;
      }
    }

    try {
      let changeType: ChangeType;
      let stats: FileChangeEvent['stats'];

      try {
        const fileStats = await fs.stat(filePath);
        stats = {
          size: fileStats.size,
          mtime: fileStats.mtime,
          isDirectory: fileStats.isDirectory()
        };

        if (eventType === 'rename') {
          // File was added or directory was added
          changeType = fileStats.isDirectory() ? 'addDir' : 'add';
        } else {
          changeType = 'change';
        }

        // Set up watcher for new directories
        if (changeType === 'addDir' && this.options.recursive) {
          await this.setupWatchers(filePath, this.getDepth(filePath));
        }
      } catch {
        // File was deleted
        changeType = filePath.endsWith(path.sep) ? 'unlinkDir' : 'unlink';
        
        // Remove watcher for deleted directories
        if (this.watchers.has(filePath)) {
          this.watchers.get(filePath)?.close();
          this.watchers.delete(filePath);
          this.state.watchedPaths.delete(filePath);
        }
      }

      const event: FileChangeEvent = {
        type: changeType,
        path: filePath,
        relativePath,
        timestamp: new Date(),
        stats
      };

      this.queueChange(event);
    } catch (error) {
      logger.debug('Error handling file event', { filePath, eventType, error });
    }
  }

  /**
   * Queue a change for batched emission
   */
  private queueChange(event: FileChangeEvent): void {
    // Deduplicate: remove existing events for the same path
    this.pendingChanges = this.pendingChanges.filter(
      e => e.path !== event.path
    );

    this.pendingChanges.push(event);
    this.state.changeCount++;

    // Emit individual change event
    this.emit('change', event);

    // Force flush if batch is too large
    if (this.pendingChanges.length >= this.options.maxBatchSize) {
      this.flushChanges();
      return;
    }

    // Set up debounced batch emission
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushChanges();
    }, this.options.debounceMs);
  }

  /**
   * Flush pending changes as a batch
   */
  private flushChanges(): void {
    if (this.pendingChanges.length === 0) return;

    const batch: ChangeBatch = {
      changes: [...this.pendingChanges],
      startTime: this.pendingChanges[0].timestamp,
      endTime: new Date()
    };

    this.pendingChanges = [];
    this.debounceTimer = null;

    // Emit batch event
    this.emit('batch', batch);

    // Emit specific events by type
    const added = batch.changes.filter(c => c.type === 'add' || c.type === 'addDir');
    const changed = batch.changes.filter(c => c.type === 'change');
    const removed = batch.changes.filter(c => c.type === 'unlink' || c.type === 'unlinkDir');

    if (added.length > 0) {
      this.emit('added', added);
    }
    if (changed.length > 0) {
      this.emit('changed', changed);
    }
    if (removed.length > 0) {
      this.emit('removed', removed);
    }
  }

  /**
   * Check if a path should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    const basename = path.basename(filePath);

    for (const pattern of this.options.ignorePatterns) {
      // Glob pattern with *
      if (pattern.includes('*')) {
        const regex = new RegExp(
          '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
        );
        if (regex.test(basename)) {
          return true;
        }
      } else {
        // Exact match
        if (basename === pattern) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate depth of a path relative to root
   */
  private getDepth(filePath: string): number {
    const relative = path.relative(this.state.rootPath, filePath);
    if (!relative) return 0;
    return relative.split(path.sep).length;
  }
}

// ============================================
// Chokidar-like Wrapper (Optional)
// ============================================

/**
 * Simplified watcher interface similar to chokidar
 */
export function createWatcher(
  paths: string | string[],
  options: WatcherOptions = {}
): FileSystemWatcher {
  const watcher = new FileSystemWatcher(options);
  
  const pathsArray = Array.isArray(paths) ? paths : [paths];
  
  // Start watching when ready handlers are attached
  setImmediate(async () => {
    try {
      for (const p of pathsArray) {
        await watcher.watch(p);
      }
    } catch (error) {
      watcher.emit('error', error);
    }
  });

  return watcher;
}

// ============================================
// Exports
// ============================================

export const fileWatcher = new FileSystemWatcher();

export default FileSystemWatcher;

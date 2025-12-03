/**
 * The Joker - Agentic Terminal
 * File System Watcher
 * 
 * Real-time file system monitoring with debouncing,
 * intelligent filtering, and change batching.
 * Uses chokidar for cross-platform file watching.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import chokidar, { FSWatcher as ChokidarWatcher } from 'chokidar';
import type { Stats } from 'fs';
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
 * Uses chokidar for robust cross-platform file watching
 */
export class FileSystemWatcher extends EventEmitter {
  private options: Required<WatcherOptions>;
  private watcher: ChokidarWatcher | null = null;
  private state: WatcherState;
  private pendingChanges: FileChangeEvent[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  private static readonly DEFAULT_IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/.cache/**',
    '**/coverage/**',
    '**/__pycache__/**',
    '**/.pytest_cache/**',
    '**/vendor/**',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.log',
    '**/*.lock',
    '**/*.tmp',
    '**/*.temp',
    '**/*.swp',
    '**/*~'
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

    // Set up chokidar watcher
    this.watcher = chokidar.watch(resolvedPath, {
      ignored: this.options.ignorePatterns,
      persistent: true,
      ignoreInitial: this.options.ignoreInitial,
      followSymlinks: this.options.followSymlinks,
      depth: this.options.depth === Infinity ? undefined : this.options.depth,
      usePolling: this.options.usePolling,
      interval: this.options.pollingInterval,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    // Set up event handlers
    this.setupChokidarEvents();

    // Emit ready event
    this.emit('ready', { rootPath: resolvedPath });
  }

  /**
   * Set up chokidar event handlers
   */
  private setupChokidarEvents(): void {
    if (!this.watcher) return;

    this.watcher
      .on('add', (filePath: string, stats?: Stats) => {
        this.handleChokidarEvent('add', filePath, stats);
      })
      .on('change', (filePath: string, stats?: Stats) => {
        this.handleChokidarEvent('change', filePath, stats);
      })
      .on('unlink', (filePath: string) => {
        this.handleChokidarEvent('unlink', filePath);
      })
      .on('addDir', (filePath: string, stats?: Stats) => {
        this.handleChokidarEvent('addDir', filePath, stats);
      })
      .on('unlinkDir', (filePath: string) => {
        this.handleChokidarEvent('unlinkDir', filePath);
      })
      .on('error', (error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn('Watcher error', { error: err });
        this.emit('error', { error: err });
      })
      .on('ready', () => {
        // Update watched paths from chokidar
        const watched = this.watcher?.getWatched() || {};
        for (const dir of Object.keys(watched)) {
          this.state.watchedPaths.add(dir);
          for (const file of watched[dir]) {
            this.state.watchedPaths.add(path.join(dir, file));
          }
        }
        logger.info('Watcher ready', { 
          rootPath: this.state.rootPath,
          watchedCount: this.state.watchedPaths.size 
        });
      });
  }

  /**
   * Handle chokidar events
   */
  private handleChokidarEvent(
    type: ChangeType, 
    filePath: string, 
    stats?: Stats
  ): void {
    if (this.isShuttingDown) return;

    // Check file extensions filter
    if (this.options.watchExtensions.length > 0) {
      const ext = path.extname(filePath);
      if (!this.options.watchExtensions.includes(ext)) {
        return;
      }
    }

    const relativePath = path.relative(this.state.rootPath, filePath);

    const event: FileChangeEvent = {
      type,
      path: filePath,
      relativePath,
      timestamp: new Date(),
      stats: stats ? {
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory()
      } : undefined
    };

    this.queueChange(event);
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

    // Close chokidar watcher
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

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
    return { 
      ...this.state,
      watchedPaths: new Set(this.state.watchedPaths),
      fileHashes: new Map(this.state.fileHashes)
    };
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
    if (!this.state.isWatching || !this.watcher) {
      throw new Error('Watcher is not running. Call watch() first.');
    }

    const resolved = path.resolve(filePath);
    this.watcher.add(resolved);
    this.state.watchedPaths.add(resolved);
  }

  /**
   * Remove a path from watching
   */
  async unwatch(filePath: string): Promise<void> {
    if (!this.watcher) return;

    const resolved = path.resolve(filePath);
    await this.watcher.unwatch(resolved);
    this.state.watchedPaths.delete(resolved);
  }

  /**
   * Get watched paths count
   */
  getWatchedPathsCount(): number {
    return this.state.watchedPaths.size;
  }

  /**
   * Get all watched directories and files
   */
  getWatchedPaths(): Record<string, string[]> {
    if (!this.watcher) return {};
    return this.watcher.getWatched();
  }

  // ============================================
  // Private Methods
  // ============================================

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
  shouldIgnore(filePath: string): boolean {
    const basename = path.basename(filePath);

    for (const pattern of this.options.ignorePatterns) {
      // Simple glob pattern matching
      if (pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/\*\*/g, '{{GLOBSTAR}}')
          .replace(/\*/g, '[^/]*')
          .replace(/{{GLOBSTAR}}/g, '.*')
          .replace(/\./g, '\\.');
        const regex = new RegExp(regexPattern);
        if (regex.test(filePath) || regex.test(basename)) {
          return true;
        }
      } else {
        if (basename === pattern || filePath.includes(pattern)) {
          return true;
        }
      }
    }

    return false;
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

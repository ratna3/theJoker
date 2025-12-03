/**
 * The Joker - Agentic Terminal
 * File System Operations
 * 
 * Utility functions for file system operations including
 * reading, writing, copying, moving, and traversing.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream, Stats } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

/**
 * File information
 */
export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
  permissions: string;
}

/**
 * Directory listing options
 */
export interface ListOptions {
  /** Include hidden files (starting with .) */
  includeHidden?: boolean;
  /** Recurse into subdirectories */
  recursive?: boolean;
  /** Maximum depth for recursion */
  maxDepth?: number;
  /** Filter by extension(s) */
  extensions?: string[];
  /** Filter by name pattern (regex) */
  pattern?: RegExp;
  /** Patterns to ignore */
  ignore?: string[];
  /** Sort by field */
  sortBy?: 'name' | 'size' | 'modified' | 'created';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Copy options
 */
export interface CopyOptions {
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Preserve timestamps */
  preserveTimestamps?: boolean;
  /** Filter function to decide which files to copy */
  filter?: (src: string, dest: string) => boolean | Promise<boolean>;
  /** Recursive copy */
  recursive?: boolean;
}

/**
 * Search result
 */
export interface SearchResult {
  path: string;
  matches: Array<{
    line: number;
    column: number;
    text: string;
    context: string;
  }>;
}

/**
 * File diff
 */
export interface FileDiff {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  path: string;
  oldContent?: string;
  newContent?: string;
}

// ============================================
// File Operations Class
// ============================================

/**
 * File system operations utility class
 */
export class FileOperations {
  
  // ============================================
  // Reading Operations
  // ============================================

  /**
   * Read file content as string
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    try {
      return await fs.readFile(filePath, encoding);
    } catch (error) {
      logger.error('Failed to read file', { filePath, error });
      throw error;
    }
  }

  /**
   * Read file content as buffer
   */
  async readFileBuffer(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      logger.error('Failed to read file buffer', { filePath, error });
      throw error;
    }
  }

  /**
   * Read JSON file
   */
  async readJSON<T = unknown>(filePath: string): Promise<T> {
    const content = await this.readFile(filePath);
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      logger.error('Failed to parse JSON', { filePath, error });
      throw new Error(`Invalid JSON in file: ${filePath}`);
    }
  }

  /**
   * Read file lines
   */
  async readLines(filePath: string): Promise<string[]> {
    const content = await this.readFile(filePath);
    return content.split(/\r?\n/);
  }

  /**
   * Read specific lines from a file
   */
  async readLinesRange(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<string[]> {
    const lines = await this.readLines(filePath);
    return lines.slice(startLine - 1, endLine);
  }

  // ============================================
  // Writing Operations
  // ============================================

  /**
   * Write content to file
   */
  async writeFile(
    filePath: string,
    content: string | Buffer,
    options?: { encoding?: BufferEncoding; mode?: number }
  ): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, options);
      logger.debug('File written', { filePath });
    } catch (error) {
      logger.error('Failed to write file', { filePath, error });
      throw error;
    }
  }

  /**
   * Write JSON to file
   */
  async writeJSON(
    filePath: string,
    data: unknown,
    options?: { pretty?: boolean; spaces?: number }
  ): Promise<void> {
    const content = options?.pretty
      ? JSON.stringify(data, null, options?.spaces ?? 2)
      : JSON.stringify(data);
    await this.writeFile(filePath, content);
  }

  /**
   * Append content to file
   */
  async appendFile(filePath: string, content: string | Buffer): Promise<void> {
    try {
      await fs.appendFile(filePath, content);
    } catch (error) {
      logger.error('Failed to append to file', { filePath, error });
      throw error;
    }
  }

  /**
   * Insert content at specific line
   */
  async insertAtLine(
    filePath: string,
    lineNumber: number,
    content: string
  ): Promise<void> {
    const lines = await this.readLines(filePath);
    lines.splice(lineNumber - 1, 0, content);
    await this.writeFile(filePath, lines.join('\n'));
  }

  /**
   * Replace content in file
   */
  async replaceInFile(
    filePath: string,
    search: string | RegExp,
    replace: string
  ): Promise<number> {
    let content = await this.readFile(filePath);
    let count = 0;

    if (typeof search === 'string') {
      const parts = content.split(search);
      count = parts.length - 1;
      content = parts.join(replace);
    } else {
      const matches = content.match(search);
      count = matches?.length || 0;
      content = content.replace(search, replace);
    }

    await this.writeFile(filePath, content);
    return count;
  }

  // ============================================
  // Directory Operations
  // ============================================

  /**
   * Create directory (recursive)
   */
  async createDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      logger.debug('Directory created', { dirPath });
    } catch (error) {
      logger.error('Failed to create directory', { dirPath, error });
      throw error;
    }
  }

  /**
   * Ensure directory exists
   */
  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await this.createDir(dirPath);
    }
  }

  /**
   * List directory contents
   */
  async listDir(
    dirPath: string,
    options: ListOptions = {}
  ): Promise<FileInfo[]> {
    const results: FileInfo[] = [];
    await this.listDirRecursive(dirPath, options, results, 0);

    // Sort results
    if (options.sortBy) {
      results.sort((a, b) => {
        let comparison = 0;
        switch (options.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'size':
            comparison = a.size - b.size;
            break;
          case 'modified':
            comparison = a.modified.getTime() - b.modified.getTime();
            break;
          case 'created':
            comparison = a.created.getTime() - b.created.getTime();
            break;
        }
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return results;
  }

  private async listDirRecursive(
    dirPath: string,
    options: ListOptions,
    results: FileInfo[],
    depth: number
  ): Promise<void> {
    if (options.maxDepth !== undefined && depth > options.maxDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip hidden files if not included
        if (!options.includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Skip ignored patterns
        if (options.ignore?.some(pattern => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(entry.name);
          }
          return entry.name === pattern;
        })) {
          continue;
        }

        // Check extension filter
        if (options.extensions && options.extensions.length > 0) {
          const ext = path.extname(entry.name);
          if (!options.extensions.includes(ext)) {
            if (!entry.isDirectory()) continue;
          }
        }

        // Check pattern filter
        if (options.pattern && !options.pattern.test(entry.name)) {
          if (!entry.isDirectory()) continue;
        }

        const info = await this.getFileInfo(fullPath);
        results.push(info);

        // Recurse into directories
        if (entry.isDirectory() && options.recursive) {
          await this.listDirRecursive(fullPath, options, results, depth + 1);
        }
      }
    } catch (error) {
      logger.warn('Error listing directory', { dirPath, error });
    }
  }

  /**
   * Get file/directory information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.lstat(filePath);
      return this.statsToFileInfo(filePath, stats);
    } catch (error) {
      logger.error('Failed to get file info', { filePath, error });
      throw error;
    }
  }

  private statsToFileInfo(filePath: string, stats: Stats): FileInfo {
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink(),
      permissions: (stats.mode & 0o777).toString(8)
    };
  }

  // ============================================
  // Copy/Move Operations
  // ============================================

  /**
   * Copy file or directory
   */
  async copy(src: string, dest: string, options: CopyOptions = {}): Promise<void> {
    const srcStats = await fs.stat(src);

    if (srcStats.isDirectory()) {
      await this.copyDir(src, dest, options);
    } else {
      await this.copyFile(src, dest, options);
    }
  }

  /**
   * Copy a single file
   */
  async copyFile(src: string, dest: string, options: CopyOptions = {}): Promise<void> {
    // Check filter
    if (options.filter && !(await options.filter(src, dest))) {
      return;
    }

    // Check if destination exists
    if (!options.overwrite) {
      try {
        await fs.access(dest);
        throw new Error(`Destination already exists: ${dest}`);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }

    // Ensure destination directory exists
    await this.ensureDir(path.dirname(dest));

    // Copy using streams for large files
    await pipeline(
      createReadStream(src),
      createWriteStream(dest)
    );

    // Preserve timestamps if requested
    if (options.preserveTimestamps) {
      const stats = await fs.stat(src);
      await fs.utimes(dest, stats.atime, stats.mtime);
    }

    logger.debug('File copied', { src, dest });
  }

  /**
   * Copy directory recursively
   */
  async copyDir(src: string, dest: string, options: CopyOptions = {}): Promise<void> {
    await this.ensureDir(dest);

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (options.recursive !== false) {
          await this.copyDir(srcPath, destPath, options);
        }
      } else {
        await this.copyFile(srcPath, destPath, options);
      }
    }

    logger.debug('Directory copied', { src, dest });
  }

  /**
   * Move file or directory
   */
  async move(src: string, dest: string, options?: { overwrite?: boolean }): Promise<void> {
    try {
      // Try rename first (fastest if on same filesystem)
      await fs.rename(src, dest);
    } catch (error) {
      // If rename fails (cross-device), copy and delete
      if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
        await this.copy(src, dest, { overwrite: options?.overwrite });
        await this.remove(src);
      } else {
        throw error;
      }
    }
    logger.debug('File moved', { src, dest });
  }

  /**
   * Rename file or directory
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    await fs.rename(oldPath, newPath);
    logger.debug('File renamed', { oldPath, newPath });
  }

  // ============================================
  // Delete Operations
  // ============================================

  /**
   * Remove file or directory
   */
  async remove(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
      logger.debug('Removed', { filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Empty a directory without removing it
   */
  async emptyDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath);
    await Promise.all(
      entries.map(entry => this.remove(path.join(dirPath, entry)))
    );
    logger.debug('Directory emptied', { dirPath });
  }

  /**
   * Remove empty directories recursively
   */
  async removeEmptyDirs(dirPath: string): Promise<number> {
    let removed = 0;

    const processDir = async (dir: string): Promise<boolean> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let hasFiles = false;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(dir, entry.name);
          const subEmpty = await processDir(subPath);
          if (!subEmpty) hasFiles = true;
        } else {
          hasFiles = true;
        }
      }

      if (!hasFiles) {
        await fs.rmdir(dir);
        removed++;
        return true;
      }

      return false;
    };

    await processDir(dirPath);
    return removed;
  }

  // ============================================
  // Search Operations
  // ============================================

  /**
   * Search for text in files
   */
  async searchInFiles(
    dirPath: string,
    pattern: string | RegExp,
    options: ListOptions = {}
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const files = await this.listDir(dirPath, { ...options, recursive: true });
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;

    for (const file of files) {
      if (!file.isFile) continue;

      try {
        const content = await this.readFile(file.path);
        const lines = content.split('\n');
        const matches: SearchResult['matches'] = [];

        lines.forEach((line, index) => {
          let match;
          while ((match = regex.exec(line)) !== null) {
            matches.push({
              line: index + 1,
              column: match.index + 1,
              text: match[0],
              context: line.trim()
            });
          }
        });

        if (matches.length > 0) {
          results.push({ path: file.path, matches });
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return results;
  }

  /**
   * Find files by name pattern
   */
  async findFiles(
    dirPath: string,
    pattern: string | RegExp,
    options: ListOptions = {}
  ): Promise<string[]> {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern.replace(/\*/g, '.*'), 'i')
      : pattern;

    const files = await this.listDir(dirPath, { ...options, recursive: true, pattern: regex });
    return files.map(f => f.path);
  }

  // ============================================
  // Utility Operations
  // ============================================

  /**
   * Check if path exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a file
   */
  async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a directory
   */
  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get file size
   */
  async getSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Get directory size (recursive)
   */
  async getDirSize(dirPath: string): Promise<number> {
    let totalSize = 0;

    const calculateSize = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await calculateSize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    };

    await calculateSize(dirPath);
    return totalSize;
  }

  /**
   * Calculate file hash
   */
  async getHash(
    filePath: string,
    algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash(algorithm);
      const stream = createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Compare two files
   */
  async compareFiles(file1: string, file2: string): Promise<boolean> {
    const [hash1, hash2] = await Promise.all([
      this.getHash(file1),
      this.getHash(file2)
    ]);
    return hash1 === hash2;
  }

  /**
   * Get file diff
   */
  async diff(oldPath: string, newPath: string): Promise<FileDiff> {
    const [oldExists, newExists] = await Promise.all([
      this.exists(oldPath),
      this.exists(newPath)
    ]);

    if (!oldExists && newExists) {
      return {
        type: 'added',
        path: newPath,
        newContent: await this.readFile(newPath)
      };
    }

    if (oldExists && !newExists) {
      return {
        type: 'removed',
        path: oldPath,
        oldContent: await this.readFile(oldPath)
      };
    }

    if (oldExists && newExists) {
      const [oldContent, newContent] = await Promise.all([
        this.readFile(oldPath),
        this.readFile(newPath)
      ]);

      if (oldContent === newContent) {
        return { type: 'unchanged', path: oldPath };
      }

      return {
        type: 'modified',
        path: newPath,
        oldContent,
        newContent
      };
    }

    throw new Error('Neither file exists');
  }

  /**
   * Create a temporary file
   */
  async createTempFile(
    prefix: string = 'tmp',
    extension: string = ''
  ): Promise<string> {
    const os = await import('os');
    const tempDir = os.tmpdir();
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
    const tempPath = path.join(tempDir, fileName);
    await this.writeFile(tempPath, '');
    return tempPath;
  }

  /**
   * Create a temporary directory
   */
  async createTempDir(prefix: string = 'tmp'): Promise<string> {
    const os = await import('os');
    const tempDir = os.tmpdir();
    const dirName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempPath = path.join(tempDir, dirName);
    await this.createDir(tempPath);
    return tempPath;
  }

  /**
   * Watch file for changes (simple single-file watch)
   */
  watchFile(
    filePath: string,
    callback: (eventType: string, filename: string) => void
  ): { close: () => void } {
    const { watch } = require('fs');
    const watcher = watch(filePath, callback);
    return watcher;
  }

  /**
   * Touch file (update timestamps or create)
   */
  async touch(filePath: string): Promise<void> {
    try {
      const now = new Date();
      await fs.utimes(filePath, now, now);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.writeFile(filePath, '');
      } else {
        throw error;
      }
    }
  }

  /**
   * Make file executable (Unix-like systems)
   */
  async makeExecutable(filePath: string): Promise<void> {
    const stats = await fs.stat(filePath);
    const newMode = stats.mode | 0o111;
    await fs.chmod(filePath, newMode);
  }

  /**
   * Resolve symlink
   */
  async resolveSymlink(filePath: string): Promise<string> {
    return await fs.realpath(filePath);
  }

  /**
   * Create symlink
   */
  async createSymlink(target: string, linkPath: string): Promise<void> {
    await fs.symlink(target, linkPath);
  }
}

// ============================================
// Singleton Export
// ============================================

export const fileOps = new FileOperations();

export default FileOperations;

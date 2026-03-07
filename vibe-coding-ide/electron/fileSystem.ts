/**
 * ENDj0K3R — File System Manager
 * Handles file/directory operations and file watching with chokidar
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import type { FileNode, FileChangeEvent } from '../src/types/index';

let chokidar: any;
try {
    chokidar = require('chokidar');
} catch {
    console.warn('chokidar not available — file watching disabled');
}

const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico', '.webp',
    '.mp3', '.mp4', '.ogg', '.wav', '.avi', '.mov',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.zip', '.gz', '.tar', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.exe', '.dll', '.so', '.dylib',
    '.node', '.wasm',
]);

const IGNORE_DIRS = new Set([
    'node_modules', '.git', '.next', '.nuxt', 'dist', 'build',
    '__pycache__', '.venv', 'venv', '.idea', '.vscode',
    'coverage', '.cache', '.turbo', '.parcel-cache',
]);

export class FileSystemManager {
    private watcher: any = null;
    private watchCallbacks: ((event: FileChangeEvent) => void)[] = [];
    private debounceTimers = new Map<string, NodeJS.Timeout>();

    /**
     * Read directory contents and return FileNode tree
     */
    async readDirectory(dirPath: string, depth = 0, maxDepth = 1): Promise<FileNode[]> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const nodes: FileNode[] = [];

            // Sort: directories first, then files, alphabetically
            const sorted = entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            });

            for (const entry of sorted) {
                // Skip hidden/ignored directories
                if (entry.name.startsWith('.') && entry.isDirectory() && entry.name !== '.env') {
                    if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
                }
                if (IGNORE_DIRS.has(entry.name)) continue;

                const fullPath = path.join(dirPath, entry.name);
                const isDir = entry.isDirectory();

                let stats: fs.Stats | null = null;
                try {
                    stats = await fs.promises.stat(fullPath);
                } catch {
                    continue; // Skip files we can't stat
                }

                const node: FileNode = {
                    name: entry.name,
                    path: fullPath,
                    type: isDir ? 'directory' : 'file',
                    extension: isDir ? undefined : path.extname(entry.name).toLowerCase(),
                    size: isDir ? undefined : stats.size,
                    modified: stats.mtime.toISOString(),
                    depth,
                    gitStatus: null,
                };

                // Lazy load children only at first level
                if (isDir && depth < maxDepth) {
                    try {
                        node.children = await this.readDirectory(fullPath, depth + 1, maxDepth);
                    } catch {
                        node.children = [];
                    }
                } else if (isDir) {
                    node.children = undefined; // Will be loaded on expand
                }

                nodes.push(node);
            }

            return nodes;
        } catch (err: any) {
            console.error(`Error reading directory ${dirPath}:`, err.message);
            return [];
        }
    }

    /**
     * Read file contents
     */
    async readFile(filePath: string): Promise<{ content: string | null; encoding: string; size: number; isBinary: boolean }> {
        try {
            const stats = await fs.promises.stat(filePath);
            const ext = path.extname(filePath).toLowerCase();

            if (BINARY_EXTENSIONS.has(ext)) {
                return { content: null, encoding: 'binary', size: stats.size, isBinary: true };
            }

            // Limit file size to prevent memory issues (10MB)
            if (stats.size > 10 * 1024 * 1024) {
                return { content: null, encoding: 'utf-8', size: stats.size, isBinary: true };
            }

            const content = await fs.promises.readFile(filePath, 'utf-8');
            return { content, encoding: 'utf-8', size: stats.size, isBinary: false };
        } catch (err: any) {
            throw new Error(`Failed to read file: ${err.message}`);
        }
    }

    /**
     * Write file contents, creating directories if needed
     */
    async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
        try {
            const dir = path.dirname(filePath);
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(filePath, content, 'utf-8');
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Delete file or directory
     */
    async deleteItem(itemPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const stats = await fs.promises.stat(itemPath);
            if (stats.isDirectory()) {
                await fs.promises.rm(itemPath, { recursive: true, force: true });
            } else {
                await fs.promises.unlink(itemPath);
            }
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Rename file or directory
     */
    async renameItem(oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Check if target already exists
            try {
                await fs.promises.access(newPath);
                return { success: false, error: 'Target already exists' };
            } catch {
                // Good, target doesn't exist
            }
            await fs.promises.rename(oldPath, newPath);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Create a new file or directory
     */
    async createItem(parentPath: string, name: string, type: 'file' | 'directory'): Promise<FileNode> {
        const fullPath = path.join(parentPath, name);

        if (type === 'directory') {
            await fs.promises.mkdir(fullPath, { recursive: true });
        } else {
            await fs.promises.writeFile(fullPath, '', 'utf-8');
        }

        const stats = await fs.promises.stat(fullPath);
        return {
            name,
            path: fullPath,
            type,
            extension: type === 'file' ? path.extname(name).toLowerCase() : undefined,
            size: type === 'file' ? stats.size : undefined,
            modified: stats.mtime.toISOString(),
            depth: 0,
            gitStatus: null,
        };
    }

    /**
     * Watch a directory for changes using chokidar
     */
    watchDirectory(dirPath: string, callback: (event: FileChangeEvent) => void): void {
        this.stopWatching();

        if (!chokidar) {
            console.warn('chokidar not available, file watching disabled');
            return;
        }

        this.watchCallbacks.push(callback);

        this.watcher = chokidar.watch(dirPath, {
            ignored: [
                /(^|[\/\\])\../, // dotfiles
                '**/node_modules/**',
                '**/dist/**',
                '**/.git/**',
                '**/.next/**',
                '**/build/**',
            ],
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50,
            },
        });

        const emitDebounced = (type: FileChangeEvent['type'], filePath: string) => {
            const key = `${type}:${filePath}`;
            const existing = this.debounceTimers.get(key);
            if (existing) clearTimeout(existing);

            this.debounceTimers.set(key, setTimeout(() => {
                this.debounceTimers.delete(key);
                const event: FileChangeEvent = { type, path: filePath };
                this.watchCallbacks.forEach(cb => cb(event));
            }, 100));
        };

        this.watcher
            .on('add', (p: string) => emitDebounced('add', p))
            .on('change', (p: string) => emitDebounced('change', p))
            .on('unlink', (p: string) => emitDebounced('unlink', p))
            .on('addDir', (p: string) => emitDebounced('addDir', p))
            .on('unlinkDir', (p: string) => emitDebounced('unlinkDir', p));
    }

    /**
     * Stop watching
     */
    stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.watchCallbacks = [];
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }

    /**
     * Get git status for a directory
     */
    async getGitStatus(dirPath: string): Promise<Map<string, string>> {
        return new Promise((resolve) => {
            exec('git status --porcelain', { cwd: dirPath }, (error, stdout) => {
                const statusMap = new Map<string, string>();
                if (error) {
                    resolve(statusMap);
                    return;
                }
                const lines = stdout.trim().split('\n').filter(Boolean);
                for (const line of lines) {
                    const status = line.substring(0, 2).trim();
                    const filePath = line.substring(3).trim();
                    const fullPath = path.resolve(dirPath, filePath);
                    statusMap.set(fullPath, status);
                }
                resolve(statusMap);
            });
        });
    }
}

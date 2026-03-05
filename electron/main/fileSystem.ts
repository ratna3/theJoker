/**
 * The Joker — File System Manager
 * Handles file/directory operations and file watching
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

let chokidar: any;
try {
    chokidar = require('chokidar');
} catch {
    console.warn('chokidar not available — file watching disabled');
}

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    extension?: string;
    size?: number;
    modified?: string;
    children?: FileNode[];
    depth: number;
    gitStatus?: string | null;
}

interface FileChangeEvent {
    type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
    path: string;
}

const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico', '.webp',
    '.mp3', '.mp4', '.ogg', '.wav', '.avi', '.mov',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.zip', '.gz', '.tar', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.exe', '.dll', '.so', '.dylib', '.node', '.wasm',
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

    async readDirectory(dirPath: string, depth = 0, maxDepth = 1): Promise<FileNode[]> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const nodes: FileNode[] = [];
            const sorted = entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            });
            for (const entry of sorted) {
                if (entry.name.startsWith('.') && entry.isDirectory()) continue;
                if (IGNORE_DIRS.has(entry.name)) continue;
                const fullPath = path.join(dirPath, entry.name);
                const isDir = entry.isDirectory();
                let stats: fs.Stats | null = null;
                try { stats = await fs.promises.stat(fullPath); } catch { continue; }
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
                if (isDir && depth < maxDepth) {
                    try { node.children = await this.readDirectory(fullPath, depth + 1, maxDepth); }
                    catch { node.children = []; }
                } else if (isDir) {
                    node.children = undefined;
                }
                nodes.push(node);
            }
            return nodes;
        } catch (err: any) {
            console.error(`Error reading directory ${dirPath}:`, err.message);
            return [];
        }
    }

    async readFile(filePath: string): Promise<{ content: string | null; encoding: string; size: number; isBinary: boolean }> {
        const stats = await fs.promises.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext) || stats.size > 10 * 1024 * 1024) {
            return { content: null, encoding: 'binary', size: stats.size, isBinary: true };
        }
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return { content, encoding: 'utf-8', size: stats.size, isBinary: false };
    }

    async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
        try {
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            await fs.promises.writeFile(filePath, content, 'utf-8');
            return { success: true };
        } catch (err: any) { return { success: false, error: err.message }; }
    }

    async deleteItem(itemPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const stats = await fs.promises.stat(itemPath);
            if (stats.isDirectory()) await fs.promises.rm(itemPath, { recursive: true, force: true });
            else await fs.promises.unlink(itemPath);
            return { success: true };
        } catch (err: any) { return { success: false, error: err.message }; }
    }

    async renameItem(oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            try { await fs.promises.access(newPath); return { success: false, error: 'Target already exists' }; } catch { }
            await fs.promises.rename(oldPath, newPath);
            return { success: true };
        } catch (err: any) { return { success: false, error: err.message }; }
    }

    async createItem(parentPath: string, name: string, type: 'file' | 'directory'): Promise<FileNode> {
        const fullPath = path.join(parentPath, name);
        if (type === 'directory') await fs.promises.mkdir(fullPath, { recursive: true });
        else await fs.promises.writeFile(fullPath, '', 'utf-8');
        const stats = await fs.promises.stat(fullPath);
        return {
            name, path: fullPath, type,
            extension: type === 'file' ? path.extname(name).toLowerCase() : undefined,
            size: type === 'file' ? stats.size : undefined,
            modified: stats.mtime.toISOString(),
            depth: 0, gitStatus: null,
        };
    }

    watchDirectory(dirPath: string, callback: (event: FileChangeEvent) => void): void {
        this.stopWatching();
        if (!chokidar) return;
        this.watchCallbacks.push(callback);
        this.watcher = chokidar.watch(dirPath, {
            ignored: [/(^|[\/\\])\./, '**/node_modules/**', '**/dist/**', '**/.git/**', '**/.next/**', '**/build/**'],
            persistent: true, ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
        });
        const emitDebounced = (type: FileChangeEvent['type'], filePath: string) => {
            const key = `${type}:${filePath}`;
            const existing = this.debounceTimers.get(key);
            if (existing) clearTimeout(existing);
            this.debounceTimers.set(key, setTimeout(() => {
                this.debounceTimers.delete(key);
                this.watchCallbacks.forEach(cb => cb({ type, path: filePath }));
            }, 100));
        };
        this.watcher
            .on('add', (p: string) => emitDebounced('add', p))
            .on('change', (p: string) => emitDebounced('change', p))
            .on('unlink', (p: string) => emitDebounced('unlink', p))
            .on('addDir', (p: string) => emitDebounced('addDir', p))
            .on('unlinkDir', (p: string) => emitDebounced('unlinkDir', p));
    }

    stopWatching(): void {
        if (this.watcher) { this.watcher.close(); this.watcher = null; }
        this.watchCallbacks = [];
        for (const timer of this.debounceTimers.values()) clearTimeout(timer);
        this.debounceTimers.clear();
    }
}

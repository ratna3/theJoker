/**
 * Zustand Store — File Explorer
 */

import { create } from 'zustand';
import type { FileNode, FileChangeEvent } from '../types';

interface FileState {
    rootPath: string | null;
    rootTree: FileNode[];
    expandedPaths: Set<string>;
    selectedPath: string | null;
    watcherActive: boolean;
    searchQuery: string;
    openFolder: (path: string) => Promise<void>;
    refreshTree: () => Promise<void>;
    setTree: (tree: FileNode[]) => void;
    toggleExpand: (path: string) => void;
    selectFile: (path: string) => void;
    setSearchQuery: (query: string) => void;
    handleFileChange: (event: FileChangeEvent) => void;
    updateChildren: (parentPath: string, children: FileNode[]) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
    rootPath: null,
    rootTree: [],
    expandedPaths: new Set<string>(),
    selectedPath: null,
    watcherActive: false,
    searchQuery: '',

    openFolder: async (folderPath) => {
        try {
            const tree = await window.electronAPI.fs.readDir(folderPath);
            await window.electronAPI.fs.watchStart(folderPath);
            set({
                rootPath: folderPath,
                rootTree: tree,
                expandedPaths: new Set<string>(),
                selectedPath: null,
                watcherActive: true,
            });
        } catch (err) {
            console.error('Failed to open folder:', err);
        }
    },

    refreshTree: async () => {
        const { rootPath } = get();
        if (!rootPath) return;
        try {
            const tree = await window.electronAPI.fs.readDir(rootPath);
            set({ rootTree: tree });
        } catch (err) {
            console.error('Failed to refresh tree:', err);
        }
    },

    setTree: (tree) => set({ rootTree: tree }),

    toggleExpand: (path) => {
        set((state) => {
            const newExpanded = new Set(state.expandedPaths);
            if (newExpanded.has(path)) {
                newExpanded.delete(path);
            } else {
                newExpanded.add(path);
            }
            return { expandedPaths: newExpanded };
        });
    },

    selectFile: (path) => set({ selectedPath: path }),

    setSearchQuery: (query) => set({ searchQuery: query }),

    handleFileChange: (_event) => {
        // Debounced refresh
        const { refreshTree } = get();
        refreshTree();
    },

    updateChildren: (parentPath, children) => {
        const updateNodeChildren = (nodes: FileNode[]): FileNode[] => {
            return nodes.map((node) => {
                if (node.path === parentPath) {
                    return { ...node, children };
                }
                if (node.children) {
                    return { ...node, children: updateNodeChildren(node.children) };
                }
                return node;
            });
        };
        set((state) => ({ rootTree: updateNodeChildren(state.rootTree) }));
    },
}));

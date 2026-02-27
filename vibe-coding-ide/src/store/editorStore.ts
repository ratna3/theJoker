/**
 * Zustand Store — Editor Tabs
 */

import { create } from 'zustand';
import type { EditorTab } from '../types';

const LANGUAGE_MAP: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescriptreact',
    '.js': 'javascript', '.jsx': 'javascriptreact',
    '.json': 'json', '.html': 'html', '.css': 'css',
    '.scss': 'scss', '.less': 'less', '.md': 'markdown',
    '.py': 'python', '.rs': 'rust', '.go': 'go',
    '.java': 'java', '.c': 'c', '.cpp': 'cpp',
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
    '.yaml': 'yaml', '.yml': 'yaml', '.xml': 'xml',
    '.sql': 'sql', '.graphql': 'graphql',
    '.env': 'plaintext', '.txt': 'plaintext',
    '.svg': 'xml', '.gitignore': 'plaintext',
};

function getLanguage(filePath: string): string {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    const basename = filePath.split(/[/\\]/).pop() || '';
    if (basename === 'Dockerfile') return 'dockerfile';
    if (basename === 'Makefile') return 'makefile';
    return LANGUAGE_MAP[ext] || 'plaintext';
}

interface EditorState {
    openTabs: EditorTab[];
    activeTabId: string | null;
    openFile: (path: string) => Promise<void>;
    closeTab: (id: string) => void;
    closeAllTabs: () => void;
    setActiveTab: (id: string) => void;
    updateContent: (id: string, content: string) => void;
    saveFile: (id: string) => Promise<void>;
    saveActiveFile: () => Promise<void>;
    markModified: (id: string, modified: boolean) => void;
    reorderTabs: (fromIndex: number, toIndex: number) => void;
    getActiveTab: () => EditorTab | undefined;
}

export const useEditorStore = create<EditorState>((set, get) => ({
    openTabs: [],
    activeTabId: null,

    openFile: async (filePath: string) => {
        const { openTabs } = get();

        // Check if already open
        const existing = openTabs.find((t) => t.filePath === filePath);
        if (existing) {
            set({ activeTabId: existing.id });
            return;
        }

        try {
            const result = await window.electronAPI.fs.readFile(filePath);
            if (result.isBinary) return; // Don't open binary files

            const fileName = filePath.split(/[/\\]/).pop() || 'untitled';
            const id = `tab-${Date.now()}`;
            const tab: EditorTab = {
                id,
                filePath,
                fileName,
                language: getLanguage(filePath),
                content: result.content || '',
                isModified: false,
                isActive: true,
            };

            set((state) => ({
                openTabs: [...state.openTabs.map(t => ({ ...t, isActive: false })), tab],
                activeTabId: id,
            }));
        } catch (err) {
            console.error('Failed to open file:', err);
        }
    },

    closeTab: (id) => {
        set((state) => {
            const idx = state.openTabs.findIndex((t) => t.id === id);
            const remaining = state.openTabs.filter((t) => t.id !== id);
            let newActive = state.activeTabId;

            if (state.activeTabId === id) {
                if (remaining.length > 0) {
                    const newIdx = Math.min(idx, remaining.length - 1);
                    newActive = remaining[newIdx].id;
                    remaining[newIdx] = { ...remaining[newIdx], isActive: true };
                } else {
                    newActive = null;
                }
            }

            return { openTabs: remaining, activeTabId: newActive };
        });
    },

    closeAllTabs: () => set({ openTabs: [], activeTabId: null }),

    setActiveTab: (id) => {
        set((state) => ({
            activeTabId: id,
            openTabs: state.openTabs.map((t) => ({
                ...t,
                isActive: t.id === id,
            })),
        }));
    },

    updateContent: (id, content) => {
        set((state) => ({
            openTabs: state.openTabs.map((t) =>
                t.id === id ? { ...t, content, isModified: true } : t
            ),
        }));
    },

    saveFile: async (id) => {
        const tab = get().openTabs.find((t) => t.id === id);
        if (!tab) return;
        try {
            await window.electronAPI.fs.writeFile(tab.filePath, tab.content);
            set((state) => ({
                openTabs: state.openTabs.map((t) =>
                    t.id === id ? { ...t, isModified: false } : t
                ),
            }));
        } catch (err) {
            console.error('Failed to save file:', err);
        }
    },

    saveActiveFile: async () => {
        const { activeTabId, saveFile } = get();
        if (activeTabId) await saveFile(activeTabId);
    },

    markModified: (id, modified) => {
        set((state) => ({
            openTabs: state.openTabs.map((t) =>
                t.id === id ? { ...t, isModified: modified } : t
            ),
        }));
    },

    reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
            const tabs = [...state.openTabs];
            const [moved] = tabs.splice(fromIndex, 1);
            tabs.splice(toIndex, 0, moved);
            return { openTabs: tabs };
        });
    },

    getActiveTab: () => {
        const { openTabs, activeTabId } = get();
        return openTabs.find((t) => t.id === activeTabId);
    },
}));

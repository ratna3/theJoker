/**
 * useKeyboardShortcuts — Global keyboard shortcut registry
 */

import { useEffect } from 'react';
import { useEditorStore } from '../store';

export function useKeyboardShortcuts() {
    const { saveActiveFile, closeTab, activeTabId, openTabs, setActiveTab } = useEditorStore();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't intercept when focus is in terminal
            const target = e.target as HTMLElement;
            const isInTerminal = target.closest('.xterm');

            if (e.ctrlKey && e.key === 's' && !isInTerminal) {
                e.preventDefault();
                saveActiveFile();
            }

            if (e.ctrlKey && e.key === 'w' && !isInTerminal) {
                e.preventDefault();
                if (activeTabId) closeTab(activeTabId);
            }

            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                if (openTabs.length < 2) return;
                const currentIdx = openTabs.findIndex(t => t.id === activeTabId);
                const nextIdx = e.shiftKey
                    ? (currentIdx - 1 + openTabs.length) % openTabs.length
                    : (currentIdx + 1) % openTabs.length;
                setActiveTab(openTabs[nextIdx].id);
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [saveActiveFile, closeTab, activeTabId, openTabs, setActiveTab]);
}

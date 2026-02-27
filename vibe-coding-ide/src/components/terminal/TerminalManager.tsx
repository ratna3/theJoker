/**
 * TerminalManager — Hook for managing terminal operations
 */

import { useTerminalStore } from '../../store';

export function useTerminalManager() {
    const store = useTerminalStore();

    const writeToTerminal = (id: string, text: string) => {
        window.electronAPI?.terminal?.write(id, text);
    };

    const createAndFocus = async (cwd?: string) => {
        const homeDir = cwd || await window.electronAPI?.system?.getHomeDir() || '';
        return store.createSession(homeDir);
    };

    return {
        ...store,
        writeToTerminal,
        createAndFocus,
    };
}

// Also export as a component for compatibility
export const TerminalManager: React.FC = () => null;

import React from 'react';

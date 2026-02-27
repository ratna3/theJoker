/**
 * Zustand Store — Terminal Sessions
 */

import { create } from 'zustand';
import type { TerminalSession } from '../types';

interface TerminalState {
    sessions: TerminalSession[];
    activeSessionId: string | null;
    createSession: (cwd?: string) => string;
    destroySession: (id: string) => void;
    setActiveSession: (id: string) => void;
    getSession: (id: string) => TerminalSession | undefined;
    renameSession: (id: string, name: string) => void;
}

let sessionCounter = 0;

export const useTerminalStore = create<TerminalState>((set, get) => ({
    sessions: [],
    activeSessionId: null,

    createSession: (cwd) => {
        sessionCounter++;
        const id = `terminal-${Date.now()}-${sessionCounter}`;
        const session: TerminalSession = {
            id,
            name: `Terminal ${sessionCounter}`,
            cwd: cwd || '',
            isActive: true,
            createdAt: Date.now(),
        };
        set((state) => ({
            sessions: [...state.sessions, session],
            activeSessionId: id,
        }));
        return id;
    },

    destroySession: (id) => {
        set((state) => {
            const remaining = state.sessions.filter((s) => s.id !== id);
            const newActive = state.activeSessionId === id
                ? remaining[remaining.length - 1]?.id || null
                : state.activeSessionId;
            return { sessions: remaining, activeSessionId: newActive };
        });
    },

    setActiveSession: (id) => set({ activeSessionId: id }),

    getSession: (id) => get().sessions.find((s) => s.id === id),

    renameSession: (id, name) => {
        set((state) => ({
            sessions: state.sessions.map((s) =>
                s.id === id ? { ...s, name } : s
            ),
        }));
    },
}));

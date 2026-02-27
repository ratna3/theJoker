/**
 * TerminalPanel — Container for terminal tabs
 */

import React, { useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { TerminalTab } from './TerminalTab';
import { useTerminalStore } from '../../store';

export const TerminalPanel: React.FC = () => {
    const { sessions, activeSessionId, createSession, destroySession, setActiveSession } = useTerminalStore();

    const handleNewTerminal = useCallback(async () => {
        const homeDir = await window.electronAPI?.system?.getHomeDir() || '';
        createSession(homeDir);
    }, [createSession]);

    const handleCloseTerminal = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        window.electronAPI?.terminal?.destroy(id);
        destroySession(id);
    }, [destroySession]);

    // Auto-create first terminal
    React.useEffect(() => {
        if (sessions.length === 0) {
            handleNewTerminal();
        }
    }, []);

    return (
        <div className="h-full flex flex-col bg-app-bg border-t border-app-border">
            {/* Tab Bar */}
            <div className="flex items-center h-[32px] bg-app-sidebar border-b border-app-border px-1 gap-0.5 flex-shrink-0">
                <span className="text-[11px] text-app-textMuted font-semibold tracking-wider uppercase px-2 flex-shrink-0">
                    Terminal
                </span>
                <div className="flex-1 flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
                    {sessions.map((session) => (
                        <button
                            key={session.id}
                            onClick={() => setActiveSession(session.id)}
                            className={`
                flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all flex-shrink-0
                ${session.id === activeSessionId
                                    ? 'bg-app-bg text-app-text border-b-2 border-app-accent'
                                    : 'text-app-textMuted hover:text-app-text hover:bg-white/5'
                                }
              `}
                        >
                            <span className="truncate max-w-[100px]">{session.name}</span>
                            <span
                                onClick={(e) => handleCloseTerminal(session.id, e)}
                                className="opacity-50 hover:opacity-100 hover:text-app-error transition-opacity"
                            >
                                <X size={12} />
                            </span>
                        </button>
                    ))}
                </div>
                <button
                    onClick={handleNewTerminal}
                    className="p-1 rounded hover:bg-white/10 text-app-textMuted hover:text-app-text transition-colors flex-shrink-0"
                    title="New Terminal"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Active Terminal */}
            <div className="flex-1 relative overflow-hidden">
                {sessions.map((session) => (
                    <div
                        key={session.id}
                        className={`absolute inset-0 ${session.id === activeSessionId ? 'block' : 'hidden'}`}
                    >
                        <TerminalTab sessionId={session.id} />
                    </div>
                ))}
            </div>
        </div>
    );
};

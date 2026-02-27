/**
 * AppShell — Root layout with resizable panels
 * CSS Grid: MenuBar | (Sidebar | Editor+Terminal | ChatPanel) | StatusBar
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ResizableDivider } from '../shared/ResizableDivider';
import { EditorPanel } from '../editor/EditorPanel';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { useFileStore } from '../../store';

const STORAGE_KEY = 'vibe-panel-sizes';

function loadSizes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveSizes(sizes: any) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
}

export const AppShell: React.FC = () => {
    const saved = loadSizes();
    const [sidebarWidth, setSidebarWidth] = useState(saved?.sidebarWidth ?? 240);
    const [chatWidth, setChatWidth] = useState(saved?.chatWidth ?? 360);
    const [terminalHeight, setTerminalHeight] = useState(saved?.terminalHeight ?? 280);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showChat, setShowChat] = useState(true);
    const [showTerminal, setShowTerminal] = useState(true);

    // Listen for file change events
    useEffect(() => {
        const cleanup = window.electronAPI?.fs?.onFileChange?.((event) => {
            useFileStore.getState().handleFileChange(event);
        });
        return () => cleanup?.();
    }, []);

    // Listen for menu events
    useEffect(() => {
        const cleanups = [
            window.electronAPI?.onMenuEvent?.('toggle-sidebar', () => setShowSidebar(p => !p)),
            window.electronAPI?.onMenuEvent?.('toggle-terminal', () => setShowTerminal(p => !p)),
            window.electronAPI?.onMenuEvent?.('toggle-chat', () => setShowChat(p => !p)),
            window.electronAPI?.onMenuEvent?.('folder-opened', () => { }),
        ];
        return () => cleanups.forEach(c => c?.());
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'b') { e.preventDefault(); setShowSidebar(p => !p); }
            if (e.ctrlKey && e.key === 'j') { e.preventDefault(); setShowChat(p => !p); }
            if (e.ctrlKey && e.key === '`') { e.preventDefault(); setShowTerminal(p => !p); }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                // Save handled by editor store
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Persist sizes
    useEffect(() => {
        saveSizes({ sidebarWidth, chatWidth, terminalHeight });
    }, [sidebarWidth, chatWidth, terminalHeight]);

    const handleSidebarResize = useCallback((delta: number) => {
        setSidebarWidth(w => Math.max(150, Math.min(400, w + delta)));
    }, []);

    const handleChatResize = useCallback((delta: number) => {
        setChatWidth(w => Math.max(280, Math.min(500, w - delta)));
    }, []);

    const handleTerminalResize = useCallback((delta: number) => {
        setTerminalHeight(h => Math.max(120, Math.min(window.innerHeight * 0.6, h - delta)));
    }, []);

    return (
        <div className="h-screen w-screen flex flex-col bg-app-bg overflow-hidden select-none">
            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                {showSidebar && (
                    <>
                        <div style={{ width: sidebarWidth }} className="flex-shrink-0 h-full overflow-hidden">
                            <Sidebar />
                        </div>
                        <ResizableDivider direction="horizontal" onResize={handleSidebarResize} />
                    </>
                )}

                {/* Center: Editor + Terminal */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Editor */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <EditorPanel />
                    </div>

                    {/* Terminal */}
                    {showTerminal && (
                        <>
                            <ResizableDivider direction="vertical" onResize={handleTerminalResize} />
                            <div style={{ height: terminalHeight }} className="flex-shrink-0 overflow-hidden">
                                <TerminalPanel />
                            </div>
                        </>
                    )}
                </div>

                {/* Chat Panel */}
                {showChat && (
                    <>
                        <ResizableDivider direction="horizontal" onResize={handleChatResize} />
                        <div style={{ width: chatWidth }} className="flex-shrink-0 h-full overflow-hidden">
                            <ChatPanel />
                        </div>
                    </>
                )}
            </div>

            {/* Status Bar */}
            <StatusBar
                showSidebar={showSidebar}
                showTerminal={showTerminal}
                showChat={showChat}
                onToggleSidebar={() => setShowSidebar(p => !p)}
                onToggleTerminal={() => setShowTerminal(p => !p)}
                onToggleChat={() => setShowChat(p => !p)}
            />
        </div>
    );
};

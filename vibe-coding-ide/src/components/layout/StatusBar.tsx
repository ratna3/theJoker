/**
 * StatusBar — Bottom status bar with connection info, file details, and panel toggles
 */

import React, { useState, useEffect } from 'react';
import { Circle, GitBranch, ToggleLeft, ToggleRight } from 'lucide-react';
import { useSettingsStore, useEditorStore } from '../../store';

interface Props {
    showSidebar: boolean;
    showTerminal: boolean;
    showChat: boolean;
    onToggleSidebar: () => void;
    onToggleTerminal: () => void;
    onToggleChat: () => void;
}

export const StatusBar: React.FC<Props> = ({
    showSidebar, showTerminal, showChat,
    onToggleSidebar, onToggleTerminal, onToggleChat,
}) => {
    const { lmStudioUrl, selectedModel } = useSettingsStore();
    const activeTab = useEditorStore((s) => {
        const tab = s.openTabs.find(t => t.id === s.activeTabId);
        return tab;
    });
    const [connected, setConnected] = useState(false);

    // Poll LM Studio connection
    useEffect(() => {
        const check = async () => {
            try {
                const result = await window.electronAPI?.system?.testLMConnection(lmStudioUrl);
                setConnected(result?.connected ?? false);
            } catch {
                setConnected(false);
            }
        };
        check();
        const interval = setInterval(check, 10000);
        return () => clearInterval(interval);
    }, [lmStudioUrl]);

    return (
        <div className="h-[24px] flex items-center justify-between px-3 bg-app-sidebar border-t border-app-border text-[11px] select-none">
            {/* Left */}
            <div className="flex items-center gap-3">
                {/* AI Status */}
                <div className="flex items-center gap-1.5 cursor-pointer hover:text-app-text transition-colors">
                    <Circle
                        size={8}
                        fill={connected ? '#10b981' : '#ef4444'}
                        stroke="none"
                    />
                    <span className="text-app-textMuted">
                        {connected ? (selectedModel || 'LM Studio') : 'Disconnected'}
                    </span>
                </div>

                {/* Git Branch */}
                <div className="flex items-center gap-1 text-app-textMuted">
                    <GitBranch size={12} />
                    <span>main</span>
                </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-3 text-app-textMuted">
                {/* Active file info */}
                {activeTab && (
                    <>
                        <span>{activeTab.language}</span>
                        <span>UTF-8</span>
                    </>
                )}

                {/* Panel toggles */}
                <button
                    onClick={onToggleSidebar}
                    className="hover:text-app-text transition-colors"
                    title="Toggle Sidebar (Ctrl+B)"
                >
                    {showSidebar ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                </button>
                <button
                    onClick={onToggleTerminal}
                    className="hover:text-app-text transition-colors"
                    title="Toggle Terminal (Ctrl+`)"
                >
                    Terminal
                </button>
                <button
                    onClick={onToggleChat}
                    className="hover:text-app-text transition-colors"
                    title="Toggle Chat (Ctrl+J)"
                >
                    Chat
                </button>
            </div>
        </div>
    );
};

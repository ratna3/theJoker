/**
 * EditorPanel — Main editor area with tab bar and Monaco editor
 */

import React from 'react';
import { EditorTab } from './EditorTab';
import { MonacoEditor } from './MonacoEditor';
import { useEditorStore, useFileStore } from '../../store';
import { FolderOpen } from 'lucide-react';

export const EditorPanel: React.FC = () => {
    const { openTabs, activeTabId, closeTab, setActiveTab } = useEditorStore();
    const { openFolder } = useFileStore();
    const activeTab = openTabs.find((t) => t.id === activeTabId);

    const handleOpenFolder = async () => {
        const path = await window.electronAPI?.dialog?.openFolder();
        if (path) openFolder(path);
    };

    // Welcome Screen
    if (openTabs.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-app-bg gap-6 select-none">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-24 h-24 rounded-2xl flex items-center justify-center animate-pulse-glow">
                        <img src="./theJoker.png" alt="The Joker" className="w-20 h-20 object-contain drop-shadow-lg" />
                    </div>
                    <h1 className="text-3xl font-bold gradient-text">The Joker — ENDj0K3R</h1>
                    <p className="text-app-textMuted text-sm">AI-powered desktop IDE • Powered by LM Studio</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleOpenFolder}
                        className="flex items-center gap-2 px-5 py-2.5 bg-app-panel border border-app-border rounded-lg text-[13px] text-app-text hover:bg-app-accent/10 hover:border-app-accent/50 transition-all"
                    >
                        <FolderOpen size={16} />
                        Open Folder
                    </button>
                </div>

                <div className="mt-6 text-[12px] text-app-textMuted/60 space-y-1 text-center">
                    <p><kbd className="px-1.5 py-0.5 bg-app-panel rounded text-[10px] border border-app-border">Ctrl+O</kbd> Open Folder</p>
                    <p><kbd className="px-1.5 py-0.5 bg-app-panel rounded text-[10px] border border-app-border">Ctrl+B</kbd> Toggle Sidebar</p>
                    <p><kbd className="px-1.5 py-0.5 bg-app-panel rounded text-[10px] border border-app-border">Ctrl+`</kbd> Toggle Terminal</p>
                    <p><kbd className="px-1.5 py-0.5 bg-app-panel rounded text-[10px] border border-app-border">Ctrl+J</kbd> Toggle Chat</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-app-bg">
            {/* Tab Bar */}
            <div className="flex-shrink-0 flex items-center h-[35px] bg-app-sidebar border-b border-app-border overflow-x-auto scrollbar-hide">
                {openTabs.map((tab) => (
                    <EditorTab
                        key={tab.id}
                        tab={tab}
                        isActive={tab.id === activeTabId}
                        onClick={() => setActiveTab(tab.id)}
                        onClose={() => closeTab(tab.id)}
                    />
                ))}
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0">
                {activeTab && (
                    <MonacoEditor
                        key={activeTab.id}
                        filePath={activeTab.filePath}
                        language={activeTab.language}
                        content={activeTab.content}
                        tabId={activeTab.id}
                    />
                )}
            </div>
        </div>
    );
};

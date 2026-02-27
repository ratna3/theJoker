/**
 * FileExplorer — Container with header, search, and file tree
 */

import React, { useCallback } from 'react';
import { FilePlus, FolderPlus, RefreshCw, FolderOpen, Search } from 'lucide-react';
import { FileTree } from './FileTree';
import { useFileStore } from '../../store';

export const FileExplorer: React.FC = () => {
    const { rootPath, rootTree, searchQuery, setSearchQuery, refreshTree, openFolder } = useFileStore();

    const handleOpenFolder = useCallback(async () => {
        const path = await window.electronAPI?.dialog?.openFolder();
        if (path) openFolder(path);
    }, [openFolder]);

    const handleNewFile = useCallback(async () => {
        if (!rootPath) return;
        const name = prompt('New file name:');
        if (name) {
            await window.electronAPI.fs.createItem(rootPath, name, 'file');
            refreshTree();
        }
    }, [rootPath, refreshTree]);

    const handleNewFolder = useCallback(async () => {
        if (!rootPath) return;
        const name = prompt('New folder name:');
        if (name) {
            await window.electronAPI.fs.createItem(rootPath, name, 'directory');
            refreshTree();
        }
    }, [rootPath, refreshTree]);

    const folderName = rootPath?.split(/[/\\]/).pop() || '';

    return (
        <div className="h-full flex flex-col bg-app-sidebar">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-app-border">
                <span className="text-[11px] font-semibold tracking-wider text-app-textMuted uppercase">
                    Explorer
                </span>
                <div className="flex items-center gap-1">
                    <button onClick={handleNewFile} className="p-1 rounded hover:bg-white/10 text-app-textMuted hover:text-app-text transition-colors" title="New File">
                        <FilePlus size={14} />
                    </button>
                    <button onClick={handleNewFolder} className="p-1 rounded hover:bg-white/10 text-app-textMuted hover:text-app-text transition-colors" title="New Folder">
                        <FolderPlus size={14} />
                    </button>
                    <button onClick={refreshTree} className="p-1 rounded hover:bg-white/10 text-app-textMuted hover:text-app-text transition-colors" title="Refresh">
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Root folder name */}
            {rootPath && (
                <div className="px-3 py-1.5 text-[12px] font-medium text-app-text border-b border-app-border/50 truncate">
                    {folderName}
                </div>
            )}

            {/* Search */}
            {rootPath && (
                <div className="px-2 py-1.5">
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-textMuted" />
                        <input
                            type="text"
                            placeholder="Filter files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-app-bg border border-app-border rounded px-2 py-1 pl-7 text-[12px] text-app-text placeholder:text-app-textMuted focus:outline-none focus:border-app-accent transition-colors"
                        />
                    </div>
                </div>
            )}

            {/* File Tree or Empty State */}
            <div className="flex-1 overflow-auto">
                {rootPath ? (
                    <FileTree nodes={rootTree} depth={0} searchQuery={searchQuery} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
                        <FolderOpen size={40} className="text-app-textMuted/50" />
                        <p className="text-[13px] text-app-textMuted">No folder open</p>
                        <button
                            onClick={handleOpenFolder}
                            className="px-4 py-1.5 bg-app-accent hover:bg-app-accentHover text-white text-[12px] rounded transition-colors"
                        >
                            Open Folder
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

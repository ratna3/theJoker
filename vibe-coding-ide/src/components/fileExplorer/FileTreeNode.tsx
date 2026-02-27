/**
 * FileTreeNode — Individual file/folder node in the tree
 */

import React, { useState, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, Trash2, Pencil } from 'lucide-react';
import { FileIcon } from '../shared/FileIcon';
import { FileTree } from './FileTree';
import { FileContextMenu } from './FileContextMenu';
import { useFileStore, useEditorStore } from '../../store';
import type { FileNode } from '../../types';

interface Props {
    node: FileNode;
    depth: number;
    index: number;
    searchQuery?: string;
}

export const FileTreeNode: React.FC<Props> = ({ node, depth, index, searchQuery }) => {
    const { expandedPaths, toggleExpand, selectedPath, selectFile, updateChildren, refreshTree } = useFileStore();
    const { openFile } = useEditorStore();
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [showActions, setShowActions] = useState(false);
    const nodeRef = useRef<HTMLDivElement>(null);

    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;
    const isDirectory = node.type === 'directory';

    const handleClick = useCallback(async () => {
        selectFile(node.path);
        if (isDirectory) {
            toggleExpand(node.path);
            // Lazy-load children if not loaded
            if (!isExpanded && (!node.children || node.children.length === 0)) {
                try {
                    const children = await window.electronAPI.fs.readDir(node.path);
                    updateChildren(node.path, children);
                } catch (err) {
                    console.error('Failed to load children:', err);
                }
            }
        } else {
            openFile(node.path);
        }
    }, [node.path, isDirectory, isExpanded, node.children, selectFile, toggleExpand, updateChildren, openFile]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    }, []);

    const handleDelete = useCallback(async () => {
        if (confirm(`Delete "${node.name}"?`)) {
            await window.electronAPI.fs.deleteItem(node.path);
            refreshTree();
        }
    }, [node.name, node.path, refreshTree]);

    const handleRename = useCallback(async () => {
        const newName = prompt('Rename to:', node.name);
        if (newName && newName !== node.name) {
            const parentPath = node.path.substring(0, node.path.lastIndexOf(node.name.length > 0 ? node.name : ''));
            const newPath = parentPath + newName;
            await window.electronAPI.fs.rename(node.path, newPath);
            refreshTree();
        }
    }, [node.name, node.path, refreshTree]);

    // Git status coloring
    const gitColor = node.gitStatus === 'modified' ? 'text-app-warning' :
        node.gitStatus === 'untracked' ? 'text-app-success' :
            node.gitStatus === 'deleted' ? 'text-app-error line-through' : '';

    return (
        <>
            <div
                ref={nodeRef}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
                className={`
          file-tree-node flex items-center gap-1 px-2 py-[3px] cursor-pointer
          animate-fade-slide-in
          ${isSelected ? 'selected' : ''}
        `}
                style={{
                    paddingLeft: `${depth * 12 + 8}px`,
                    animationDelay: `${index * 20}ms`,
                }}
            >
                {/* Expand/Collapse Icon */}
                {isDirectory ? (
                    <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-app-textMuted">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                ) : (
                    <span className="w-4 flex-shrink-0" />
                )}

                {/* File Icon */}
                <FileIcon name={node.name} isDirectory={isDirectory} isExpanded={isExpanded} size={15} />

                {/* Name */}
                <span className={`text-[13px] truncate flex-1 ${gitColor || 'text-app-text'}`}>
                    {node.name}
                </span>

                {/* Hover Actions */}
                {showActions && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleRename(); }}
                            className="p-0.5 rounded hover:bg-white/10 text-app-textMuted hover:text-app-text"
                        >
                            <Pencil size={12} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            className="p-0.5 rounded hover:bg-white/10 text-app-textMuted hover:text-app-error"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>

            {/* Children */}
            {isDirectory && isExpanded && node.children && (
                <FileTree nodes={node.children} depth={depth + 1} searchQuery={searchQuery} />
            )}

            {/* Context Menu */}
            {contextMenu && (
                <FileContextMenu
                    node={node}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onRename={handleRename}
                    onDelete={handleDelete}
                />
            )}
        </>
    );
};

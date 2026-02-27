/**
 * FileContextMenu — Right-click context menu for files/folders
 */

import React, { useEffect, useRef } from 'react';
import { FilePlus, FolderPlus, Pencil, Trash2, Copy, Terminal, ExternalLink } from 'lucide-react';
import { useFileStore } from '../../store';
import type { FileNode } from '../../types';

interface Props {
    node: FileNode;
    x: number;
    y: number;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
}

export const FileContextMenu: React.FC<Props> = ({ node, x, y, onClose, onRename, onDelete }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const { refreshTree } = useFileStore();

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    // Adjust position to stay in viewport
    const adjustedX = Math.min(x, window.innerWidth - 200);
    const adjustedY = Math.min(y, window.innerHeight - 300);

    const handleNewFile = async () => {
        const parentPath = node.type === 'directory' ? node.path : node.path.substring(0, node.path.lastIndexOf('/') + 1) || node.path.substring(0, node.path.lastIndexOf('\\') + 1);
        const name = prompt('New file name:');
        if (name) {
            await window.electronAPI.fs.createItem(parentPath, name, 'file');
            refreshTree();
        }
        onClose();
    };

    const handleNewFolder = async () => {
        const parentPath = node.type === 'directory' ? node.path : node.path.substring(0, node.path.lastIndexOf('/') + 1) || node.path.substring(0, node.path.lastIndexOf('\\') + 1);
        const name = prompt('New folder name:');
        if (name) {
            await window.electronAPI.fs.createItem(parentPath, name, 'directory');
            refreshTree();
        }
        onClose();
    };

    const handleCopyPath = () => {
        navigator.clipboard.writeText(node.path);
        onClose();
    };

    const items = [
        { icon: FilePlus, label: 'New File', action: handleNewFile },
        { icon: FolderPlus, label: 'New Folder', action: handleNewFolder },
        { divider: true },
        { icon: Pencil, label: 'Rename', shortcut: 'F2', action: () => { onRename(); onClose(); } },
        { icon: Trash2, label: 'Delete', shortcut: 'Del', action: () => { onDelete(); onClose(); }, danger: true },
        { divider: true },
        { icon: Copy, label: 'Copy Path', action: handleCopyPath },
    ] as const;

    return (
        <div
            ref={menuRef}
            className="context-menu fixed z-50 min-w-[180px] bg-app-panel border border-app-border rounded-lg shadow-xl py-1 overflow-hidden"
            style={{ left: adjustedX, top: adjustedY }}
        >
            {items.map((item, i) => {
                if ('divider' in item) {
                    return <div key={i} className="my-1 border-t border-app-border" />;
                }
                const Icon = item.icon;
                return (
                    <button
                        key={i}
                        onClick={item.action}
                        className={`
              w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors
              ${'danger' in item && item.danger
                                ? 'text-app-error hover:bg-app-error/10'
                                : 'text-app-text hover:bg-white/5'
                            }
            `}
                    >
                        <Icon size={14} className="flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {'shortcut' in item && item.shortcut && (
                            <span className="text-[10px] text-app-textMuted">{item.shortcut}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

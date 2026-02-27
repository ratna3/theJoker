/**
 * EditorTab — Individual tab pill component
 */

import React from 'react';
import { X } from 'lucide-react';
import { FileIcon } from '../shared/FileIcon';
import type { EditorTab as EditorTabType } from '../../types';

interface Props {
    tab: EditorTabType;
    isActive: boolean;
    onClick: () => void;
    onClose: () => void;
}

export const EditorTab: React.FC<Props> = ({ tab, isActive, onClick, onClose }) => {
    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    const handleMiddleClick = (e: React.MouseEvent) => {
        if (e.button === 1) {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div
            onClick={onClick}
            onMouseDown={handleMiddleClick}
            className={`
        editor-tab group flex items-center gap-1.5 px-3 h-full cursor-pointer border-r border-app-border/50
        min-w-[100px] max-w-[180px] flex-shrink-0 select-none
        ${isActive
                    ? 'active bg-app-bg text-app-text'
                    : 'bg-app-sidebar text-app-textMuted hover:text-app-text hover:bg-app-panel/50'
                }
      `}
        >
            {/* Modified Indicator */}
            {tab.isModified && (
                <div className="w-2 h-2 rounded-full bg-app-accent flex-shrink-0" />
            )}

            {/* File Icon */}
            <FileIcon name={tab.fileName} size={14} />

            {/* File Name */}
            <span className="text-[12px] truncate flex-1">{tab.fileName}</span>

            {/* Close Button */}
            <button
                onClick={handleClose}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-app-textMuted hover:text-app-text transition-all flex-shrink-0"
            >
                <X size={12} />
            </button>
        </div>
    );
};

/**
 * FileIcon — Maps file extensions to colored Lucide icons
 */

import React from 'react';
import {
    FileText, FileCode, FileJson, FileImage,
    Folder, FolderOpen, File, Lock, Palette,
    FileType, Code2, Braces, Hash, Terminal,
    Globe, Settings, Database
} from 'lucide-react';

interface Props {
    name: string;
    isDirectory?: boolean;
    isExpanded?: boolean;
    size?: number;
}

const ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
    '.ts': { icon: FileCode, color: '#3b82f6' },
    '.tsx': { icon: FileCode, color: '#3b82f6' },
    '.js': { icon: FileCode, color: '#f59e0b' },
    '.jsx': { icon: FileCode, color: '#f59e0b' },
    '.json': { icon: Braces, color: '#10b981' },
    '.css': { icon: Palette, color: '#a855f7' },
    '.scss': { icon: Palette, color: '#ec4899' },
    '.less': { icon: Palette, color: '#6366f1' },
    '.html': { icon: Globe, color: '#f97316' },
    '.md': { icon: FileText, color: '#64748b' },
    '.mdx': { icon: FileText, color: '#64748b' },
    '.txt': { icon: FileText, color: '#64748b' },
    '.png': { icon: FileImage, color: '#14b8a6' },
    '.jpg': { icon: FileImage, color: '#14b8a6' },
    '.jpeg': { icon: FileImage, color: '#14b8a6' },
    '.gif': { icon: FileImage, color: '#14b8a6' },
    '.svg': { icon: FileImage, color: '#14b8a6' },
    '.webp': { icon: FileImage, color: '#14b8a6' },
    '.ico': { icon: FileImage, color: '#14b8a6' },
    '.env': { icon: Lock, color: '#ef4444' },
    '.env.local': { icon: Lock, color: '#ef4444' },
    '.gitignore': { icon: Settings, color: '#64748b' },
    '.py': { icon: FileCode, color: '#3b82f6' },
    '.rs': { icon: FileCode, color: '#f97316' },
    '.go': { icon: FileCode, color: '#06b6d4' },
    '.java': { icon: FileCode, color: '#ef4444' },
    '.sql': { icon: Database, color: '#f59e0b' },
    '.sh': { icon: Terminal, color: '#10b981' },
    '.bash': { icon: Terminal, color: '#10b981' },
    '.yml': { icon: Settings, color: '#ef4444' },
    '.yaml': { icon: Settings, color: '#ef4444' },
    '.toml': { icon: Settings, color: '#f59e0b' },
    '.xml': { icon: Code2, color: '#f97316' },
    '.graphql': { icon: Hash, color: '#ec4899' },
    '.prisma': { icon: Database, color: '#6366f1' },
    '.lock': { icon: Lock, color: '#64748b' },
};

const FILENAME_MAP: Record<string, { icon: React.ElementType; color: string }> = {
    'Dockerfile': { icon: FileCode, color: '#06b6d4' },
    'docker-compose.yml': { icon: FileCode, color: '#06b6d4' },
    'package.json': { icon: Braces, color: '#10b981' },
    'tsconfig.json': { icon: Settings, color: '#3b82f6' },
    '.eslintrc': { icon: Settings, color: '#6366f1' },
    '.prettierrc': { icon: Settings, color: '#ec4899' },
    'README.md': { icon: FileType, color: '#3b82f6' },
};

export const FileIcon: React.FC<Props> = ({ name, isDirectory, isExpanded, size = 16 }) => {
    if (isDirectory) {
        const Icon = isExpanded ? FolderOpen : Folder;
        return <Icon size={size} style={{ color: '#f59e0b' }} className="flex-shrink-0" />;
    }

    // Check exact filename first
    const filenameMatch = FILENAME_MAP[name];
    if (filenameMatch) {
        const Icon = filenameMatch.icon;
        return <Icon size={size} style={{ color: filenameMatch.color }} className="flex-shrink-0" />;
    }

    // Check extension
    const ext = '.' + name.split('.').pop()?.toLowerCase();
    const match = ICON_MAP[ext];
    if (match) {
        const Icon = match.icon;
        return <Icon size={size} style={{ color: match.color }} className="flex-shrink-0" />;
    }

    return <File size={size} style={{ color: '#64748b' }} className="flex-shrink-0" />;
};

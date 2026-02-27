/**
 * FileTree — Recursive file tree renderer
 */

import React from 'react';
import { FileTreeNode } from './FileTreeNode';
import type { FileNode } from '../../types';

interface Props {
    nodes: FileNode[];
    depth: number;
    searchQuery?: string;
}

function filterNodes(nodes: FileNode[], query: string): FileNode[] {
    if (!query) return nodes;
    const lower = query.toLowerCase();
    return nodes.reduce<FileNode[]>((acc, node) => {
        if (node.name.toLowerCase().includes(lower)) {
            acc.push(node);
        } else if (node.type === 'directory' && node.children) {
            const filtered = filterNodes(node.children, query);
            if (filtered.length > 0) {
                acc.push({ ...node, children: filtered });
            }
        }
        return acc;
    }, []);
}

export const FileTree: React.FC<Props> = ({ nodes, depth, searchQuery }) => {
    const filtered = searchQuery ? filterNodes(nodes, searchQuery) : nodes;

    if (filtered.length === 0) {
        if (depth === 0 && searchQuery) {
            return (
                <div className="px-4 py-3 text-[12px] text-app-textMuted italic">
                    No files match "{searchQuery}"
                </div>
            );
        }
        return null;
    }

    return (
        <div className="relative">
            {filtered.map((node, index) => (
                <FileTreeNode
                    key={node.path}
                    node={node}
                    depth={depth}
                    index={index}
                    searchQuery={searchQuery}
                />
            ))}
        </div>
    );
};

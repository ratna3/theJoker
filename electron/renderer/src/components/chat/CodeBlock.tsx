/**
 * CodeBlock — Syntax-highlighted code block with copy/apply buttons
 */

import React, { useState } from 'react';
import { Copy, Check, FileCode, Play } from 'lucide-react';

interface Props {
    language: string;
    code: string;
    fileName?: string;
}

export const CodeBlock: React.FC<Props> = ({ language, code, fileName }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Extract filepath from comment
    const filepathMatch = code.match(/^\/\/\s*filepath:\s*(.+)/m);
    const displayName = fileName || filepathMatch?.[1]?.trim() || '';

    return (
        <div className="code-block my-2">
            {/* Header */}
            <div className="code-block-header">
                <div className="flex items-center gap-2">
                    <FileCode size={12} />
                    <span>{displayName || language}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:bg-white/10 transition-colors"
                    >
                        {copied ? (
                            <>
                                <Check size={12} className="text-app-success" />
                                <span className="text-app-success">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy size={12} />
                                <span>Copy</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Code Content */}
            <div className="code-block-content">
                <pre className="text-app-text">
                    <code>{code}</code>
                </pre>
            </div>
        </div>
    );
};

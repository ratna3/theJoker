/**
 * ENDj0K3R — Flag Display v2.0
 * Compact inline flag badge with copy-to-clipboard
 */

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface FlagDisplayProps {
    flag: string;
    context: string;
}

export const FlagDisplay: React.FC<FlagDisplayProps> = ({ flag, context }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(flag);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            onClick={handleCopy}
            title={`${context}\nClick to copy`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                maxWidth: '300px',
            }}
        >
            <span style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 600,
                color: '#22c55e',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {flag}
            </span>
            {copied
                ? <Check size={10} color="#22c55e" />
                : <Copy size={10} color="#22c55e" style={{ opacity: 0.5 }} />
            }
        </div>
    );
};

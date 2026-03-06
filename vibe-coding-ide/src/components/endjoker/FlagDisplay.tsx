/**
 * ENDj0K3R — Flag Detection Display
 * Shows captured flags in a dedicated section
 */

import React from 'react';
import { usePentestStore } from '../../store/pentestStore';
import { Flag, Copy, Check } from 'lucide-react';

export const FlagDisplay: React.FC = () => {
    const flagsFound = usePentestStore((s) => s.flagsFound);
    const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

    if (flagsFound.length === 0) return null;

    const handleCopy = (flag: string, idx: number) => {
        navigator.clipboard.writeText(flag);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    return (
        <div style={{
            padding: '8px 12px',
            borderTop: '1px solid rgba(34, 197, 94, 0.3)',
            backgroundColor: 'rgba(34, 197, 94, 0.05)',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px',
                color: '#22c55e',
                fontSize: '12px',
                fontWeight: 600,
            }}>
                <Flag size={14} />
                🚩 Flags Found ({flagsFound.length})
            </div>
            {flagsFound.map((f, idx) => (
                <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    marginBottom: '4px',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: '6px',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                }}>
                    <span style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#22c55e',
                        fontWeight: 600,
                        wordBreak: 'break-all',
                    }}>
                        {f.flag}
                    </span>
                    <button
                        onClick={() => handleCopy(f.flag, idx)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedIdx === idx ? '#22c55e' : '#6b7280',
                            padding: '4px',
                            flexShrink: 0,
                        }}
                        title="Copy flag"
                    >
                        {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
            ))}
        </div>
    );
};

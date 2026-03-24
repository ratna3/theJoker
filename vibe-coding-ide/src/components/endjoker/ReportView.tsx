/**
 * ENDj0K3R — Report Viewer
 * Displays the generated pentest report as rendered markdown
 */

import React from 'react';
import { usePentestStore } from '../../store/pentestStore';
import { FileText, Copy, Check, Download } from 'lucide-react';

export const ReportView: React.FC = () => {
    const reportContent = usePentestStore((s) => s.reportContent);
    const generateReport = usePentestStore((s) => s.generateReport);
    const agentState = usePentestStore((s) => s.agentState);
    const [copied, setCopied] = React.useState(false);

    if (!reportContent) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: '#525252',
                fontSize: '13px',
                gap: '12px',
            }}>
                <FileText size={24} />
                <span>No report generated yet</span>
                <button
                    onClick={generateReport}
                    disabled={agentState === 'idle'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: agentState !== 'idle' ? '#6366f1' : '#374151',
                        color: agentState !== 'idle' ? '#fff' : '#6b7280',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: agentState !== 'idle' ? 'pointer' : 'not-allowed',
                    }}
                >
                    <FileText size={14} />
                    Generate Report
                </button>
            </div>
        );
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(reportContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                gap: '6px',
                padding: '6px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <button
                    onClick={generateReport}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: '#6366f1',
                        fontSize: '11px',
                        cursor: 'pointer',
                    }}
                >
                    <FileText size={12} /> Regenerate
                </button>
                <button
                    onClick={handleCopy}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        backgroundColor: copied ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        color: copied ? '#22c55e' : '#a3a3a3',
                        fontSize: '11px',
                        cursor: 'pointer',
                    }}
                >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy Markdown'}
                </button>
            </div>

            {/* Report content */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#d4d4d4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {reportContent}
            </div>
        </div>
    );
};

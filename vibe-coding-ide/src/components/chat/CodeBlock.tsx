/**
 * CodeBlock — Syntax-highlighted code block with copy/apply/execute buttons
 */

import React, { useState } from 'react';
import { Copy, Check, FileCode, Play, FileEdit, Terminal, Loader2 } from 'lucide-react';
import { useFileStore, useEditorStore, useTerminalStore } from '../../store';

interface Props {
    language: string;
    code: string;
    fileName?: string;
}

export const CodeBlock: React.FC<Props> = ({ language, code, fileName }) => {
    const [copied, setCopied] = useState(false);
    const [applyStatus, setApplyStatus] = useState<'idle' | 'applying' | 'success' | 'error'>('idle');
    const [execStatus, setExecStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const rootPath = useFileStore((s) => s.rootPath);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Extract filepath from comment
    const filepathMatch = code.match(/^(?:\/\/|#|<!--)\s*filepath:\s*(.+?)(?:\s*-->)?$/m);
    const detectedPath = filepathMatch?.[1]?.trim() || '';
    const displayName = fileName || detectedPath || '';
    const isTerminalBlock = language === 'terminal' || language === 'cmd' || language === 'powershell';

    // Clean code content (remove filepath comment for display)
    const displayCode = detectedPath
        ? code.replace(/^(?:\/\/|#|<!--)\s*filepath:\s*.+?(?:\s*-->)?[\r\n]*/m, '').trim()
        : code;

    // Apply code to file
    const handleApply = async () => {
        if (!rootPath || !detectedPath) return;
        setApplyStatus('applying');
        setErrorMsg('');

        try {
            const result = await window.electronAPI.ai.applyFile(rootPath, detectedPath, displayCode);
            if (result.success) {
                setApplyStatus('success');
                // Refresh file tree
                useFileStore.getState().refreshTree();
                // Open the file in the editor
                if (result.resolvedPath) {
                    await useEditorStore.getState().openFile(result.resolvedPath);
                }
                setTimeout(() => setApplyStatus('idle'), 3000);
            } else {
                setApplyStatus('error');
                setErrorMsg(result.error || 'Failed to apply');
                setTimeout(() => setApplyStatus('idle'), 5000);
            }
        } catch (err: any) {
            setApplyStatus('error');
            setErrorMsg(err.message || 'Failed to apply');
            setTimeout(() => setApplyStatus('idle'), 5000);
        }
    };

    // Execute terminal command
    const handleExecute = async () => {
        const { sessions, activeSessionId } = useTerminalStore.getState();
        const terminalId = activeSessionId || sessions[0]?.id;
        if (!terminalId) {
            setErrorMsg('No active terminal session');
            setExecStatus('error');
            setTimeout(() => setExecStatus('idle'), 3000);
            return;
        }

        setExecStatus('executing');
        setErrorMsg('');

        try {
            // Execute each line as a command
            const lines = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
            for (const line of lines) {
                const cmd = line.replace(/^[$>]\s*/, '').trim();
                if (!cmd) continue;
                const result = await window.electronAPI.ai.runTerminal(terminalId, cmd);
                if (!result.success) {
                    setExecStatus('error');
                    setErrorMsg(result.error || 'Command failed');
                    setTimeout(() => setExecStatus('idle'), 5000);
                    return;
                }
                // Small delay between commands
                if (lines.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            setExecStatus('success');
            setTimeout(() => setExecStatus('idle'), 3000);
        } catch (err: any) {
            setExecStatus('error');
            setErrorMsg(err.message || 'Execution failed');
            setTimeout(() => setExecStatus('idle'), 5000);
        }
    };

    return (
        <div className="code-block my-2">
            {/* Header */}
            <div className="code-block-header">
                <div className="flex items-center gap-2">
                    {isTerminalBlock ? <Terminal size={12} /> : <FileCode size={12} />}
                    <span>{displayName || (isTerminalBlock ? 'Terminal' : language)}</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Apply to File button — only for code blocks with a detected filepath */}
                    {detectedPath && !isTerminalBlock && (
                        <button
                            onClick={handleApply}
                            disabled={applyStatus === 'applying' || !rootPath}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
                                applyStatus === 'success'
                                    ? 'text-app-success'
                                    : applyStatus === 'error'
                                    ? 'text-app-error'
                                    : 'hover:bg-white/10'
                            }`}
                            title={applyStatus === 'success' ? 'Applied!' : applyStatus === 'error' ? errorMsg : `Apply to ${detectedPath}`}
                        >
                            {applyStatus === 'applying' ? (
                                <><Loader2 size={12} className="animate-spin" /><span>Applying...</span></>
                            ) : applyStatus === 'success' ? (
                                <><Check size={12} /><span>Applied!</span></>
                            ) : applyStatus === 'error' ? (
                                <><span>Failed</span></>
                            ) : (
                                <><FileEdit size={12} /><span>Apply</span></>
                            )}
                        </button>
                    )}

                    {/* Execute button — only for terminal blocks */}
                    {isTerminalBlock && (
                        <button
                            onClick={handleExecute}
                            disabled={execStatus === 'executing'}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
                                execStatus === 'success'
                                    ? 'text-app-success'
                                    : execStatus === 'error'
                                    ? 'text-app-error'
                                    : 'hover:bg-white/10'
                            }`}
                            title={execStatus === 'success' ? 'Executed!' : execStatus === 'error' ? errorMsg : 'Execute in terminal'}
                        >
                            {execStatus === 'executing' ? (
                                <><Loader2 size={12} className="animate-spin" /><span>Running...</span></>
                            ) : execStatus === 'success' ? (
                                <><Check size={12} /><span>Done!</span></>
                            ) : execStatus === 'error' ? (
                                <><span>Failed</span></>
                            ) : (
                                <><Play size={12} /><span>Execute</span></>
                            )}
                        </button>
                    )}

                    {/* Copy button — always shown */}
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
                    <code>{displayCode}</code>
                </pre>
            </div>

            {/* Error display */}
            {errorMsg && (applyStatus === 'error' || execStatus === 'error') && (
                <div className="px-3 py-1 text-[11px] text-app-error bg-app-error/10 border-t border-app-error/20">
                    {errorMsg}
                </div>
            )}
        </div>
    );
};

/**
 * ENDj0K3R — Payload Generator
 * Interactive reverse/bind shell payload builder
 */

import React, { useState, useCallback } from 'react';
import { usePentestStore } from '../../store/pentestStore';
import { Zap, Copy, Check, Terminal } from 'lucide-react';

const LANGUAGES = [
    { value: 'bash', label: 'Bash' },
    { value: 'python3', label: 'Python 3' },
    { value: 'python', label: 'Python 2' },
    { value: 'php', label: 'PHP' },
    { value: 'perl', label: 'Perl' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'netcat', label: 'Netcat' },
    { value: 'powershell', label: 'PowerShell' },
    { value: 'java', label: 'Java' },
    { value: 'csharp', label: 'C#' },
];

const ENCODINGS = [
    { value: 'none', label: 'None' },
    { value: 'base64', label: 'Base64' },
    { value: 'url', label: 'URL Encode' },
    { value: 'hex', label: 'Hex' },
];

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: '#e5e5e5',
    fontSize: '12px',
    outline: 'none',
    fontFamily: 'monospace',
    boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#a3a3a3',
    marginBottom: '4px',
    fontWeight: 500,
    display: 'block',
};

export const PayloadGenerator: React.FC = () => {
    const generatePayload = usePentestStore((s) => s.generatePayload);
    const [type, setType] = useState<'reverse_shell' | 'bind_shell'>('reverse_shell');
    const [language, setLanguage] = useState('bash');
    const [lhost, setLhost] = useState('');
    const [lport, setLport] = useState('4444');
    const [encoding, setEncoding] = useState('none');
    const [payload, setPayload] = useState('');
    const [copied, setCopied] = useState(false);
    const [generating, setGenerating] = useState(false);

    const handleGenerate = useCallback(async () => {
        if (!lhost.trim() || !lport.trim()) return;
        setGenerating(true);
        try {
            const result = await generatePayload({
                type,
                language,
                lhost: lhost.trim(),
                lport: parseInt(lport) || 4444,
                encoding: encoding !== 'none' ? encoding : undefined,
            });
            setPayload(result);
        } catch {
            setPayload('Error generating payload');
        }
        setGenerating(false);
    }, [type, language, lhost, lport, encoding, generatePayload]);

    const handleCopy = () => {
        navigator.clipboard.writeText(payload);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
            {/* Type toggle */}
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Payload Type</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {(['reverse_shell', 'bind_shell'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setType(t)}
                            style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: '4px',
                                border: `1px solid ${type === t ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255,255,255,0.08)'}`,
                                backgroundColor: type === t ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                color: type === t ? '#818cf8' : '#6b7280',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            {t === 'reverse_shell' ? '← Reverse Shell' : '→ Bind Shell'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Language */}
            <div style={{ marginBottom: '10px' }}>
                <label style={labelStyle}>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle as any}>
                    {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                </select>
            </div>

            {/* LHOST / LPORT */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <div style={{ flex: 2 }}>
                    <label style={labelStyle}>{type === 'reverse_shell' ? 'LHOST (your IP)' : 'RHOST (target IP)'}</label>
                    <input
                        type="text"
                        value={lhost}
                        onChange={(e) => setLhost(e.target.value)}
                        placeholder="10.10.14.x"
                        style={inputStyle}
                    />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>PORT</label>
                    <input
                        type="text"
                        value={lport}
                        onChange={(e) => setLport(e.target.value)}
                        placeholder="4444"
                        style={inputStyle}
                    />
                </div>
            </div>

            {/* Encoding */}
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Encoding</label>
                <select value={encoding} onChange={(e) => setEncoding(e.target.value)} style={inputStyle as any}>
                    {ENCODINGS.map((e) => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                </select>
            </div>

            {/* Generate button */}
            <button
                onClick={handleGenerate}
                disabled={!lhost.trim() || generating}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: lhost.trim() && !generating ? 'pointer' : 'not-allowed',
                    backgroundColor: lhost.trim() && !generating ? '#6366f1' : '#374151',
                    color: lhost.trim() && !generating ? '#fff' : '#6b7280',
                    transition: 'all 0.2s',
                    marginBottom: '12px',
                }}
            >
                <Zap size={14} />
                {generating ? 'Generating...' : 'Generate Payload'}
            </button>

            {/* Payload output */}
            {payload && (
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                    }}>
                        <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 500 }}>Generated Payload:</span>
                        <button
                            onClick={handleCopy}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                backgroundColor: copied ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                color: copied ? '#22c55e' : '#a3a3a3',
                                fontSize: '10px',
                                cursor: 'pointer',
                            }}
                        >
                            {copied ? <Check size={10} /> : <Copy size={10} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <div style={{
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        lineHeight: '1.5',
                        color: '#22c55e',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}>
                        {payload}
                    </div>

                    {/* Listener command */}
                    {type === 'reverse_shell' && (
                        <div style={{ marginTop: '8px' }}>
                            <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                                <Terminal size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                                Start listener:
                            </span>
                            <div style={{
                                padding: '6px 10px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                color: '#f59e0b',
                            }}>
                                nc -lvnp {lport || '4444'}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

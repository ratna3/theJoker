/**
 * ENDj0K3R — Main Pentest Panel
 * Target configuration, agent controls, activity feed, and session management
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePentestStore } from '../../store/pentestStore';
import { DisclaimerModal } from './DisclaimerModal';
import { PentestActivityFeed } from './ActivityFeed';
import { FlagDisplay } from './FlagDisplay';
import { SessionManager } from './SessionManager';
import {
    Skull, Play, Pause, Square, Send, Target, Crosshair,
    Zap, AlertTriangle
} from 'lucide-react';

const api = () => (window as any).electronAPI;

export const EndJokerPanel: React.FC = () => {
    const {
        agentState, disclaimerAccepted, acceptDisclaimer,
        target, setTarget, customInstruction, setCustomInstruction,
        addActivity, addFlag, setAgentState, startPentest,
        pausePentest, resumePentest, stopPentest, injectInstruction,
    } = usePentestStore();

    const [model, setModel] = useState('');
    const [models, setModels] = useState<string[]>([]);
    const [injectionText, setInjectionText] = useState('');
    const [showDisclaimer, setShowDisclaimer] = useState(!disclaimerAccepted);

    // Load models on mount
    useEffect(() => {
        api().system.getLMStudioModels('http://localhost:1234')
            .then((m: string[]) => setModels(m || []))
            .catch(() => { });
    }, []);

    // Subscribe to IPC events
    useEffect(() => {
        const cleanupActivity = api().pentest.onActivity((item: any) => {
            addActivity(item);
        });
        const cleanupState = api().pentest.onStateChange((state: string) => {
            setAgentState(state as any);
        });
        const cleanupFlag = api().pentest.onFlagFound((flag: any) => {
            addFlag(flag);
        });

        return () => {
            cleanupActivity();
            cleanupState();
            cleanupFlag();
        };
    }, []);

    // Show disclaimer if not accepted
    if (showDisclaimer || !disclaimerAccepted) {
        return (
            <DisclaimerModal
                onAccept={() => {
                    acceptDisclaimer();
                    setShowDisclaimer(false);
                }}
                onExit={() => {
                    setShowDisclaimer(true);
                }}
            />
        );
    }

    const handleStart = () => {
        if (!target.trim()) return;
        startPentest({
            target: target.trim(),
            customInstruction: customInstruction.trim() || undefined,
            model: model || undefined,
            baseUrl: 'http://localhost:1234',
        });
    };

    const handleInject = () => {
        if (!injectionText.trim()) return;
        injectInstruction(injectionText.trim());
        setInjectionText('');
    };

    const isRunning = agentState === 'running';
    const isPaused = agentState === 'paused';
    const isActive = isRunning || isPaused;

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0a0e0c',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid rgba(220, 38, 38, 0.2)',
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.08), rgba(99, 102, 241, 0.05))',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <Skull size={20} color="#ef4444" />
                    <span style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#ef4444',
                        letterSpacing: '1.5px',
                        fontFamily: 'monospace',
                    }}>
                        ENDj0K3R
                    </span>
                    <span style={{
                        fontSize: '10px',
                        color: '#6b7280',
                        marginLeft: 'auto',
                        textTransform: 'uppercase',
                    }}>
                        {agentState}
                    </span>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isRunning ? '#22c55e' :
                            isPaused ? '#f59e0b' :
                                agentState === 'completed' ? '#6366f1' :
                                    agentState === 'error' ? '#ef4444' : '#525252',
                        boxShadow: isRunning ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
                        animation: isRunning ? 'pulse 2s ease-in-out infinite' : 'none',
                    }} />
                </div>
            </div>

            {/* Target Config (only when idle) */}
            {!isActive && agentState !== 'completed' && (
                <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            color: '#a3a3a3',
                            marginBottom: '4px',
                            fontWeight: 500,
                        }}>
                            <Target size={12} /> Target
                        </label>
                        <input
                            type="text"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="IP, URL, or domain..."
                            style={{
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
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            color: '#a3a3a3',
                            marginBottom: '4px',
                            fontWeight: 500,
                        }}>
                            <Crosshair size={12} /> Instructions (optional)
                        </label>
                        <textarea
                            value={customInstruction}
                            onChange={(e) => setCustomInstruction(e.target.value)}
                            placeholder="Challenge context, hints, or specific instructions..."
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: '#e5e5e5',
                                fontSize: '12px',
                                outline: 'none',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {models.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                color: '#a3a3a3',
                                marginBottom: '4px',
                                fontWeight: 500,
                            }}>
                                <Zap size={12} /> Model
                            </label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                    color: '#e5e5e5',
                                    fontSize: '12px',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            >
                                <option value="">Auto-detect</option>
                                {models.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={handleStart}
                        disabled={!target.trim()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: target.trim() ? 'pointer' : 'not-allowed',
                            backgroundColor: target.trim() ? '#dc2626' : '#374151',
                            color: target.trim() ? '#fff' : '#6b7280',
                            transition: 'all 0.2s',
                        }}
                    >
                        <Play size={16} />
                        Start Pentest
                    </button>
                </div>
            )}

            {/* Agent Controls (when running/paused) */}
            {isActive && (
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <button
                        onClick={() => isPaused ? resumePentest() : pausePentest()}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: isPaused ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                            backgroundColor: isPaused ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: isPaused ? '#22c55e' : '#f59e0b',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        {isPaused ? <Play size={14} /> : <Pause size={14} />}
                        {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                        onClick={() => stopPentest()}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        <Square size={14} />
                        Stop
                    </button>
                </div>
            )}

            {/* Instruction Injection (when paused) */}
            {isPaused && (
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <input
                        type="text"
                        value={injectionText}
                        onChange={(e) => setInjectionText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInject()}
                        placeholder="Inject instruction..."
                        style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            color: '#e5e5e5',
                            fontSize: '12px',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleInject}
                        disabled={!injectionText.trim()}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: injectionText.trim() ? '#6366f1' : '#374151',
                            color: injectionText.trim() ? '#fff' : '#6b7280',
                            cursor: injectionText.trim() ? 'pointer' : 'not-allowed',
                        }}
                    >
                        <Send size={14} />
                    </button>
                </div>
            )}

            {/* Completed state — allow restart */}
            {agentState === 'completed' && (
                <div style={{
                    padding: '12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    textAlign: 'center',
                }}>
                    <div style={{
                        color: '#6366f1',
                        fontSize: '12px',
                        marginBottom: '8px',
                    }}>
                        ✅ Pentest session completed
                    </div>
                    <button
                        onClick={() => setAgentState('idle')}
                        style={{
                            padding: '8px 24px',
                            borderRadius: '6px',
                            border: '1px solid rgba(220, 38, 38, 0.3)',
                            backgroundColor: 'rgba(220, 38, 38, 0.1)',
                            color: '#ef4444',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        New Pentest
                    </button>
                </div>
            )}

            {/* Flag Display */}
            <FlagDisplay />

            {/* Activity Feed */}
            <PentestActivityFeed />

            {/* Session Manager */}
            <SessionManager />

            {/* CSS Animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

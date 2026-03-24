/**
 * ENDj0K3R — Main Control Panel v2.0
 * Tab-based interface: Activity | Knowledge Base | Report | Payload Generator
 * Execution mode toggle, streaming awareness, improved session management
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePentestStore, ExecutionMode } from '../../store/pentestStore';
import { DisclaimerModal } from './DisclaimerModal';
import { ActivityFeed } from './ActivityFeed';
import { FlagDisplay } from './FlagDisplay';
import { SessionManager } from './SessionManager';
import { KnowledgeBaseView } from './KnowledgeBaseView';
import { ReportView } from './ReportView';
import { PayloadGenerator } from './PayloadGenerator';
import {
    Play, Pause, Square, Send, Settings,
    Brain, Globe, FileText, Zap,
    Shield, ShieldCheck, ShieldAlert, History,
    Crosshair, AlertTriangle, Flag
} from 'lucide-react';

// ── Execution Mode Selector ──
const ModeSelector: React.FC = () => {
    const mode = usePentestStore((s) => s.executionMode);
    const setMode = usePentestStore((s) => s.setMode);
    const agentState = usePentestStore((s) => s.agentState);

    const modes: { value: ExecutionMode; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
        { value: 'auto', label: 'Auto', icon: <Zap size={12} />, desc: 'Full auto, no approval', color: '#22c55e' },
        { value: 'approval', label: 'Approval', icon: <Shield size={12} />, desc: 'Approve commands', color: '#f59e0b' },
        { value: 'manual', label: 'Manual', icon: <ShieldCheck size={12} />, desc: 'Guide each step', color: '#6366f1' },
    ];

    return (
        <div style={{ display: 'flex', gap: '3px', padding: '2px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            {modes.map((m) => (
                <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    disabled={agentState === 'running'}
                    title={m.desc}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: mode === m.value ? `${m.color}15` : 'transparent',
                        color: mode === m.value ? m.color : '#525252',
                        fontSize: '10px',
                        fontWeight: mode === m.value ? 600 : 400,
                        cursor: agentState === 'running' ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    {m.icon} {m.label}
                </button>
            ))}
        </div>
    );
};

// ── Tab Bar ──
const TabBar: React.FC = () => {
    const activeTab = usePentestStore((s) => s.activeTab);
    const setActiveTab = usePentestStore((s) => s.setActiveTab);
    const kb = usePentestStore((s) => s.knowledgeBase);
    const reportContent = usePentestStore((s) => s.reportContent);

    const tabs: { value: typeof activeTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { value: 'activity', label: 'Activity', icon: <Brain size={13} /> },
        {
            value: 'kb', label: 'KB', icon: <Globe size={13} />,
            badge: kb ? kb.hosts.length + kb.credentials.length : 0,
        },
        {
            value: 'report', label: 'Report', icon: <FileText size={13} />,
            badge: reportContent ? 1 : 0,
        },
        { value: 'payload', label: 'Payload', icon: <Zap size={13} /> },
    ];

    return (
        <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backgroundColor: 'rgba(0,0,0,0.15)',
        }}>
            {tabs.map((tab) => (
                <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px 14px',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === tab.value ? '#6366f1' : 'transparent'}`,
                        backgroundColor: 'transparent',
                        color: activeTab === tab.value ? '#e5e5e5' : '#525252',
                        fontSize: '12px',
                        fontWeight: activeTab === tab.value ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative',
                    }}
                >
                    {tab.icon}
                    {tab.label}
                    {tab.badge && tab.badge > 0 && (
                        <span style={{
                            fontSize: '9px',
                            padding: '1px 4px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            color: '#818cf8',
                            fontWeight: 700,
                        }}>
                            {tab.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
};

// ── Main Panel ──
export const EndJokerPanel: React.FC = () => {
    const {
        agentState, disclaimerAccepted, target, customInstruction,
        flagsFound, activities, activeTab,
        setTarget, setCustomInstruction,
        startPentest, pausePentest, resumePentest, stopPentest,
        injectInstruction, loadSessions,
        addActivity, addFlag, setAgentState,
        setPendingApproval, setKnowledgeBase, setStreamingText,
        clearStreaming,
    } = usePentestStore();

    const [instruction, setInstruction] = useState('');
    const [showSessions, setShowSessions] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [model, setModel] = useState('');
    const [baseUrl, setBaseUrl] = useState('http://localhost:1234');
    const [connected, setConnected] = useState<boolean | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const executionMode = usePentestStore((s) => s.executionMode);

    // Test LM Studio connection
    const checkConnection = useCallback(async () => {
        try {
            const api = (window as any).electronAPI;
            const result = await api.system.testLMConnection(baseUrl);
            setConnected(result?.connected || false);
            if (result?.models?.length > 0 && !model) {
                setModel(result.models[0]);
            }
        } catch {
            setConnected(false);
        }
    }, [baseUrl, model]);

    useEffect(() => {
        checkConnection();
    }, []);

    // Register IPC event listeners
    useEffect(() => {
        const api = (window as any).electronAPI;
        if (!api?.pentest) return;

        const cleanups: (() => void)[] = [];

        cleanups.push(api.pentest.onActivity((item: any) => {
            addActivity(item);
        }));

        cleanups.push(api.pentest.onStateChange((state: string) => {
            setAgentState(state as any);
        }));

        cleanups.push(api.pentest.onFlagFound((flag: any) => {
            addFlag(flag);
        }));

        cleanups.push(api.pentest.onStreamingToken((data: { token: string; agentRole: string; fullContent: string }) => {
            setStreamingText(data.fullContent, data.agentRole);
        }));

        cleanups.push(api.pentest.onCommandApproval((approval: any) => {
            setPendingApproval(approval);
        }));

        cleanups.push(api.pentest.onKBUpdate((kb: any) => {
            setKnowledgeBase(kb);
        }));

        return () => {
            cleanups.forEach(fn => fn());
        };
    }, []);

    // When agent state changes from streaming to activity, clear streaming
    useEffect(() => {
        if (agentState === 'idle' || agentState === 'completed' || agentState === 'error') {
            clearStreaming();
        }
    }, [agentState]);

    const acceptDisclaimer = usePentestStore((s) => s.acceptDisclaimer);

    if (!disclaimerAccepted) {
        return <DisclaimerModal onAccept={acceptDisclaimer} onExit={() => {}} />;
    }

    const handleStart = () => {
        if (!target.trim()) return;
        startPentest({
            target: target.trim(),
            customInstruction: customInstruction.trim() || undefined,
            model: model || undefined,
            baseUrl,
            mode: executionMode,
        });
    };

    const handleInject = () => {
        if (!instruction.trim()) return;
        injectInstruction(instruction.trim());
        setInstruction('');
    };

    const isRunning = agentState === 'running' || agentState === 'paused' || agentState === 'awaiting_approval';

    // State indicator
    const stateConfig: Record<string, { color: string; label: string; pulse: boolean }> = {
        idle: { color: '#525252', label: 'Idle', pulse: false },
        running: { color: '#22c55e', label: 'Running', pulse: true },
        paused: { color: '#f59e0b', label: 'Paused', pulse: false },
        completed: { color: '#6366f1', label: 'Completed', pulse: false },
        error: { color: '#ef4444', label: 'Error', pulse: false },
        awaiting_approval: { color: '#f59e0b', label: 'Awaiting Approval', pulse: true },
    };
    const stCfg = stateConfig[agentState] || stateConfig.idle;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: '#0a0e0c',
            color: '#e5e5e5',
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flex: 1,
                }}>
                    <Crosshair size={16} color="#ef4444" />
                    <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '1px', color: '#ef4444' }}>
                        ENDj0K3R
                    </span>
                    <span style={{ fontSize: '10px', color: '#525252', fontFamily: 'monospace' }}>v2.0</span>

                    {/* State indicator */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginLeft: '8px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: `${stCfg.color}10`,
                        border: `1px solid ${stCfg.color}30`,
                    }}>
                        <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: stCfg.color,
                            animation: stCfg.pulse ? 'state-pulse 1.5s infinite' : 'none',
                        }} />
                        <span style={{ color: stCfg.color, fontSize: '10px', fontWeight: 600 }}>{stCfg.label}</span>
                    </div>
                </div>

                {/* Toolbar buttons */}
                <button
                    onClick={() => setShowSessions(!showSessions)}
                    title="Session History"
                    style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        backgroundColor: showSessions ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        color: showSessions ? '#6366f1' : '#525252',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    <History size={12} /> Sessions
                </button>
                <button
                    onClick={() => setShowConfig(!showConfig)}
                    title="Configuration"
                    style={{
                        padding: '4px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        backgroundColor: showConfig ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        color: showConfig ? '#6366f1' : '#525252',
                        cursor: 'pointer',
                    }}
                >
                    <Settings size={14} />
                </button>
            </div>

            {/* Config panel (collapsible) */}
            {showConfig && (
                <div style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                            type="text"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="LM Studio URL"
                            style={{
                                flex: 1,
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: '#e5e5e5',
                                fontSize: '11px',
                                outline: 'none',
                                fontFamily: 'monospace',
                            }}
                        />
                        <button onClick={checkConnection} style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: connected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: connected ? '#22c55e' : '#ef4444',
                            fontSize: '10px',
                            cursor: 'pointer',
                        }}>
                            {connected === null ? 'Test' : connected ? '✓ Connected' : '✕ Failed'}
                        </button>
                    </div>
                    <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="Model name (leave empty for auto-detect)"
                        style={{
                            padding: '6px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            color: '#e5e5e5',
                            fontSize: '11px',
                            outline: 'none',
                            fontFamily: 'monospace',
                        }}
                    />
                    <ModeSelector />
                </div>
            )}

            {/* Session History (collapsible) */}
            {showSessions && (
                <div style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <SessionManager />
                </div>
            )}

            {/* Target input & start controls */}
            {!isRunning && (
                <div style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                            type="text"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            placeholder="Target IP / URL (e.g. 10.10.11.100 or http://target.ctf)"
                            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                            style={{
                                flex: 1,
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: '#e5e5e5',
                                fontSize: '13px',
                                outline: 'none',
                                fontFamily: 'monospace',
                            }}
                        />
                        <button
                            onClick={handleStart}
                            disabled={!target.trim()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: target.trim() ? '#ef4444' : '#374151',
                                color: target.trim() ? '#fff' : '#6b7280',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: target.trim() ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Play size={14} /> Start
                        </button>
                    </div>
                    <textarea
                        value={customInstruction}
                        onChange={(e) => setCustomInstruction(e.target.value)}
                        placeholder="Custom instructions (optional)... e.g. 'Focus on web exploitation, target is running Apache'"
                        rows={2}
                        style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            color: '#e5e5e5',
                            fontSize: '12px',
                            outline: 'none',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                        }}
                    />
                </div>
            )}

            {/* Running controls */}
            {isRunning && (
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    padding: '6px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    alignItems: 'center',
                }}>
                    {agentState === 'running' && (
                        <button onClick={pausePentest} style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '5px 12px', borderRadius: '6px', border: 'none',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                            fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                        }}>
                            <Pause size={12} /> Pause
                        </button>
                    )}
                    {agentState === 'paused' && (
                        <button onClick={() => resumePentest()} style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '5px 12px', borderRadius: '6px', border: 'none',
                            backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
                            fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                        }}>
                            <Play size={12} /> Resume
                        </button>
                    )}
                    <button onClick={stopPentest} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '5px 12px', borderRadius: '6px', border: 'none',
                        backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                        fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                    }}>
                        <Square size={12} /> Stop
                    </button>

                    {/* Instruction input */}
                    <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInject()}
                            placeholder="Inject instruction..."
                            style={{
                                flex: 1,
                                padding: '5px 8px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: '#e5e5e5',
                                fontSize: '11px',
                                outline: 'none',
                            }}
                        />
                        <button onClick={handleInject} disabled={!instruction.trim()} style={{
                            padding: '5px 8px', borderRadius: '4px', border: 'none',
                            backgroundColor: instruction.trim() ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                            color: instruction.trim() ? '#6366f1' : '#525252',
                            cursor: instruction.trim() ? 'pointer' : 'default',
                        }}>
                            <Send size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Flags */}
            {flagsFound.length > 0 && (
                <div style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                }}>
                    <Flag size={12} color="#22c55e" />
                    {flagsFound.map((f, i) => (
                        <FlagDisplay key={i} flag={f.flag} context={f.context} />
                    ))}
                </div>
            )}

            {/* Tabs */}
            <TabBar />

            {/* Tab content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                {activeTab === 'activity' && <ActivityFeed />}
                {activeTab === 'kb' && <KnowledgeBaseView />}
                {activeTab === 'report' && <ReportView />}
                {activeTab === 'payload' && <PayloadGenerator />}
            </div>

            <style>{`
                @keyframes state-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
};

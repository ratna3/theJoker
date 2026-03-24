/**
 * ENDj0K3R — Activity Feed v2.0
 * Real-time activity display with streaming tokens, agent roles, approval UI, expandable tool outputs
 */

import React, { useEffect, useRef } from 'react';
import { usePentestStore } from '../../store/pentestStore';
import { Bot, Terminal, Flag, Info, CheckCircle, XCircle, AlertTriangle, Shield, Brain, Eye,
    ChevronDown, ChevronRight, Check, X, Edit3 } from 'lucide-react';

// Agent role icon & color
const agentRoleConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    coordinator: { icon: <Brain size={12} />, color: '#a78bfa', label: 'Coordinator' },
    operator: { icon: <Terminal size={12} />, color: '#22c55e', label: 'Operator' },
    analyst: { icon: <Eye size={12} />, color: '#38bdf8', label: 'Analyst' },
};

const messageTypeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    info: { icon: <Info size={12} />, color: '#6366f1' },
    success: { icon: <CheckCircle size={12} />, color: '#22c55e' },
    error: { icon: <XCircle size={12} />, color: '#ef4444' },
    warning: { icon: <AlertTriangle size={12} />, color: '#f59e0b' },
};

// ── Approval Inline Widget ──
const ApprovalWidget: React.FC = () => {
    const pending = usePentestStore((s) => s.pendingApproval);
    const approve = usePentestStore((s) => s.approveCommand);
    const reject = usePentestStore((s) => s.rejectCommand);
    const [editing, setEditing] = React.useState(false);
    const [editedCmd, setEditedCmd] = React.useState('');

    if (!pending) return null;

    return (
        <div style={{
            margin: '4px 0',
            padding: '10px',
            borderRadius: '8px',
            border: `1px solid ${pending.dangerous ? 'rgba(220, 38, 38, 0.4)' : 'rgba(99, 102, 241, 0.3)'}`,
            backgroundColor: pending.dangerous ? 'rgba(220, 38, 38, 0.06)' : 'rgba(99, 102, 241, 0.06)',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '6px',
                fontSize: '11px',
                color: pending.dangerous ? '#ef4444' : '#6366f1',
                fontWeight: 600,
            }}>
                <Shield size={12} />
                {pending.dangerous ? '⚠️ DANGEROUS COMMAND — Requires Approval' : '🔒 Command Approval Required'}
            </div>

            {editing ? (
                <textarea
                    value={editedCmd}
                    onChange={(e) => setEditedCmd(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        color: '#e5e5e5',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        resize: 'vertical',
                        minHeight: '40px',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
            ) : (
                <div style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#22c55e',
                    marginBottom: '4px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                }}>
                    $ {pending.command}
                </div>
            )}

            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button
                    onClick={() => approve(editing ? editedCmd : undefined)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#22c55e',
                        color: '#000',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    <Check size={12} /> Approve
                </button>
                <button
                    onClick={() => reject()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 14px',
                        borderRadius: '6px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        backgroundColor: 'transparent',
                        color: '#ef4444',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    <X size={12} /> Reject
                </button>
                <button
                    onClick={() => {
                        if (!editing) setEditedCmd(pending.command);
                        setEditing(!editing);
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 14px',
                        borderRadius: '6px',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        backgroundColor: editing ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        color: '#6366f1',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    <Edit3 size={12} /> {editing ? 'Preview' : 'Edit'}
                </button>
            </div>
        </div>
    );
};

// ── Activity Item ──
const ActivityItemRow: React.FC<{ item: any }> = ({ item }) => {
    const [expanded, setExpanded] = React.useState(false);
    const agentCfg = item.agentRole ? agentRoleConfig[item.agentRole] : null;
    const typeCfg = messageTypeConfig[item.messageType || 'info'];

    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (item.type === 'tool') {
        const isRunning = item.toolStatus === 'running';
        return (
            <div style={{
                padding: '4px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                fontSize: '12px',
                opacity: isRunning ? 0.7 : 1,
            }}>
                <div
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: item.toolResult ? 'pointer' : 'default' }}
                    onClick={() => item.toolResult && setExpanded(!expanded)}
                >
                    <span style={{ color: '#525252', fontSize: '10px', fontFamily: 'monospace', minWidth: '60px' }}>{time}</span>
                    {agentCfg && <span style={{ color: agentCfg.color }}>{agentCfg.icon}</span>}
                    <Terminal size={12} color={isRunning ? '#f59e0b' : '#22c55e'} />
                    <span style={{ color: '#e5e5e5', fontFamily: 'monospace' }}>{item.content}</span>
                    {isRunning && <span style={{ color: '#f59e0b', fontSize: '10px' }}>⏱ running...</span>}
                    {item.toolResult && (
                        expanded ? <ChevronDown size={12} color="#525252" /> : <ChevronRight size={12} color="#525252" />
                    )}
                </div>
                {expanded && item.toolResult && (
                    <div style={{
                        marginTop: '4px',
                        marginLeft: '72px',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        lineHeight: '1.4',
                        color: '#a3a3a3',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}>
                        {item.toolResult}
                    </div>
                )}
            </div>
        );
    }

    if (item.type === 'flag') {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 8px',
                marginBottom: '2px',
                borderRadius: '6px',
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
            }}>
                <Flag size={14} color="#22c55e" />
                <span style={{ color: '#22c55e', fontWeight: 600, fontFamily: 'monospace', fontSize: '12px' }}>
                    {item.content}
                </span>
            </div>
        );
    }

    if (item.type === 'state') {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 8px',
                fontSize: '11px',
                color: '#525252',
            }}>
                <span style={{ fontSize: '10px', fontFamily: 'monospace', minWidth: '60px' }}>{time}</span>
                {agentCfg && <span style={{ color: agentCfg.color, fontSize: '10px' }}>[{agentCfg.label}]</span>}
                {item.content}
            </div>
        );
    }

    // message type
    return (
        <div style={{
            display: 'flex',
            gap: '6px',
            padding: '6px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            fontSize: '12px',
            alignItems: 'flex-start',
        }}>
            <span style={{ color: '#525252', fontSize: '10px', fontFamily: 'monospace', minWidth: '60px', marginTop: '2px' }}>{time}</span>
            {agentCfg && (
                <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    color: agentCfg.color,
                    fontSize: '10px',
                    fontWeight: 600,
                    minWidth: '80px',
                    marginTop: '2px',
                }}>
                    {agentCfg.icon} {agentCfg.label}
                </span>
            )}
            <span style={{ color: typeCfg?.color || '#e5e5e5', marginTop: '2px' }}>{typeCfg?.icon}</span>
            <span style={{
                color: '#d4d4d4',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                flex: 1,
            }}>
                {item.content}
            </span>
        </div>
    );
};

// ── Main Feed ──
export const ActivityFeed: React.FC = () => {
    const activities = usePentestStore((s) => s.activities);
    const streamingText = usePentestStore((s) => s.streamingText);
    const streamingAgentRole = usePentestStore((s) => s.streamingAgentRole);
    const agentState = usePentestStore((s) => s.agentState);
    const feedRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [activities, streamingText]);

    return (
        <div
            ref={feedRef}
            style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
            }}
        >
            {activities.length === 0 && !streamingText && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '200px',
                    color: '#525252',
                    fontSize: '13px',
                    gap: '8px',
                }}>
                    <Bot size={24} />
                    <span>Start a pentest to see activity</span>
                </div>
            )}

            {activities.map((item) => (
                <ActivityItemRow key={item.id} item={item} />
            ))}

            {/* Approval widget */}
            {agentState === 'awaiting_approval' && (
                <div style={{ padding: '4px 8px' }}>
                    <ApprovalWidget />
                </div>
            )}

            {/* Streaming text */}
            {streamingText && (
                <div style={{
                    padding: '6px 8px',
                    fontSize: '12px',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'flex-start',
                }}>
                    {streamingAgentRole && agentRoleConfig[streamingAgentRole] && (
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            color: agentRoleConfig[streamingAgentRole].color,
                            fontSize: '10px',
                            fontWeight: 600,
                            minWidth: '80px',
                        }}>
                            {agentRoleConfig[streamingAgentRole].icon}
                            {agentRoleConfig[streamingAgentRole].label}
                        </span>
                    )}
                    <span style={{
                        color: '#a3a3a3',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: '1.5',
                        flex: 1,
                    }}>
                        {streamingText}
                        <span className="streaming-cursor" style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '14px',
                            backgroundColor: '#6366f1',
                            marginLeft: '2px',
                            verticalAlign: 'middle',
                            animation: 'streaming-blink 0.8s infinite',
                        }} />
                    </span>
                </div>
            )}

            <style>{`
                @keyframes streaming-blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
            `}</style>
        </div>
    );
};

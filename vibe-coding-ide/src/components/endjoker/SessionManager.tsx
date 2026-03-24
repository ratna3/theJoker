/**
 * ENDj0K3R — Session Manager v2.0
 * Lists saved sessions with resume, load, and delete functionality
 */

import React, { useEffect } from 'react';
import { usePentestStore } from '../../store/pentestStore';
import { History, Play, Trash2, Clock, Target } from 'lucide-react';

export const SessionManager: React.FC = () => {
    const sessions = usePentestStore((s) => s.sessions);
    const loadSessions = usePentestStore((s) => s.loadSessions);
    const deleteSession = usePentestStore((s) => s.deleteSession);
    const resumeSavedSession = usePentestStore((s) => s.resumeSavedSession);
    const agentState = usePentestStore((s) => s.agentState);

    useEffect(() => {
        loadSessions();
    }, []);

    if (sessions.length === 0) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                color: '#525252',
                fontSize: '12px',
                gap: '6px',
            }}>
                <History size={18} />
                <span>No previous sessions</span>
            </div>
        );
    }

    const stateColors: Record<string, string> = {
        idle: '#525252',
        running: '#22c55e',
        paused: '#f59e0b',
        completed: '#6366f1',
        error: '#ef4444',
    };

    return (
        <div style={{ padding: '4px' }}>
            {sessions.slice(0, 20).map((session) => (
                <div
                    key={session.sessionId}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        margin: '2px 4px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                    }}
                >
                    {/* Status dot */}
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: stateColors[session.status] || '#525252',
                        flexShrink: 0,
                    }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: '#e5e5e5',
                            fontFamily: 'monospace',
                        }}>
                            <Target size={11} color="#ef4444" />
                            {session.target}
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '10px',
                            color: '#525252',
                            marginTop: '2px',
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Clock size={9} />
                                {new Date(session.createdAt).toLocaleDateString()}
                            </span>
                            {session.flagsFound.length > 0 && (
                                <span style={{ color: '#22c55e' }}>
                                    🚩 {session.flagsFound.length}
                                </span>
                            )}
                            <span style={{
                                color: stateColors[session.status] || '#525252',
                                textTransform: 'capitalize',
                            }}>
                                {session.status}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <button
                        onClick={() => resumeSavedSession(session.sessionId)}
                        disabled={agentState === 'running'}
                        title="Resume session"
                        style={{
                            padding: '4px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: agentState !== 'running' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                            color: agentState !== 'running' ? '#22c55e' : '#374151',
                            cursor: agentState !== 'running' ? 'pointer' : 'not-allowed',
                        }}
                    >
                        <Play size={12} />
                    </button>
                    <button
                        onClick={() => deleteSession(session.sessionId)}
                        title="Delete session"
                        style={{
                            padding: '4px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#525252',
                            cursor: 'pointer',
                        }}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
};

/**
 * ENDj0K3R — Session Manager
 * Lists saved pentest sessions and allows resume/delete
 */

import React, { useEffect } from 'react';
import { usePentestStore } from '../../store/pentestStore';
import { History, Trash2, Clock, Target, Flag } from 'lucide-react';

export const SessionManager: React.FC = () => {
    const sessions = usePentestStore((s) => s.sessions);
    const loadSessions = usePentestStore((s) => s.loadSessions);
    const deleteSession = usePentestStore((s) => s.deleteSession);
    const [showSessions, setShowSessions] = React.useState(false);

    useEffect(() => {
        if (showSessions) loadSessions();
    }, [showSessions]);

    return (
        <div style={{ padding: '0 12px 8px' }}>
            <button
                onClick={() => setShowSessions(!showSessions)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    backgroundColor: 'rgba(99, 102, 241, 0.05)',
                    color: '#a3a3a3',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                <History size={14} />
                {showSessions ? 'Hide' : 'Show'} Session History
            </button>

            {showSessions && (
                <div style={{ marginTop: '8px' }}>
                    {sessions.length === 0 ? (
                        <div style={{
                            color: '#525252',
                            fontSize: '12px',
                            textAlign: 'center',
                            padding: '12px',
                        }}>
                            No saved sessions
                        </div>
                    ) : (
                        sessions.slice(0, 10).map((session) => (
                            <div key={session.sessionId} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                marginBottom: '4px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        marginBottom: '2px',
                                    }}>
                                        <Target size={12} color="#6366f1" />
                                        <span style={{
                                            color: '#e5e5e5',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {session.target}
                                        </span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        color: '#6b7280',
                                        fontSize: '11px',
                                    }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={10} />
                                            {new Date(session.createdAt).toLocaleDateString()}
                                        </span>
                                        <span style={{
                                            color: session.status === 'completed' ? '#22c55e' :
                                                session.status === 'error' ? '#ef4444' : '#f59e0b',
                                            textTransform: 'uppercase',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                        }}>
                                            {session.status}
                                        </span>
                                        {session.flagsFound?.length > 0 && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#22c55e' }}>
                                                <Flag size={10} /> {session.flagsFound.length}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteSession(session.sessionId)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#6b7280',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        flexShrink: 0,
                                    }}
                                    title="Delete session"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

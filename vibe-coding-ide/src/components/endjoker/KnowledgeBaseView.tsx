/**
 * ENDj0K3R — Knowledge Base View
 * Displays discovered hosts, ports, services, credentials, and attack surface
 */

import React from 'react';
import { usePentestStore, KBHost, KBCredential } from '../../store/pentestStore';
import { Globe, Lock, AlertTriangle, Server, Shield, RefreshCw, Key } from 'lucide-react';

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
        critical: { bg: 'rgba(220, 38, 38, 0.15)', text: '#ef4444', border: 'rgba(220, 38, 38, 0.3)' },
        high: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.3)' },
        medium: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
        low: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
        info: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' },
    };
    const c = colors[severity] || colors.info;
    return (
        <span style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: c.bg,
            color: c.text,
            border: `1px solid ${c.border}`,
            textTransform: 'uppercase',
        }}>
            {severity}
        </span>
    );
};

const HostCard: React.FC<{ host: KBHost }> = ({ host }) => (
    <div style={{
        marginBottom: '8px',
        borderRadius: '8px',
        border: '1px solid rgba(99, 102, 241, 0.15)',
        backgroundColor: 'rgba(99, 102, 241, 0.03)',
        overflow: 'hidden',
    }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
            <Server size={14} color="#6366f1" />
            <span style={{ color: '#e5e5e5', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>
                {host.ip}
            </span>
            {host.hostname && (
                <span style={{ color: '#6b7280', fontSize: '11px' }}>({host.hostname})</span>
            )}
            {host.os && (
                <span style={{ color: '#a3a3a3', fontSize: '10px', marginLeft: 'auto', fontStyle: 'italic' }}>
                    {host.os}
                </span>
            )}
        </div>
        {host.ports.length > 0 && (
            <div style={{ padding: '6px 12px' }}>
                {host.ports.filter(p => p.state === 'open').map((port, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 0',
                        fontSize: '12px',
                        borderBottom: idx < host.ports.filter(p => p.state === 'open').length - 1
                            ? '1px solid rgba(255,255,255,0.03)' : 'none',
                    }}>
                        <span style={{ color: '#22c55e', fontFamily: 'monospace', fontWeight: 600, minWidth: '60px' }}>
                            {port.port}/{port.protocol}
                        </span>
                        <span style={{ color: '#e5e5e5' }}>{port.service || '—'}</span>
                        {port.version && (
                            <span style={{ color: '#6b7280', fontSize: '11px' }}>{port.version}</span>
                        )}
                        {port.vulns.length > 0 && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                marginLeft: 'auto',
                                color: '#ef4444',
                                fontSize: '11px',
                            }}>
                                <AlertTriangle size={12} /> {port.vulns.length}
                            </span>
                        )}
                    </div>
                ))}
                {/* Show vulns */}
                {host.ports.flatMap(p => p.vulns).map((vuln, idx) => (
                    <div key={`v-${idx}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        marginTop: '4px',
                        backgroundColor: 'rgba(220, 38, 38, 0.05)',
                        borderRadius: '4px',
                        fontSize: '11px',
                    }}>
                        <SeverityBadge severity={vuln.severity} />
                        <span style={{ color: '#e5e5e5' }}>{vuln.title}</span>
                        {vuln.cve && <span style={{ color: '#6b7280' }}>{vuln.cve}</span>}
                    </div>
                ))}
            </div>
        )}
    </div>
);

const CredentialRow: React.FC<{ cred: KBCredential }> = ({ cred }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        fontSize: '12px',
    }}>
        <Key size={12} color="#f59e0b" />
        <span style={{
            padding: '1px 6px',
            borderRadius: '3px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
        }}>
            {cred.type}
        </span>
        <span style={{ color: '#e5e5e5', fontFamily: 'monospace' }}>
            {cred.username || '—'}
        </span>
        <span style={{ color: '#525252' }}>:</span>
        <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>
            {cred.value}
        </span>
        {cred.service && (
            <span style={{ color: '#6b7280', marginLeft: 'auto', fontSize: '11px' }}>@ {cred.service}</span>
        )}
    </div>
);

export const KnowledgeBaseView: React.FC = () => {
    const kb = usePentestStore((s) => s.knowledgeBase);
    const fetchKB = usePentestStore((s) => s.fetchKB);
    const agentState = usePentestStore((s) => s.agentState);

    React.useEffect(() => {
        fetchKB();
        if (agentState === 'running') {
            const interval = setInterval(fetchKB, 5000);
            return () => clearInterval(interval);
        }
    }, [agentState]);

    if (!kb || (kb.hosts.length === 0 && kb.credentials.length === 0)) {
        return (
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
                <Globe size={24} />
                <span>No discoveries yet — start a pentest to populate the knowledge base</span>
                <button
                    onClick={fetchKB}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        backgroundColor: 'transparent',
                        color: '#6366f1',
                        fontSize: '11px',
                        cursor: 'pointer',
                    }}
                >
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>
            {/* Hosts */}
            {kb.hosts.length > 0 && (
                <>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 4px 8px',
                        color: '#6366f1',
                        fontSize: '12px',
                        fontWeight: 600,
                    }}>
                        <Server size={14} />
                        Hosts ({kb.hosts.length})
                    </div>
                    {kb.hosts.map((host, idx) => (
                        <HostCard key={idx} host={host} />
                    ))}
                </>
            )}

            {/* Credentials */}
            {kb.credentials.length > 0 && (
                <>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '12px 4px 8px',
                        color: '#f59e0b',
                        fontSize: '12px',
                        fontWeight: 600,
                    }}>
                        <Lock size={14} />
                        Credentials ({kb.credentials.length})
                    </div>
                    <div style={{
                        borderRadius: '8px',
                        border: '1px solid rgba(245, 158, 11, 0.15)',
                        overflow: 'hidden',
                    }}>
                        {kb.credentials.map((cred, idx) => (
                            <CredentialRow key={idx} cred={cred} />
                        ))}
                    </div>
                </>
            )}

            {/* Notes */}
            {kb.notes.length > 0 && (
                <>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '12px 4px 8px',
                        color: '#a3a3a3',
                        fontSize: '12px',
                        fontWeight: 600,
                    }}>
                        Notes ({kb.notes.length})
                    </div>
                    {kb.notes.slice(-10).map((note, idx) => (
                        <div key={idx} style={{
                            color: '#6b7280',
                            fontSize: '11px',
                            padding: '2px 8px',
                            fontFamily: 'monospace',
                        }}>
                            {note}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

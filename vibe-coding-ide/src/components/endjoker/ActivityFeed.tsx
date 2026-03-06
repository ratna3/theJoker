/**
 * ENDj0K3R — Real-time Activity Feed
 * Displays agent messages, tool executions, and status updates
 */

import React, { useEffect, useRef } from 'react';
import { usePentestStore, ActivityItem } from '../../store/pentestStore';
import { Terminal, MessageSquare, Flag, Activity } from 'lucide-react';

const ActivityItemComponent: React.FC<{ item: ActivityItem }> = ({ item }) => {
    const time = new Date(item.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const getIcon = () => {
        switch (item.type) {
            case 'tool': return <Terminal size={14} />;
            case 'flag': return <Flag size={14} />;
            case 'state': return <Activity size={14} />;
            default: return <MessageSquare size={14} />;
        }
    };

    const getColor = () => {
        if (item.type === 'flag') return '#22c55e';
        switch (item.messageType) {
            case 'success': return '#22c55e';
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            default: return '#6366f1';
        }
    };

    return (
        <div style={{
            display: 'flex',
            gap: '8px',
            padding: '6px 12px',
            borderLeft: `3px solid ${getColor()}`,
            backgroundColor: item.type === 'flag' ? 'rgba(34, 197, 94, 0.08)' :
                item.type === 'tool' ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
            marginBottom: '4px',
            borderRadius: '0 4px 4px 0',
            transition: 'background-color 0.2s',
        }}>
            <span style={{ color: '#525252', fontSize: '11px', whiteSpace: 'nowrap', marginTop: '2px' }}>
                {time}
            </span>
            <span style={{ color: getColor(), flexShrink: 0, marginTop: '2px' }}>
                {getIcon()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    color: '#e5e5e5',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    fontFamily: item.type === 'tool' ? 'monospace' : 'inherit',
                }}>
                    {item.content}
                </div>
                {item.toolResult && (
                    <div style={{
                        marginTop: '4px',
                        padding: '6px 8px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#a3a3a3',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '120px',
                        overflowY: 'auto',
                    }}>
                        {item.toolResult}
                    </div>
                )}
            </div>
        </div>
    );
};

export const PentestActivityFeed: React.FC = () => {
    const activities = usePentestStore((s) => s.activities);
    const feedRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [activities]);

    return (
        <div
            ref={feedRef}
            style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                padding: '8px 0',
            }}
        >
            {activities.length === 0 ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#525252',
                    fontSize: '13px',
                    gap: '8px',
                }}>
                    <Activity size={24} />
                    <span>Activity feed — waiting for agent to start...</span>
                </div>
            ) : (
                activities.map((item) => (
                    <ActivityItemComponent key={item.id} item={item} />
                ))
            )}
        </div>
    );
};

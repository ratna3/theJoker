/**
 * ThinkingIndicator — Animated thinking dots displayed while AI processes
 */

import React from 'react';

export const ThinkingIndicator: React.FC = () => {
    return (
        <div className="flex gap-2 items-start chat-message-enter">
            <div className="ai-avatar w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[10px]">🧠</span>
            </div>
            <div className="bg-app-panel rounded-lg px-3 py-3 flex items-center gap-2">
                <span className="text-[12px] text-app-textMuted italic">Thinking</span>
                <div className="thinking-dots flex gap-1">
                    <span className="w-1.5 h-1.5 bg-app-accent rounded-full animate-thinking-dot" />
                    <span className="w-1.5 h-1.5 bg-app-accent rounded-full animate-thinking-dot" />
                    <span className="w-1.5 h-1.5 bg-app-accent rounded-full animate-thinking-dot" />
                </div>
            </div>
        </div>
    );
};

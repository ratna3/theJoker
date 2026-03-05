/**
 * ChatMessage — Individual message bubble with markdown support
 */

import React from 'react';
import { User, ThumbsUp, ThumbsDown, Copy, RefreshCw } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import type { ChatMessage as ChatMessageType } from '../../types';

interface Props {
    message: ChatMessageType;
}

export const ChatMessage: React.FC<Props> = ({ message }) => {
    const isUser = message.role === 'user';

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
    };

    // Simple markdown-to-JSX renderer
    const renderContent = (text: string) => {
        const parts: React.ReactNode[] = [];
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Text before code block
            if (match.index > lastIndex) {
                parts.push(
                    <span key={`text-${lastIndex}`}>
                        {renderInlineMarkdown(text.slice(lastIndex, match.index))}
                    </span>
                );
            }
            // Code block
            parts.push(
                <CodeBlock
                    key={`code-${match.index}`}
                    language={match[1] || 'text'}
                    code={match[2].trim()}
                />
            );
            lastIndex = match.index + match[0].length;
        }

        // Remaining text
        if (lastIndex < text.length) {
            parts.push(
                <span key={`text-${lastIndex}`}>
                    {renderInlineMarkdown(text.slice(lastIndex))}
                </span>
            );
        }

        return parts.length > 0 ? parts : renderInlineMarkdown(text);
    };

    const renderInlineMarkdown = (text: string) => {
        // Split on inline code, bold, italic
        return text.split('\n').map((line, i) => {
            // Headers
            if (line.startsWith('### ')) return <h3 key={i} className="text-[14px] font-semibold mt-2 mb-1">{line.slice(4)}</h3>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-[15px] font-semibold mt-2 mb-1">{line.slice(3)}</h2>;
            if (line.startsWith('# ')) return <h1 key={i} className="text-[16px] font-bold mt-2 mb-1">{line.slice(2)}</h1>;
            // List items
            if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc">{renderInlineFormatting(line.slice(2))}</li>;
            if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal">{renderInlineFormatting(line.replace(/^\d+\.\s/, ''))}</li>;
            // Empty lines
            if (!line.trim()) return <br key={i} />;
            // Normal text
            return <p key={i} className="my-0.5">{renderInlineFormatting(line)}</p>;
        });
    };

    const renderInlineFormatting = (text: string): React.ReactNode => {
        // Handle inline code, bold, italic
        const parts: React.ReactNode[] = [];
        const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
        let lastIdx = 0;
        let m;

        while ((m = regex.exec(text)) !== null) {
            if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
            const matched = m[0];
            if (matched.startsWith('`')) {
                parts.push(<code key={m.index} className="px-1 py-0.5 bg-app-bg rounded text-[12px] text-app-accent font-mono">{matched.slice(1, -1)}</code>);
            } else if (matched.startsWith('**')) {
                parts.push(<strong key={m.index}>{matched.slice(2, -2)}</strong>);
            } else if (matched.startsWith('*')) {
                parts.push(<em key={m.index}>{matched.slice(1, -1)}</em>);
            }
            lastIdx = m.index + matched.length;
        }
        if (lastIdx < text.length) parts.push(text.slice(lastIdx));
        return parts.length > 0 ? parts : text;
    };

    return (
        <div className={`chat-message-enter flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`
        w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
        ${isUser
                    ? 'bg-app-accent/30 text-app-accent'
                    : 'ai-avatar text-white'
                }
      `}>
                {isUser ? <User size={14} /> : <img src="./theJoker.png" alt="The Joker" className="w-4 h-4 object-contain" />}
            </div>

            {/* Message Content */}
            <div className={`
        flex-1 min-w-0 rounded-lg px-3 py-2 text-[13px] leading-relaxed
        ${isUser
                    ? 'bg-app-accent/10 border border-app-accent/20 text-app-text'
                    : 'bg-app-panel text-app-text'
                }
      `}>
                <div className="whitespace-pre-wrap break-words">
                    {renderContent(message.content)}
                    {message.isStreaming && <span className="streaming-cursor" />}
                </div>

                {/* Action buttons (only for completed assistant messages) */}
                {!isUser && !message.isStreaming && message.content && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-app-border/30">
                        <button onClick={handleCopy} className="p-1 rounded hover:bg-white/10 text-app-textMuted hover:text-app-text transition-colors" title="Copy">
                            <Copy size={12} />
                        </button>
                        <button className="p-1 rounded hover:bg-white/10 text-app-textMuted hover:text-app-success transition-colors" title="Helpful">
                            <ThumbsUp size={12} />
                        </button>
                        <button className="p-1 rounded hover:bg-white/10 text-app-textMuted hover:text-app-error transition-colors" title="Not helpful">
                            <ThumbsDown size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

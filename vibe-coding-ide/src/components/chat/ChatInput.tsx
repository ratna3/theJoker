/**
 * ChatInput — Multi-line textarea with slash commands and context buttons
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Paperclip, FileCode } from 'lucide-react';
import type { SlashCommand } from '../../types';

interface Props {
    onSend: (content: string, context?: { file?: boolean; selection?: string }) => void;
    onStop: () => void;
    isStreaming: boolean;
}

const SLASH_COMMANDS: SlashCommand[] = [
    { name: '/explain', description: 'Explain the current code', icon: '💡' },
    { name: '/fix', description: 'Fix bugs in the code', icon: '🔧' },
    { name: '/refactor', description: 'Refactor for better quality', icon: '♻️' },
    { name: '/add-feature', description: 'Add a new feature', icon: '✨' },
    { name: '/add-tests', description: 'Generate unit tests', icon: '🧪' },
    { name: '/optimize', description: 'Optimize performance', icon: '⚡' },
    { name: '/terminal', description: 'Run a terminal command', icon: '💻' },
    { name: '/edit', description: 'Edit a specific file', icon: '📝' },
    { name: '/create', description: 'Create a new file', icon: '📄' },
];

export const ChatInput: React.FC<Props> = ({ onSend, onStop, isStreaming }) => {
    const [value, setValue] = useState('');
    const [showSlashMenu, setShowSlashMenu] = useState(false);
    const [selectedCommand, setSelectedCommand] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
    }, [value]);

    // Slash command detection
    useEffect(() => {
        if (value === '/' || (value.startsWith('/') && !value.includes(' '))) {
            setShowSlashMenu(true);
            setSelectedCommand(0);
        } else {
            setShowSlashMenu(false);
        }
    }, [value]);

    const handleSend = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed || isStreaming) return;
        onSend(trimmed);
        setValue('');
    }, [value, isStreaming, onSend]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (showSlashMenu) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedCommand(c => Math.min(c + 1, SLASH_COMMANDS.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedCommand(c => Math.max(c - 1, 0));
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const cmd = SLASH_COMMANDS[selectedCommand];
                setValue(cmd.name + ' ');
                setShowSlashMenu(false);
                return;
            }
            if (e.key === 'Escape') {
                setShowSlashMenu(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [showSlashMenu, selectedCommand, handleSend]);

    const filteredCommands = value.startsWith('/')
        ? SLASH_COMMANDS.filter(c => c.name.startsWith(value.split(' ')[0]))
        : SLASH_COMMANDS;

    return (
        <div className="border-t border-app-border p-2 flex-shrink-0 relative">
            {/* Slash Command Menu */}
            {showSlashMenu && (
                <div className="absolute bottom-full left-2 right-2 mb-1 bg-app-panel border border-app-border rounded-lg shadow-xl overflow-hidden animate-scale-fade-in">
                    {filteredCommands.map((cmd, i) => (
                        <button
                            key={cmd.name}
                            onClick={() => {
                                setValue(cmd.name + ' ');
                                setShowSlashMenu(false);
                                textareaRef.current?.focus();
                            }}
                            className={`
                w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors
                ${i === selectedCommand ? 'bg-app-accent/20 text-app-text' : 'text-app-textMuted hover:bg-white/5'}
              `}
                        >
                            <span>{cmd.icon}</span>
                            <span className="font-medium text-app-text">{cmd.name}</span>
                            <span className="text-app-textMuted">{cmd.description}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="flex items-end gap-2">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message AI... (/ for commands, Shift+Enter for newline)"
                    rows={1}
                    className="flex-1 bg-app-bg border border-app-border rounded-lg px-3 py-2 text-[13px] text-app-text placeholder:text-app-textMuted resize-none focus:outline-none focus:border-app-accent transition-colors"
                    style={{ maxHeight: 150 }}
                />

                {/* Send / Stop */}
                {isStreaming ? (
                    <button
                        onClick={onStop}
                        className="p-2 rounded-lg bg-app-error hover:bg-app-error/80 text-white transition-colors flex-shrink-0"
                        title="Stop"
                    >
                        <Square size={16} fill="white" />
                    </button>
                ) : (
                    <button
                        onClick={handleSend}
                        disabled={!value.trim()}
                        className={`
              p-2 rounded-lg transition-all flex-shrink-0
              ${value.trim()
                                ? 'bg-app-accent hover:bg-app-accentHover text-white'
                                : 'bg-app-panel text-app-textMuted cursor-not-allowed'
                            }
            `}
                        title="Send"
                    >
                        <Send size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

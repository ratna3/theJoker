/**
 * ChatPanel — Main AI chat container with messages and input
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useChatStore, useEditorStore, useSettingsStore } from '../../store';

export const ChatPanel: React.FC = () => {
    const { messages, isStreaming, addMessage, appendToken, setStreaming, clearChat } = useChatStore();
    const { lmStudioUrl, selectedModel, temperature, maxTokens } = useSettingsStore();
    const activeTab = useEditorStore((s) => s.openTabs.find(t => t.id === s.activeTabId));
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [userScrolledUp, setUserScrolledUp] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (!userScrolledUp) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, userScrolledUp]);

    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setUserScrolledUp(!isNearBottom);
    }, []);

    const handleSend = useCallback(async (content: string, attachedContext?: { file?: boolean; selection?: string }) => {
        // Add user message
        addMessage('user', content, {
            filePath: activeTab?.filePath,
            fileName: activeTab?.fileName,
        });

        // Create assistant message placeholder
        const assistantId = addMessage('assistant', '');
        setStreaming(true, assistantId);

        // Set up token listener
        const removeToken = window.electronAPI?.ai?.onToken?.((token) => {
            appendToken(token);
        });

        const removeComplete = window.electronAPI?.ai?.onComplete?.((response) => {
            setStreaming(false);
            removeToken?.();
            removeComplete?.();
            removeError?.();
        });

        const removeError = window.electronAPI?.ai?.onError?.((error) => {
            useChatStore.getState().updateMessage(assistantId, {
                content: `⚠️ ${error}`,
                isStreaming: false,
            });
            setStreaming(false);
            removeToken?.();
            removeComplete?.();
            removeError?.();
        });

        // Build messages for API
        const apiMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content }));
        apiMessages.push({ role: 'user', content });

        // Start streaming
        await window.electronAPI?.ai?.streamStart({
            messages: apiMessages,
            model: selectedModel || 'default',
            temperature,
            maxTokens,
            baseUrl: lmStudioUrl,
            currentFile: activeTab ? { path: activeTab.filePath, content: activeTab.content } : undefined,
            selectedCode: attachedContext?.selection,
        });
    }, [messages, activeTab, addMessage, appendToken, setStreaming, selectedModel, temperature, maxTokens]);

    const handleStop = useCallback(() => {
        useChatStore.getState().cancelStream();
    }, []);

    return (
        <div className="h-full flex flex-col bg-app-sidebar border-l border-app-border">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-app-border flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden">
                        <img src="./theJoker.png" alt="The Joker" className="w-6 h-6 object-contain" />
                    </div>
                    <span className="text-[13px] font-medium text-app-text">The Joker AI</span>
                    {selectedModel && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-app-accent/20 text-app-accent rounded-full">
                            {selectedModel.split('/').pop()}
                        </span>
                    )}
                </div>
                <button
                    onClick={clearChat}
                    className="p-1 rounded hover:bg-white/10 text-app-textMuted hover:text-app-text transition-colors"
                    title="Clear Chat"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Messages */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden">
                            <img src="./theJoker.png" alt="The Joker" className="w-14 h-14 object-contain" />
                        </div>
                        <p className="text-[13px] text-app-textMuted">Ask The Joker anything about your code</p>
                        <p className="text-[11px] text-app-textMuted">Type <span className="text-app-accent">/</span> for commands</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                ))}

                {isStreaming && messages[messages.length - 1]?.content === '' && (
                    <ThinkingIndicator />
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Context Indicator */}
            {activeTab && (
                <div className="px-3 py-1 text-[11px] text-app-textMuted border-t border-app-border/50 flex-shrink-0">
                    <span>Context: {activeTab.fileName}</span>
                </div>
            )}

            {/* Input */}
            <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
            />
        </div>
    );
};

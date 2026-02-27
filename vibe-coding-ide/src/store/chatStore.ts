/**
 * Zustand Store — Chat Messages
 */

import { create } from 'zustand';
import type { ChatMessage } from '../types';

interface ChatState {
    messages: ChatMessage[];
    isStreaming: boolean;
    currentStreamId: string | null;
    addMessage: (role: 'user' | 'assistant', content: string, context?: ChatMessage['context']) => string;
    appendToken: (token: string) => void;
    updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
    setStreaming: (streaming: boolean, messageId?: string) => void;
    clearChat: () => void;
    cancelStream: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    isStreaming: false,
    currentStreamId: null,

    addMessage: (role, content, context) => {
        const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const message: ChatMessage = {
            id,
            role,
            content,
            timestamp: Date.now(),
            isStreaming: role === 'assistant',
            context,
        };
        set((state) => ({ messages: [...state.messages, message] }));
        return id;
    },

    appendToken: (token) => {
        const { currentStreamId } = get();
        if (!currentStreamId) return;
        set((state) => ({
            messages: state.messages.map((m) =>
                m.id === currentStreamId
                    ? { ...m, content: m.content + token }
                    : m
            ),
        }));
    },

    updateMessage: (id, updates) => {
        set((state) => ({
            messages: state.messages.map((m) =>
                m.id === id ? { ...m, ...updates } : m
            ),
        }));
    },

    setStreaming: (streaming, messageId) => {
        set({ isStreaming: streaming, currentStreamId: messageId || null });
        if (!streaming && get().currentStreamId) {
            set((state) => ({
                messages: state.messages.map((m) =>
                    m.id === state.currentStreamId
                        ? { ...m, isStreaming: false }
                        : m
                ),
            }));
        }
    },

    clearChat: () => set({ messages: [], isStreaming: false, currentStreamId: null }),

    cancelStream: () => {
        window.electronAPI.ai.streamStop();
        const { currentStreamId } = get();
        if (currentStreamId) {
            set((state) => ({
                isStreaming: false,
                currentStreamId: null,
                messages: state.messages.map((m) =>
                    m.id === currentStreamId ? { ...m, isStreaming: false } : m
                ),
            }));
        }
    },
}));

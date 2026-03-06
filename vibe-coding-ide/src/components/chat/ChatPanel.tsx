/**
 * ChatPanel — Main AI chat container with plan-approval and autonomous execution
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useChatStore, useEditorStore, useSettingsStore, useFileStore, useTerminalStore } from '../../store';
import { parseAIResponse } from '../../utils/responseParser';
import type { ExecutionResult } from '../../store/chatStore';

/**
 * Detect if an AI response contains a [PLAN]...[/PLAN] block
 */
function extractPlan(text: string): string | null {
    const match = text.match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/);
    return match ? match[1].trim() : null;
}

export const ChatPanel: React.FC = () => {
    const {
        messages, isStreaming, addMessage, appendToken, setStreaming, clearChat,
        pendingPlanMessageId, setPendingPlan, isExecuting, setExecuting,
        executionResults, addExecutionResult, clearExecutionResults,
    } = useChatStore();
    const { lmStudioUrl, selectedModel, temperature, maxTokens } = useSettingsStore();
    const activeTab = useEditorStore((s) => s.openTabs.find(t => t.id === s.activeTabId));
    const rootPath = useFileStore((s) => s.rootPath);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [userScrolledUp, setUserScrolledUp] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (!userScrolledUp) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, executionResults, userScrolledUp]);

    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setUserScrolledUp(!isNearBottom);
    }, []);

    /**
     * Gather terminal output for AI context
     */
    const getTerminalContext = useCallback(async (): Promise<string | undefined> => {
        try {
            const { sessions, activeSessionId } = useTerminalStore.getState();
            const terminalId = activeSessionId || sessions[0]?.id;
            if (!terminalId) return undefined;

            const result = await window.electronAPI?.ai?.readTerminalOutput?.(terminalId, 50);
            if (result?.success && result.output?.trim()) {
                return result.output;
            }
        } catch {
            // Terminal context is optional
        }
        return undefined;
    }, []);

    /**
     * Gather project file list for AI context
     */
    const getProjectFiles = useCallback(async (): Promise<string[] | undefined> => {
        if (!rootPath) return undefined;
        try {
            const result = await window.electronAPI?.ai?.listProjectFiles?.(rootPath);
            if (result?.success && result.files?.length > 0) {
                return result.files;
            }
        } catch {
            // Project files context is optional
        }
        return undefined;
    }, [rootPath]);

    /**
     * Core: send a message to the AI and return the full response via Promise
     */
    const sendToAI = useCallback(async (
        userContent: string,
        extraContext?: { terminalErrors?: string; projectFiles?: string[] },
    ): Promise<string> => {
        return new Promise(async (resolve, reject) => {
            const currentMessages = useChatStore.getState().messages;

            const removeToken = window.electronAPI?.ai?.onToken?.((token) => {
                appendToken(token);
            });

            const removeComplete = window.electronAPI?.ai?.onComplete?.((response) => {
                setStreaming(false);
                removeToken?.();
                removeComplete?.();
                removeError?.();
                resolve(response);
            });

            const removeError = window.electronAPI?.ai?.onError?.((error) => {
                setStreaming(false);
                removeToken?.();
                removeComplete?.();
                removeError?.();
                reject(new Error(error));
            });

            // Build messages for API including full conversation history
            const apiMessages = currentMessages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }));
            apiMessages.push({ role: 'user', content: userContent });

            try {
                await window.electronAPI?.ai?.streamStart({
                    messages: apiMessages,
                    model: selectedModel || 'default',
                    temperature,
                    maxTokens,
                    baseUrl: lmStudioUrl,
                    currentFile: activeTab ? { path: activeTab.filePath, content: activeTab.content } : undefined,
                    terminalErrors: extraContext?.terminalErrors,
                    projectFiles: extraContext?.projectFiles,
                });
            } catch (err: any) {
                removeToken?.();
                removeComplete?.();
                removeError?.();
                reject(err);
            }
        });
    }, [activeTab, appendToken, setStreaming, selectedModel, temperature, maxTokens, lmStudioUrl]);

    /**
     * Execute all AI actions (file writes + terminal commands) autonomously
     */
    const executeActions = useCallback(async (response: string): Promise<ExecutionResult[]> => {
        const actions = parseAIResponse(response);
        const results: ExecutionResult[] = [];

        if (actions.length === 0) return results;

        const { sessions, activeSessionId } = useTerminalStore.getState();
        const terminalId = activeSessionId || sessions[0]?.id;

        for (const action of actions) {
            if (action.type === 'file-write') {
                try {
                    if (!rootPath) throw new Error('No project folder open');
                    const result = await window.electronAPI.ai.applyFile(rootPath, action.filePath, action.content);
                    const execResult: ExecutionResult = {
                        action: 'file-write',
                        detail: action.filePath,
                        success: result.success,
                        error: result.error,
                    };
                    results.push(execResult);
                    addExecutionResult(execResult);
                    // Refresh file tree
                    useFileStore.getState().refreshTree();
                    // Open in editor if successful
                    if (result.success && result.resolvedPath) {
                        await useEditorStore.getState().openFile(result.resolvedPath);
                    }
                } catch (err: any) {
                    const execResult: ExecutionResult = {
                        action: 'file-write',
                        detail: action.filePath,
                        success: false,
                        error: err.message,
                    };
                    results.push(execResult);
                    addExecutionResult(execResult);
                }
            } else if (action.type === 'terminal-command') {
                try {
                    if (!terminalId) throw new Error('No active terminal');
                    const result = await window.electronAPI.ai.runTerminal(terminalId, action.command);
                    const execResult: ExecutionResult = {
                        action: 'terminal-command',
                        detail: action.command,
                        success: result.success,
                        error: result.error,
                    };
                    results.push(execResult);
                    addExecutionResult(execResult);
                    // Wait for command to process
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err: any) {
                    const execResult: ExecutionResult = {
                        action: 'terminal-command',
                        detail: action.command,
                        success: false,
                        error: err.message,
                    };
                    results.push(execResult);
                    addExecutionResult(execResult);
                }
            }
        }

        return results;
    }, [rootPath, addExecutionResult]);

    /**
     * Handle plan approval — triggers autonomous execution
     */
    const handleApprovePlan = useCallback(async () => {
        const approvedMsgId = pendingPlanMessageId;
        setPendingPlan(null);
        setExecuting(true);
        clearExecutionResults();

        // Check if the pending message already contains executable actions (direct code)
        const pendingMessage = useChatStore.getState().messages.find(m => m.id === approvedMsgId);
        const existingActions = pendingMessage ? parseAIResponse(pendingMessage.content) : [];
        const hasPlanBlock = pendingMessage ? !!extractPlan(pendingMessage.content) : false;

        if (existingActions.length > 0 && !hasPlanBlock) {
            // Direct execution: apply code actions already present in the response
            addMessage('user', '✅ Approved — Applying changes...');
            const results = await executeActions(pendingMessage!.content);

            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            if (results.length > 0) {
                const summaryLines = results.map(r => {
                    const icon = r.success ? '✅' : '❌';
                    const type = r.action === 'file-write' ? '📝' : '💻';
                    return `${icon} ${type} ${r.detail}${r.error ? ` — ${r.error}` : ''}`;
                });
                addMessage('assistant', `**Execution Complete** — ${successCount} succeeded, ${failCount} failed\n${summaryLines.join('\n')}`);
            }

            setExecuting(false);
            return;
        }

        // Plan-based execution: ask AI to implement the approved plan
        addMessage('user', '✅ Plan Approved — Execute now.');

        // Create assistant message placeholder for execution response
        const execAssistantId = addMessage('assistant', '');
        setStreaming(true, execAssistantId);

        try {
            // Gather context
            const [terminalErrors, projectFiles] = await Promise.all([
                getTerminalContext(),
                getProjectFiles(),
            ]);

            // Send "__PLAN_APPROVED__" which triggers execution mode in system prompt
            const response = await sendToAI('__PLAN_APPROVED__', { terminalErrors, projectFiles });

            // Auto-execute all actions from the response
            const results = await executeActions(response);

            // Add execution summary message
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            if (results.length > 0) {
                const summaryLines = results.map(r => {
                    const icon = r.success ? '✅' : '❌';
                    const type = r.action === 'file-write' ? '📝' : '💻';
                    return `${icon} ${type} ${r.detail}${r.error ? ` — ${r.error}` : ''}`;
                });

                const summaryMsg = `\n\n---\n**Execution Complete** — ${successCount} succeeded, ${failCount} failed\n${summaryLines.join('\n')}`;
                useChatStore.getState().updateMessage(execAssistantId, {
                    content: useChatStore.getState().messages.find(m => m.id === execAssistantId)?.content + summaryMsg,
                });
            }

            // If there were failures, send error details to AI for a fix
            if (failCount > 0) {
                const errorDetails = results
                    .filter(r => !r.success)
                    .map(r => `${r.action}: ${r.detail} — Error: ${r.error}`)
                    .join('\n');

                const retryAssistantId = addMessage('assistant', '');
                setStreaming(true, retryAssistantId);

                const retryResponse = await sendToAI(
                    `Some actions failed. Please fix and retry:\n${errorDetails}`,
                    { terminalErrors: await getTerminalContext(), projectFiles: await getProjectFiles() },
                );

                // Try executing the fixes
                await executeActions(retryResponse);
            }
        } catch (err: any) {
            useChatStore.getState().updateMessage(execAssistantId, {
                content: `⚠️ Execution failed: ${err.message}`,
                isStreaming: false,
            });
            setStreaming(false);
        }

        setExecuting(false);
    }, [addMessage, setStreaming, setPendingPlan, setExecuting, clearExecutionResults, sendToAI, executeActions, getTerminalContext, getProjectFiles]);

    /**
     * Handle plan denial
     */
    const handleDenyPlan = useCallback(() => {
        setPendingPlan(null);
        addMessage('user', '❌ Plan denied.');
        addMessage('assistant', 'Got it — plan cancelled. Feel free to ask for a different approach or give more details about what you\'d like.');
    }, [addMessage, setPendingPlan]);

    /**
     * Main send handler — detects plans in AI response
     */
    const handleSend = useCallback(async (content: string, attachedContext?: { file?: boolean; selection?: string }) => {
        // Add user message
        addMessage('user', content, {
            filePath: activeTab?.filePath,
            fileName: activeTab?.fileName,
        });

        // Create assistant message placeholder
        const assistantId = addMessage('assistant', '');
        setStreaming(true, assistantId);

        // Gather context in parallel
        const [terminalErrors, projectFiles] = await Promise.all([
            getTerminalContext(),
            getProjectFiles(),
        ]);

        try {
            const response = await sendToAI(content, { terminalErrors, projectFiles });

            // Check if response contains a plan or executable code actions
            const plan = extractPlan(response);
            const hasActions = parseAIResponse(response).length > 0;
            if (plan || hasActions) {
                setPendingPlan(assistantId);
            }
        } catch (err: any) {
            useChatStore.getState().updateMessage(assistantId, {
                content: `⚠️ ${err.message}`,
                isStreaming: false,
            });
            setStreaming(false);
        }
    }, [activeTab, rootPath, addMessage, setStreaming, setPendingPlan, sendToAI, getTerminalContext, getProjectFiles]);

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
                    {isExecuting && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> Executing
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
                    <React.Fragment key={msg.id}>
                        <ChatMessage message={msg} />

                        {/* Plan Approval Buttons — shown after plan message */}
                        {msg.id === pendingPlanMessageId && !msg.isStreaming && (
                            <div className="flex items-center gap-2 ml-9 animate-scale-fade-in">
                                <button
                                    onClick={handleApprovePlan}
                                    disabled={isExecuting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-app-success/20 hover:bg-app-success/30 text-app-success rounded-lg text-[12px] font-medium transition-colors border border-app-success/30"
                                >
                                    <CheckCircle size={14} />
                                    Approve Plan
                                </button>
                                <button
                                    onClick={handleDenyPlan}
                                    disabled={isExecuting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-app-error/20 hover:bg-app-error/30 text-app-error rounded-lg text-[12px] font-medium transition-colors border border-app-error/30"
                                >
                                    <XCircle size={14} />
                                    Deny
                                </button>
                            </div>
                        )}
                    </React.Fragment>
                ))}

                {/* Execution Progress */}
                {isExecuting && executionResults.length > 0 && (
                    <div className="ml-9 space-y-1 animate-scale-fade-in">
                        <p className="text-[11px] text-app-textMuted font-medium mb-1">Executing changes...</p>
                        {executionResults.map((r, i) => (
                            <div key={i} className={`flex items-center gap-1.5 text-[11px] ${r.success ? 'text-app-success' : 'text-app-error'}`}>
                                {r.success ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                <span className="text-app-textMuted">{r.action === 'file-write' ? '📝' : '💻'}</span>
                                <span className="truncate">{r.detail}</span>
                            </div>
                        ))}
                    </div>
                )}

                {isStreaming && messages[messages.length - 1]?.content === '' && (
                    <ThinkingIndicator />
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Context Indicator */}
            {(activeTab || rootPath) && (
                <div className="px-3 py-1 text-[11px] text-app-textMuted border-t border-app-border/50 flex-shrink-0 flex items-center gap-2">
                    {activeTab && <span>Context: {activeTab.fileName}</span>}
                    {rootPath && <span className="text-app-accent/50">| Project loaded</span>}
                </div>
            )}

            {/* Input */}
            <ChatInput
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming || isExecuting}
            />
        </div>
    );
};

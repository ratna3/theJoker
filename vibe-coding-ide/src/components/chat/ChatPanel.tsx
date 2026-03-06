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
        let terminalId = activeSessionId || sessions[0]?.id;
        let filesChanged = false;

        // If no terminal session exists, create one
        if (!terminalId && actions.some(a => a.type === 'terminal-command')) {
            const cwd = rootPath || await window.electronAPI?.system?.getHomeDir() || '';
            terminalId = useTerminalStore.getState().createSession(cwd);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await window.electronAPI?.terminal?.create(terminalId, cwd);
        }

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
                    if (result.success) {
                        filesChanged = true;
                        if (result.resolvedPath) {
                            await useEditorStore.getState().openFile(result.resolvedPath);
                        }
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
                    const cwd = rootPath || '';
                    // Use blocking execution so commands run sequentially
                    const result = await window.electronAPI.terminal.execute({
                        command: action.command,
                        cwd,
                        sessionId: terminalId,
                        timeout: 120000,
                    });
                    const execResult: ExecutionResult = {
                        action: 'terminal-command',
                        detail: action.command,
                        success: result.success,
                        error: result.error || (!result.success ? `Exit code: ${result.exitCode}` : undefined),
                    };
                    results.push(execResult);
                    addExecutionResult(execResult);
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

        // Refresh file explorer once after all actions complete
        if (filesChanged) {
            await new Promise(resolve => setTimeout(resolve, 300));
            await useFileStore.getState().refreshTree();
        }

        return results;
    }, [rootPath, addExecutionResult]);

    /**
     * Ensure a terminal session exists and return its ID
     */
    const ensureTerminal = useCallback(async (): Promise<string> => {
        const { sessions, activeSessionId } = useTerminalStore.getState();
        let terminalId = activeSessionId || sessions[0]?.id;
        if (!terminalId) {
            const cwd = rootPath || await window.electronAPI?.system?.getHomeDir() || '';
            terminalId = useTerminalStore.getState().createSession(cwd);
            await new Promise(resolve => setTimeout(resolve, 1000));
            await window.electronAPI?.terminal?.create(terminalId, cwd);
        }
        return terminalId;
    }, [rootPath]);

    /**
     * Auto-install dependencies if package.json exists in the project
     */
    const autoInstallDependencies = useCallback(async (terminalId: string): Promise<ExecutionResult | null> => {
        if (!rootPath) return null;
        try {
            const pkgResult = await window.electronAPI.fs.readFile(rootPath.replace(/\\/g, '/') + '/package.json');
            if (!pkgResult || !pkgResult.content) return null;
        } catch {
            return null; // No package.json, skip install
        }

        addMessage('assistant', '📦 Installing dependencies...');
        const result = await window.electronAPI.terminal.execute({
            command: 'npm install',
            cwd: rootPath,
            sessionId: terminalId,
            timeout: 180000,
        });

        // If first attempt fails, try with --legacy-peer-deps
        if (!result.success) {
            addMessage('assistant', '⚠️ `npm install` failed, retrying with `--legacy-peer-deps`...');
            const retryResult = await window.electronAPI.terminal.execute({
                command: 'npm install --legacy-peer-deps',
                cwd: rootPath,
                sessionId: terminalId,
                timeout: 180000,
            });
            const execResult: ExecutionResult = {
                action: 'terminal-command',
                detail: 'npm install --legacy-peer-deps',
                success: retryResult.success,
                error: retryResult.error,
            };
            addExecutionResult(execResult);
            return execResult;
        }

        const execResult: ExecutionResult = {
            action: 'terminal-command',
            detail: 'npm install',
            success: true,
        };
        addExecutionResult(execResult);
        return execResult;
    }, [rootPath, addMessage, addExecutionResult]);

    /**
     * Detect the dev server command from package.json scripts
     */
    const detectDevCommand = useCallback(async (): Promise<{ command: string; port: number } | null> => {
        if (!rootPath) return null;
        try {
            const pkgResult = await window.electronAPI.fs.readFile(rootPath.replace(/\\/g, '/') + '/package.json');
            if (!pkgResult?.content) return null;
            const pkg = JSON.parse(pkgResult.content);
            const scripts = pkg.scripts || {};

            // Priority order: dev, start, serve
            let command: string | null = null;
            if (scripts.dev) command = 'npm run dev';
            else if (scripts.start) command = 'npm start';
            else if (scripts.serve) command = 'npm run serve';
            if (!command) return null;

            // Try to detect port from scripts
            let port = 3000;
            const scriptContent = scripts.dev || scripts.start || scripts.serve || '';
            const portMatch = scriptContent.match(/--port\s+(\d+)/);
            if (portMatch) port = parseInt(portMatch[1], 10);
            // Common framework defaults
            if (scripts.dev?.includes('vite') || pkg.devDependencies?.vite) port = 5173;
            if (scripts.dev?.includes('next') || pkg.dependencies?.next) port = 3000;

            return { command, port };
        } catch {
            return null;
        }
    }, [rootPath]);

    /**
     * Launch the dev server and return the URL
     */
    const launchDevServer = useCallback(async (terminalId: string): Promise<string | null> => {
        const devInfo = await detectDevCommand();
        if (!devInfo || !rootPath) return null;

        addMessage('assistant', `🚀 Starting dev server: \`${devInfo.command}\`...`);
        const result = await window.electronAPI.terminal.launchDevServer({
            command: devInfo.command,
            cwd: rootPath,
            sessionId: terminalId,
            port: devInfo.port,
            timeout: 60000,
        });

        if (result.success && result.url) {
            addMessage('assistant', `✅ **Dev server running!**\n🌐 Open in browser: **${result.url}**`);
            return result.url;
        } else {
            addMessage('assistant', `⚠️ Dev server may still be starting. Check terminal for output.`);
            return `http://localhost:${devInfo.port}`;
        }
    }, [rootPath, detectDevCommand, addMessage]);

    /**
     * Read terminal output and check for errors
     */
    const checkTerminalForErrors = useCallback(async (): Promise<string | null> => {
        const output = await getTerminalContext();
        if (!output) return null;

        const errorPatterns = [
            /error\s*:/i,
            /ERR!/,
            /ENOENT/,
            /SyntaxError/,
            /TypeError/,
            /ReferenceError/,
            /Cannot find module/i,
            /Module not found/i,
            /Failed to compile/i,
            /Build failed/i,
        ];

        for (const pattern of errorPatterns) {
            if (pattern.test(output)) {
                return output;
            }
        }
        return null;
    }, [getTerminalContext]);

    /**
     * Handle plan approval — triggers autonomous execution with auto-install, dev server, and error handling
     */
    const handleApprovePlan = useCallback(async () => {
        const approvedMsgId = pendingPlanMessageId;
        setPendingPlan(null);
        setExecuting(true);
        clearExecutionResults();

        const pendingMessage = useChatStore.getState().messages.find(m => m.id === approvedMsgId);
        const existingActions = pendingMessage ? parseAIResponse(pendingMessage.content) : [];
        const hasPlanBlock = pendingMessage ? !!extractPlan(pendingMessage.content) : false;

        const MAX_ERROR_RETRIES = 3;

        try {
            let allResults: ExecutionResult[] = [];

            if (existingActions.length > 0 && !hasPlanBlock) {
                // Direct execution: apply code actions already present in the response
                addMessage('user', '✅ Approved — Applying changes...');
                allResults = await executeActions(pendingMessage!.content);
            } else {
                // Plan-based execution: ask AI to implement the approved plan
                addMessage('user', '✅ Plan Approved — Execute now.');

                const execAssistantId = addMessage('assistant', '');
                setStreaming(true, execAssistantId);

                const [terminalErrors, projectFiles] = await Promise.all([
                    getTerminalContext(),
                    getProjectFiles(),
                ]);

                const response = await sendToAI('__PLAN_APPROVED__', { terminalErrors, projectFiles });
                allResults = await executeActions(response);

                // Update the assistant message with summary
                const successCount = allResults.filter(r => r.success).length;
                const failCount = allResults.filter(r => !r.success).length;

                if (allResults.length > 0) {
                    const summaryLines = allResults.map(r => {
                        const icon = r.success ? '✅' : '❌';
                        const type = r.action === 'file-write' ? '📝' : '💻';
                        return `${icon} ${type} ${r.detail}${r.error ? ` — ${r.error}` : ''}`;
                    });
                    const content = useChatStore.getState().messages.find(m => m.id === execAssistantId)?.content || '';
                    useChatStore.getState().updateMessage(execAssistantId, {
                        content: content + `\n\n---\n**Execution Complete** — ${successCount} succeeded, ${failCount} failed\n${summaryLines.join('\n')}`,
                    });
                }
            }

            // ── Post-execution autonomous workflow ──
            const terminalId = await ensureTerminal();

            // Auto-install dependencies
            const installResult = await autoInstallDependencies(terminalId);
            if (installResult) {
                allResults.push(installResult);
            }

            // Error detection and auto-fix loop
            let retries = 0;
            while (retries < MAX_ERROR_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const errorOutput = await checkTerminalForErrors();
                const failedActions = allResults.filter(r => !r.success);

                if (!errorOutput && failedActions.length === 0) break;

                retries++;
                const errorContext = [
                    failedActions.length > 0
                        ? `Failed actions:\n${failedActions.map(r => `- ${r.action}: ${r.detail} — ${r.error}`).join('\n')}`
                        : '',
                    errorOutput ? `Terminal errors:\n${errorOutput}` : '',
                ].filter(Boolean).join('\n\n');

                addMessage('assistant', `🔄 Detected errors (attempt ${retries}/${MAX_ERROR_RETRIES}). Auto-fixing...`);

                const fixAssistantId = addMessage('assistant', '');
                setStreaming(true, fixAssistantId);

                try {
                    const fixResponse = await sendToAI(
                        `Errors occurred during execution. Fix these issues and provide corrected code:\n\n${errorContext}`,
                        { terminalErrors: errorOutput || undefined, projectFiles: await getProjectFiles() },
                    );
                    const fixResults = await executeActions(fixResponse);
                    allResults = fixResults;

                    // Re-install if new files were written
                    if (fixResults.some(r => r.action === 'file-write' && r.success)) {
                        const reinstall = await autoInstallDependencies(terminalId);
                        if (reinstall) allResults.push(reinstall);
                    }
                } catch (err: any) {
                    useChatStore.getState().updateMessage(fixAssistantId, {
                        content: `⚠️ Auto-fix attempt failed: ${err.message}`,
                        isStreaming: false,
                    });
                    setStreaming(false);
                    break;
                }
            }

            // Launch dev server
            await launchDevServer(terminalId);

            // Final summary
            const totalSuccess = allResults.filter(r => r.success).length;
            const totalFail = allResults.filter(r => !r.success).length;
            if (totalFail === 0 && totalSuccess > 0) {
                addMessage('assistant', `🎉 **All changes applied successfully!** (${totalSuccess} actions completed)`);
            }

        } catch (err: any) {
            addMessage('assistant', `⚠️ Execution failed: ${err.message}`);
            setStreaming(false);
        }

        setExecuting(false);
    }, [addMessage, setStreaming, setPendingPlan, setExecuting, clearExecutionResults, sendToAI, executeActions, getTerminalContext, getProjectFiles, ensureTerminal, autoInstallDependencies, launchDevServer, checkTerminalForErrors, pendingPlanMessageId, addExecutionResult]);

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
            const actions = parseAIResponse(response);

            if (plan) {
                // Has a [PLAN] block — show approve/deny buttons
                setPendingPlan(assistantId);
            } else if (actions.length > 0) {
                // Direct code actions (no plan) — auto-execute immediately
                setExecuting(true);
                clearExecutionResults();
                const results = await executeActions(response);

                // Auto-install dependencies if files were written
                const filesWritten = results.some(r => r.action === 'file-write' && r.success);
                if (filesWritten) {
                    const terminalId = await ensureTerminal();
                    await autoInstallDependencies(terminalId);
                }

                // Summary
                const successCount = results.filter(r => r.success).length;
                const failCount = results.filter(r => !r.success).length;
                if (results.length > 0) {
                    const summaryLines = results.map(r => {
                        const icon = r.success ? '✅' : '❌';
                        const type = r.action === 'file-write' ? '📝' : '💻';
                        return `${icon} ${type} ${r.detail}${r.error ? ` — ${r.error}` : ''}`;
                    });
                    addMessage('assistant', `**Auto-applied ${successCount} change(s)${failCount > 0 ? `, ${failCount} failed` : ''}**\n${summaryLines.join('\n')}`);
                }

                // Error auto-fix loop
                if (failCount > 0) {
                    const failedDetails = results.filter(r => !r.success).map(r => `- ${r.action}: ${r.detail} — ${r.error}`).join('\n');
                    const fixId = addMessage('assistant', '');
                    setStreaming(true, fixId);
                    try {
                        const fixResponse = await sendToAI(
                            `These actions failed. Fix the errors and provide corrected code:\n\n${failedDetails}`,
                            { terminalErrors: await getTerminalContext() || undefined, projectFiles },
                        );
                        const fixResults = await executeActions(fixResponse);
                        const fixSuccess = fixResults.filter(r => r.success).length;
                        if (fixSuccess > 0) {
                            addMessage('assistant', `🔧 Auto-fix applied ${fixSuccess} correction(s)`);
                        }
                    } catch {
                        // Auto-fix failed, user can see the errors
                    }
                }

                setExecuting(false);
            }
        } catch (err: any) {
            useChatStore.getState().updateMessage(assistantId, {
                content: `⚠️ ${err.message}`,
                isStreaming: false,
            });
            setStreaming(false);
        }
    }, [activeTab, rootPath, addMessage, setStreaming, setPendingPlan, setExecuting, clearExecutionResults, sendToAI, executeActions, ensureTerminal, autoInstallDependencies, getTerminalContext, getProjectFiles]);

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

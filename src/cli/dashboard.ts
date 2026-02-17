/**
 * Interactive TUI Dashboard - Real-Time Agent Thinking Visualization
 * Part of The Joker's terminal interface
 * 
 * Features:
 * - Split-pane layout: Agent Thinking (left) | Tool Execution (right)
 * - Stats bar with session metrics at the bottom
 * - Input box for user queries
 * - Color-coded agent states
 * - Keyboard shortcuts for navigation
 */

import * as blessed from 'blessed';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export interface DashboardStats {
    sessionStart: number;
    messageCount: number;
    stepsCompleted: number;
    totalSteps: number;
    corrections: number;
    agentState: string;
    modelName: string;
    currentIteration: number;
}

export interface DashboardThought {
    reasoning: string;
    confidence?: number;
    type?: string;
}

export interface DashboardStepInfo {
    id?: string;
    tool: string;
    description: string;
    params?: Record<string, unknown>;
}

export interface DashboardStepResult {
    success: boolean;
    metadata: {
        executionTime: number;
        toolName?: string;
    };
    data?: unknown;
    error?: string;
}

export interface DashboardPlan {
    id: string;
    intent: string;
    query: string;
    steps: Array<{ description: string }>;
}

export interface DashboardCorrection {
    strategy: string;
    attempt: number;
    maxAttempts: number;
    reason?: string;
}

// State color map
const STATE_COLORS: Record<string, string> = {
    IDLE: 'gray',
    THINKING: 'cyan',
    PLANNING: 'yellow',
    ACTING: 'green',
    OBSERVING: 'blue',
    CORRECTING: 'red',
    COMPLETE: 'green',
    FAILED: 'red',
};

const STATE_ICONS: Record<string, string> = {
    IDLE: '💤',
    THINKING: '🧠',
    PLANNING: '📋',
    ACTING: '⚡',
    OBSERVING: '👁️',
    CORRECTING: '🔄',
    COMPLETE: '✅',
    FAILED: '❌',
};

// ============================================
// JokerDashboard
// ============================================

/**
 * JokerDashboard — Blessed-based split-pane TUI for real-time agent visualization
 */
export class JokerDashboard extends EventEmitter {
    private screen!: blessed.Widgets.Screen;
    private thoughtPane!: blessed.Widgets.Log;
    private toolPane!: blessed.Widgets.Log;
    private statsBar!: blessed.Widgets.BoxElement;
    private inputBox!: blessed.Widgets.TextboxElement;
    private headerBar!: blessed.Widgets.BoxElement;
    private initialized: boolean = false;
    private stats: DashboardStats;
    private statsInterval: NodeJS.Timeout | null = null;
    private visible: boolean = false;

    constructor() {
        super();
        this.stats = {
            sessionStart: Date.now(),
            messageCount: 0,
            stepsCompleted: 0,
            totalSteps: 0,
            corrections: 0,
            agentState: 'IDLE',
            modelName: 'qwen2.5-coder-14b',
            currentIteration: 0,
        };
    }

    // ============================================
    // Initialization
    // ============================================

    /**
     * Initialize the blessed screen and layout
     */
    initialize(): void {
        if (this.initialized) return;

        this.screen = blessed.screen({
            smartCSR: true,
            title: '🃏 The Joker — Interactive Dashboard',
            cursor: {
                artificial: true,
                shape: 'line',
                blink: true,
                color: 'cyan',
            },
            fullUnicode: true,
        } as any);

        this.createLayout();
        this.bindKeys();

        this.initialized = true;
        logger.info('[Dashboard] Initialized');
    }

    /**
     * Create the split-pane layout
     */
    private createLayout(): void {
        // ─── Header Bar ───
        this.headerBar = blessed.box({
            parent: this.screen,
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            content: ' 🃏 {bold}The Joker{/bold} — Interactive Dashboard                                      {gray-fg}[Tab] Switch Pane  [q] Quit  [c] Clear{/gray-fg}',
            tags: true,
            style: {
                fg: 'white',
                bg: 'black',
                bold: true,
            },
            border: {
                type: 'line',
            },
            style2: {
                border: {
                    fg: 'magenta',
                },
            },
        } as any);

        // ─── Left Pane: Agent Thinking ───
        this.thoughtPane = blessed.log({
            parent: this.screen,
            label: ' 🧠 Agent Thinking ',
            top: 3,
            left: 0,
            width: '50%',
            height: '70%-3',
            border: {
                type: 'line',
            },
            style: {
                fg: 'white',
                bg: 'default',
                border: {
                    fg: 'cyan',
                },
                label: {
                    fg: 'cyan',
                    bold: true,
                },
            },
            scrollable: true,
            scrollbar: {
                style: {
                    bg: 'cyan',
                },
            },
            mouse: true,
            keys: true,
            tags: true,
            padding: {
                left: 1,
                right: 1,
            },
        } as any);

        // ─── Right Pane: Tool Execution ───
        this.toolPane = blessed.log({
            parent: this.screen,
            label: ' 🔄 Tool Execution ',
            top: 3,
            right: 0,
            width: '50%',
            height: '70%-3',
            border: {
                type: 'line',
            },
            style: {
                fg: 'white',
                bg: 'default',
                border: {
                    fg: 'green',
                },
                label: {
                    fg: 'green',
                    bold: true,
                },
            },
            scrollable: true,
            scrollbar: {
                style: {
                    bg: 'green',
                },
            },
            mouse: true,
            keys: true,
            tags: true,
            padding: {
                left: 1,
                right: 1,
            },
        } as any);

        // ─── Stats Bar ───
        this.statsBar = blessed.box({
            parent: this.screen,
            label: ' 📊 Stats ',
            bottom: 3,
            left: 0,
            width: '100%',
            height: '30%-3',
            border: {
                type: 'line',
            },
            style: {
                fg: 'white',
                bg: 'default',
                border: {
                    fg: 'yellow',
                },
                label: {
                    fg: 'yellow',
                    bold: true,
                },
            },
            tags: true,
            padding: {
                left: 1,
                right: 1,
            },
        } as any);

        // ─── Input Box ───
        this.inputBox = blessed.textbox({
            parent: this.screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 3,
            border: {
                type: 'line',
            },
            style: {
                fg: 'white',
                bg: 'default',
                border: {
                    fg: 'magenta',
                },
            },
            label: ' 🃏 Enter query ',
            inputOnFocus: true,
            mouse: true,
            keys: true,
        } as any);

        // Handle input submission
        this.inputBox.on('submit', (value: string) => {
            if (value && value.trim()) {
                this.stats.messageCount++;
                this.addThought({
                    reasoning: `Processing: "${value.trim()}"`,
                    type: 'input',
                });
                this.emit('input', value.trim());
            }
            this.inputBox.clearValue();
            this.inputBox.focus();
            this.screen.render();
        });

        // Update stats display
        this.updateStatsDisplay();
    }

    /**
     * Bind keyboard shortcuts
     */
    private bindKeys(): void {
        // Quit
        this.screen.key(['q', 'C-c'], () => {
            this.emit('quit');
            this.destroy();
        });

        // Tab between panes
        this.screen.key(['tab'], () => {
            if ((this.screen as any).focused === this.thoughtPane) {
                this.toolPane.focus();
            } else if ((this.screen as any).focused === this.toolPane) {
                this.inputBox.focus();
            } else {
                this.thoughtPane.focus();
            }
            this.screen.render();
        });

        // Clear panes
        this.screen.key(['c'], () => {
            if ((this.screen as any).focused !== this.inputBox) {
                this.clearPanes();
            }
        });

        // Focus input
        this.screen.key(['i', 'enter'], () => {
            this.inputBox.focus();
            this.screen.render();
        });

        // Escape from input
        this.inputBox.key(['escape'], () => {
            this.thoughtPane.focus();
            this.screen.render();
        });
    }

    // ============================================
    // Public API — Widget Updates
    // ============================================

    /**
     * Add a thought to the left pane
     */
    addThought(thought: DashboardThought): void {
        if (!this.initialized) return;

        const timestamp = this.getTimestamp();

        if (thought.confidence !== undefined) {
            const pct = Math.round(thought.confidence * 100);
            const color = pct > 80 ? 'green' : pct > 50 ? 'yellow' : 'red';
            this.thoughtPane.log(
                `{gray-fg}${timestamp}{/} {${color}-fg}[${pct}%]{/} ${thought.reasoning}`
            );
        } else {
            const icon = thought.type === 'input' ? '💬' : '💭';
            this.thoughtPane.log(
                `{gray-fg}${timestamp}{/} ${icon} ${thought.reasoning}`
            );
        }

        this.screen.render();
    }

    /**
     * Add a state change notification to the thought pane
     */
    addStateChange(from: string, to: string): void {
        if (!this.initialized) return;

        const timestamp = this.getTimestamp();
        const icon = STATE_ICONS[to] || '🔹';
        const color = STATE_COLORS[to] || 'white';

        this.stats.agentState = to;
        this.thoughtPane.log(
            `{gray-fg}${timestamp}{/} ${icon} {${color}-fg}{bold}State: ${from} → ${to}{/}`
        );
        this.updateStatsDisplay();
        this.screen.render();
    }

    /**
     * Show a plan in the thought pane
     */
    addPlan(plan: DashboardPlan): void {
        if (!this.initialized) return;

        const timestamp = this.getTimestamp();
        this.stats.totalSteps = plan.steps.length;

        this.thoughtPane.log('');
        this.thoughtPane.log(
            `{gray-fg}${timestamp}{/} {yellow-fg}{bold}📋 Plan: ${plan.steps.length} steps{/}`
        );
        this.thoughtPane.log(
            `{gray-fg}   Intent: ${plan.intent} | Query: "${plan.query.slice(0, 50)}..."{/}`
        );

        plan.steps.forEach((step: { description: string }, i: number) => {
            this.thoughtPane.log(
                `{gray-fg}   ${i + 1}. ${step.description}{/}`
            );
        });

        this.thoughtPane.log('');
        this.updateStatsDisplay();
        this.screen.render();
    }

    /**
     * Show tool execution start in the right pane
     */
    addToolStart(step: DashboardStepInfo): void {
        if (!this.initialized) return;

        const timestamp = this.getTimestamp();
        this.toolPane.log('');
        this.toolPane.log(
            `{gray-fg}${timestamp}{/} {yellow-fg}▶{/} {bold}${step.tool}{/}`
        );
        this.toolPane.log(
            `{gray-fg}   ${step.description}{/}`
        );

        if (step.params && Object.keys(step.params).length > 0) {
            const paramsStr = JSON.stringify(step.params, null, 0);
            const truncated = paramsStr.length > 60 ? paramsStr.substring(0, 60) + '...' : paramsStr;
            this.toolPane.log(`{gray-fg}   params: ${truncated}{/}`);
        }

        this.toolPane.log(`{gray-fg}   ⏱ running...{/}`);
        this.screen.render();
    }

    /**
     * Show tool execution result in the right pane
     */
    addToolResult(step: DashboardStepInfo, result: DashboardStepResult): void {
        if (!this.initialized) return;

        const time = (result.metadata.executionTime / 1000).toFixed(1);

        if (result.success) {
            this.stats.stepsCompleted++;
            let summary = '';
            if (result.data && typeof result.data === 'object') {
                const dataStr = JSON.stringify(result.data, null, 0);
                summary = dataStr.length > 50 ? dataStr.substring(0, 50) + '...' : dataStr;
            }
            this.toolPane.log(
                `   {green-fg}✅ ${time}s{/}${summary ? ` — ${summary}` : ''}`
            );
        } else {
            this.toolPane.log(
                `   {red-fg}❌ ${time}s — ${result.error || 'Failed'}{/}`
            );
        }

        this.updateStatsDisplay();
        this.screen.render();
    }

    /**
     * Show a correction event
     */
    addCorrection(correction: DashboardCorrection): void {
        if (!this.initialized) return;

        this.stats.corrections++;
        const timestamp = this.getTimestamp();

        this.thoughtPane.log(
            `{gray-fg}${timestamp}{/} {red-fg}{bold}🔄 Self-Correction{/}`
        );
        this.thoughtPane.log(
            `{red-fg}   Strategy: ${correction.strategy} (${correction.attempt}/${correction.maxAttempts}){/}`
        );
        if (correction.reason) {
            this.thoughtPane.log(
                `{red-fg}   Reason: ${correction.reason}{/}`
            );
        }

        this.toolPane.log(
            `{gray-fg}${this.getTimestamp()}{/} {red-fg}⚡ Correction: ${correction.strategy}{/}`
        );

        this.updateStatsDisplay();
        this.screen.render();
    }

    /**
     * Show goal achieved
     */
    addGoalAchieved(result: { success: boolean; totalTime: number; iterations: number; finalAnswer?: string }): void {
        if (!this.initialized) return;

        const timestamp = this.getTimestamp();
        this.thoughtPane.log('');
        this.thoughtPane.log(
            `{gray-fg}${timestamp}{/} {green-fg}{bold}✅ Goal Achieved!{/}`
        );
        this.thoughtPane.log(
            `{green-fg}   Time: ${result.totalTime}ms | Iterations: ${result.iterations}{/}`
        );

        if (result.finalAnswer) {
            const truncated = result.finalAnswer.length > 200
                ? result.finalAnswer.substring(0, 200) + '...'
                : result.finalAnswer;
            this.thoughtPane.log('');
            this.thoughtPane.log(`{white-fg}{bold}Answer:{/}`);
            truncated.split('\n').slice(0, 5).forEach(line => {
                this.thoughtPane.log(`{white-fg}  ${line}{/}`);
            });
        }

        this.thoughtPane.log('');
        this.addStateChange(this.stats.agentState, 'COMPLETE');
    }

    /**
     * Show goal failed
     */
    addGoalFailed(error: string): void {
        if (!this.initialized) return;

        const timestamp = this.getTimestamp();
        this.thoughtPane.log('');
        this.thoughtPane.log(
            `{gray-fg}${timestamp}{/} {red-fg}{bold}❌ Goal Failed{/}`
        );
        this.thoughtPane.log(
            `{red-fg}   ${error}{/}`
        );
        this.thoughtPane.log('');
        this.addStateChange(this.stats.agentState, 'FAILED');
    }

    /**
     * Add an info message to the thought pane
     */
    addInfo(message: string): void {
        if (!this.initialized) return;

        this.thoughtPane.log(
            `{gray-fg}${this.getTimestamp()}{/} {blue-fg}ℹ ${message}{/}`
        );
        this.screen.render();
    }

    // ============================================
    // Stats Display
    // ============================================

    private updateStatsDisplay(): void {
        if (!this.statsBar) return;

        const uptime = this.formatDuration(Date.now() - this.stats.sessionStart);
        const stateColor = STATE_COLORS[this.stats.agentState] || 'white';
        const stateIcon = STATE_ICONS[this.stats.agentState] || '🔹';

        const stepsDisplay = this.stats.totalSteps > 0
            ? `${this.stats.stepsCompleted}/${this.stats.totalSteps}`
            : '0';

        // Build a multi-line stats display
        const lines = [
            ``,
            ` ${stateIcon} {${stateColor}-fg}{bold}State: ${this.stats.agentState}{/}     ⏱ {white-fg}Session: ${uptime}{/}     💬 {white-fg}Messages: ${this.stats.messageCount}{/}`,
            ``,
            ` 🔧 {white-fg}Steps: ${stepsDisplay}{/}     🔄 {white-fg}Corrections: ${this.stats.corrections}{/}     🔁 {white-fg}Iteration: ${this.stats.currentIteration}{/}     🤖 {white-fg}Model: ${this.stats.modelName}{/}`,
            ``,
        ];

        this.statsBar.setContent(lines.join('\n'));
    }

    /**
     * Start periodic stats refresh
     */
    startStatsRefresh(intervalMs: number = 1000): void {
        this.stopStatsRefresh();
        this.statsInterval = setInterval(() => {
            this.updateStatsDisplay();
            if (this.screen) {
                this.screen.render();
            }
        }, intervalMs);
    }

    /**
     * Stop periodic stats refresh
     */
    stopStatsRefresh(): void {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }

    // ============================================
    // Controls
    // ============================================

    /**
     * Show the dashboard
     */
    show(): void {
        if (!this.initialized) {
            this.initialize();
        }
        this.visible = true;
        this.startStatsRefresh();
        this.inputBox.focus();
        this.screen.render();
        logger.info('[Dashboard] Shown');
    }

    /**
     * Hide the dashboard (returns to regular REPL)
     */
    hide(): void {
        this.visible = false;
        this.stopStatsRefresh();
        if (this.screen) {
            this.screen.destroy();
            this.initialized = false;
        }
        logger.info('[Dashboard] Hidden');
    }

    /**
     * Check if dashboard is currently visible
     */
    isVisible(): boolean {
        return this.visible;
    }

    /**
     * Clear both panes
     */
    clearPanes(): void {
        if (!this.initialized) return;

        this.thoughtPane.setContent('');
        this.toolPane.setContent('');
        this.addInfo('Panes cleared');
        this.screen.render();
    }

    /**
     * Destroy the dashboard and clean up resources
     */
    destroy(): void {
        this.stopStatsRefresh();
        if (this.screen) {
            this.screen.destroy();
        }
        this.visible = false;
        this.initialized = false;
        logger.info('[Dashboard] Destroyed');
    }

    /**
     * Update the model name displayed
     */
    setModelName(name: string): void {
        this.stats.modelName = name;
        this.updateStatsDisplay();
    }

    /**
     * Update the current iteration
     */
    setIteration(iteration: number): void {
        this.stats.currentIteration = iteration;
        this.updateStatsDisplay();
    }

    /**
     * Reset stats for a new session
     */
    resetStats(): void {
        this.stats = {
            sessionStart: Date.now(),
            messageCount: 0,
            stepsCompleted: 0,
            totalSteps: 0,
            corrections: 0,
            agentState: 'IDLE',
            modelName: this.stats.modelName,
            currentIteration: 0,
        };
        this.updateStatsDisplay();
    }

    // ============================================
    // Helpers
    // ============================================

    private getTimestamp(): string {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000) % 60;
        const minutes = Math.floor(ms / 60000) % 60;
        const hours = Math.floor(ms / 3600000);
        if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    }
}

// ============================================
// Export singleton
// ============================================

export const jokerDashboard = new JokerDashboard();
export default JokerDashboard;

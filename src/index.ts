/**
 * The Joker - Agentic Terminal
 * Main Entry Point
 */

import { Terminal, terminal, theme, commandRegistry, display, progressTracker } from './cli/index.js';
import { LMStudioClient, lmStudioClient } from './llm/client.js';
import { AirLLMBridge } from './llm/airllm-bridge.js';
import { SYSTEM_PROMPT_AGENT } from './llm/prompts.js';
import { logger } from './utils/logger.js';
import { config, llmConfig, airllmConfig, paths } from './utils/config.js';
import { ChatMessage } from './types/index.js';
import { JokerAgent, getAgent, AgentState, getMemory } from './agents/index.js';
import { ReconPipeline } from './tools/recon.js';
import { JokerDashboard } from './cli/dashboard.js';
import { VibeCodingPipeline } from './agents/vibe-coder.js';

/**
 * Main application class
 */
class TheJoker {
  private terminal: Terminal;
  private llmClient: LMStudioClient;
  private agent: JokerAgent | null = null;
  private dashboard: JokerDashboard;
  private conversationHistory: ChatMessage[] = [];
  private systemPrompt: string;
  private agentMode: boolean = true; // Use autonomous agent by default
  private dashboardMode: boolean = false; // TUI dashboard mode
  private airllmBridge: AirLLMBridge | null = null; // AirLLM sidecar bridge

  constructor() {
    this.terminal = terminal;
    this.llmClient = lmStudioClient;
    this.dashboard = new JokerDashboard();

    // System prompt for The Joker agent
    this.systemPrompt = SYSTEM_PROMPT_AGENT;

    // Initialize conversation with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: this.systemPrompt,
    });
  }

  private static readonly VERSION = '1.1.1';
  private activeBackend: 'lmstudio' | 'airllm' = 'lmstudio';

  /**
   * Initialize the application
   */
  async initialize(): Promise<boolean> {
    logger.info('Initializing The Joker...');

    // Show initial banner (generic)
    this.terminal.showBanner(TheJoker.VERSION, '...', 'Initializing');

    // ── Backend selection ────────────────────────────────────
    this.terminal.print('\n🎭 Choose your LLM backend:\n', 'primary');
    this.terminal.print('  1. LM Studio  — Local inference (default)', 'info');
    this.terminal.print('  2. AirLLM     — 70B models on 4GB RAM (requires Python)\n', 'info');

    const backendChoice = await this.terminal.select<string>(
      'Select backend',
      ['LM Studio (default)', 'AirLLM (70B on 4GB RAM)'],
    );

    const useAirLLM = backendChoice.startsWith('AirLLM');
    let activeModel = llmConfig.model;
    let activeBackendLabel = 'LM Studio';

    if (useAirLLM) {
      // ── Start AirLLM sidecar ─────────────────────────────
      this.terminal.print('\n⚡ Starting AirLLM sidecar server...', 'warning');
      this.terminal.print('⚠️  First run will download the model — this can take a while.', 'warning');
      this.terminal.print('⚠️  Each response may take 30-120 seconds on CPU.\n', 'warning');

      try {
        this.airllmBridge = new AirLLMBridge();
        await this.airllmBridge.start();

        // Switch LLM client to the AirLLM-proxied client
        this.llmClient = this.airllmBridge.getClient();
        this.activeBackend = 'airllm';
        activeModel = airllmConfig.model;
        activeBackendLabel = 'AirLLM';

        this.terminal.spinnerSuccess('AirLLM sidecar started');
      } catch (error) {
        const err = error as Error;
        this.terminal.print(`\n❌ Failed to start AirLLM: ${err.message}`, 'error');
        this.terminal.print('Falling back to LM Studio backend.\n', 'warning');
      }
    }

    // ── Connect to the chosen backend ────────────────────────
    this.terminal.startSpinner(`Connecting to ${activeBackendLabel}...`);
    const connected = await this.llmClient.testConnection();

    if (!connected) {
      this.terminal.spinnerFail(`Failed to connect to ${activeBackendLabel}`);
      if (this.activeBackend === 'lmstudio') {
        this.terminal.print(`\nMake sure LM Studio is running at ${llmConfig.baseUrl}`, 'warning');
        this.terminal.print(`and has a model loaded (${llmConfig.model})`, 'warning');
      } else {
        this.terminal.print('\nMake sure the AirLLM sidecar started successfully.', 'warning');
      }
      return false;
    }

    this.terminal.spinnerSuccess(`Connected to ${activeBackendLabel}`);

    // ── Initialize agent ─────────────────────────────────────
    this.terminal.startSpinner('Initializing agent...');
    try {
      this.agent = getAgent(this.llmClient, {
        maxIterations: 10,
        maxCorrections: 3,
        enableLearning: true,
        verboseMode: false,
      });

      this.setupAgentEvents();
      this.terminal.spinnerSuccess('Agent initialized');
    } catch (error) {
      this.terminal.spinnerFail('Failed to initialize agent');
      logger.error('Agent initialization failed', { error });
      this.agentMode = false;
    }

    // ── Show banner with active config ───────────────────────
    this.terminal.showBanner(TheJoker.VERSION, activeModel, activeBackendLabel);

    this.terminal.print(`Model: ${activeModel}`, 'muted');
    this.terminal.print(`Backend: ${activeBackendLabel}`, 'muted');
    this.terminal.print(`Mode: ${this.agentMode ? 'Autonomous Agent' : 'Simple Chat'}`, 'muted');
    this.terminal.print('\nType "help" for available commands\n', 'info');

    return true;
  }

  /**
   * Set up agent event handlers for real-time feedback
   */
  private setupAgentEvents(): void {
    if (!this.agent) return;

    this.agent.on('state:change', ({ from, to }) => {
      logger.debug('Agent state changed', { from, to });

      // Show state transitions to user
      switch (to) {
        case AgentState.THINKING:
          if (this.dashboardMode) {
            this.dashboard.addStateChange(from, 'THINKING');
          } else {
            display.agentThinking('Analyzing your request...');
          }
          break;
        case AgentState.PLANNING:
          if (this.dashboardMode) {
            this.dashboard.addStateChange(from, 'PLANNING');
          } else {
            display.agentAction('Creating action plan...');
          }
          break;
        case AgentState.ACTING:
          if (this.dashboardMode) {
            this.dashboard.addStateChange(from, 'ACTING');
          } else {
            display.agentAction('Executing plan...');
          }
          break;
        case AgentState.OBSERVING:
          if (this.dashboardMode) {
            this.dashboard.addStateChange(from, 'OBSERVING');
          } else {
            display.agentThinking('Analyzing results...');
          }
          break;
        case AgentState.CORRECTING:
          if (this.dashboardMode) {
            this.dashboard.addStateChange(from, 'CORRECTING');
          } else {
            display.agentThinking('Self-correcting...');
          }
          break;
      }
    });

    this.agent.on('thought', (thought) => {
      logger.debug('Agent thought', { thought: thought.reasoning.slice(0, 100) });
      if (this.dashboardMode) {
        this.dashboard.addThought({
          reasoning: thought.reasoning,
          confidence: thought.confidence,
        });
      }
    });

    this.agent.on('plan:created', (plan) => {
      logger.debug('Plan created', {
        planId: plan.id,
        steps: plan.steps.length,
        intent: plan.intent
      });

      // Show plan summary to user
      if (this.dashboardMode) {
        this.dashboard.addPlan({
          id: plan.id,
          intent: plan.intent,
          query: plan.query,
          steps: plan.steps,
        });
      } else {
        this.terminal.print(`\n📋 Plan: ${plan.steps.length} steps for "${plan.query.slice(0, 50)}..."`, 'info');
        plan.steps.forEach((step: { description: string }, i: number) => {
          this.terminal.print(`   ${i + 1}. ${step.description}`, 'muted');
        });
        this.terminal.print('', 'muted');
      }
    });

    this.agent.on('step:complete', ({ step, result }) => {
      const status = result.success ? '✓' : '✗';
      logger.debug('Step complete', {
        step: step.id,
        success: result.success,
        time: result.metadata.executionTime
      });
      if (this.dashboardMode) {
        this.dashboard.addToolResult(
          { tool: step.tool, description: step.description, id: step.id },
          result
        );
      }
    });

    this.agent.on('correction', (correction) => {
      if (this.dashboardMode) {
        this.dashboard.addCorrection(correction);
      } else {
        this.terminal.print(`⚡ Self-correction: ${correction.strategy} (attempt ${correction.attempt}/${correction.maxAttempts})`, 'warning');
      }
    });

    this.agent.on('goal:achieved', (result) => {
      logger.info('Goal achieved', {
        success: result.success,
        time: result.totalTime,
        iterations: result.iterations,
      });
      if (this.dashboardMode) {
        this.dashboard.addGoalAchieved(result);
      }
    });

    this.agent.on('goal:failed', ({ error }) => {
      logger.error('Goal failed', { error });
      if (this.dashboardMode) {
        this.dashboard.addGoalFailed(error);
      }
    });
  }

  /**
   * Process user input with autonomous agent
   */
  async processInputWithAgent(input: string): Promise<void> {
    if (!this.agent) {
      return this.processInput(input);
    }

    logger.debug('Processing with agent', { input });

    // Start progress tracking
    const steps = ['Thinking', 'Planning', 'Executing', 'Observing', 'Synthesizing'];
    progressTracker.start('Processing request', steps);
    progressTracker.startStep('thinking', 'Analyzing your request...');

    try {
      // Run the agent
      const result = await this.agent.run(input);

      progressTracker.completeStep('synthesizing', 'Complete');

      // Display the final answer
      console.log(''); // Empty line before response
      console.log(display.agentResult(result.finalAnswer));

      // Show stats if verbose
      if (result.iterations > 1 || result.corrections.length > 0) {
        this.terminal.print(`\n📊 Stats: ${result.iterations} iteration(s), ${result.corrections.length} correction(s), ${result.totalTime}ms`, 'muted');
      }

    } catch (error) {
      progressTracker.failStep('thinking', 'Failed');
      const err = error as Error;
      this.terminal.print(`Error: ${err.message}`, 'error');
      logger.error('Agent error', { error: err.message, stack: err.stack });
    }
  }

  /**
   * Process user input (simple chat mode - fallback)
   */
  async processInput(input: string): Promise<void> {
    logger.debug('Processing input (simple mode)', { input });

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: input,
    });

    // Start processing indicator
    this.terminal.startSpinner('Thinking...');

    try {
      // Send to LLM
      const response = await this.llmClient.chat(this.conversationHistory);

      this.terminal.stopSpinner();

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response.content,
      });

      // Display response
      this.terminal.displayAgentResponse(response.content);

      // Log usage stats
      if (response.usage) {
        logger.debug('Token usage', response.usage);
      }
    } catch (error) {
      this.terminal.spinnerFail('Error processing request');
      const err = error as Error;
      this.terminal.print(`Error: ${err.message}`, 'error');
      logger.error('LLM error', { error: err.message, stack: err.stack });
    }
  }

  /**
   * Start the REPL
   */
  async start(): Promise<void> {
    const initialized = await this.initialize();

    if (!initialized) {
      this.terminal.print('\nPress Enter to retry or Ctrl+C to exit...', 'warning');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return this.start();
    }

    // Register additional commands for agent control
    this.registerAgentCommands();

    // Start interactive loop - use agent mode
    await this.terminal.startREPL(async (input) => {
      if (this.agentMode && this.agent) {
        await this.processInputWithAgent(input);
      } else {
        await this.processInput(input);
      }
    });
  }

  /**
   * Register agent-specific commands
   */
  private registerAgentCommands(): void {
    commandRegistry.register({
      name: 'agent',
      aliases: ['mode'],
      description: 'Toggle agent mode on/off',
      category: 'agent',
      execute: async () => {
        this.agentMode = !this.agentMode;
        this.terminal.print(`Agent mode: ${this.agentMode ? 'ON (autonomous)' : 'OFF (simple chat)'}`, 'success');
        return { success: true };
      },
    });

    commandRegistry.register({
      name: 'memory',
      aliases: ['mem'],
      description: 'Show agent memory statistics',
      category: 'agent',
      execute: async () => {
        const memory = getMemory();
        const stats = memory.getStats();

        display.box('Agent Memory', [
          `Sessions: ${stats.sessions}`,
          `Messages: ${stats.messages}`,
          `Thoughts: ${stats.thoughts}`,
          `Observations: ${stats.observations}`,
          `Patterns: ${stats.patterns}`,
          `Site Knowledge: ${stats.siteKnowledge}`,
        ].join('\n'));
        return { success: true };
      },
    });

    commandRegistry.register({
      name: 'agent-status',
      aliases: ['astatus'],
      description: 'Show current agent status',
      category: 'agent',
      execute: async () => {
        if (!this.agent) {
          this.terminal.print('Agent not initialized', 'warning');
          return { success: false };
        }

        const stats = this.agent.getStats();
        display.box('Agent Status', [
          `State: ${stats.state}`,
          `Thoughts: ${stats.thoughtsCount}`,
          `Observations: ${stats.observationsCount}`,
          `Corrections: ${stats.correctionsCount}`,
          `Current Iteration: ${stats.currentIteration}`,
        ].join('\n'));
        return { success: true };
      },
    });

    commandRegistry.register({
      name: 'reset-agent',
      aliases: ['areset'],
      description: 'Reset agent state',
      category: 'agent',
      execute: async () => {
        if (this.agent) {
          this.agent.reset();
          this.terminal.print('Agent state reset', 'success');
          return { success: true };
        } else {
          this.terminal.print('Agent not initialized', 'warning');
          return { success: false };
        }
      },
    });

    // ============================================
    // 🖥️ TUI Dashboard Command — Interactive Mode
    // ============================================
    commandRegistry.register({
      name: 'tui',
      aliases: ['dashboard', 'ui'],
      description: 'Toggle interactive TUI dashboard with live agent visualization',
      category: 'agent',
      execute: async () => {
        this.dashboardMode = !this.dashboardMode;
        if (this.dashboardMode) {
          this.terminal.print('🖥️  Launching TUI Dashboard...', 'info');
          this.terminal.print('   [Tab] Switch pane  [q] Quit  [c] Clear  [i/Enter] Focus input  [Esc] Back', 'muted');

          // Small delay to let the message display before blessed takes over the screen
          await new Promise(resolve => setTimeout(resolve, 500));

          this.dashboard.setModelName(llmConfig.model);
          this.dashboard.show();

          // Wire dashboard input to agent processing
          this.dashboard.on('input', async (input: string) => {
            if (this.agent) {
              await this.processInputWithAgent(input);
            }
          });

          // Wire quit to exit dashboard mode
          this.dashboard.on('quit', () => {
            this.dashboardMode = false;
            this.terminal.print('Returned to standard terminal mode', 'success');
          });
        } else {
          this.dashboard.hide();
          this.terminal.print('TUI Dashboard disabled — back to standard mode', 'success');
        }
        return { success: true };
      },
    });

    // ============================================
    // 🎨 Vibe Coding Command — Natural Language → Running App
    // ============================================
    let vibePipeline: VibeCodingPipeline | null = null;

    commandRegistry.register({
      name: 'vibe',
      aliases: ['build', 'create-app'],
      description: 'Build a complete app from a natural language description',
      category: 'tools',
      execute: async (args) => {
        const prompt = args && args.length > 0 ? args.join(' ') : null;
        if (!prompt) {
          this.terminal.print('Usage: vibe <description>', 'warning');
          this.terminal.print('Example: vibe Build me a portfolio website with dark mode and a contact form', 'muted');
          return { success: false };
        }

        // If there's a live session, refine instead of re-creating
        if (vibePipeline && vibePipeline.isLiveSession()) {
          this.terminal.print(`\n🔄 Refining live project...`, 'info');
          const result = await vibePipeline.refine(prompt);
          if (result.success) {
            this.terminal.print(`✅ Updated ${result.filesChanged.length} files — HMR will pick up changes!`, 'success');
          } else {
            this.terminal.print('❌ Refinement failed', 'error');
          }
          return { success: result.success };
        }

        this.terminal.print(`\n🎨 Vibe Coding Mode`, 'info');
        this.terminal.print(`   "${prompt}"`, 'muted');
        this.terminal.print('   This may take 1-3 minutes...\n', 'muted');

        vibePipeline = new VibeCodingPipeline(this.llmClient as any);

        // Wire step events to display
        vibePipeline.on('step:detail', ({ message }: { step: string; message: string }) => {
          this.terminal.print(`   ${message}`, 'info');
        });
        vibePipeline.on('step:complete', (step: string) => {
          this.terminal.print(`   ✅ ${step}`, 'success');
        });
        vibePipeline.on('pipeline:error', ({ error }: { error: string }) => {
          this.terminal.print(`   ❌ ${error}`, 'error');
        });

        try {
          const result = await vibePipeline.run(prompt);

          if (result.success) {
            this.terminal.print('\n' + '═'.repeat(50), 'success');
            this.terminal.print(`🚀 App live at: ${result.devServerUrl}`, 'success');
            this.terminal.print(`📁 Project: ${result.projectPath}`, 'info');
            this.terminal.print(`🧬 ${result.filesGenerated.length} files generated`, 'info');
            this.terminal.print(`⏱ Total: ${(result.totalTimeMs / 1000).toFixed(1)}s`, 'muted');
            this.terminal.print('═'.repeat(50), 'success');
            this.terminal.print('\n💡 Type another `vibe` prompt to refine the app, or `vibe-stop` to stop the server.\n', 'muted');
          } else {
            this.terminal.print(`\n❌ Vibe coding failed: ${result.errors.join(', ')}`, 'error');
          }

          return { success: result.success, data: result };
        } catch (error) {
          const err = error as Error;
          this.terminal.print(`\n❌ Vibe coding failed: ${err.message}`, 'error');
          logger.error('Vibe coding error', { error: err.message });
          return { success: false };
        }
      },
    });

    commandRegistry.register({
      name: 'vibe-stop',
      aliases: ['stop-dev'],
      description: 'Stop the running vibe coding dev server',
      category: 'tools',
      execute: async () => {
        if (vibePipeline && vibePipeline.isLiveSession()) {
          await vibePipeline.cleanup();
          this.terminal.print('🛑 Dev server stopped', 'success');
          vibePipeline = null;
        } else {
          this.terminal.print('No vibe coding session running', 'warning');
        }
        return { success: true };
      },
    });

    // ============================================
    // 🔍 Recon Command — Domain Reconnaissance
    // ============================================
    commandRegistry.register({
      name: 'recon',
      aliases: ['scan', 'osint', 'investigate'],
      description: 'Run passive reconnaissance on a domain (DNS, WHOIS, SSL, tech stack, emails, social links)',
      category: 'tools',
      execute: async (args) => {
        const domain = args && args.length > 0 ? args[0] : null;
        if (!domain) {
          this.terminal.print('Usage: recon <domain>', 'warning');
          this.terminal.print('Example: recon example.com', 'muted');
          return { success: false };
        }

        this.terminal.print(`\n🔍 Starting reconnaissance on: ${domain}`, 'info');
        this.terminal.print('   This may take 15-30 seconds...\n', 'muted');

        const pipeline = new ReconPipeline();

        // Show real-time progress
        pipeline.on('module:start', (name: string) => {
          this.terminal.print(`   🔄 ${name}...`, 'muted');
        });
        pipeline.on('module:complete', (name: string) => {
          this.terminal.print(`   ✅ ${name}`, 'success');
        });

        try {
          const result = await pipeline.recon(domain);
          const report = pipeline.generateReport(result);

          // Save report to file
          const fs = await import('fs');
          const path = await import('path');
          const reportsDir = path.resolve(process.cwd(), 'reports');
          if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
          }
          const cleanDomain = domain.replace(/[^a-zA-Z0-9.\-]/g, '_');
          const reportPath = path.join(reportsDir, `${cleanDomain}-recon.md`);
          fs.writeFileSync(reportPath, report, 'utf-8');

          // Show summary
          this.terminal.print(`\n📊 Security Score: ${result.securityScore}/100`, result.securityScore >= 70 ? 'success' : 'warning');
          this.terminal.print(`💻 Tech Stack: ${result.techStack.detected.map(t => t.name).join(', ') || 'None detected'}`, 'info');
          this.terminal.print(`📧 Emails: ${result.emails.length > 0 ? result.emails.join(', ') : 'None found'}`, 'info');
          this.terminal.print(`🔗 Links: ${result.links.internal} internal, ${result.links.external} external`, 'info');
          this.terminal.print(`\n📄 Full report saved to: ${reportPath}`, 'success');

          return { success: true, data: result };
        } catch (error) {
          const err = error as Error;
          this.terminal.print(`\n❌ Recon failed: ${err.message}`, 'error');
          logger.error('Recon error', { error: err.message });
          return { success: false };
        }
      },
    });

    // ============================================
    // 🧠 AirLLM Commands — 70B Models on 4GB RAM
    // ============================================
    commandRegistry.register({
      name: 'airllm',
      aliases: ['air', '70b'],
      description: 'Switch to AirLLM backend — run 70B models on 4GB RAM',
      category: 'tools',
      execute: async (args) => {
        if (this.airllmBridge?.isReady()) {
          this.terminal.print('AirLLM is already running!', 'warning');
          this.terminal.print(`Model: ${airllmConfig.model}`, 'muted');
          this.terminal.print(`Sidecar PID: ${this.airllmBridge.getPid()}`, 'muted');
          return { success: true };
        }

        this.terminal.print('\n🧠 AirLLM — 70B Parameter Models on 4GB RAM', 'info');
        this.terminal.print('   Powered by AirLLM (Li, 2023) — layer-wise inference', 'muted');
        this.terminal.print('   https://github.com/lyogavin/airllm/', 'muted');
        this.terminal.print('', 'muted');
        this.terminal.print('   ⚠️  AirLLM inference is SLOW (30-120s per response).', 'warning');
        this.terminal.print('   The model loads one layer at a time from disk to GPU.', 'muted');
        this.terminal.print('   This is a tradeoff: massive models on tiny hardware.', 'muted');
        this.terminal.print('', 'muted');

        const modelId = args && args.length > 0 ? args.join(' ') : airllmConfig.model;
        this.terminal.print(`   Model: ${modelId}`, 'info');
        this.terminal.print(`   Port: ${airllmConfig.port}`, 'muted');
        this.terminal.print(`   Compression: ${airllmConfig.compression}`, 'muted');
        this.terminal.print('', 'muted');

        this.terminal.startSpinner('Starting AirLLM sidecar server (this may take several minutes)...');

        try {
          this.airllmBridge = new AirLLMBridge({
            model: modelId,
          });

          // Show sidecar output in real-time
          this.airllmBridge.on('sidecar:output', (output: string) => {
            this.terminal.print(`   ${output}`, 'muted');
          });

          await this.airllmBridge.start();

          this.terminal.spinnerSuccess('AirLLM sidecar is ready!');

          // Swap the LLM client
          this.llmClient = this.airllmBridge.getClient();

          // Re-initialize agent with new client
          this.agent = getAgent(this.llmClient as any, {
            maxIterations: 10,
            maxCorrections: 3,
            enableLearning: true,
            verboseMode: false,
          });
          this.setupAgentEvents();

          this.terminal.print('\n✅ Switched to AirLLM backend', 'success');
          this.terminal.print('   All queries will now use the 70B model.', 'muted');
          this.terminal.print('   Type "airllm-stop" to revert to LM Studio.\n', 'muted');

          return { success: true };
        } catch (error) {
          this.terminal.spinnerFail('Failed to start AirLLM sidecar');
          const err = error as Error;
          this.terminal.print(`\n❌ ${err.message}`, 'error');
          this.terminal.print('\nTroubleshooting:', 'warning');
          this.terminal.print('   1. Make sure Python 3.9+ is installed: python --version', 'muted');
          this.terminal.print('   2. Install deps: pip install -r requirements-airllm.txt', 'muted');
          this.terminal.print('   3. Ensure you have enough disk space (~40GB for 70B models)', 'muted');
          logger.error('AirLLM start failed', { error: err.message });
          this.airllmBridge = null;
          return { success: false };
        }
      },
    });

    commandRegistry.register({
      name: 'airllm-stop',
      aliases: ['air-stop'],
      description: 'Stop AirLLM sidecar and revert to LM Studio',
      category: 'tools',
      execute: async () => {
        if (!this.airllmBridge?.isReady()) {
          this.terminal.print('AirLLM is not running', 'warning');
          return { success: false };
        }

        this.airllmBridge.stop();
        this.airllmBridge = null;

        // Revert to LM Studio client
        this.llmClient = lmStudioClient;

        // Re-initialize agent with LM Studio
        this.agent = getAgent(this.llmClient as any, {
          maxIterations: 10,
          maxCorrections: 3,
          enableLearning: true,
          verboseMode: false,
        });
        this.setupAgentEvents();

        this.terminal.print('🛑 AirLLM sidecar stopped', 'success');
        this.terminal.print('   Reverted to LM Studio backend.\n', 'muted');
        return { success: true };
      },
    });

    commandRegistry.register({
      name: 'airllm-status',
      aliases: ['air-status'],
      description: 'Show AirLLM sidecar status',
      category: 'tools',
      execute: async () => {
        if (!this.airllmBridge?.isReady()) {
          this.terminal.print('AirLLM is not running', 'muted');
          this.terminal.print('Start with: airllm [model-name]', 'muted');
          return { success: true };
        }

        const cfg = this.airllmBridge.getConfig();
        display.box('AirLLM Status', [
          `Status: ✅ Running`,
          `PID: ${this.airllmBridge.getPid()}`,
          `Model: ${cfg.model}`,
          `Endpoint: ${this.airllmBridge.getBaseUrl()}`,
          `Compression: ${cfg.compression}`,
          `Max Length: ${cfg.maxLength}`,
        ].join('\n'));
        return { success: true };
      },
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Persist agent memory
    const memory = getMemory();
    memory.persist();

    // Stop AirLLM sidecar if running
    if (this.airllmBridge) {
      this.airllmBridge.destroy();
      this.airllmBridge = null;
    }

    // Cancel any running agent operations
    if (this.agent) {
      this.agent.cancel();
    }

    this.terminal.close();
    logger.info('The Joker terminated');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const joker = new TheJoker();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log();
    joker.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    joker.cleanup();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    joker.cleanup();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });

  // Start the application
  await joker.start();
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Export for testing
export { TheJoker };

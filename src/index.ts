/**
 * The Joker - Agentic Terminal
 * Main Entry Point
 */

import { Terminal, terminal, theme, commandRegistry, display, progressTracker } from './cli/index.js';
import { LMStudioClient, lmStudioClient } from './llm/client.js';
import { logger } from './utils/logger.js';
import { config, llmConfig, paths } from './utils/config.js';
import { ChatMessage } from './types/index.js';
import { JokerAgent, getAgent, AgentState, getMemory } from './agents/index.js';

/**
 * Main application class
 */
class TheJoker {
  private terminal: Terminal;
  private llmClient: LMStudioClient;
  private agent: JokerAgent | null = null;
  private conversationHistory: ChatMessage[] = [];
  private systemPrompt: string;
  private agentMode: boolean = true; // Use autonomous agent by default

  constructor() {
    this.terminal = terminal;
    this.llmClient = lmStudioClient;
    
    // System prompt for The Joker agent
    this.systemPrompt = `You are "The Joker", an advanced agentic terminal assistant. You have two main capabilities:

1. **Web Scraping**: You can scrape websites, extract data, search the web, and gather information from any URL.

2. **Autonomous Coding**: You can create complete projects from scratch. When asked to create an app, you:
   - Analyze the requirements
   - Plan the project structure
   - Generate all necessary files (components, pages, APIs, configs)
   - Set up dependencies
   - Provide instructions to run the project

You are powered by qwen2.5-coder-14b-instruct-uncensored via LM Studio.

When responding:
- Be concise but helpful
- For coding tasks, provide complete, working code
- For web scraping tasks, explain what data you'll extract
- Use markdown formatting for code blocks
- Ask clarifying questions if the request is ambiguous

Current capabilities available:
- Web scraping with Puppeteer
- Code generation for React, Next.js, Node.js, TypeScript
- File system operations
- Project scaffolding

Always respond in a helpful, focused manner.`;

    // Initialize conversation with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: this.systemPrompt,
    });
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<boolean> {
    logger.info('Initializing The Joker...');
    
    // Show banner
    this.terminal.showBanner();
    
    // Test LLM connection
    this.terminal.startSpinner('Connecting to LM Studio...');
    
    const connected = await this.llmClient.testConnection();
    
    if (!connected) {
      this.terminal.spinnerFail('Failed to connect to LM Studio');
      this.terminal.print(`\nMake sure LM Studio is running at ${llmConfig.baseUrl}`, 'warning');
      this.terminal.print('and has a model loaded (qwen2.5-coder-14b-instruct-uncensored)', 'warning');
      return false;
    }
    
    this.terminal.spinnerSuccess('Connected to LM Studio');
    
    // Initialize the autonomous agent
    this.terminal.startSpinner('Initializing agent...');
    try {
      this.agent = getAgent(this.llmClient, {
        maxIterations: 10,
        maxCorrections: 3,
        enableLearning: true,
        verboseMode: false,
      });
      
      // Set up agent event handlers
      this.setupAgentEvents();
      
      this.terminal.spinnerSuccess('Agent initialized');
    } catch (error) {
      this.terminal.spinnerFail('Failed to initialize agent');
      logger.error('Agent initialization failed', { error });
      this.agentMode = false; // Fall back to simple mode
    }
    
    // Display configuration info
    this.terminal.print(`\nModel: ${llmConfig.model}`, 'muted');
    this.terminal.print(`Endpoint: ${llmConfig.baseUrl}`, 'muted');
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
          display.agentThinking('Analyzing your request...');
          break;
        case AgentState.PLANNING:
          display.agentAction('Creating action plan...');
          break;
        case AgentState.ACTING:
          display.agentAction('Executing plan...');
          break;
        case AgentState.OBSERVING:
          display.agentThinking('Analyzing results...');
          break;
        case AgentState.CORRECTING:
          display.agentThinking('Self-correcting...');
          break;
      }
    });

    this.agent.on('thought', (thought) => {
      logger.debug('Agent thought', { thought: thought.reasoning.slice(0, 100) });
    });

    this.agent.on('plan:created', (plan) => {
      logger.debug('Plan created', { 
        planId: plan.id, 
        steps: plan.steps.length,
        intent: plan.intent 
      });
      
      // Show plan summary to user
      this.terminal.print(`\n📋 Plan: ${plan.steps.length} steps for "${plan.query.slice(0, 50)}..."`, 'info');
      plan.steps.forEach((step: { description: string }, i: number) => {
        this.terminal.print(`   ${i + 1}. ${step.description}`, 'muted');
      });
      this.terminal.print('', 'muted');
    });

    this.agent.on('step:complete', ({ step, result }) => {
      const status = result.success ? '✓' : '✗';
      logger.debug('Step complete', { 
        step: step.id, 
        success: result.success,
        time: result.metadata.executionTime 
      });
    });

    this.agent.on('correction', (correction) => {
      this.terminal.print(`⚡ Self-correction: ${correction.strategy} (attempt ${correction.attempt}/${correction.maxAttempts})`, 'warning');
    });

    this.agent.on('goal:achieved', (result) => {
      logger.info('Goal achieved', {
        success: result.success,
        time: result.totalTime,
        iterations: result.iterations,
      });
    });

    this.agent.on('goal:failed', ({ error }) => {
      logger.error('Goal failed', { error });
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
      display.agentResult(result.finalAnswer);

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
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Persist agent memory
    const memory = getMemory();
    memory.persist();
    
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

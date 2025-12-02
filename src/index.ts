/**
 * The Joker - Agentic Terminal
 * Main Entry Point
 */

import { Terminal, terminal, theme } from './cli/terminal';
import { LMStudioClient, lmStudioClient } from './llm/client';
import { logger } from './utils/logger';
import { config, llmConfig, paths } from './utils/config';
import { ChatMessage } from './types';

/**
 * Main application class
 */
class TheJoker {
  private terminal: Terminal;
  private llmClient: LMStudioClient;
  private conversationHistory: ChatMessage[] = [];
  private systemPrompt: string;

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
    
    // Display configuration info
    this.terminal.print(`\nModel: ${llmConfig.model}`, 'muted');
    this.terminal.print(`Endpoint: ${llmConfig.baseUrl}`, 'muted');
    this.terminal.print('\nType "help" for available commands\n', 'info');
    
    return true;
  }

  /**
   * Process user input
   */
  async processInput(input: string): Promise<void> {
    logger.debug('Processing input', { input });
    
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

    // Start interactive loop
    await this.terminal.startREPL(async (input) => {
      await this.processInput(input);
    });
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
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

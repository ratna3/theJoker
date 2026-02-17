/**
 * The Joker - Agentic Terminal
 * Interactive Terminal Interface with Enhanced UX
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import inquirer from 'inquirer';
import { EventEmitter } from 'events';
import readline from 'readline';
import { logger } from '../utils/logger.js';
import { terminalConfig } from '../utils/config.js';
import { commandRegistry } from './commands.js';

/**
 * Terminal color theme - exported for use by other modules
 */
export const theme = {
  primary: chalk.hex('#00FF00'),      // Joker green
  secondary: chalk.hex('#800080'),    // Purple
  accent: chalk.hex('#FFD700'),       // Gold
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
  success: chalk.green,
  muted: chalk.gray,
  white: chalk.white,
  bold: chalk.bold,
};

/**
 * Generate ASCII Art Banner for The Joker (dynamic)
 */
function generateBanner(version: string, modelName: string, backend: string): string {
  return `
${theme.primary('╔════════════════════════════════════════════════════════════════════╗')}
${theme.primary('║')}                                                                    ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('████████╗██╗  ██╗███████╗     ██╗ ██████╗ ██╗  ██╗███████╗██████╗ ')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('╚══██╔══╝██║  ██║██╔════╝     ██║██╔═══██╗██║ ██╔╝██╔════╝██╔══██╗')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('   ██║   ███████║█████╗       ██║██║   ██║█████╔╝ █████╗  ██████╔╝')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('   ██║   ██╔══██║██╔══╝  ██   ██║██║   ██║██╔═██╗ ██╔══╝  ██╔══██╗')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('   ██║   ██║  ██║███████╗╚█████╔╝╚██████╔╝██║  ██╗███████╗██║  ██║')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝')} ${theme.primary('║')}
${theme.primary('║')}                                                                    ${theme.primary('║')}
${theme.primary('║')}  ${theme.accent(`v${version} • Agentic Terminal • Web Scraping • Autonomous Coding`)}     ${theme.primary('║')}
${theme.primary('║')}  ${theme.muted(`Backend: ${backend} | Model: ${modelName}`.padEnd(62))}  ${theme.primary('║')}
${theme.primary('║')}                                                                    ${theme.primary('║')}
${theme.primary('╚════════════════════════════════════════════════════════════════════╝')}
`;
}

/**
 * Terminal command history
 */
interface CommandHistory {
  commands: string[];
  index: number;
}

/**
 * Terminal UI class for interactive command line interface
 */
export class Terminal extends EventEmitter {
  private rl: readline.Interface | null = null;
  private spinner: Ora | null = null;
  private history: CommandHistory = { commands: [], index: -1 };
  private isProcessing = false;
  private maxHistorySize = 100;

  constructor() {
    super();
    logger.debug('Terminal initialized');
  }

  /**
   * Display the banner
   */
  showBanner(version = '1.1.1', modelName = 'unknown', backend = 'LM Studio'): void {
    console.clear();
    console.log(generateBanner(version, modelName, backend));
    console.log();
  }

  /**
   * Print a message with proper formatting
   */
  print(message: string, type: 'info' | 'success' | 'warning' | 'error' | 'primary' | 'muted' = 'info'): void {
    const formatted = {
      info: theme.info(message),
      success: theme.success(message),
      warning: theme.warning(message),
      error: theme.error(message),
      primary: theme.primary(message),
      muted: theme.muted(message),
    };
    console.log(formatted[type]);
  }

  /**
   * Print a line separator
   */
  separator(): void {
    console.log(theme.muted('─'.repeat(70)));
  }

  /**
   * Display a section header
   */
  header(title: string): void {
    console.log();
    console.log(theme.accent(`◆ ${title}`));
    this.separator();
  }

  /**
   * Display formatted code block
   */
  code(content: string, language = 'typescript'): void {
    console.log(theme.muted(`\`\`\`${language}`));
    console.log(chalk.white(content));
    console.log(theme.muted('```'));
  }

  /**
   * Display a list
   */
  list(items: string[], prefix = '•'): void {
    items.forEach(item => {
      console.log(`  ${theme.primary(prefix)} ${theme.white(item)}`);
    });
  }

  /**
   * Start a spinner with message
   */
  startSpinner(message: string): void {
    if (!terminalConfig.spinner) {
      console.log(theme.info(`⏳ ${message}...`));
      return;
    }
    this.spinner = ora({
      text: message,
      color: 'green',
      spinner: 'dots',
    }).start();
  }

  /**
   * Update spinner text
   */
  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Stop spinner with success
   */
  spinnerSuccess(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner with failure
   */
  spinnerFail(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner (no status)
   */
  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Prompt user for input
   */
  async prompt(message: string, defaultValue?: string): Promise<string> {
    const response = await inquirer.prompt([
      {
        type: 'input',
        name: 'value',
        message: theme.primary(`${message}:`),
        default: defaultValue,
      },
    ]);
    return response.value;
  }

  /**
   * Prompt for confirmation
   */
  async confirm(message: string, defaultValue = true): Promise<boolean> {
    const response = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: theme.primary(message),
        default: defaultValue,
      },
    ]);
    return response.confirmed;
  }

  /**
   * Prompt for selection from list
   */
  async select<T extends string>(message: string, choices: T[]): Promise<T> {
    const response = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: theme.primary(message),
        choices,
      },
    ]);
    return response.selection;
  }

  /**
   * Prompt for multi-select
   */
  async multiSelect<T extends string>(message: string, choices: T[]): Promise<T[]> {
    const response = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selections',
        message: theme.primary(message),
        choices,
      },
    ]);
    return response.selections;
  }

  /**
   * Start the interactive REPL
   */
  async startREPL(onInput: (input: string) => Promise<void>): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const promptText = theme.primary('🃏 joker') + theme.muted(' > ');

    const askQuestion = (): void => {
      this.rl?.question(promptText, async (input) => {
        const trimmedInput = input.trim();

        if (!trimmedInput) {
          askQuestion();
          return;
        }

        // Add to history
        this.addToHistory(trimmedInput);

        // Check CommandRegistry for ALL registered commands
        const { command } = commandRegistry.parse(trimmedInput);
        if (commandRegistry.has(command)) {
          try {
            const result = await commandRegistry.execute(trimmedInput);
            if (result.output) {
              console.log(result.output);
            }
            if (result.error) {
              this.print(result.error, 'error');
            }
          } catch (error) {
            const err = error as Error;
            this.print(`Command error: ${err.message}`, 'error');
          }
          console.log();
          askQuestion();
          return;
        }

        // Not a command — process as agent/LLM input
        this.isProcessing = true;
        try {
          await onInput(trimmedInput);
        } catch (error) {
          const err = error as Error;
          this.print(`Error: ${err.message}`, 'error');
          logger.error('REPL error', { error: err.message, stack: err.stack });
        }
        this.isProcessing = false;

        console.log();
        askQuestion();
      });
    };

    askQuestion();

    // Handle close
    this.rl.on('close', () => {
      console.log();
      this.print('Goodbye! 🃏', 'primary');
      process.exit(0);
    });
  }

  /**
   * Show dynamic help — pulls all commands from CommandRegistry
   */
  showHelp(): void {
    this.header('The Joker v1.1.1 — Help');

    const commands = commandRegistry.getAll();

    // Group by category
    const categories: Record<string, typeof commands> = {};
    for (const cmd of commands) {
      const cat = cmd.category || 'general';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    }

    const categoryLabels: Record<string, string> = {
      general: '📋 General',
      agent: '🤖 Agent',
      tools: '🔧 Tools',
      config: '⚙️  Config',
      navigation: '🧭 Navigation',
      debug: '🐛 Debug',
    };

    const categoryOrder = ['general', 'agent', 'tools', 'config', 'navigation', 'debug'];

    for (const catKey of categoryOrder) {
      const cmds = categories[catKey];
      if (!cmds || cmds.length === 0) continue;

      const label = categoryLabels[catKey] || catKey;
      console.log(theme.accent(`\n${label}:`));

      for (const cmd of cmds) {
        const aliases = cmd.aliases && cmd.aliases.length > 0
          ? theme.muted(` (${cmd.aliases.join(', ')})`)
          : '';
        const name = cmd.name.padEnd(16);
        console.log(`  ${theme.primary('•')} ${theme.white(name)} ${theme.muted('—')} ${theme.muted(cmd.description)}${aliases}`);
      }
    }

    console.log(theme.accent('\n💡 Examples:'));
    console.log(theme.muted('    • vibe Build me a portfolio website with dark mode'));
    console.log(theme.muted('    • recon example.com'));
    console.log(theme.muted('    • airllm'));
    console.log(theme.muted('    • Tell me about quantum computing'));
    console.log();
  }

  /**
   * Add command to history
   */
  private addToHistory(command: string): void {
    if (this.history.commands[this.history.commands.length - 1] !== command) {
      this.history.commands.push(command);
      if (this.history.commands.length > this.maxHistorySize) {
        this.history.commands.shift();
      }
    }
    this.history.index = this.history.commands.length;
  }

  /**
   * Show command history
   */
  showHistory(): void {
    this.header('Command History');
    if (this.history.commands.length === 0) {
      this.print('No commands in history', 'muted');
      return;
    }
    this.history.commands.forEach((cmd, i) => {
      console.log(`  ${theme.muted(`${i + 1}.`)} ${theme.white(cmd)}`);
    });
  }

  /**
   * Display a progress bar
   */
  progressBar(current: number, total: number, label = ''): void {
    const width = 40;
    const progress = Math.round((current / total) * width);
    const bar = '█'.repeat(progress) + '░'.repeat(width - progress);
    const percent = Math.round((current / total) * 100);

    process.stdout.write(`\r${theme.primary(bar)} ${percent}% ${theme.muted(label)}`);

    if (current === total) {
      console.log();
    }
  }

  /**
   * Display a table
   */
  table(headers: string[], rows: string[][]): void {
    // Calculate column widths
    const widths = headers.map((h, i) => {
      const maxRow = Math.max(...rows.map(r => (r[i] || '').length));
      return Math.max(h.length, maxRow);
    });

    // Print header
    const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join(' │ ');
    console.log(theme.accent(headerRow));
    console.log(theme.muted('─'.repeat(headerRow.length)));

    // Print rows
    rows.forEach(row => {
      const rowStr = row.map((cell, i) => (cell || '').padEnd(widths[i])).join(' │ ');
      console.log(theme.white(rowStr));
    });
  }

  /**
   * Format and display an agent response
   */
  displayAgentResponse(response: string): void {
    console.log();
    console.log(theme.secondary('🤖 Agent Response:'));
    this.separator();
    console.log(theme.white(response));
    this.separator();
  }

  /**
   * Display thinking animation
   */
  async showThinking(duration = 1000): Promise<void> {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const interval = setInterval(() => {
      process.stdout.write(`\r${theme.primary(frames[i])} ${theme.muted('Thinking...')}`);
      i = (i + 1) % frames.length;
    }, 80);

    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(20) + '\r');
  }

  /**
   * Close the terminal
   */
  close(): void {
    this.stopSpinner();
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    logger.debug('Terminal closed');
  }
}

// Export theme for external use - theme is already exported above

// Default terminal instance
export const terminal = new Terminal();

export default Terminal;

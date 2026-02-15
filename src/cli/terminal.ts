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
 * ASCII Art Banner for The Joker
 */
const BANNER = `
${theme.primary('╔════════════════════════════════════════════════════════════════════╗')}
${theme.primary('║')}                                                                    ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('████████╗██╗  ██╗███████╗     ██╗ ██████╗ ██╗  ██╗███████╗██████╗ ')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('╚══██╔══╝██║  ██║██╔════╝     ██║██╔═══██╗██║ ██╔╝██╔════╝██╔══██╗')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('   ██║   ███████║█████╗       ██║██║   ██║█████╔╝ █████╗  ██████╔╝')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('   ██║   ██╔══██║██╔══╝  ██   ██║██║   ██║██╔═██╗ ██╔══╝  ██╔══██╗')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('   ██║   ██║  ██║███████╗╚█████╔╝╚██████╔╝██║  ██╗███████╗██║  ██║')} ${theme.primary('║')}
${theme.primary('║')}  ${theme.secondary('   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚════╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝')} ${theme.primary('║')}
${theme.primary('║')}                                                                    ${theme.primary('║')}
${theme.primary('║')}  ${theme.accent('Agentic Terminal • Web Scraping • Autonomous Coding')}               ${theme.primary('║')}
${theme.primary('║')}  ${theme.muted('Powered by LM Studio | qwen2.5-coder-14b-instruct-uncensored')}      ${theme.primary('║')}
${theme.primary('║')}                                                                    ${theme.primary('║')}
${theme.primary('╚════════════════════════════════════════════════════════════════════╝')}
`;

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
  showBanner(): void {
    console.clear();
    console.log(BANNER);
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

        // Handle built-in commands
        if (await this.handleBuiltInCommand(trimmedInput)) {
          askQuestion();
          return;
        }

        // Process user input
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
   * Handle built-in terminal commands
   */
  private async handleBuiltInCommand(input: string): Promise<boolean> {
    const command = input.toLowerCase();

    switch (command) {
      case 'help':
        this.showHelp();
        return true;
      case 'clear':
      case 'cls':
        console.clear();
        return true;
      case 'history':
        this.showHistory();
        return true;
      case 'exit':
      case 'quit':
      case 'q':
        this.rl?.close();
        return true;
      case 'banner':
        this.showBanner();
        return true;
      default:
        return false;
    }
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
  private showHistory(): void {
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
   * Show help information
   */
  private showHelp(): void {
    this.header('The Joker - Help');

    console.log(theme.accent('\n📋 Commands:'));
    this.list([
      'help     - Show this help message',
      'clear    - Clear the terminal',
      'history  - Show command history',
      'banner   - Show the banner',
      'exit     - Exit the terminal',
    ]);

    console.log(theme.accent('\n🕸️  Web Scraping:'));
    this.list([
      'scrape <url>           - Scrape a webpage',
      'search <query>         - Search the web',
      'extract <url> <data>   - Extract specific data',
    ]);

    console.log(theme.accent('\n💻 Coding Agent:'));
    this.list([
      'create <project-desc>  - Create a new project',
      'generate <component>   - Generate code component',
      'modify <file> <change> - Modify existing file',
    ]);

    console.log(theme.accent('\n🎨 Vibe Coding Mode:'));
    this.list([
      'vibe <description>     - Build a complete app from a natural language prompt',
      'vibe-stop              - Stop the running dev server',
    ]);
    console.log(theme.muted('  Aliases: build, create-app'));

    console.log(theme.accent('\n🔍 Hack Mode (Recon & OSINT):'));
    this.list([
      'recon <domain>         - Run passive reconnaissance on a domain',
    ]);
    console.log(theme.muted('  Aliases: scan, osint, investigate'));

    console.log(theme.accent('\n🖥️  TUI Dashboard:'));
    this.list([
      'tui                    - Toggle interactive split-pane dashboard',
    ]);
    console.log(theme.muted('  Aliases: dashboard, ui'));

    console.log(theme.accent('\n💡 Examples:'));
    console.log(theme.white('  Web Scraping:'));
    console.log(theme.muted('    • scrape https://example.com'));
    console.log(theme.muted('    • search best programming languages 2025'));
    console.log(theme.white('  Vibe Coding:'));
    console.log(theme.muted('    • vibe Build me a portfolio website with dark mode and a contact form'));
    console.log(theme.muted('    • vibe Create a todo app with React and local storage'));
    console.log(theme.muted('    • vibe Make an Express REST API with user authentication'));
    console.log(theme.white('  Hack Mode:'));
    console.log(theme.muted('    • recon example.com'));
    console.log(theme.muted('    • scan google.com'));
    console.log(theme.white('  Dashboard:'));
    console.log(theme.muted('    • tui'));
    console.log();
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

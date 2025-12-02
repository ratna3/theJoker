/**
 * Command System - Modular command handling for The Joker terminal
 * Provides extensible command infrastructure with built-in commands
 */

import { terminal, theme } from './terminal.js';
import { display, ICONS } from './display.js';
import { EventEmitter } from 'events';

/**
 * Command interface
 */
export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: CommandCategory;
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>;
}

/**
 * Command categories for organization
 */
export type CommandCategory = 'general' | 'navigation' | 'tools' | 'config' | 'debug' | 'agent';

/**
 * Command execution context
 */
export interface CommandContext {
  rawInput: string;
  args: string[];
  flags: Record<string, string | boolean>;
  terminal: typeof terminal;
  display: typeof display;
}

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

/**
 * Command Registry - manages all available commands
 */
export class CommandRegistry extends EventEmitter {
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();
  private history: string[] = [];
  private historyIndex: number = -1;
  private maxHistory: number = 100;

  constructor() {
    super();
    this.registerBuiltInCommands();
  }

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.name, command);
    
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
    
    this.emit('command:registered', command);
  }

  /**
   * Unregister a command
   */
  unregister(name: string): boolean {
    const command = this.commands.get(name);
    if (!command) return false;
    
    this.commands.delete(name);
    
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }
    
    this.emit('command:unregistered', command);
    return true;
  }

  /**
   * Get a command by name or alias
   */
  get(nameOrAlias: string): Command | undefined {
    const name = this.aliases.get(nameOrAlias) || nameOrAlias;
    return this.commands.get(name);
  }

  /**
   * Check if a command exists
   */
  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined;
  }

  /**
   * Get all commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: CommandCategory): Command[] {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  /**
   * Parse input into command parts
   */
  parse(input: string): { command: string; args: string[]; flags: Record<string, string | boolean> } {
    const parts = input.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';
    const args: string[] = [];
    const flags: Record<string, string | boolean> = {};
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.startsWith('--')) {
        // Long flag: --flag or --flag=value
        const [key, value] = part.slice(2).split('=');
        flags[key] = value || true;
      } else if (part.startsWith('-')) {
        // Short flag: -f or -f value
        const key = part.slice(1);
        const nextPart = parts[i + 1];
        if (nextPart && !nextPart.startsWith('-')) {
          flags[key] = nextPart;
          i++;
        } else {
          flags[key] = true;
        }
      } else {
        args.push(part);
      }
    }
    
    return { command, args, flags };
  }

  /**
   * Execute a command
   */
  async execute(input: string): Promise<CommandResult> {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      return { success: true };
    }
    
    // Add to history
    this.addToHistory(trimmedInput);
    
    const { command, args, flags } = this.parse(trimmedInput);
    const cmd = this.get(command);
    
    if (!cmd) {
      return {
        success: false,
        error: `Unknown command: "${command}". Type "help" for available commands.`
      };
    }
    
    const context: CommandContext = {
      rawInput: trimmedInput,
      args,
      flags,
      terminal,
      display
    };
    
    this.emit('command:before', { command: cmd, context });
    
    try {
      const result = await cmd.execute(args, context);
      this.emit('command:after', { command: cmd, context, result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('command:error', { command: cmd, context, error });
      return {
        success: false,
        error: `Command failed: ${errorMessage}`
      };
    }
  }

  /**
   * Add to command history
   */
  private addToHistory(input: string): void {
    // Don't add duplicates of the last command
    if (this.history[this.history.length - 1] !== input) {
      this.history.push(input);
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
    }
    this.historyIndex = this.history.length;
  }

  /**
   * Get previous command from history
   */
  previousHistory(): string | undefined {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      return this.history[this.historyIndex];
    }
    return undefined;
  }

  /**
   * Get next command from history
   */
  nextHistory(): string | undefined {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return this.history[this.historyIndex];
    }
    this.historyIndex = this.history.length;
    return undefined;
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
  }

  /**
   * Register built-in commands
   */
  private registerBuiltInCommands(): void {
    // Help command
    this.register({
      name: 'help',
      aliases: ['?', 'h', 'commands'],
      description: 'Show available commands and their usage',
      usage: 'help [command]',
      category: 'general',
      execute: async (args, ctx) => {
        if (args.length > 0) {
          const cmd = this.get(args[0]);
          if (cmd) {
            const output = [
              '',
              theme.accent(`${ICONS.info} ${cmd.name}`),
              theme.muted('─'.repeat(40)),
              '',
              theme.secondary(cmd.description),
              ''
            ];
            
            if (cmd.usage) {
              output.push(theme.muted('Usage: ') + theme.primary(cmd.usage));
            }
            
            if (cmd.aliases && cmd.aliases.length > 0) {
              output.push(theme.muted('Aliases: ') + theme.secondary(cmd.aliases.join(', ')));
            }
            
            output.push(theme.muted('Category: ') + theme.secondary(cmd.category));
            output.push('');
            
            return { success: true, output: output.join('\n') };
          } else {
            return { success: false, error: `Unknown command: ${args[0]}` };
          }
        }
        
        // Show all commands grouped by category
        const categories: CommandCategory[] = ['general', 'navigation', 'tools', 'config', 'debug'];
        const output: string[] = [
          '',
          ctx.display.box([
            theme.primary(`${ICONS.joker} The Joker - Command Reference`),
            '',
            theme.muted('Type "help <command>" for detailed information')
          ], 'Help', 'accent'),
          ''
        ];
        
        for (const category of categories) {
          const cmds = this.getByCategory(category);
          if (cmds.length === 0) continue;
          
          output.push(theme.accent(`\n  ${category.toUpperCase()}`));
          output.push(theme.muted('  ' + '─'.repeat(38)));
          
          for (const cmd of cmds) {
            const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
            output.push(
              '  ' + theme.primary(cmd.name.padEnd(15)) +
              theme.muted(aliases.padEnd(15)) +
              theme.secondary(cmd.description)
            );
          }
        }
        
        output.push('');
        return { success: true, output: output.join('\n') };
      }
    });

    // Clear command
    this.register({
      name: 'clear',
      aliases: ['cls'],
      description: 'Clear the terminal screen',
      category: 'general',
      execute: async () => {
        console.clear();
        terminal.showBanner();
        return { success: true };
      }
    });

    // Exit command
    this.register({
      name: 'exit',
      aliases: ['quit', 'q'],
      description: 'Exit The Joker',
      category: 'general',
      execute: async () => {
        console.log(theme.muted('\nGoodbye! 🃏\n'));
        return { success: true, exitCode: 0 };
      }
    });

    // History command
    this.register({
      name: 'history',
      aliases: ['hist'],
      description: 'Show command history',
      usage: 'history [--clear]',
      category: 'general',
      execute: async (args, ctx) => {
        if (ctx.flags.clear) {
          this.clearHistory();
          return { success: true, output: ctx.display.success('History cleared') };
        }
        
        const history = this.getHistory();
        if (history.length === 0) {
          return { success: true, output: ctx.display.info('No command history') };
        }
        
        const output = [
          theme.accent(`\n${ICONS.clock} Command History`),
          theme.muted('─'.repeat(40)),
          ''
        ];
        
        for (let i = 0; i < history.length; i++) {
          output.push(
            theme.muted(`  ${String(i + 1).padStart(3)}  `) +
            theme.secondary(history[i])
          );
        }
        
        output.push('');
        return { success: true, output: output.join('\n') };
      }
    });

    // Status command
    this.register({
      name: 'status',
      aliases: ['st'],
      description: 'Show system status',
      category: 'general',
      execute: async (args, ctx) => {
        const statusItems = [
          { label: 'Terminal', value: 'Active', ok: true },
          { label: 'Commands', value: `${this.commands.size} loaded`, ok: true },
          { label: 'History', value: `${this.history.length} entries`, ok: true },
          { label: 'Memory', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, ok: true }
        ];
        
        const output = [
          '',
          theme.accent(`${ICONS.sparkle} System Status`),
          theme.muted('─'.repeat(40)),
          '',
          ctx.display.status(statusItems),
          ''
        ];
        
        return { success: true, output: output.join('\n') };
      }
    });

    // Banner command
    this.register({
      name: 'banner',
      description: 'Show the Joker banner',
      category: 'general',
      execute: async () => {
        terminal.showBanner();
        return { success: true };
      }
    });

    // Version command
    this.register({
      name: 'version',
      aliases: ['v', 'ver'],
      description: 'Show version information',
      category: 'general',
      execute: async (args, ctx) => {
        const output = ctx.display.box([
          theme.primary('The Joker'),
          theme.muted('Version: ') + theme.accent('1.0.0'),
          theme.muted('Node: ') + theme.secondary(process.version),
          theme.muted('Platform: ') + theme.secondary(process.platform)
        ], 'Version', 'primary');
        
        return { success: true, output };
      }
    });

    // Echo command (for testing)
    this.register({
      name: 'echo',
      description: 'Echo input back to terminal',
      usage: 'echo <message>',
      category: 'debug',
      execute: async (args) => {
        return { success: true, output: args.join(' ') };
      }
    });

    // Time command
    this.register({
      name: 'time',
      aliases: ['now'],
      description: 'Show current time',
      category: 'general',
      execute: async () => {
        const now = new Date();
        const output = theme.accent(`${ICONS.clock} `) + theme.secondary(now.toLocaleString());
        return { success: true, output };
      }
    });
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();

/**
 * Display Module - Enhanced output formatting for The Joker terminal
 * Provides rich visual formatting for results, errors, and information
 */

import chalk, { ChalkInstance } from 'chalk';
import { theme } from './terminal.js';

// Box drawing characters
const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼'
};

// Display configuration
interface DisplayConfig {
  width: number;
  padding: number;
  showIcons: boolean;
}

const defaultConfig: DisplayConfig = {
  width: 80,
  padding: 2,
  showIcons: true
};

// Icons for different types
const ICONS = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  search: '🔍',
  file: '📄',
  folder: '📁',
  link: '🔗',
  code: '💻',
  thought: '💭',
  action: '⚡',
  result: '📊',
  clock: '⏱',
  rocket: '🚀',
  sparkle: '✨',
  joker: '🃏'
};

/**
 * Display class for enhanced output formatting
 */
export class Display {
  private config: DisplayConfig;

  constructor(config: Partial<DisplayConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.updateWidth();
  }

  /**
   * Update width based on terminal size
   */
  private updateWidth(): void {
    const cols = process.stdout.columns || 80;
    this.config.width = Math.min(cols - 4, 120);
  }

  /**
   * Create a horizontal line
   */
  line(char: string = '─', color: string = 'muted'): string {
    const colorFn = (theme as Record<string, ChalkInstance>)[color] || theme.muted;
    return colorFn(char.repeat(this.config.width));
  }

  /**
   * Create a box around content
   */
  box(content: string | string[], title?: string, borderColor: string = 'primary'): string {
    this.updateWidth();
    const lines = Array.isArray(content) ? content : content.split('\n');
    const colorFn = (theme as Record<string, ChalkInstance>)[borderColor] || theme.primary;
    const width = this.config.width - 4;
    const output: string[] = [];

    // Top border with optional title
    if (title) {
      const titlePadded = ` ${title} `;
      const leftPad = Math.floor((width - titlePadded.length) / 2);
      const rightPad = width - titlePadded.length - leftPad;
      output.push(
        colorFn(BOX.topLeft) +
        colorFn(BOX.horizontal.repeat(leftPad)) +
        theme.accent(titlePadded) +
        colorFn(BOX.horizontal.repeat(rightPad)) +
        colorFn(BOX.topRight)
      );
    } else {
      output.push(
        colorFn(BOX.topLeft) +
        colorFn(BOX.horizontal.repeat(width + 2)) +
        colorFn(BOX.topRight)
      );
    }

    // Content lines
    for (const line of lines) {
      const strippedLength = this.stripAnsi(line).length;
      const padding = Math.max(0, width - strippedLength);
      output.push(
        colorFn(BOX.vertical) + ' ' + line + ' '.repeat(padding + 1) + colorFn(BOX.vertical)
      );
    }

    // Bottom border
    output.push(
      colorFn(BOX.bottomLeft) +
      colorFn(BOX.horizontal.repeat(width + 2)) +
      colorFn(BOX.bottomRight)
    );

    return output.join('\n');
  }

  /**
   * Strip ANSI codes from string
   */
  private stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Display a success message
   */
  success(message: string, details?: string): string {
    const icon = this.config.showIcons ? ICONS.success + ' ' : '';
    let output = theme.success(icon + message);
    if (details) {
      output += '\n' + theme.muted('  ' + details);
    }
    return output;
  }

  /**
   * Display an error message
   */
  error(message: string, details?: string): string {
    const icon = this.config.showIcons ? ICONS.error + ' ' : '';
    let output = theme.error(icon + message);
    if (details) {
      output += '\n' + theme.muted('  ' + details);
    }
    return output;
  }

  /**
   * Display a warning message
   */
  warning(message: string, details?: string): string {
    const icon = this.config.showIcons ? ICONS.warning + ' ' : '';
    let output = theme.warning(icon + message);
    if (details) {
      output += '\n' + theme.muted('  ' + details);
    }
    return output;
  }

  /**
   * Display an info message
   */
  info(message: string, details?: string): string {
    const icon = this.config.showIcons ? ICONS.info + ' ' : '';
    let output = theme.info(icon + message);
    if (details) {
      output += '\n' + theme.muted('  ' + details);
    }
    return output;
  }

  /**
   * Display a link with proper formatting
   */
  link(url: string, title?: string): string {
    const icon = this.config.showIcons ? ICONS.link + ' ' : '';
    if (title) {
      return icon + theme.primary(title) + '\n  ' + theme.muted(url);
    }
    return icon + theme.info.underline(url);
  }

  /**
   * Display search results
   */
  searchResults(results: SearchResult[]): string {
    if (results.length === 0) {
      return this.warning('No results found');
    }

    const output: string[] = [
      this.line(),
      theme.primary(`${ICONS.search} Found ${results.length} result(s)`),
      this.line()
    ];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      output.push('');
      output.push(theme.accent(`[${i + 1}] ${result.title}`));
      if (result.description) {
        output.push(theme.muted('    ' + result.description.substring(0, 100) + '...'));
      }
      if (result.url) {
        output.push('    ' + theme.info.underline(result.url));
      }
    }

    output.push('');
    output.push(this.line());
    return output.join('\n');
  }

  /**
   * Display code with syntax highlighting hint
   */
  code(content: string, language?: string): string {
    const output: string[] = [];
    const lines = content.split('\n');
    
    // Header
    const langLabel = language ? ` ${language} ` : ' code ';
    output.push(theme.muted('```' + langLabel));
    
    // Code lines with line numbers
    for (let i = 0; i < lines.length; i++) {
      const lineNum = theme.muted(String(i + 1).padStart(4) + ' │ ');
      output.push(lineNum + theme.secondary(lines[i]));
    }
    
    output.push(theme.muted('```'));
    return output.join('\n');
  }

  /**
   * Display a file tree
   */
  fileTree(files: FileItem[], depth: number = 0): string {
    const output: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isLast = i === files.length - 1;
      const prefix = depth > 0 ? '  '.repeat(depth - 1) + (isLast ? '└─ ' : '├─ ') : '';
      const icon = file.isDirectory ? ICONS.folder : ICONS.file;
      
      output.push(
        theme.muted(prefix) +
        (file.isDirectory ? theme.primary(icon + ' ' + file.name) : theme.secondary(icon + ' ' + file.name))
      );
      
      if (file.children && file.children.length > 0) {
        output.push(this.fileTree(file.children, depth + 1));
      }
    }
    
    return output.join('\n');
  }

  /**
   * Display agent thinking process
   */
  agentThinking(thought: string): string {
    const icon = this.config.showIcons ? ICONS.thought + ' ' : '';
    return theme.muted(icon + 'Thinking: ') + theme.secondary(thought);
  }

  /**
   * Display agent action
   */
  agentAction(action: string, tool?: string): string {
    const icon = this.config.showIcons ? ICONS.action + ' ' : '';
    let output = theme.warning(icon + 'Action: ') + theme.primary(action);
    if (tool) {
      output += theme.muted(' using ') + theme.accent(tool);
    }
    return output;
  }

  /**
   * Display agent result
   */
  agentResult(result: string): string {
    const icon = this.config.showIcons ? ICONS.result + ' ' : '';
    return theme.success(icon + 'Result: ') + theme.secondary(result);
  }

  /**
   * Display timing information
   */
  timing(label: string, ms: number): string {
    const icon = this.config.showIcons ? ICONS.clock + ' ' : '';
    const formatted = ms >= 1000 
      ? `${(ms / 1000).toFixed(2)}s` 
      : `${ms}ms`;
    return theme.muted(icon + label + ': ') + theme.accent(formatted);
  }

  /**
   * Display a key-value pair
   */
  keyValue(key: string, value: string): string {
    return theme.muted(key + ': ') + theme.primary(value);
  }

  /**
   * Display multiple key-value pairs
   */
  properties(props: Record<string, string | number | boolean>): string {
    const output: string[] = [];
    const maxKeyLength = Math.max(...Object.keys(props).map(k => k.length));
    
    for (const [key, value] of Object.entries(props)) {
      const paddedKey = key.padEnd(maxKeyLength);
      output.push(
        theme.muted(paddedKey + ' : ') + theme.primary(String(value))
      );
    }
    
    return output.join('\n');
  }

  /**
   * Display a table
   */
  table(headers: string[], rows: string[][]): string {
    if (rows.length === 0) {
      return this.warning('No data to display');
    }

    // Calculate column widths
    const widths = headers.map((h, i) => {
      const maxRowWidth = Math.max(...rows.map(r => (r[i] || '').length));
      return Math.max(h.length, maxRowWidth);
    });

    const output: string[] = [];
    const totalWidth = widths.reduce((a, b) => a + b, 0) + (widths.length * 3) + 1;

    // Top border
    output.push(theme.muted(BOX.topLeft + widths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.topT) + BOX.topRight));

    // Header row
    const headerRow = headers.map((h, i) => ' ' + theme.accent(h.padEnd(widths[i])) + ' ').join(theme.muted(BOX.vertical));
    output.push(theme.muted(BOX.vertical) + headerRow + theme.muted(BOX.vertical));

    // Header separator
    output.push(theme.muted(BOX.leftT + widths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.cross) + BOX.rightT));

    // Data rows
    for (const row of rows) {
      const dataRow = row.map((cell, i) => ' ' + theme.secondary((cell || '').padEnd(widths[i])) + ' ').join(theme.muted(BOX.vertical));
      output.push(theme.muted(BOX.vertical) + dataRow + theme.muted(BOX.vertical));
    }

    // Bottom border
    output.push(theme.muted(BOX.bottomLeft + widths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.bottomT) + BOX.bottomRight));

    return output.join('\n');
  }

  /**
   * Display a JSON object with formatting
   */
  json(obj: unknown, indent: number = 2): string {
    const formatted = JSON.stringify(obj, null, indent);
    return this.code(formatted, 'json');
  }

  /**
   * Display a divider with optional label
   */
  divider(label?: string): string {
    if (!label) {
      return this.line();
    }
    
    const labelPadded = ` ${label} `;
    const sideWidth = Math.floor((this.config.width - labelPadded.length) / 2);
    return theme.muted(
      BOX.horizontal.repeat(sideWidth) +
      theme.accent(labelPadded) +
      BOX.horizontal.repeat(sideWidth)
    );
  }

  /**
   * Display welcome/startup message
   */
  welcome(): string {
    const lines = [
      theme.primary(`${ICONS.joker} Welcome to The Joker`),
      '',
      theme.secondary('Your AI-powered terminal assistant'),
      theme.muted('Type "help" for available commands'),
      ''
    ];
    return this.box(lines, 'The Joker', 'accent');
  }

  /**
   * Display status information
   */
  status(items: StatusItem[]): string {
    const output: string[] = [];
    
    for (const item of items) {
      const icon = item.ok ? theme.success(ICONS.success) : theme.error(ICONS.error);
      const label = item.ok ? theme.primary(item.label) : theme.muted(item.label);
      const value = theme.secondary(item.value);
      output.push(`${icon} ${label}: ${value}`);
    }
    
    return output.join('\n');
  }
}

// Type definitions
interface SearchResult {
  title: string;
  url?: string;
  description?: string;
}

interface FileItem {
  name: string;
  isDirectory: boolean;
  children?: FileItem[];
}

interface StatusItem {
  label: string;
  value: string;
  ok: boolean;
}

// Singleton instance
export const display = new Display();

// Export types and icons
export { ICONS, BOX, DisplayConfig, SearchResult, FileItem, StatusItem };

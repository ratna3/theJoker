/**
 * Result Formatter - Beautiful output formatting for CLI
 * Phase 8: Data Processing & Output Formatting
 */

import chalk from 'chalk';

/**
 * Formatted item for display
 */
export interface FormattedItem {
    title?: string;
    description?: string;
    url?: string;
    metadata?: Record<string, string | number | boolean>;
    tags?: string[];
    score?: number;
    [key: string]: unknown;
}

/**
 * Formatted result container
 */
export interface FormattedResult {
    header?: string;
    items: FormattedItem[];
    summary?: string;
    footer?: string;
    format: 'list' | 'table' | 'cards' | 'markdown' | 'json';
    timestamp: Date;
}

/**
 * Table column configuration
 */
export interface TableColumn {
    key: string;
    header: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
    truncate?: boolean;
}

/**
 * Formatter options
 */
export interface FormatterOptions {
    colorize?: boolean;
    maxWidth?: number;
    showEmptyFields?: boolean;
    truncateLength?: number;
    dateFormat?: string;
}

/**
 * Default formatter options
 */
const DEFAULT_OPTIONS: FormatterOptions = {
    colorize: true,
    maxWidth: 120,
    showEmptyFields: false,
    truncateLength: 80,
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
};

/**
 * ResultFormatter class - Beautiful output formatting utilities
 */
export class ResultFormatter {
    private options: FormatterOptions;

    constructor(options: FormatterOptions = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Format data as a numbered list
     * @param data - Array of items to format
     * @returns Formatted string
     */
    formatAsList(data: FormattedItem[]): string {
        if (!data || data.length === 0) {
            return this.colorize('No results found.', 'dim');
        }

        const lines: string[] = [];

        data.forEach((item, index) => {
            const number = this.colorize(`${index + 1}.`, 'cyan');
            const title = item.title || item.description || 'Untitled';
            
            lines.push(`${number} ${this.colorize(title, 'bold')}`);

            if (item.description && item.title) {
                lines.push(`   ${this.colorize(this.truncate(item.description), 'dim')}`);
            }

            if (item.url) {
                lines.push(`   ${this.colorize('→', 'dim')} ${this.colorize(item.url, 'blue')}`);
            }

            if (item.tags && item.tags.length > 0) {
                const tags = item.tags.map(tag => this.colorize(`#${tag}`, 'magenta')).join(' ');
                lines.push(`   ${tags}`);
            }

            if (item.metadata && Object.keys(item.metadata).length > 0) {
                const meta = Object.entries(item.metadata)
                    .map(([key, value]) => `${this.colorize(key, 'dim')}: ${value}`)
                    .join(' | ');
                lines.push(`   ${meta}`);
            }

            lines.push('');
        });

        return lines.join('\n').trim();
    }

    /**
     * Format data as a table
     * @param data - Array of items to format
     * @param columns - Column configurations
     * @returns Formatted table string
     */
    formatAsTable(data: FormattedItem[], columns?: TableColumn[]): string {
        if (!data || data.length === 0) {
            return this.colorize('No results found.', 'dim');
        }

        // Auto-detect columns if not provided
        if (!columns || columns.length === 0) {
            const allKeys = new Set<string>();
            data.forEach(item => {
                Object.keys(item).forEach(key => {
                    if (key !== 'metadata' && typeof item[key] !== 'object') {
                        allKeys.add(key);
                    }
                });
            });
            columns = Array.from(allKeys).slice(0, 5).map(key => ({
                key,
                header: this.capitalizeFirst(key),
                truncate: true,
            }));
        }

        // Calculate column widths
        const widths = columns.map(col => {
            const headerWidth = col.header.length;
            const dataWidth = Math.max(...data.map(item => {
                const value = this.getNestedValue(item, col.key);
                return String(value ?? '').length;
            }));
            return col.width || Math.min(Math.max(headerWidth, dataWidth) + 2, 40);
        });

        const totalWidth = widths.reduce((sum, w) => sum + w, 0) + columns.length + 1;
        const lines: string[] = [];

        // Top border
        lines.push(this.colorize('┌' + widths.map(w => '─'.repeat(w)).join('┬') + '┐', 'dim'));

        // Header row
        const headerRow = columns.map((col, i) => 
            this.padCell(this.colorize(col.header, 'bold'), widths[i], col.align || 'left')
        ).join(this.colorize('│', 'dim'));
        lines.push(this.colorize('│', 'dim') + headerRow + this.colorize('│', 'dim'));

        // Header separator
        lines.push(this.colorize('├' + widths.map(w => '─'.repeat(w)).join('┼') + '┤', 'dim'));

        // Data rows
        data.forEach(item => {
            const row = columns!.map((col, i) => {
                let value = this.getNestedValue(item, col.key);
                if (value === null || value === undefined) value = '';
                let strValue = String(value);
                
                if (col.truncate && strValue.length > widths[i] - 2) {
                    strValue = strValue.substring(0, widths[i] - 5) + '...';
                }

                // Apply colors based on value type
                if (col.key === 'url') {
                    strValue = this.colorize(strValue, 'blue');
                } else if (col.key === 'score' || col.key === 'rating') {
                    strValue = this.colorize(strValue, 'yellow');
                }

                return this.padCell(strValue, widths[i], col.align || 'left');
            }).join(this.colorize('│', 'dim'));
            lines.push(this.colorize('│', 'dim') + row + this.colorize('│', 'dim'));
        });

        // Bottom border
        lines.push(this.colorize('└' + widths.map(w => '─'.repeat(w)).join('┴') + '┘', 'dim'));

        return lines.join('\n');
    }

    /**
     * Format data as cards (box-style display)
     * @param data - Array of items to format
     * @returns Formatted cards string
     */
    formatAsCards(data: FormattedItem[]): string {
        if (!data || data.length === 0) {
            return this.colorize('No results found.', 'dim');
        }

        const cardWidth = Math.min(this.options.maxWidth || 80, 80);
        const lines: string[] = [];

        data.forEach((item, index) => {
            // Card top border
            lines.push(this.colorize('╭' + '─'.repeat(cardWidth - 2) + '╮', 'dim'));

            // Card number and title
            const title = item.title || 'Untitled';
            const header = ` ${this.colorize(`#${index + 1}`, 'cyan')} ${this.colorize(this.truncate(title, cardWidth - 10), 'bold')}`;
            lines.push(this.colorize('│', 'dim') + header.padEnd(cardWidth - 2 + this.getColorLength(header)) + this.colorize('│', 'dim'));

            // Separator
            lines.push(this.colorize('├' + '─'.repeat(cardWidth - 2) + '┤', 'dim'));

            // Description
            if (item.description) {
                const descLines = this.wrapText(item.description, cardWidth - 4);
                descLines.forEach(line => {
                    const content = ` ${this.colorize(line, 'dim')}`;
                    lines.push(this.colorize('│', 'dim') + content.padEnd(cardWidth - 2 + this.getColorLength(content)) + this.colorize('│', 'dim'));
                });
            }

            // URL
            if (item.url) {
                const urlLine = ` ${this.colorize('→', 'dim')} ${this.colorize(this.truncate(item.url, cardWidth - 8), 'blue')}`;
                lines.push(this.colorize('│', 'dim') + urlLine.padEnd(cardWidth - 2 + this.getColorLength(urlLine)) + this.colorize('│', 'dim'));
            }

            // Tags
            if (item.tags && item.tags.length > 0) {
                const tagsLine = ' ' + item.tags.map(tag => this.colorize(`#${tag}`, 'magenta')).join(' ');
                lines.push(this.colorize('│', 'dim') + tagsLine.padEnd(cardWidth - 2 + this.getColorLength(tagsLine)) + this.colorize('│', 'dim'));
            }

            // Score/Rating
            if (item.score !== undefined) {
                const scoreLine = ` ${this.colorize('Score:', 'dim')} ${this.colorize(String(item.score), 'yellow')}`;
                lines.push(this.colorize('│', 'dim') + scoreLine.padEnd(cardWidth - 2 + this.getColorLength(scoreLine)) + this.colorize('│', 'dim'));
            }

            // Metadata
            if (item.metadata && Object.keys(item.metadata).length > 0) {
                Object.entries(item.metadata).forEach(([key, value]) => {
                    const metaLine = ` ${this.colorize(this.capitalizeFirst(key) + ':', 'dim')} ${value}`;
                    lines.push(this.colorize('│', 'dim') + metaLine.padEnd(cardWidth - 2 + this.getColorLength(metaLine)) + this.colorize('│', 'dim'));
                });
            }

            // Card bottom border
            lines.push(this.colorize('╰' + '─'.repeat(cardWidth - 2) + '╯', 'dim'));
            lines.push('');
        });

        return lines.join('\n').trim();
    }

    /**
     * Format data as Markdown
     * @param data - Array of items to format
     * @returns Markdown formatted string
     */
    formatAsMarkdown(data: FormattedItem[]): string {
        if (!data || data.length === 0) {
            return '*No results found.*';
        }

        const lines: string[] = [];

        data.forEach((item, index) => {
            // Title as heading
            const title = item.title || 'Untitled';
            lines.push(`### ${index + 1}. ${title}`);
            lines.push('');

            // Description
            if (item.description) {
                lines.push(item.description);
                lines.push('');
            }

            // URL as link
            if (item.url) {
                lines.push(`**URL:** [${this.truncate(item.url, 50)}](${item.url})`);
                lines.push('');
            }

            // Tags
            if (item.tags && item.tags.length > 0) {
                lines.push(`**Tags:** ${item.tags.map(tag => `\`${tag}\``).join(' ')}`);
                lines.push('');
            }

            // Score
            if (item.score !== undefined) {
                lines.push(`**Score:** ${item.score}`);
                lines.push('');
            }

            // Metadata as table
            if (item.metadata && Object.keys(item.metadata).length > 0) {
                lines.push('| Property | Value |');
                lines.push('|----------|-------|');
                Object.entries(item.metadata).forEach(([key, value]) => {
                    lines.push(`| ${this.capitalizeFirst(key)} | ${value} |`);
                });
                lines.push('');
            }

            lines.push('---');
            lines.push('');
        });

        return lines.join('\n').trim();
    }

    /**
     * Format data as JSON (pretty-printed)
     * @param data - Array of items to format
     * @returns JSON formatted string
     */
    formatAsJson(data: FormattedItem[]): string {
        return JSON.stringify(data, null, 2);
    }

    /**
     * Create a formatted result object
     * @param items - Items to format
     * @param options - Additional options
     * @returns FormattedResult object
     */
    createResult(
        items: FormattedItem[],
        options: {
            header?: string;
            summary?: string;
            footer?: string;
            format?: 'list' | 'table' | 'cards' | 'markdown' | 'json';
        } = {}
    ): FormattedResult {
        return {
            header: options.header,
            items,
            summary: options.summary,
            footer: options.footer,
            format: options.format || 'list',
            timestamp: new Date(),
        };
    }

    /**
     * Render a formatted result
     * @param result - FormattedResult to render
     * @returns Rendered string
     */
    render(result: FormattedResult): string {
        const lines: string[] = [];

        // Header
        if (result.header) {
            lines.push('');
            lines.push(this.colorize('═'.repeat(Math.min(result.header.length + 4, 80)), 'cyan'));
            lines.push(this.colorize(`  ${result.header}  `, 'bold'));
            lines.push(this.colorize('═'.repeat(Math.min(result.header.length + 4, 80)), 'cyan'));
            lines.push('');
        }

        // Content based on format
        switch (result.format) {
            case 'table':
                lines.push(this.formatAsTable(result.items));
                break;
            case 'cards':
                lines.push(this.formatAsCards(result.items));
                break;
            case 'markdown':
                lines.push(this.formatAsMarkdown(result.items));
                break;
            case 'json':
                lines.push(this.formatAsJson(result.items));
                break;
            case 'list':
            default:
                lines.push(this.formatAsList(result.items));
        }

        // Summary
        if (result.summary) {
            lines.push('');
            lines.push(this.colorize('Summary:', 'bold'));
            lines.push(result.summary);
        }

        // Footer
        if (result.footer) {
            lines.push('');
            lines.push(this.colorize('─'.repeat(60), 'dim'));
            lines.push(this.colorize(result.footer, 'dim'));
        }

        // Timestamp
        lines.push('');
        lines.push(this.colorize(`Generated: ${result.timestamp.toLocaleString()}`, 'dim'));

        return lines.join('\n');
    }

    /**
     * Format a progress bar
     * @param current - Current value
     * @param total - Total value
     * @param width - Width of the bar
     * @returns Progress bar string
     */
    formatProgressBar(current: number, total: number, width: number = 30): string {
        const percentage = Math.min(100, Math.max(0, (current / total) * 100));
        const filled = Math.round((width * percentage) / 100);
        const empty = width - filled;

        const bar = this.colorize('█'.repeat(filled), 'green') + 
                    this.colorize('░'.repeat(empty), 'dim');
        const pct = this.colorize(`${percentage.toFixed(1)}%`, 'cyan');

        return `[${bar}] ${pct} (${current}/${total})`;
    }

    /**
     * Format a key-value pair
     * @param key - Key name
     * @param value - Value
     * @param keyWidth - Width for key column
     * @returns Formatted key-value string
     */
    formatKeyValue(key: string, value: string | number | boolean, keyWidth: number = 15): string {
        const formattedKey = this.colorize(key.padEnd(keyWidth), 'cyan');
        return `${formattedKey}: ${value}`;
    }

    /**
     * Format a status indicator
     * @param status - Status type
     * @param message - Status message
     * @returns Formatted status string
     */
    formatStatus(status: 'success' | 'error' | 'warning' | 'info' | 'pending', message: string): string {
        const icons: Record<string, { icon: string; color: 'green' | 'red' | 'yellow' | 'blue' | 'dim' }> = {
            success: { icon: '✓', color: 'green' },
            error: { icon: '✗', color: 'red' },
            warning: { icon: '⚠', color: 'yellow' },
            info: { icon: 'ℹ', color: 'blue' },
            pending: { icon: '○', color: 'dim' },
        };

        const { icon, color } = icons[status];
        return `${this.colorize(icon, color)} ${message}`;
    }

    /**
     * Format a section header
     * @param title - Section title
     * @param width - Width of the header
     * @returns Formatted section header
     */
    formatSectionHeader(title: string, width: number = 60): string {
        const padding = Math.max(0, width - title.length - 4);
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        
        return this.colorize(
            '─'.repeat(leftPad) + `  ${title}  ` + '─'.repeat(rightPad),
            'cyan'
        );
    }

    // Helper methods

    private colorize(text: string, color: string): string {
        if (!this.options.colorize) return text;

        const colors: Record<string, (text: string) => string> = {
            bold: chalk.bold,
            dim: chalk.dim,
            red: chalk.red,
            green: chalk.green,
            yellow: chalk.yellow,
            blue: chalk.blue,
            cyan: chalk.cyan,
            magenta: chalk.magenta,
            white: chalk.white,
        };

        return colors[color] ? colors[color](text) : text;
    }

    private truncate(text: string, maxLength?: number): string {
        const max = maxLength || this.options.truncateLength || 80;
        if (text.length <= max) return text;
        return text.substring(0, max - 3) + '...';
    }

    private padCell(text: string, width: number, align: 'left' | 'center' | 'right'): string {
        const textLength = this.stripAnsi(text).length;
        const padding = Math.max(0, width - textLength);
        
        switch (align) {
            case 'right':
                return ' '.repeat(padding) + text;
            case 'center':
                const leftPad = Math.floor(padding / 2);
                const rightPad = padding - leftPad;
                return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
            case 'left':
            default:
                return text + ' '.repeat(padding);
        }
    }

    private stripAnsi(text: string): string {
        // eslint-disable-next-line no-control-regex
        return text.replace(/\u001b\[[0-9;]*m/g, '');
    }

    private getColorLength(text: string): number {
        return text.length - this.stripAnsi(text).length;
    }

    private capitalizeFirst(text: string): string {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    private wrapText(text: string, width: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            if (currentLine.length + word.length + 1 <= width) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);

        return lines;
    }

    private getNestedValue(obj: Record<string, unknown>, key: string): unknown {
        const keys = key.split('.');
        let value: unknown = obj;
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = (value as Record<string, unknown>)[k];
            } else {
                return undefined;
            }
        }
        
        return value;
    }
}

// Export convenience functions
export const formatAsList = (data: FormattedItem[], options?: FormatterOptions): string => {
    return new ResultFormatter(options).formatAsList(data);
};

export const formatAsTable = (data: FormattedItem[], columns?: TableColumn[], options?: FormatterOptions): string => {
    return new ResultFormatter(options).formatAsTable(data, columns);
};

export const formatAsCards = (data: FormattedItem[], options?: FormatterOptions): string => {
    return new ResultFormatter(options).formatAsCards(data);
};

export const formatAsMarkdown = (data: FormattedItem[], options?: FormatterOptions): string => {
    return new ResultFormatter(options).formatAsMarkdown(data);
};

export default ResultFormatter;

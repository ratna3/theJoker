/**
 * CLI Module - Central exports for The Joker terminal interface
 * Provides unified access to all CLI components
 */

// Terminal core
import { Terminal, terminal, theme } from './terminal.js';
export { Terminal, terminal, theme };

// Display formatting
import {
  Display,
  display,
  ICONS,
  BOX
} from './display.js';
export { Display, display, ICONS, BOX };
export type { DisplayConfig, SearchResult, FileItem, StatusItem } from './display.js';

// Command system
import { CommandRegistry, commandRegistry } from './commands.js';
export { CommandRegistry, commandRegistry };
export type { Command, CommandCategory, CommandContext, CommandResult } from './commands.js';

// Progress tracking
import { ProgressTracker, progressTracker } from './progress.js';
export { ProgressTracker, progressTracker };
export type { StepStatus, ProgressStep, ProgressConfig, ProgressSummary } from './progress.js';

/**
 * Initialize all CLI components
 */
export async function initializeCLI(): Promise<void> {
  // Terminal is auto-initialized
  // Command registry is auto-initialized with built-in commands
  // Display and Progress are ready to use
  
  // Any additional initialization can be added here
  console.log('CLI components initialized');
}

/**
 * Cleanup all CLI components
 */
export function cleanupCLI(): void {
  terminal.close();
  progressTracker.reset();
}

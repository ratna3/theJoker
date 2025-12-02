/**
 * Progress Tracker - Real-time progress tracking for The Joker terminal
 * Provides multi-step progress visualization and status updates
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { theme } from './terminal.js';
import { ICONS } from './display.js';
import { EventEmitter } from 'events';

/**
 * Step status types
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Progress step definition
 */
export interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
  startTime?: number;
  endTime?: number;
  substeps?: ProgressStep[];
}

/**
 * Progress tracker configuration
 */
export interface ProgressConfig {
  showTimings: boolean;
  showSubsteps: boolean;
  animatedSpinner: boolean;
  compactMode: boolean;
}

const defaultConfig: ProgressConfig = {
  showTimings: true,
  showSubsteps: true,
  animatedSpinner: true,
  compactMode: false
};

/**
 * Progress Tracker class for multi-step operations
 */
export class ProgressTracker extends EventEmitter {
  private steps: Map<string, ProgressStep> = new Map();
  private stepOrder: string[] = [];
  private currentSpinner: Ora | null = null;
  private config: ProgressConfig;
  private startTime: number = 0;
  private title: string = '';

  constructor(config: Partial<ProgressConfig> = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Initialize a new progress tracking session
   */
  start(title: string, steps: string[]): void {
    this.title = title;
    this.startTime = Date.now();
    this.steps.clear();
    this.stepOrder = [];

    for (const step of steps) {
      const id = this.generateId(step);
      this.steps.set(id, {
        id,
        label: step,
        status: 'pending'
      });
      this.stepOrder.push(id);
    }

    this.render();
    this.emit('start', { title, steps: this.stepOrder });
  }

  /**
   * Generate a step ID from label
   */
  private generateId(label: string): string {
    return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Start a step
   */
  startStep(stepId: string, message?: string): void {
    const step = this.findStep(stepId);
    if (!step) return;

    step.status = 'running';
    step.startTime = Date.now();
    step.message = message;

    if (this.config.animatedSpinner) {
      this.currentSpinner = ora({
        text: this.formatStepText(step),
        spinner: 'dots',
        color: 'green'
      }).start();
    }

    this.emit('step:start', step);
  }

  /**
   * Update step message
   */
  updateStep(stepId: string, message: string): void {
    const step = this.findStep(stepId);
    if (!step) return;

    step.message = message;

    if (this.currentSpinner) {
      this.currentSpinner.text = this.formatStepText(step);
    }

    this.emit('step:update', step);
  }

  /**
   * Complete a step successfully
   */
  completeStep(stepId: string, message?: string): void {
    const step = this.findStep(stepId);
    if (!step) return;

    step.status = 'completed';
    step.endTime = Date.now();
    if (message) step.message = message;

    if (this.currentSpinner) {
      this.currentSpinner.succeed(this.formatStepText(step));
      this.currentSpinner = null;
    }

    this.emit('step:complete', step);
  }

  /**
   * Mark a step as failed
   */
  failStep(stepId: string, error?: string): void {
    const step = this.findStep(stepId);
    if (!step) return;

    step.status = 'failed';
    step.endTime = Date.now();
    step.message = error || 'Failed';

    if (this.currentSpinner) {
      this.currentSpinner.fail(this.formatStepText(step));
      this.currentSpinner = null;
    }

    this.emit('step:fail', step);
  }

  /**
   * Skip a step
   */
  skipStep(stepId: string, reason?: string): void {
    const step = this.findStep(stepId);
    if (!step) return;

    step.status = 'skipped';
    step.message = reason || 'Skipped';

    if (this.currentSpinner) {
      this.currentSpinner.info(this.formatStepText(step));
      this.currentSpinner = null;
    }

    this.emit('step:skip', step);
  }

  /**
   * Find a step by ID or label
   */
  private findStep(idOrLabel: string): ProgressStep | undefined {
    // Try by ID first
    let step = this.steps.get(idOrLabel);
    if (step) return step;

    // Try by generated ID from label
    const generatedId = this.generateId(idOrLabel);
    step = this.steps.get(generatedId);
    if (step) return step;

    // Try to find by label
    for (const s of this.steps.values()) {
      if (s.label.toLowerCase() === idOrLabel.toLowerCase()) {
        return s;
      }
    }

    return undefined;
  }

  /**
   * Format step text for display
   */
  private formatStepText(step: ProgressStep): string {
    let text = step.label;

    if (step.message) {
      text += theme.muted(` - ${step.message}`);
    }

    if (this.config.showTimings && step.startTime && step.endTime) {
      const duration = step.endTime - step.startTime;
      text += theme.muted(` (${this.formatDuration(duration)})`);
    }

    return text;
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Get status icon for a step
   */
  private getStatusIcon(status: StepStatus): string {
    switch (status) {
      case 'completed': return theme.success(ICONS.success);
      case 'failed': return theme.error(ICONS.error);
      case 'running': return theme.warning('●');
      case 'skipped': return theme.muted('○');
      case 'pending': return theme.muted('○');
      default: return theme.muted('○');
    }
  }

  /**
   * Render current progress
   */
  render(): void {
    if (this.currentSpinner) return; // Don't interrupt spinner

    const output: string[] = [''];

    // Title
    if (this.title) {
      output.push(theme.accent(`${ICONS.rocket} ${this.title}`));
      output.push(theme.muted('─'.repeat(50)));
      output.push('');
    }

    // Steps
    for (const stepId of this.stepOrder) {
      const step = this.steps.get(stepId);
      if (!step) continue;

      const icon = this.getStatusIcon(step.status);
      let line = `  ${icon} ${step.label}`;

      if (step.message && step.status !== 'pending') {
        line += theme.muted(` - ${step.message}`);
      }

      if (this.config.showTimings && step.startTime && step.endTime) {
        line += theme.muted(` (${this.formatDuration(step.endTime - step.startTime)})`);
      }

      output.push(line);

      // Substeps
      if (this.config.showSubsteps && step.substeps) {
        for (const substep of step.substeps) {
          const subIcon = this.getStatusIcon(substep.status);
          output.push(`    ${subIcon} ${theme.muted(substep.label)}`);
        }
      }
    }

    output.push('');
    console.log(output.join('\n'));
  }

  /**
   * Finish progress tracking
   */
  finish(): ProgressSummary {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    const stats = {
      total: this.steps.size,
      completed: 0,
      failed: 0,
      skipped: 0
    };

    for (const step of this.steps.values()) {
      if (step.status === 'completed') stats.completed++;
      else if (step.status === 'failed') stats.failed++;
      else if (step.status === 'skipped') stats.skipped++;
    }

    const summary: ProgressSummary = {
      title: this.title,
      duration: totalDuration,
      stats,
      success: stats.failed === 0
    };

    this.renderSummary(summary);
    this.emit('finish', summary);

    return summary;
  }

  /**
   * Render final summary
   */
  private renderSummary(summary: ProgressSummary): void {
    const output: string[] = [''];

    output.push(theme.muted('─'.repeat(50)));

    if (summary.success) {
      output.push(theme.success(`${ICONS.success} Completed successfully!`));
    } else {
      output.push(theme.error(`${ICONS.error} Completed with errors`));
    }

    output.push(
      theme.muted('  Steps: ') +
      theme.success(`${summary.stats.completed} completed`) + ', ' +
      theme.error(`${summary.stats.failed} failed`) + ', ' +
      theme.muted(`${summary.stats.skipped} skipped`)
    );

    output.push(
      theme.muted('  Duration: ') +
      theme.accent(this.formatDuration(summary.duration))
    );

    output.push('');
    console.log(output.join('\n'));
  }

  /**
   * Create a simple progress bar
   */
  progressBar(current: number, total: number, width: number = 30, label?: string): string {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    const bar = theme.success('█'.repeat(filled)) + theme.muted('░'.repeat(empty));
    const percentText = theme.accent(`${percentage}%`.padStart(4));

    if (label) {
      return `${label} [${bar}] ${percentText}`;
    }
    return `[${bar}] ${percentText}`;
  }

  /**
   * Display a live progress bar (updates in place)
   */
  liveProgressBar(current: number, total: number, label?: string): void {
    const bar = this.progressBar(current, total, 30, label);
    process.stdout.write(`\r${bar}`);

    if (current >= total) {
      process.stdout.write('\n');
    }
  }

  /**
   * Add a substep to an existing step
   */
  addSubstep(stepId: string, substepLabel: string): string {
    const step = this.findStep(stepId);
    if (!step) return '';

    if (!step.substeps) {
      step.substeps = [];
    }

    const substepId = `${step.id}-${this.generateId(substepLabel)}`;
    step.substeps.push({
      id: substepId,
      label: substepLabel,
      status: 'pending'
    });

    return substepId;
  }

  /**
   * Update substep status
   */
  updateSubstep(stepId: string, substepId: string, status: StepStatus): void {
    const step = this.findStep(stepId);
    if (!step || !step.substeps) return;

    const substep = step.substeps.find(s => s.id === substepId);
    if (substep) {
      substep.status = status;
    }
  }

  /**
   * Get all steps
   */
  getSteps(): ProgressStep[] {
    return this.stepOrder.map(id => this.steps.get(id)!).filter(Boolean);
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }
    this.steps.clear();
    this.stepOrder = [];
    this.title = '';
    this.startTime = 0;
  }
}

/**
 * Progress summary
 */
export interface ProgressSummary {
  title: string;
  duration: number;
  stats: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  };
  success: boolean;
}

// Singleton instance
export const progressTracker = new ProgressTracker();

/**
 * The Joker - Agentic Terminal
 * Progress Tracking System
 * 
 * Auto-generates and updates progress.md files for projects,
 * tracking tasks, file changes, and build status in real-time.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { FileSystemWatcher, FileChangeEvent, ChangeBatch } from './watcher';
import { logger } from '../utils/logger';

// ============================================
// Progress Tracking Types
// ============================================

/**
 * Task status types
 */
export type TaskStatus = 
  | 'pending' 
  | 'in-progress' 
  | 'completed' 
  | 'failed' 
  | 'skipped' 
  | 'blocked';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task category
 */
export type TaskCategory = 
  | 'setup'
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'build'
  | 'deploy'
  | 'other';

/**
 * Individual task definition
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  startedAt?: Date;
  estimatedMinutes?: number;
  actualMinutes?: number;
  assignee?: string;
  tags?: string[];
  dependencies?: string[];
  subtasks?: Task[];
  notes?: string;
  files?: string[];
  blockedBy?: string;
  blockedReason?: string;
}

/**
 * File change log entry
 */
export interface FileChangeLog {
  timestamp: Date;
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  filePath: string;
  relativePath: string;
  oldPath?: string;
  size?: number;
  taskId?: string;
  description?: string;
}

/**
 * Build status entry
 */
export interface BuildStatus {
  timestamp: Date;
  status: 'success' | 'failed' | 'warning' | 'running' | 'cancelled';
  command: string;
  duration?: number;
  errorCount?: number;
  warningCount?: number;
  errors?: BuildError[];
  output?: string;
}

/**
 * Build error details
 */
export interface BuildError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

/**
 * Project milestone
 */
export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: Date;
  completedDate?: Date;
  isCompleted: boolean;
  taskIds: string[];
  progress: number;
}

/**
 * Progress statistics
 */
export interface ProgressStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  failedTasks: number;
  skippedTasks: number;
  blockedTasks: number;
  completionPercentage: number;
  totalFilesChanged: number;
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  averageBuildTime?: number;
  estimatedTimeRemaining?: number;
  startDate?: Date;
  lastUpdateDate: Date;
}

/**
 * Project progress data
 */
export interface ProjectProgress {
  projectName: string;
  projectPath: string;
  version?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  tasks: Task[];
  fileChanges: FileChangeLog[];
  buildHistory: BuildStatus[];
  milestones: Milestone[];
  stats: ProgressStats;
  metadata: Record<string, unknown>;
}

/**
 * Tracker configuration
 */
export interface TrackerConfig {
  /** Path to the progress file */
  progressFilePath?: string;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Maximum file changes to keep in history */
  maxFileChanges?: number;
  /** Maximum builds to keep in history */
  maxBuildHistory?: number;
  /** Enable file watching */
  enableFileWatching?: boolean;
  /** Custom ignore patterns */
  ignorePatterns?: string[];
  /** Include file size in logs */
  includeFileSize?: boolean;
  /** Generate JSON alongside markdown */
  generateJson?: boolean;
  /** Custom template for markdown generation */
  markdownTemplate?: string;
}

// ============================================
// Progress Tracker Class
// ============================================

/**
 * Progress Tracker for project development
 * Generates and maintains progress.md files with task tracking,
 * file change logging, and build status monitoring
 */
export class ProgressTracker extends EventEmitter {
  private config: Required<TrackerConfig>;
  private progress: ProjectProgress;
  private watcher: FileSystemWatcher | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isDirty = false;
  private isInitialized = false;

  private static readonly DEFAULT_CONFIG: Required<TrackerConfig> = {
    progressFilePath: 'progress.md',
    autoSaveInterval: 30000, // 30 seconds
    maxFileChanges: 500,
    maxBuildHistory: 100,
    enableFileWatching: true,
    ignorePatterns: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/*.log',
      '**/coverage/**'
    ],
    includeFileSize: true,
    generateJson: true,
    markdownTemplate: ''
  };

  constructor(
    projectPath: string,
    projectName: string,
    config: TrackerConfig = {}
  ) {
    super();
    
    this.config = { ...ProgressTracker.DEFAULT_CONFIG, ...config };

    this.progress = this.createEmptyProgress(projectPath, projectName);
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize the tracker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Try to load existing progress
    await this.loadProgress();

    // Start file watching if enabled
    if (this.config.enableFileWatching) {
      await this.startFileWatching();
    }

    // Start auto-save timer
    this.startAutoSave();

    this.isInitialized = true;
    this.emit('initialized', this.progress);
    
    logger.info('Progress tracker initialized', {
      projectName: this.progress.projectName,
      projectPath: this.progress.projectPath
    });
  }

  /**
   * Create empty progress object
   */
  private createEmptyProgress(projectPath: string, projectName: string): ProjectProgress {
    const now = new Date();
    return {
      projectName,
      projectPath: path.resolve(projectPath),
      createdAt: now,
      updatedAt: now,
      tasks: [],
      fileChanges: [],
      buildHistory: [],
      milestones: [],
      stats: {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        failedTasks: 0,
        skippedTasks: 0,
        blockedTasks: 0,
        completionPercentage: 0,
        totalFilesChanged: 0,
        totalBuilds: 0,
        successfulBuilds: 0,
        failedBuilds: 0,
        startDate: now,
        lastUpdateDate: now
      },
      metadata: {}
    };
  }

  // ============================================
  // Task Management
  // ============================================

  /**
   * Add a new task
   */
  addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const now = new Date();
    const newTask: Task = {
      ...task,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    this.progress.tasks.push(newTask);
    this.updateStats();
    this.markDirty();

    this.emit('taskAdded', newTask);
    logger.debug('Task added', { taskId: newTask.id, title: newTask.title });

    return newTask;
  }

  /**
   * Update an existing task
   */
  updateTask(taskId: string, updates: Partial<Task>): Task | null {
    const taskIndex = this.progress.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return null;

    const task = this.progress.tasks[taskIndex];
    const updatedTask: Task = {
      ...task,
      ...updates,
      id: task.id, // Preserve ID
      createdAt: task.createdAt, // Preserve creation date
      updatedAt: new Date()
    };

    // Handle status changes
    if (updates.status && updates.status !== task.status) {
      if (updates.status === 'in-progress' && !updatedTask.startedAt) {
        updatedTask.startedAt = new Date();
      }
      if (updates.status === 'completed') {
        // Set completedAt if not already set
        if (!updatedTask.completedAt) {
          updatedTask.completedAt = new Date();
        }
        // Calculate actual minutes if task was started
        if (updatedTask.startedAt && updatedTask.actualMinutes === undefined) {
          updatedTask.actualMinutes = Math.round(
            (updatedTask.completedAt.getTime() - updatedTask.startedAt.getTime()) / 60000
          );
        }
      }
    }

    this.progress.tasks[taskIndex] = updatedTask;
    this.updateStats();
    this.markDirty();

    this.emit('taskUpdated', updatedTask);
    logger.debug('Task updated', { taskId, updates });

    return updatedTask;
  }

  /**
   * Remove a task
   */
  removeTask(taskId: string): boolean {
    const taskIndex = this.progress.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return false;

    const [removed] = this.progress.tasks.splice(taskIndex, 1);
    this.updateStats();
    this.markDirty();

    this.emit('taskRemoved', removed);
    logger.debug('Task removed', { taskId });

    return true;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.progress.tasks.find(t => t.id === taskId);
  }

  /**
   * Get all tasks
   */
  getTasks(filter?: Partial<Task>): Task[] {
    if (!filter) return [...this.progress.tasks];

    return this.progress.tasks.filter(task => {
      for (const [key, value] of Object.entries(filter)) {
        if (task[key as keyof Task] !== value) return false;
      }
      return true;
    });
  }

  /**
   * Mark task as started
   */
  startTask(taskId: string): Task | null {
    return this.updateTask(taskId, { 
      status: 'in-progress',
      startedAt: new Date()
    });
  }

  /**
   * Mark task as completed
   */
  completeTask(taskId: string, notes?: string): Task | null {
    return this.updateTask(taskId, { 
      status: 'completed',
      completedAt: new Date(),
      notes: notes
    });
  }

  /**
   * Mark task as failed
   */
  failTask(taskId: string, reason?: string): Task | null {
    return this.updateTask(taskId, { 
      status: 'failed',
      notes: reason
    });
  }

  /**
   * Block a task
   */
  blockTask(taskId: string, blockedBy: string, reason?: string): Task | null {
    return this.updateTask(taskId, {
      status: 'blocked',
      blockedBy,
      blockedReason: reason
    });
  }

  // ============================================
  // File Change Tracking
  // ============================================

  /**
   * Log a file change
   */
  logFileChange(change: Omit<FileChangeLog, 'timestamp'>): FileChangeLog {
    const log: FileChangeLog = {
      ...change,
      timestamp: new Date()
    };

    this.progress.fileChanges.push(log);

    // Trim if over max
    if (this.progress.fileChanges.length > this.config.maxFileChanges) {
      this.progress.fileChanges = this.progress.fileChanges.slice(-this.config.maxFileChanges);
    }

    this.progress.stats.totalFilesChanged++;
    this.markDirty();

    this.emit('fileChanged', log);
    logger.debug('File change logged', { type: log.type, path: log.relativePath });

    return log;
  }

  /**
   * Get file change history
   */
  getFileChanges(options?: {
    limit?: number;
    type?: FileChangeLog['type'];
    since?: Date;
    taskId?: string;
  }): FileChangeLog[] {
    let changes = [...this.progress.fileChanges];

    if (options?.type) {
      changes = changes.filter(c => c.type === options.type);
    }

    if (options?.since) {
      changes = changes.filter(c => c.timestamp >= options.since!);
    }

    if (options?.taskId) {
      changes = changes.filter(c => c.taskId === options.taskId);
    }

    // Sort by timestamp descending (newest first)
    changes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      changes = changes.slice(0, options.limit);
    }

    return changes;
  }

  // ============================================
  // Build Status Tracking
  // ============================================

  /**
   * Log a build status
   */
  logBuildStatus(build: Omit<BuildStatus, 'timestamp'>): BuildStatus {
    const status: BuildStatus = {
      ...build,
      timestamp: new Date()
    };

    this.progress.buildHistory.push(status);

    // Trim if over max
    if (this.progress.buildHistory.length > this.config.maxBuildHistory) {
      this.progress.buildHistory = this.progress.buildHistory.slice(-this.config.maxBuildHistory);
    }

    // Update stats
    this.progress.stats.totalBuilds++;
    if (status.status === 'success') {
      this.progress.stats.successfulBuilds++;
    } else if (status.status === 'failed') {
      this.progress.stats.failedBuilds++;
    }

    // Calculate average build time
    const completedBuilds = this.progress.buildHistory.filter(
      b => b.duration && (b.status === 'success' || b.status === 'failed')
    );
    if (completedBuilds.length > 0) {
      const totalTime = completedBuilds.reduce((sum, b) => sum + (b.duration || 0), 0);
      this.progress.stats.averageBuildTime = Math.round(totalTime / completedBuilds.length);
    }

    this.markDirty();
    this.emit('buildLogged', status);
    logger.debug('Build status logged', { status: status.status, command: status.command });

    return status;
  }

  /**
   * Get build history
   */
  getBuildHistory(limit?: number): BuildStatus[] {
    const history = [...this.progress.buildHistory];
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get last build status
   */
  getLastBuild(): BuildStatus | undefined {
    return this.progress.buildHistory[this.progress.buildHistory.length - 1];
  }

  // ============================================
  // Milestone Management
  // ============================================

  /**
   * Add a milestone
   */
  addMilestone(milestone: Omit<Milestone, 'id' | 'progress' | 'isCompleted'>): Milestone {
    const newMilestone: Milestone = {
      ...milestone,
      id: this.generateId(),
      progress: 0,
      isCompleted: false
    };

    this.progress.milestones.push(newMilestone);
    this.updateMilestoneProgress(newMilestone.id);
    this.markDirty();

    this.emit('milestoneAdded', newMilestone);
    return newMilestone;
  }

  /**
   * Update milestone progress
   */
  updateMilestoneProgress(milestoneId: string): number {
    const milestone = this.progress.milestones.find(m => m.id === milestoneId);
    if (!milestone) return 0;

    if (milestone.taskIds.length === 0) {
      milestone.progress = 0;
      return 0;
    }

    const tasks = milestone.taskIds
      .map(id => this.getTask(id))
      .filter((t): t is Task => t !== undefined);

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    milestone.progress = Math.round((completedTasks / tasks.length) * 100);
    milestone.isCompleted = milestone.progress === 100;

    if (milestone.isCompleted && !milestone.completedDate) {
      milestone.completedDate = new Date();
    }

    this.markDirty();
    return milestone.progress;
  }

  /**
   * Get all milestones
   */
  getMilestones(): Milestone[] {
    return [...this.progress.milestones];
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Update progress statistics
   */
  private updateStats(): void {
    const tasks = this.progress.tasks;
    
    this.progress.stats = {
      ...this.progress.stats,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      skippedTasks: tasks.filter(t => t.status === 'skipped').length,
      blockedTasks: tasks.filter(t => t.status === 'blocked').length,
      completionPercentage: tasks.length > 0
        ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
        : 0,
      lastUpdateDate: new Date()
    };

    // Calculate estimated time remaining
    const remainingTasks = tasks.filter(t => 
      t.status === 'pending' || t.status === 'in-progress'
    );
    const estimatedMinutes = remainingTasks.reduce(
      (sum, t) => sum + (t.estimatedMinutes || 30), // Default 30 min per task
      0
    );
    this.progress.stats.estimatedTimeRemaining = estimatedMinutes;

    // Update all milestone progress
    for (const milestone of this.progress.milestones) {
      this.updateMilestoneProgress(milestone.id);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): ProgressStats {
    return { ...this.progress.stats };
  }

  // ============================================
  // File Watching
  // ============================================

  /**
   * Start file watching
   */
  private async startFileWatching(): Promise<void> {
    if (this.watcher) return;

    this.watcher = new FileSystemWatcher({
      ignorePatterns: this.config.ignorePatterns,
      ignoreInitial: true,
      debounceMs: 200
    });

    this.watcher.on('change', (event: FileChangeEvent) => {
      this.handleFileChange(event);
    });

    this.watcher.on('error', (err) => {
      logger.warn('File watcher error', { error: err });
    });

    await this.watcher.watch(this.progress.projectPath);
    logger.info('File watching started', { path: this.progress.projectPath });
  }

  /**
   * Handle file change from watcher
   */
  private handleFileChange(event: FileChangeEvent): void {
    const typeMap: Record<string, FileChangeLog['type']> = {
      'add': 'created',
      'change': 'modified',
      'unlink': 'deleted',
      'addDir': 'created',
      'unlinkDir': 'deleted'
    };

    this.logFileChange({
      type: typeMap[event.type] || 'modified',
      filePath: event.path,
      relativePath: event.relativePath,
      size: event.stats?.size
    });
  }

  /**
   * Stop file watching
   */
  async stopFileWatching(): Promise<void> {
    if (!this.watcher) return;

    await this.watcher.close();
    this.watcher = null;
    logger.info('File watching stopped');
  }

  // ============================================
  // Persistence
  // ============================================

  /**
   * Load progress from file
   */
  async loadProgress(): Promise<boolean> {
    const jsonPath = this.getJsonPath();

    try {
      await fs.access(jsonPath);
      const content = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Restore dates
      this.progress = this.restoreDates(data);
      this.updateStats();

      logger.info('Progress loaded from file', { path: jsonPath });
      return true;
    } catch {
      logger.debug('No existing progress file found, starting fresh');
      return false;
    }
  }

  /**
   * Save progress to file
   */
  async saveProgress(): Promise<void> {
    this.progress.updatedAt = new Date();

    // Generate markdown
    const markdown = this.generateMarkdown();
    const mdPath = path.join(this.progress.projectPath, this.config.progressFilePath);
    await fs.writeFile(mdPath, markdown, 'utf-8');

    // Generate JSON if enabled
    if (this.config.generateJson) {
      const jsonPath = this.getJsonPath();
      await fs.writeFile(jsonPath, JSON.stringify(this.progress, null, 2), 'utf-8');
    }

    this.isDirty = false;
    this.emit('saved', { markdown: mdPath, json: this.getJsonPath() });
    logger.info('Progress saved', { path: mdPath });
  }

  /**
   * Get JSON file path
   */
  private getJsonPath(): string {
    const mdPath = path.join(this.progress.projectPath, this.config.progressFilePath);
    return mdPath.replace(/\.md$/, '.json');
  }

  /**
   * Restore dates from JSON
   */
  private restoreDates(data: ProjectProgress): ProjectProgress {
    const dateFields = ['createdAt', 'updatedAt', 'completedAt', 'startedAt', 'targetDate', 'completedDate', 'timestamp'];
    
    const restore = (obj: Record<string, unknown>): void => {
      for (const [key, value] of Object.entries(obj)) {
        if (dateFields.includes(key) && typeof value === 'string') {
          obj[key] = new Date(value);
        } else if (value && typeof value === 'object') {
          restore(value as Record<string, unknown>);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object') {
              restore(item as Record<string, unknown>);
            }
          }
        }
      }
    };

    restore(data as unknown as Record<string, unknown>);
    return data;
  }

  /**
   * Mark as dirty (needs save)
   */
  private markDirty(): void {
    this.isDirty = true;
    this.progress.updatedAt = new Date();
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) return;

    this.autoSaveTimer = setInterval(async () => {
      if (this.isDirty) {
        await this.saveProgress();
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  // ============================================
  // Markdown Generation
  // ============================================

  /**
   * Generate markdown progress file
   */
  generateMarkdown(): string {
    const p = this.progress;
    const lines: string[] = [];

    // Header
    lines.push(`# ${p.projectName} - Development Progress`);
    lines.push('');
    if (p.description) {
      lines.push(`> ${p.description}`);
      lines.push('');
    }

    // Metadata
    lines.push(`**Created:** ${this.formatDate(p.createdAt)}`);
    lines.push(`**Last Updated:** ${this.formatDate(p.updatedAt)}`);
    if (p.version) {
      lines.push(`**Version:** ${p.version}`);
    }
    lines.push('');

    // Progress bar
    const progressBar = this.generateProgressBar(p.stats.completionPercentage);
    lines.push(`## 📊 Overall Progress`);
    lines.push('');
    lines.push(`${progressBar} ${p.stats.completionPercentage}%`);
    lines.push('');

    // Statistics summary
    lines.push('## 📋 Task Overview');
    lines.push('');
    lines.push('| Status | Count |');
    lines.push('|--------|-------|');
    lines.push(`| ✅ Completed | ${p.stats.completedTasks} |`);
    lines.push(`| 🔄 In Progress | ${p.stats.inProgressTasks} |`);
    lines.push(`| ⏳ Pending | ${p.stats.pendingTasks} |`);
    lines.push(`| ❌ Failed | ${p.stats.failedTasks} |`);
    lines.push(`| ⏭️ Skipped | ${p.stats.skippedTasks} |`);
    lines.push(`| 🚫 Blocked | ${p.stats.blockedTasks} |`);
    lines.push(`| **Total** | **${p.stats.totalTasks}** |`);
    lines.push('');

    // Milestones
    if (p.milestones.length > 0) {
      lines.push('## 🎯 Milestones');
      lines.push('');
      for (const milestone of p.milestones) {
        const icon = milestone.isCompleted ? '✅' : '🔵';
        const bar = this.generateProgressBar(milestone.progress, 10);
        lines.push(`### ${icon} ${milestone.title}`);
        if (milestone.description) {
          lines.push(`${milestone.description}`);
        }
        lines.push(`Progress: ${bar} ${milestone.progress}%`);
        if (milestone.targetDate) {
          lines.push(`Target: ${this.formatDate(milestone.targetDate)}`);
        }
        if (milestone.completedDate) {
          lines.push(`Completed: ${this.formatDate(milestone.completedDate)}`);
        }
        lines.push('');
      }
    }

    // Tasks by category
    lines.push('## 📝 Tasks');
    lines.push('');

    const categories = this.groupTasksByCategory();
    for (const [category, tasks] of Object.entries(categories)) {
      if (tasks.length === 0) continue;

      lines.push(`### ${this.getCategoryEmoji(category as TaskCategory)} ${this.capitalizeFirst(category)}`);
      lines.push('');

      for (const task of tasks) {
        const statusIcon = this.getStatusIcon(task.status);
        const priorityBadge = task.priority === 'high' || task.priority === 'critical' 
          ? ` 🔥` : '';
        
        lines.push(`- ${statusIcon} **${task.title}**${priorityBadge}`);
        
        if (task.description) {
          lines.push(`  - ${task.description}`);
        }
        
        if (task.status === 'completed' && task.actualMinutes) {
          lines.push(`  - ⏱️ Completed in ${this.formatDuration(task.actualMinutes)}`);
        }
        
        if (task.status === 'blocked' && task.blockedReason) {
          lines.push(`  - 🚫 Blocked: ${task.blockedReason}`);
        }
        
        if (task.notes) {
          lines.push(`  - 📝 ${task.notes}`);
        }
        
        if (task.files && task.files.length > 0) {
          lines.push(`  - 📁 Files: ${task.files.join(', ')}`);
        }
      }
      lines.push('');
    }

    // Recent file changes
    const recentChanges = this.getFileChanges({ limit: 20 });
    if (recentChanges.length > 0) {
      lines.push('## 📁 Recent File Changes');
      lines.push('');
      
      for (const change of recentChanges.slice(0, 10)) {
        const icon = this.getFileChangeIcon(change.type);
        const time = this.formatTime(change.timestamp);
        lines.push(`- ${icon} \`${change.relativePath}\` (${change.type}) - ${time}`);
      }
      
      if (recentChanges.length > 10) {
        lines.push(`- ... and ${recentChanges.length - 10} more changes`);
      }
      lines.push('');
    }

    // Build history
    const recentBuilds = this.getBuildHistory(5);
    if (recentBuilds.length > 0) {
      lines.push('## 🔨 Recent Builds');
      lines.push('');
      lines.push('| Status | Command | Duration | Time |');
      lines.push('|--------|---------|----------|------|');
      
      for (const build of recentBuilds) {
        const statusIcon = this.getBuildStatusIcon(build.status);
        const duration = build.duration ? this.formatDuration(build.duration / 60000) : '-';
        const time = this.formatTime(build.timestamp);
        const command = build.command.length > 30 
          ? build.command.substring(0, 27) + '...' 
          : build.command;
        lines.push(`| ${statusIcon} ${build.status} | \`${command}\` | ${duration} | ${time} |`);
      }
      lines.push('');

      // Build stats
      if (p.stats.totalBuilds > 0) {
        const successRate = Math.round((p.stats.successfulBuilds / p.stats.totalBuilds) * 100);
        lines.push(`**Build Stats:** ${p.stats.successfulBuilds}/${p.stats.totalBuilds} successful (${successRate}% success rate)`);
        if (p.stats.averageBuildTime) {
          lines.push(`**Average Build Time:** ${this.formatDuration(p.stats.averageBuildTime / 60000)}`);
        }
        lines.push('');
      }
    }

    // Estimated time
    if (p.stats.estimatedTimeRemaining && p.stats.estimatedTimeRemaining > 0) {
      lines.push('## ⏱️ Estimated Time Remaining');
      lines.push('');
      lines.push(`Approximately **${this.formatDuration(p.stats.estimatedTimeRemaining)}** to complete remaining tasks.`);
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Auto-generated by The Joker Progress Tracker*`);
    lines.push(`*Last updated: ${this.formatDate(new Date())}*`);

    return lines.join('\n');
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Group tasks by category
   */
  private groupTasksByCategory(): Record<TaskCategory, Task[]> {
    const groups: Record<TaskCategory, Task[]> = {
      setup: [],
      feature: [],
      bugfix: [],
      refactor: [],
      docs: [],
      test: [],
      build: [],
      deploy: [],
      other: []
    };

    for (const task of this.progress.tasks) {
      groups[task.category].push(task);
    }

    return groups;
  }

  /**
   * Generate ASCII progress bar
   */
  private generateProgressBar(percent: number, width: number = 20): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: TaskStatus): string {
    const icons: Record<TaskStatus, string> = {
      'pending': '⏳',
      'in-progress': '🔄',
      'completed': '✅',
      'failed': '❌',
      'skipped': '⏭️',
      'blocked': '🚫'
    };
    return icons[status];
  }

  /**
   * Get category emoji
   */
  private getCategoryEmoji(category: TaskCategory): string {
    const emojis: Record<TaskCategory, string> = {
      setup: '⚙️',
      feature: '✨',
      bugfix: '🐛',
      refactor: '🔧',
      docs: '📚',
      test: '🧪',
      build: '🔨',
      deploy: '🚀',
      other: '📌'
    };
    return emojis[category];
  }

  /**
   * Get file change icon
   */
  private getFileChangeIcon(type: FileChangeLog['type']): string {
    const icons: Record<FileChangeLog['type'], string> = {
      created: '➕',
      modified: '✏️',
      deleted: '➖',
      renamed: '📝'
    };
    return icons[type];
  }

  /**
   * Get build status icon
   */
  private getBuildStatusIcon(status: BuildStatus['status']): string {
    const icons: Record<BuildStatus['status'], string> = {
      success: '✅',
      failed: '❌',
      warning: '⚠️',
      running: '🔄',
      cancelled: '⏹️'
    };
    return icons[status];
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format time
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format duration in minutes
   */
  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Close the tracker and save final state
   */
  async close(): Promise<void> {
    this.stopAutoSave();
    await this.stopFileWatching();

    if (this.isDirty) {
      await this.saveProgress();
    }

    this.isInitialized = false;
    this.emit('closed');
    logger.info('Progress tracker closed');
  }

  // ============================================
  // Static Factory Methods
  // ============================================

  /**
   * Create and initialize a tracker
   */
  static async create(
    projectPath: string,
    projectName: string,
    config?: TrackerConfig
  ): Promise<ProgressTracker> {
    const tracker = new ProgressTracker(projectPath, projectName, config);
    await tracker.initialize();
    return tracker;
  }

  /**
   * Load existing tracker from progress file
   */
  static async load(
    projectPath: string,
    config?: TrackerConfig
  ): Promise<ProgressTracker | null> {
    const jsonPath = path.join(
      projectPath,
      (config?.progressFilePath || 'progress.md').replace(/\.md$/, '.json')
    );

    try {
      await fs.access(jsonPath);
      const content = await fs.readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content);
      
      const tracker = new ProgressTracker(projectPath, data.projectName, config);
      await tracker.initialize();
      return tracker;
    } catch {
      return null;
    }
  }
}

// ============================================
// Quick Access Functions
// ============================================

/**
 * Create a simple progress tracker
 */
export async function createProgressTracker(
  projectPath: string,
  projectName: string,
  config?: TrackerConfig
): Promise<ProgressTracker> {
  return ProgressTracker.create(projectPath, projectName, config);
}

/**
 * Load existing progress tracker
 */
export async function loadProgressTracker(
  projectPath: string,
  config?: TrackerConfig
): Promise<ProgressTracker | null> {
  return ProgressTracker.load(projectPath, config);
}

// ============================================
// Singleton Tracker Registry
// ============================================

/**
 * Registry for managing multiple project trackers
 */
export class TrackerRegistry {
  private static instance: TrackerRegistry;
  private trackers: Map<string, ProgressTracker> = new Map();

  private constructor() {}

  static getInstance(): TrackerRegistry {
    if (!TrackerRegistry.instance) {
      TrackerRegistry.instance = new TrackerRegistry();
    }
    return TrackerRegistry.instance;
  }

  /**
   * Get or create tracker for a project
   */
  async getTracker(
    projectPath: string,
    projectName?: string,
    config?: TrackerConfig
  ): Promise<ProgressTracker> {
    const resolvedPath = path.resolve(projectPath);

    if (this.trackers.has(resolvedPath)) {
      return this.trackers.get(resolvedPath)!;
    }

    // Try to load existing
    let tracker = await ProgressTracker.load(resolvedPath, config);

    // Create new if not found
    if (!tracker) {
      if (!projectName) {
        projectName = path.basename(resolvedPath);
      }
      tracker = await ProgressTracker.create(resolvedPath, projectName, config);
    }

    this.trackers.set(resolvedPath, tracker);
    return tracker;
  }

  /**
   * Remove tracker from registry
   */
  async removeTracker(projectPath: string): Promise<void> {
    const resolvedPath = path.resolve(projectPath);
    const tracker = this.trackers.get(resolvedPath);

    if (tracker) {
      await tracker.close();
      this.trackers.delete(resolvedPath);
    }
  }

  /**
   * Get all registered trackers
   */
  getAllTrackers(): ProgressTracker[] {
    return Array.from(this.trackers.values());
  }

  /**
   * Close all trackers
   */
  async closeAll(): Promise<void> {
    for (const tracker of this.trackers.values()) {
      await tracker.close();
    }
    this.trackers.clear();
  }
}

// ============================================
// Default Exports
// ============================================

export const trackerRegistry = TrackerRegistry.getInstance();

export default ProgressTracker;

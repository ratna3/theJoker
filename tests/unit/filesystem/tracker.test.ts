/**
 * The Joker - Agentic Terminal
 * Progress Tracker Unit Tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ProgressTracker,
  TrackerRegistry,
  createProgressTracker,
  loadProgressTracker,
  Task,
  TaskStatus,
  TaskCategory,
  TaskPriority,
  FileChangeLog,
  BuildStatus,
  Milestone,
  TrackerConfig
} from '../../../src/filesystem/tracker';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock chokidar
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
    getWatched: jest.fn().mockReturnValue({})
  }))
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ProgressTracker', () => {
  const testProjectPath = '/test/project';
  const testProjectName = 'Test Project';
  let tracker: ProgressTracker;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs.access to succeed
    mockFs.access.mockResolvedValue(undefined);
    
    // Mock fs.stat to return directory
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true
    } as any);
    
    // Mock fs.readFile to fail (no existing progress)
    mockFs.readFile.mockRejectedValue(new Error('File not found'));
    
    // Mock fs.writeFile to succeed
    mockFs.writeFile.mockResolvedValue(undefined);

    tracker = new ProgressTracker(testProjectPath, testProjectName);
  });

  afterEach(async () => {
    if (tracker) {
      await tracker.close();
    }
  });

  describe('Initialization', () => {
    it('should create a new tracker with default config', () => {
      expect(tracker).toBeInstanceOf(ProgressTracker);
    });

    it('should initialize successfully', async () => {
      await tracker.initialize();
      const stats = tracker.getStats();
      expect(stats.totalTasks).toBe(0);
      expect(stats.completionPercentage).toBe(0);
    });

    it('should accept custom configuration', () => {
      const config: TrackerConfig = {
        autoSaveInterval: 60000,
        maxFileChanges: 100,
        enableFileWatching: false
      };
      
      const customTracker = new ProgressTracker(testProjectPath, testProjectName, config);
      expect(customTracker).toBeInstanceOf(ProgressTracker);
    });

    it('should load existing progress from JSON file', async () => {
      const existingProgress = {
        projectName: 'Existing Project',
        projectPath: testProjectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [
          { id: '1', title: 'Task 1', status: 'completed', priority: 'medium', category: 'feature', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '2', title: 'Task 2', status: 'completed', priority: 'medium', category: 'feature', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '3', title: 'Task 3', status: 'completed', priority: 'medium', category: 'feature', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '4', title: 'Task 4', status: 'in-progress', priority: 'high', category: 'bugfix', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '5', title: 'Task 5', status: 'pending', priority: 'low', category: 'docs', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        ],
        fileChanges: [],
        buildHistory: [],
        milestones: [],
        stats: {
          totalTasks: 5,
          completedTasks: 3,
          inProgressTasks: 1,
          pendingTasks: 1,
          failedTasks: 0,
          skippedTasks: 0,
          blockedTasks: 0,
          completionPercentage: 60,
          totalFilesChanged: 10,
          totalBuilds: 2,
          successfulBuilds: 2,
          failedBuilds: 0,
          lastUpdateDate: new Date().toISOString()
        },
        metadata: {}
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingProgress));
      
      await tracker.initialize();
      const stats = tracker.getStats();
      expect(stats.totalTasks).toBe(5);
    });
  });

  describe('Task Management', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should add a new task', () => {
      const task = tracker.addTask({
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
      expect(task.createdAt).toBeInstanceOf(Date);
    });

    it('should update an existing task', () => {
      const task = tracker.addTask({
        title: 'Update Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      const updated = tracker.updateTask(task.id, {
        status: 'in-progress',
        notes: 'Started working'
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('in-progress');
      expect(updated!.notes).toBe('Started working');
      expect(updated!.startedAt).toBeInstanceOf(Date);
    });

    it('should return null when updating non-existent task', () => {
      const result = tracker.updateTask('non-existent', { status: 'completed' });
      expect(result).toBeNull();
    });

    it('should remove a task', () => {
      const task = tracker.addTask({
        title: 'Remove Task',
        status: 'pending',
        priority: 'low',
        category: 'other'
      });

      const removed = tracker.removeTask(task.id);
      expect(removed).toBe(true);
      expect(tracker.getTask(task.id)).toBeUndefined();
    });

    it('should return false when removing non-existent task', () => {
      const result = tracker.removeTask('non-existent');
      expect(result).toBe(false);
    });

    it('should get task by ID', () => {
      const task = tracker.addTask({
        title: 'Get Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      const retrieved = tracker.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Get Task');
    });

    it('should get all tasks', () => {
      tracker.addTask({
        title: 'Task 1',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });
      tracker.addTask({
        title: 'Task 2',
        status: 'completed',
        priority: 'high',
        category: 'bugfix'
      });

      const tasks = tracker.getTasks();
      expect(tasks).toHaveLength(2);
    });

    it('should filter tasks by status', () => {
      tracker.addTask({
        title: 'Pending Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });
      tracker.addTask({
        title: 'Completed Task',
        status: 'completed',
        priority: 'medium',
        category: 'feature'
      });

      const pendingTasks = tracker.getTasks({ status: 'pending' });
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].title).toBe('Pending Task');
    });

    it('should start a task', () => {
      const task = tracker.addTask({
        title: 'Start Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      const started = tracker.startTask(task.id);
      expect(started).not.toBeNull();
      expect(started!.status).toBe('in-progress');
      expect(started!.startedAt).toBeInstanceOf(Date);
    });

    it('should complete a task', () => {
      const task = tracker.addTask({
        title: 'Complete Task',
        status: 'in-progress',
        priority: 'medium',
        category: 'feature'
      });

      const completed = tracker.completeTask(task.id, 'Done!');
      expect(completed).not.toBeNull();
      expect(completed!.status).toBe('completed');
      expect(completed!.completedAt).toBeInstanceOf(Date);
      expect(completed!.notes).toBe('Done!');
    });

    it('should fail a task', () => {
      const task = tracker.addTask({
        title: 'Fail Task',
        status: 'in-progress',
        priority: 'medium',
        category: 'feature'
      });

      const failed = tracker.failTask(task.id, 'Something went wrong');
      expect(failed).not.toBeNull();
      expect(failed!.status).toBe('failed');
      expect(failed!.notes).toBe('Something went wrong');
    });

    it('should block a task', () => {
      const task = tracker.addTask({
        title: 'Block Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      const blocked = tracker.blockTask(task.id, 'dependency-task', 'Waiting for API');
      expect(blocked).not.toBeNull();
      expect(blocked!.status).toBe('blocked');
      expect(blocked!.blockedBy).toBe('dependency-task');
      expect(blocked!.blockedReason).toBe('Waiting for API');
    });

    it('should calculate actual minutes when task completed', () => {
      const task = tracker.addTask({
        title: 'Timed Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      // Start the task
      tracker.startTask(task.id);
      
      // Complete the task
      const completed = tracker.completeTask(task.id);
      expect(completed).not.toBeNull();
      expect(completed!.actualMinutes).toBeDefined();
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should calculate correct statistics', () => {
      tracker.addTask({ title: 'Completed 1', status: 'completed', priority: 'medium', category: 'feature' });
      tracker.addTask({ title: 'Completed 2', status: 'completed', priority: 'medium', category: 'feature' });
      tracker.addTask({ title: 'In Progress', status: 'in-progress', priority: 'high', category: 'bugfix' });
      tracker.addTask({ title: 'Pending', status: 'pending', priority: 'low', category: 'docs' });
      tracker.addTask({ title: 'Failed', status: 'failed', priority: 'medium', category: 'test' });

      const stats = tracker.getStats();
      expect(stats.totalTasks).toBe(5);
      expect(stats.completedTasks).toBe(2);
      expect(stats.inProgressTasks).toBe(1);
      expect(stats.pendingTasks).toBe(1);
      expect(stats.failedTasks).toBe(1);
      expect(stats.completionPercentage).toBe(40);
    });

    it('should calculate estimated time remaining', () => {
      tracker.addTask({ 
        title: 'Task 1', 
        status: 'pending', 
        priority: 'medium', 
        category: 'feature',
        estimatedMinutes: 60
      });
      tracker.addTask({ 
        title: 'Task 2', 
        status: 'in-progress', 
        priority: 'medium', 
        category: 'feature',
        estimatedMinutes: 30
      });
      tracker.addTask({ 
        title: 'Task 3', 
        status: 'completed', 
        priority: 'medium', 
        category: 'feature'
      });

      const stats = tracker.getStats();
      expect(stats.estimatedTimeRemaining).toBe(90);
    });

    it('should handle empty task list', () => {
      const stats = tracker.getStats();
      expect(stats.totalTasks).toBe(0);
      expect(stats.completionPercentage).toBe(0);
    });
  });

  describe('File Change Tracking', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should log file changes', () => {
      const change = tracker.logFileChange({
        type: 'created',
        filePath: '/test/project/src/file.ts',
        relativePath: 'src/file.ts',
        size: 1024
      });

      expect(change.timestamp).toBeInstanceOf(Date);
      expect(change.type).toBe('created');
      expect(change.relativePath).toBe('src/file.ts');
    });

    it('should get file changes with limit', () => {
      for (let i = 0; i < 10; i++) {
        tracker.logFileChange({
          type: 'modified',
          filePath: `/test/project/file${i}.ts`,
          relativePath: `file${i}.ts`
        });
      }

      const changes = tracker.getFileChanges({ limit: 5 });
      expect(changes).toHaveLength(5);
    });

    it('should filter file changes by type', () => {
      tracker.logFileChange({ type: 'created', filePath: '/a.ts', relativePath: 'a.ts' });
      tracker.logFileChange({ type: 'modified', filePath: '/b.ts', relativePath: 'b.ts' });
      tracker.logFileChange({ type: 'deleted', filePath: '/c.ts', relativePath: 'c.ts' });

      const created = tracker.getFileChanges({ type: 'created' });
      expect(created).toHaveLength(1);
    });

    it('should filter file changes by date', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);

      tracker.logFileChange({ type: 'created', filePath: '/a.ts', relativePath: 'a.ts' });

      const changes = tracker.getFileChanges({ since: yesterday });
      expect(changes).toHaveLength(1);
    });

    it('should trim file changes when exceeding max', async () => {
      const customTracker = new ProgressTracker(testProjectPath, testProjectName, {
        maxFileChanges: 5,
        enableFileWatching: false
      });
      await customTracker.initialize();

      for (let i = 0; i < 10; i++) {
        customTracker.logFileChange({
          type: 'modified',
          filePath: `/file${i}.ts`,
          relativePath: `file${i}.ts`
        });
      }

      const changes = customTracker.getFileChanges();
      expect(changes.length).toBeLessThanOrEqual(5);
      
      await customTracker.close();
    });
  });

  describe('Build Status Tracking', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should log build status', () => {
      const build = tracker.logBuildStatus({
        status: 'success',
        command: 'npm run build',
        duration: 5000
      });

      expect(build.timestamp).toBeInstanceOf(Date);
      expect(build.status).toBe('success');
      expect(build.command).toBe('npm run build');
    });

    it('should update build statistics', () => {
      tracker.logBuildStatus({ status: 'success', command: 'npm run build' });
      tracker.logBuildStatus({ status: 'success', command: 'npm run build' });
      tracker.logBuildStatus({ status: 'failed', command: 'npm run test' });

      const stats = tracker.getStats();
      expect(stats.totalBuilds).toBe(3);
      expect(stats.successfulBuilds).toBe(2);
      expect(stats.failedBuilds).toBe(1);
    });

    it('should get build history', () => {
      tracker.logBuildStatus({ status: 'success', command: 'npm run build' });
      tracker.logBuildStatus({ status: 'failed', command: 'npm run test' });

      const history = tracker.getBuildHistory();
      expect(history).toHaveLength(2);
    });

    it('should limit build history', () => {
      for (let i = 0; i < 10; i++) {
        tracker.logBuildStatus({ status: 'success', command: `build ${i}` });
      }

      const history = tracker.getBuildHistory(5);
      expect(history).toHaveLength(5);
    });

    it('should get last build', () => {
      tracker.logBuildStatus({ status: 'success', command: 'first' });
      tracker.logBuildStatus({ status: 'failed', command: 'last' });

      const lastBuild = tracker.getLastBuild();
      expect(lastBuild).toBeDefined();
      expect(lastBuild!.command).toBe('last');
    });

    it('should calculate average build time', () => {
      tracker.logBuildStatus({ status: 'success', command: 'build', duration: 6000 });
      tracker.logBuildStatus({ status: 'success', command: 'build', duration: 4000 });

      const stats = tracker.getStats();
      expect(stats.averageBuildTime).toBe(5000);
    });
  });

  describe('Milestone Management', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should add a milestone', () => {
      const milestone = tracker.addMilestone({
        title: 'Version 1.0',
        description: 'First major release',
        taskIds: []
      });

      expect(milestone.id).toBeDefined();
      expect(milestone.title).toBe('Version 1.0');
      expect(milestone.progress).toBe(0);
      expect(milestone.isCompleted).toBe(false);
    });

    it('should calculate milestone progress', () => {
      const task1 = tracker.addTask({
        title: 'Task 1',
        status: 'completed',
        priority: 'medium',
        category: 'feature'
      });
      const task2 = tracker.addTask({
        title: 'Task 2',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      const milestone = tracker.addMilestone({
        title: 'Milestone',
        taskIds: [task1.id, task2.id]
      });

      expect(milestone.progress).toBe(50);
      expect(milestone.isCompleted).toBe(false);
    });

    it('should mark milestone as completed when all tasks done', () => {
      const task1 = tracker.addTask({
        title: 'Task 1',
        status: 'completed',
        priority: 'medium',
        category: 'feature'
      });
      const task2 = tracker.addTask({
        title: 'Task 2',
        status: 'completed',
        priority: 'medium',
        category: 'feature'
      });

      const milestone = tracker.addMilestone({
        title: 'Milestone',
        taskIds: [task1.id, task2.id]
      });

      expect(milestone.progress).toBe(100);
      expect(milestone.isCompleted).toBe(true);
      expect(milestone.completedDate).toBeInstanceOf(Date);
    });

    it('should get all milestones', () => {
      tracker.addMilestone({ title: 'M1', taskIds: [] });
      tracker.addMilestone({ title: 'M2', taskIds: [] });

      const milestones = tracker.getMilestones();
      expect(milestones).toHaveLength(2);
    });
  });

  describe('Markdown Generation', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should generate markdown content', () => {
      tracker.addTask({
        title: 'Test Task',
        status: 'completed',
        priority: 'high',
        category: 'feature'
      });

      const markdown = tracker.generateMarkdown();
      expect(markdown).toContain('# Test Project');
      expect(markdown).toContain('Overall Progress');
      expect(markdown).toContain('Task Overview');
      expect(markdown).toContain('Test Task');
    });

    it('should include progress bar', () => {
      const markdown = tracker.generateMarkdown();
      expect(markdown).toMatch(/\[█*░*\]/);
    });

    it('should include task categories', () => {
      tracker.addTask({
        title: 'Feature Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });
      tracker.addTask({
        title: 'Bug Task',
        status: 'pending',
        priority: 'high',
        category: 'bugfix'
      });

      const markdown = tracker.generateMarkdown();
      expect(markdown).toContain('Feature');
      expect(markdown).toContain('Bugfix');
    });

    it('should include file changes section', () => {
      tracker.logFileChange({
        type: 'created',
        filePath: '/test/new-file.ts',
        relativePath: 'new-file.ts'
      });

      const markdown = tracker.generateMarkdown();
      expect(markdown).toContain('Recent File Changes');
      expect(markdown).toContain('new-file.ts');
    });

    it('should include build history section', () => {
      tracker.logBuildStatus({
        status: 'success',
        command: 'npm run build',
        duration: 5000
      });

      const markdown = tracker.generateMarkdown();
      expect(markdown).toContain('Recent Builds');
      expect(markdown).toContain('npm run build');
    });

    it('should include status icons', () => {
      tracker.addTask({ title: 'Task', status: 'completed', priority: 'medium', category: 'feature' });

      const markdown = tracker.generateMarkdown();
      expect(markdown).toContain('✅');
    });
  });

  describe('Persistence', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should save progress to files', async () => {
      tracker.addTask({
        title: 'Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      await tracker.saveProgress();

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should generate both markdown and JSON files', async () => {
      await tracker.saveProgress();

      const calls = mockFs.writeFile.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      const paths = calls.map(call => call[0] as string);
      expect(paths.some(p => p.endsWith('.md'))).toBe(true);
      expect(paths.some(p => p.endsWith('.json'))).toBe(true);
    });
  });

  describe('Events', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should emit taskAdded event', (done) => {
      tracker.on('taskAdded', (task) => {
        expect(task.title).toBe('Event Task');
        done();
      });

      tracker.addTask({
        title: 'Event Task',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });
    });

    it('should emit taskUpdated event', (done) => {
      const task = tracker.addTask({
        title: 'Update Event',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      tracker.on('taskUpdated', (updated) => {
        expect(updated.status).toBe('completed');
        done();
      });

      tracker.completeTask(task.id);
    });

    it('should emit taskRemoved event', (done) => {
      const task = tracker.addTask({
        title: 'Remove Event',
        status: 'pending',
        priority: 'medium',
        category: 'feature'
      });

      tracker.on('taskRemoved', (removed) => {
        expect(removed.id).toBe(task.id);
        done();
      });

      tracker.removeTask(task.id);
    });

    it('should emit fileChanged event', (done) => {
      tracker.on('fileChanged', (change) => {
        expect(change.type).toBe('modified');
        done();
      });

      tracker.logFileChange({
        type: 'modified',
        filePath: '/test.ts',
        relativePath: 'test.ts'
      });
    });

    it('should emit buildLogged event', (done) => {
      tracker.on('buildLogged', (build) => {
        expect(build.status).toBe('success');
        done();
      });

      tracker.logBuildStatus({
        status: 'success',
        command: 'npm run build'
      });
    });
  });
});

describe('TrackerRegistry', () => {
  let registry: TrackerRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = TrackerRegistry.getInstance();
    
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.readFile.mockRejectedValue(new Error('Not found'));
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await registry.closeAll();
  });

  it('should be a singleton', () => {
    const registry2 = TrackerRegistry.getInstance();
    expect(registry).toBe(registry2);
  });

  it('should create and cache tracker', async () => {
    const tracker = await registry.getTracker('/test/path', 'Test');
    const tracker2 = await registry.getTracker('/test/path');

    expect(tracker).toBe(tracker2);
  });

  it('should get all trackers', async () => {
    await registry.getTracker('/path1', 'Project 1');
    await registry.getTracker('/path2', 'Project 2');

    const all = registry.getAllTrackers();
    expect(all).toHaveLength(2);
  });

  it('should remove tracker', async () => {
    await registry.getTracker('/test/remove', 'Remove Test');
    await registry.removeTracker('/test/remove');

    const all = registry.getAllTrackers();
    expect(all).toHaveLength(0);
  });

  it('should close all trackers', async () => {
    await registry.getTracker('/path1', 'Project 1');
    await registry.getTracker('/path2', 'Project 2');
    await registry.closeAll();

    const all = registry.getAllTrackers();
    expect(all).toHaveLength(0);
  });
});

describe('Factory Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.readFile.mockRejectedValue(new Error('Not found'));
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  it('should create tracker with createProgressTracker', async () => {
    const tracker = await createProgressTracker('/test/path', 'Test Project');
    expect(tracker).toBeInstanceOf(ProgressTracker);
    await tracker.close();
  });

  it('should return null when loading non-existent tracker', async () => {
    const tracker = await loadProgressTracker('/non/existent');
    expect(tracker).toBeNull();
  });

  it('should load existing tracker with loadProgressTracker', async () => {
    const existingProgress = {
      projectName: 'Loaded Project',
      projectPath: '/test/path',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
        lastUpdateDate: new Date().toISOString()
      },
      metadata: {}
    };

    mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingProgress));

    const tracker = await loadProgressTracker('/test/path');
    expect(tracker).not.toBeNull();
    await tracker?.close();
  });
});

describe('Edge Cases', () => {
  let tracker: ProgressTracker;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
    mockFs.readFile.mockRejectedValue(new Error('Not found'));
    mockFs.writeFile.mockResolvedValue(undefined);

    tracker = new ProgressTracker('/test/project', 'Test', {
      enableFileWatching: false
    });
    await tracker.initialize();
  });

  afterEach(async () => {
    await tracker.close();
  });

  it('should handle task with all properties', () => {
    const task = tracker.addTask({
      title: 'Full Task',
      description: 'Full description',
      status: 'pending',
      priority: 'critical',
      category: 'feature',
      estimatedMinutes: 120,
      assignee: 'dev@example.com',
      tags: ['urgent', 'frontend'],
      dependencies: ['other-task-id'],
      files: ['src/component.ts'],
      notes: 'Important notes'
    });

    expect(task.title).toBe('Full Task');
    expect(task.priority).toBe('critical');
    expect(task.tags).toContain('urgent');
    expect(task.dependencies).toContain('other-task-id');
  });

  it('should handle build with errors', () => {
    const build = tracker.logBuildStatus({
      status: 'failed',
      command: 'npm run build',
      duration: 3000,
      errorCount: 2,
      warningCount: 5,
      errors: [
        { file: 'src/index.ts', line: 10, message: 'Type error', severity: 'error' },
        { file: 'src/utils.ts', line: 20, message: 'Missing import', severity: 'error' }
      ]
    });

    expect(build.errorCount).toBe(2);
    expect(build.errors).toHaveLength(2);
  });

  it('should handle milestone with target date', () => {
    const targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now

    const milestone = tracker.addMilestone({
      title: 'Sprint 1',
      description: 'First sprint',
      targetDate,
      taskIds: []
    });

    expect(milestone.targetDate).toEqual(targetDate);
  });

  it('should handle special characters in task titles', () => {
    const task = tracker.addTask({
      title: 'Task with "quotes" and <brackets>',
      status: 'pending',
      priority: 'medium',
      category: 'feature'
    });

    const markdown = tracker.generateMarkdown();
    expect(markdown).toContain('Task with "quotes" and <brackets>');
  });

  it('should handle unicode in task content', () => {
    const task = tracker.addTask({
      title: '实现功能 🚀',
      description: 'Описание задачи',
      status: 'pending',
      priority: 'medium',
      category: 'feature'
    });

    const markdown = tracker.generateMarkdown();
    expect(markdown).toContain('实现功能');
    expect(markdown).toContain('🚀');
  });

  it('should preserve task ID on update', () => {
    const task = tracker.addTask({
      title: 'Original',
      status: 'pending',
      priority: 'medium',
      category: 'feature'
    });

    const originalId = task.id;

    tracker.updateTask(task.id, {
      id: 'attempted-override',
      title: 'Updated'
    } as any);

    const updated = tracker.getTask(originalId);
    expect(updated?.id).toBe(originalId);
  });

  it('should preserve creation date on update', () => {
    const task = tracker.addTask({
      title: 'Original',
      status: 'pending',
      priority: 'medium',
      category: 'feature'
    });

    const originalCreatedAt = task.createdAt;

    // Wait a bit to ensure time difference
    tracker.updateTask(task.id, { title: 'Updated' });

    const updated = tracker.getTask(task.id);
    expect(updated?.createdAt).toEqual(originalCreatedAt);
  });
});

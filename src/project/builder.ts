/**
 * The Joker - Agentic Terminal
 * Build Manager & Development Workflow
 * 
 * Orchestrates build processes, manages dev servers, monitors build status,
 * parses errors, and attempts auto-fixes for common build issues.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import type { PackageManagerType, Framework } from '../types';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

// ============================================
// Types
// ============================================

/**
 * Build status enumeration
 */
export type BuildStatus = 'idle' | 'building' | 'success' | 'failed' | 'cancelled';

/**
 * Dev server status
 */
export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

/**
 * Build error severity
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Build error from compilation
 */
export interface BuildError {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: ErrorSeverity;
  code?: string;
  source?: string;
  suggestion?: string;
}

/**
 * Build result
 */
export interface BuildResult {
  success: boolean;
  status: BuildStatus;
  startTime: Date;
  endTime: Date;
  duration: number;
  errors: BuildError[];
  warnings: BuildError[];
  output: string;
  command: string;
  exitCode: number | null;
}

/**
 * Dev server information
 */
export interface DevServerInfo {
  status: ServerStatus;
  pid?: number;
  url?: string;
  port?: number;
  startTime?: Date;
  framework?: string;
  command?: string;
}

/**
 * Build configuration
 */
export interface BuildConfig {
  projectPath: string;
  packageManager?: PackageManagerType;
  buildCommand?: string;
  devCommand?: string;
  testCommand?: string;
  lintCommand?: string;
  env?: Record<string, string>;
  timeout?: number;
  watch?: boolean;
  verbose?: boolean;
}

/**
 * Auto-fix result
 */
export interface AutoFixResult {
  applied: boolean;
  description: string;
  error: BuildError;
  changes?: Array<{
    file: string;
    before?: string;
    after?: string;
  }>;
}

/**
 * Build watcher options
 */
export interface WatchOptions {
  debounceMs?: number;
  ignoredPatterns?: string[];
  onRebuild?: (result: BuildResult) => void;
}

/**
 * Script info from package.json
 */
export interface ScriptInfo {
  name: string;
  command: string;
  description?: string;
  type: 'build' | 'dev' | 'test' | 'lint' | 'format' | 'other';
}

/**
 * Build events
 */
export interface BuilderEvents {
  'build:start': { command: string; projectPath: string };
  'build:progress': { message: string; type: 'stdout' | 'stderr' };
  'build:complete': { result: BuildResult };
  'build:error': { error: BuildError };
  'server:start': { info: DevServerInfo };
  'server:ready': { url: string; port: number };
  'server:output': { message: string };
  'server:stop': { reason: string };
  'server:crash': { error: string };
  'fix:applied': { result: AutoFixResult };
  'watch:rebuild': { result: BuildResult };
}

// ============================================
// Error Patterns for Auto-Fix
// ============================================

interface ErrorPattern {
  pattern: RegExp;
  type: string;
  extract: (match: RegExpMatchArray, line: string) => Partial<BuildError>;
  fix?: (error: BuildError, projectPath: string) => Promise<AutoFixResult | null>;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // TypeScript errors
  {
    pattern: /^(.+\.tsx?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/,
    type: 'typescript',
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      code: match[4],
      message: match[5],
      severity: 'error' as ErrorSeverity
    })
  },
  // ESLint errors
  {
    pattern: /^(.+):(\d+):(\d+):\s*(error|warning)\s+(.+?)\s+(\S+)$/,
    type: 'eslint',
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      severity: match[4] as ErrorSeverity,
      message: match[5],
      code: match[6]
    })
  },
  // Webpack errors
  {
    pattern: /ERROR in (.+)\n\s*(.+)\s*\((\d+):(\d+)\)/m,
    type: 'webpack',
    extract: (match) => ({
      file: match[1],
      message: match[2],
      line: parseInt(match[3]),
      column: parseInt(match[4]),
      severity: 'error' as ErrorSeverity
    })
  },
  // Vite errors
  {
    pattern: /\[vite\].*?error.*?:(.+?)(?:\s+at\s+(.+?):(\d+):(\d+))?/i,
    type: 'vite',
    extract: (match) => ({
      message: match[1].trim(),
      file: match[2],
      line: match[3] ? parseInt(match[3]) : undefined,
      column: match[4] ? parseInt(match[4]) : undefined,
      severity: 'error' as ErrorSeverity
    })
  },
  // Module not found
  {
    pattern: /Module not found:\s*(?:Error:\s*)?Can't resolve ['"](.+?)['"]/,
    type: 'module-not-found',
    extract: (match) => ({
      message: `Module not found: ${match[1]}`,
      code: 'MODULE_NOT_FOUND',
      severity: 'error' as ErrorSeverity,
      suggestion: `Try installing: npm install ${match[1]}`
    }),
    fix: async (error, projectPath) => {
      const moduleName = error.message.match(/Module not found: (.+)/)?.[1];
      if (!moduleName) return null;
      
      try {
        await execAsync(`npm install ${moduleName}`, { cwd: projectPath });
        return {
          applied: true,
          description: `Installed missing module: ${moduleName}`,
          error
        };
      } catch {
        return {
          applied: false,
          description: `Failed to install: ${moduleName}`,
          error
        };
      }
    }
  },
  // TypeScript missing type declarations
  {
    pattern: /Could not find a declaration file for module ['"](.+?)['"]/,
    type: 'missing-types',
    extract: (match) => ({
      message: `Missing type declarations for: ${match[1]}`,
      code: 'TS7016',
      severity: 'error' as ErrorSeverity,
      suggestion: `Try installing: npm install -D @types/${match[1].replace('@', '').replace('/', '__')}`
    }),
    fix: async (error, projectPath) => {
      const moduleMatch = error.message.match(/Missing type declarations for: (.+)/);
      if (!moduleMatch) return null;
      
      const moduleName = moduleMatch[1];
      const typesPackage = `@types/${moduleName.replace('@', '').replace('/', '__')}`;
      
      try {
        await execAsync(`npm install -D ${typesPackage}`, { cwd: projectPath });
        return {
          applied: true,
          description: `Installed type declarations: ${typesPackage}`,
          error
        };
      } catch {
        return {
          applied: false,
          description: `Failed to install types: ${typesPackage}`,
          error
        };
      }
    }
  },
  // Port already in use
  {
    pattern: /(?:EADDRINUSE|address already in use).*?:(\d+)/i,
    type: 'port-in-use',
    extract: (match) => ({
      message: `Port ${match[1]} is already in use`,
      code: 'EADDRINUSE',
      severity: 'error' as ErrorSeverity,
      suggestion: `Kill the process using port ${match[1]} or use a different port`
    })
  },
  // Syntax errors
  {
    pattern: /SyntaxError:\s*(.+?)\s*(?:at\s+(.+?):(\d+):(\d+))?/,
    type: 'syntax',
    extract: (match) => ({
      message: match[1],
      file: match[2],
      line: match[3] ? parseInt(match[3]) : undefined,
      column: match[4] ? parseInt(match[4]) : undefined,
      severity: 'error' as ErrorSeverity
    })
  },
  // Generic Node.js errors
  {
    pattern: /Error:\s*(.+?)(?:\n\s+at\s+.+?(?:\s+\((.+?):(\d+):(\d+)\))?)?/,
    type: 'generic',
    extract: (match) => ({
      message: match[1],
      file: match[2],
      line: match[3] ? parseInt(match[3]) : undefined,
      column: match[4] ? parseInt(match[4]) : undefined,
      severity: 'error' as ErrorSeverity
    })
  }
];

// ============================================
// Build Script Detection
// ============================================

const SCRIPT_PATTERNS: Record<string, ScriptInfo['type']> = {
  build: 'build',
  compile: 'build',
  bundle: 'build',
  dev: 'dev',
  start: 'dev',
  serve: 'dev',
  develop: 'dev',
  test: 'test',
  'test:unit': 'test',
  'test:e2e': 'test',
  lint: 'lint',
  eslint: 'lint',
  format: 'format',
  prettier: 'format'
};

// ============================================
// BuildManager Class
// ============================================

/**
 * Build Manager - Orchestrates build processes and dev servers
 */
export class BuildManager extends EventEmitter {
  private config: Required<BuildConfig>;
  private buildProcess: ChildProcess | null = null;
  private devServer: ChildProcess | null = null;
  private serverInfo: DevServerInfo = { status: 'stopped' };
  private currentBuild: BuildResult | null = null;
  private buildHistory: BuildResult[] = [];
  private watchMode = false;
  private isBuilding = false;
  
  private static readonly DEFAULT_CONFIG: Required<BuildConfig> = {
    projectPath: process.cwd(),
    packageManager: 'npm',
    buildCommand: '',
    devCommand: '',
    testCommand: '',
    lintCommand: '',
    env: {},
    timeout: 300000, // 5 minutes
    watch: false,
    verbose: false
  };

  constructor(config: BuildConfig) {
    super();
    this.config = { ...BuildManager.DEFAULT_CONFIG, ...config };
  }

  // ============================================
  // Initialization & Detection
  // ============================================

  /**
   * Initialize the builder by detecting project configuration
   */
  async initialize(): Promise<void> {
    // Detect package manager if not specified
    if (!this.config.packageManager) {
      this.config.packageManager = await this.detectPackageManager();
    }

    // Detect build scripts
    const scripts = await this.detectScripts();
    
    if (!this.config.buildCommand) {
      const buildScript = scripts.find(s => s.type === 'build');
      if (buildScript) {
        this.config.buildCommand = `${this.config.packageManager} run ${buildScript.name}`;
      }
    }

    if (!this.config.devCommand) {
      const devScript = scripts.find(s => s.type === 'dev');
      if (devScript) {
        this.config.devCommand = `${this.config.packageManager} run ${devScript.name}`;
      }
    }

    if (!this.config.testCommand) {
      const testScript = scripts.find(s => s.type === 'test');
      if (testScript) {
        this.config.testCommand = `${this.config.packageManager} run ${testScript.name}`;
      }
    }

    if (!this.config.lintCommand) {
      const lintScript = scripts.find(s => s.type === 'lint');
      if (lintScript) {
        this.config.lintCommand = `${this.config.packageManager} run ${lintScript.name}`;
      }
    }

    logger.info('BuildManager initialized', {
      projectPath: this.config.projectPath,
      packageManager: this.config.packageManager,
      buildCommand: this.config.buildCommand,
      devCommand: this.config.devCommand
    });
  }

  /**
   * Detect package manager
   */
  private async detectPackageManager(): Promise<PackageManagerType> {
    const lockFiles: Array<{ file: string; manager: PackageManagerType }> = [
      { file: 'bun.lockb', manager: 'bun' },
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'yarn.lock', manager: 'yarn' },
      { file: 'package-lock.json', manager: 'npm' }
    ];

    for (const { file, manager } of lockFiles) {
      try {
        await fs.access(path.join(this.config.projectPath, file));
        return manager;
      } catch {
        // Continue to next
      }
    }

    return 'npm';
  }

  /**
   * Detect available scripts from package.json
   */
  async detectScripts(): Promise<ScriptInfo[]> {
    const scripts: ScriptInfo[] = [];

    try {
      const packageJsonPath = path.join(this.config.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      if (packageJson.scripts) {
        for (const [name, command] of Object.entries(packageJson.scripts)) {
          const type = SCRIPT_PATTERNS[name] || 'other';
          scripts.push({
            name,
            command: command as string,
            type
          });
        }
      }
    } catch (error) {
      logger.debug('Could not read package.json scripts', { error });
    }

    return scripts;
  }

  /**
   * Detect framework from project
   */
  async detectFramework(): Promise<Framework | null> {
    try {
      const packageJsonPath = path.join(this.config.projectPath, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps['next']) return 'nextjs';
      if (deps['react']) return 'react';
      if (deps['vue']) return 'vue';
      if (deps['@nestjs/core']) return 'nestjs';
      if (deps['express']) return 'express';
      
      return 'node';
    } catch {
      return null;
    }
  }

  // ============================================
  // Build Operations
  // ============================================

  /**
   * Run the build command
   */
  async build(): Promise<BuildResult> {
    if (this.isBuilding) {
      throw new Error('Build already in progress');
    }

    const command = this.config.buildCommand;
    if (!command) {
      throw new Error('No build command configured');
    }

    return this.runCommand(command, 'build');
  }

  /**
   * Run tests
   */
  async test(): Promise<BuildResult> {
    const command = this.config.testCommand;
    if (!command) {
      throw new Error('No test command configured');
    }

    return this.runCommand(command, 'test');
  }

  /**
   * Run linting
   */
  async lint(): Promise<BuildResult> {
    const command = this.config.lintCommand;
    if (!command) {
      throw new Error('No lint command configured');
    }

    return this.runCommand(command, 'lint');
  }

  /**
   * Run a custom command
   */
  async runCommand(command: string, type = 'custom'): Promise<BuildResult> {
    this.isBuilding = true;
    const startTime = new Date();
    let output = '';
    const errors: BuildError[] = [];
    const warnings: BuildError[] = [];

    this.emit('build:start', { 
      command, 
      projectPath: this.config.projectPath 
    });

    return new Promise((resolve) => {
      const env = {
        ...process.env,
        ...this.config.env,
        FORCE_COLOR: '1'
      };

      // Parse command into command and args
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      this.buildProcess = spawn(cmd, args, {
        cwd: this.config.projectPath,
        env,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timeout = setTimeout(() => {
        if (this.buildProcess) {
          this.buildProcess.kill('SIGTERM');
        }
      }, this.config.timeout);

      this.buildProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString();
        output += message;
        this.emit('build:progress', { message, type: 'stdout' });
        
        if (this.config.verbose) {
          process.stdout.write(message);
        }

        // Parse for errors
        this.parseOutput(message, errors, warnings);
      });

      this.buildProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString();
        output += message;
        this.emit('build:progress', { message, type: 'stderr' });
        
        if (this.config.verbose) {
          process.stderr.write(message);
        }

        // Parse for errors
        this.parseOutput(message, errors, warnings);
      });

      this.buildProcess.on('close', (code) => {
        clearTimeout(timeout);
        const endTime = new Date();
        
        const result: BuildResult = {
          success: code === 0,
          status: code === 0 ? 'success' : 'failed',
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          errors,
          warnings,
          output,
          command,
          exitCode: code
        };

        this.currentBuild = result;
        this.buildHistory.push(result);
        this.isBuilding = false;
        this.buildProcess = null;

        this.emit('build:complete', { result });
        
        logger.info(`${type} completed`, {
          success: result.success,
          duration: result.duration,
          errors: errors.length,
          warnings: warnings.length
        });

        resolve(result);
      });

      this.buildProcess.on('error', (error) => {
        clearTimeout(timeout);
        const endTime = new Date();
        
        const result: BuildResult = {
          success: false,
          status: 'failed',
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          errors: [{
            message: error.message,
            severity: 'error'
          }],
          warnings,
          output,
          command,
          exitCode: null
        };

        this.currentBuild = result;
        this.buildHistory.push(result);
        this.isBuilding = false;
        this.buildProcess = null;

        this.emit('build:complete', { result });
        resolve(result);
      });
    });
  }

  /**
   * Cancel current build
   */
  cancelBuild(): void {
    if (this.buildProcess) {
      this.buildProcess.kill('SIGTERM');
      this.isBuilding = false;
      
      if (this.currentBuild) {
        this.currentBuild.status = 'cancelled';
      }
      
      logger.info('Build cancelled');
    }
  }

  // ============================================
  // Dev Server Management
  // ============================================

  /**
   * Start the development server
   */
  async startDevServer(options?: { port?: number }): Promise<DevServerInfo> {
    if (this.serverInfo.status === 'running') {
      throw new Error('Dev server is already running');
    }

    const command = this.config.devCommand;
    if (!command) {
      throw new Error('No dev command configured');
    }

    this.serverInfo = {
      status: 'starting',
      command
    };

    this.emit('server:start', { info: this.serverInfo });

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ...this.config.env,
        FORCE_COLOR: '1',
        ...(options?.port ? { PORT: String(options.port) } : {})
      };

      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      this.devServer = spawn(cmd, args, {
        cwd: this.config.projectPath,
        env,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverInfo.pid = this.devServer.pid;
      this.serverInfo.startTime = new Date();

      let serverReady = false;
      const urlPatterns = [
        /(?:Local|Server running at|http:\/\/localhost):?\s*(https?:\/\/[^\s]+)/i,
        /localhost:(\d+)/i,
        /ready on (https?:\/\/[^\s]+)/i,
        /started server on .+?(https?:\/\/[^\s]+)/i
      ];

      this.devServer.stdout?.on('data', (data: Buffer) => {
        const message = data.toString();
        this.emit('server:output', { message });

        // Check for server ready message
        if (!serverReady) {
          for (const pattern of urlPatterns) {
            const match = message.match(pattern);
            if (match) {
              serverReady = true;
              const url = match[1].startsWith('http') 
                ? match[1] 
                : `http://localhost:${match[1]}`;
              const portMatch = url.match(/:(\d+)/);
              const port = portMatch ? parseInt(portMatch[1]) : 3000;

              this.serverInfo.status = 'running';
              this.serverInfo.url = url;
              this.serverInfo.port = port;

              this.emit('server:ready', { url, port });
              
              logger.info('Dev server ready', { url, port });
              resolve(this.serverInfo);
              break;
            }
          }
        }
      });

      this.devServer.stderr?.on('data', (data: Buffer) => {
        const message = data.toString();
        this.emit('server:output', { message });

        // Check for errors that might indicate server failure
        if (message.toLowerCase().includes('error') && !serverReady) {
          // Don't reject immediately, some frameworks output warnings to stderr
        }
      });

      this.devServer.on('close', (code) => {
        this.serverInfo.status = code === 0 ? 'stopped' : 'crashed';
        this.devServer = null;

        if (!serverReady) {
          this.emit('server:crash', { error: `Server exited with code ${code}` });
          reject(new Error(`Dev server failed to start (exit code: ${code})`));
        } else {
          this.emit('server:stop', { reason: `Exited with code ${code}` });
        }

        logger.info('Dev server stopped', { exitCode: code });
      });

      this.devServer.on('error', (error) => {
        this.serverInfo.status = 'crashed';
        this.devServer = null;

        this.emit('server:crash', { error: error.message });
        
        if (!serverReady) {
          reject(error);
        }

        logger.error('Dev server error', { error: error.message });
      });

      // Timeout for server startup
      setTimeout(() => {
        if (!serverReady && this.devServer) {
          // Assume it's running if we haven't gotten an error
          this.serverInfo.status = 'running';
          this.serverInfo.url = 'http://localhost:3000';
          this.serverInfo.port = 3000;
          resolve(this.serverInfo);
        }
      }, 30000);
    });
  }

  /**
   * Stop the development server
   */
  async stopDevServer(): Promise<void> {
    if (!this.devServer) {
      return;
    }

    this.serverInfo.status = 'stopping';
    this.emit('server:stop', { reason: 'Manual stop requested' });

    return new Promise((resolve) => {
      if (!this.devServer) {
        resolve();
        return;
      }

      this.devServer.on('close', () => {
        this.serverInfo.status = 'stopped';
        this.devServer = null;
        resolve();
      });

      // Try graceful shutdown first
      this.devServer.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.devServer) {
          this.devServer.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Restart the development server
   */
  async restartDevServer(): Promise<DevServerInfo> {
    await this.stopDevServer();
    return this.startDevServer({ port: this.serverInfo.port });
  }

  /**
   * Get dev server info
   */
  getServerInfo(): DevServerInfo {
    return { ...this.serverInfo };
  }

  // ============================================
  // Hot Reload Support
  // ============================================

  /**
   * Check if hot reload is supported
   */
  async hasHotReload(): Promise<boolean> {
    const framework = await this.detectFramework();
    
    // These frameworks have built-in hot reload
    const hotReloadFrameworks: Framework[] = ['react', 'nextjs', 'vue'];
    
    return framework !== null && hotReloadFrameworks.includes(framework);
  }

  /**
   * Trigger manual reload (for servers that support it)
   */
  async triggerReload(): Promise<void> {
    // Send SIGHUP to trigger reload in some dev servers
    if (this.devServer && this.devServer.pid) {
      process.kill(this.devServer.pid, 'SIGHUP');
    }
  }

  // ============================================
  // Error Parsing & Auto-Fix
  // ============================================

  /**
   * Parse build output for errors
   */
  private parseOutput(
    output: string, 
    errors: BuildError[], 
    warnings: BuildError[]
  ): void {
    const lines = output.split('\n');

    for (const line of lines) {
      for (const pattern of ERROR_PATTERNS) {
        const match = line.match(pattern.pattern);
        if (match) {
          const error = {
            source: pattern.type,
            ...pattern.extract(match, line)
          } as BuildError;

          if (error.severity === 'warning') {
            warnings.push(error);
          } else {
            errors.push(error);
            this.emit('build:error', { error });
          }
          break;
        }
      }
    }
  }

  /**
   * Attempt to auto-fix build errors
   */
  async autoFix(errors: BuildError[]): Promise<AutoFixResult[]> {
    const results: AutoFixResult[] = [];

    for (const error of errors) {
      for (const pattern of ERROR_PATTERNS) {
        if (error.source === pattern.type && pattern.fix) {
          const result = await pattern.fix(error, this.config.projectPath);
          if (result) {
            results.push(result);
            this.emit('fix:applied', { result });
            
            if (result.applied) {
              logger.info('Auto-fix applied', { 
                error: error.message,
                fix: result.description 
              });
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Build with auto-fix retry
   */
  async buildWithAutoFix(maxRetries = 3): Promise<BuildResult> {
    let retries = 0;
    let result = await this.build();

    while (!result.success && retries < maxRetries) {
      const fixResults = await this.autoFix(result.errors);
      const appliedFixes = fixResults.filter(r => r.applied);

      if (appliedFixes.length === 0) {
        // No more fixes to apply
        break;
      }

      retries++;
      logger.info(`Retry build after fixes (attempt ${retries}/${maxRetries})`);
      result = await this.build();
    }

    return result;
  }

  // ============================================
  // Build Statistics
  // ============================================

  /**
   * Get build history
   */
  getBuildHistory(limit?: number): BuildResult[] {
    const history = [...this.buildHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get last build result
   */
  getLastBuild(): BuildResult | null {
    return this.currentBuild;
  }

  /**
   * Get build statistics
   */
  getStats(): {
    totalBuilds: number;
    successfulBuilds: number;
    failedBuilds: number;
    averageDuration: number;
    successRate: number;
  } {
    const total = this.buildHistory.length;
    const successful = this.buildHistory.filter(b => b.success).length;
    const avgDuration = total > 0 
      ? this.buildHistory.reduce((sum, b) => sum + b.duration, 0) / total 
      : 0;

    return {
      totalBuilds: total,
      successfulBuilds: successful,
      failedBuilds: total - successful,
      averageDuration: Math.round(avgDuration),
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0
    };
  }

  /**
   * Clear build history
   */
  clearHistory(): void {
    this.buildHistory = [];
    this.currentBuild = null;
  }

  // ============================================
  // Watch Mode
  // ============================================

  /**
   * Start build in watch mode
   */
  async startWatch(options?: WatchOptions): Promise<void> {
    if (this.watchMode) {
      throw new Error('Already in watch mode');
    }

    this.watchMode = true;
    logger.info('Starting watch mode');

    // Run initial build
    let result = await this.build();
    options?.onRebuild?.(result);

    // Note: Actual file watching would integrate with FileSystemWatcher
    // For now, the dev server's built-in watch is used
  }

  /**
   * Stop watch mode
   */
  stopWatch(): void {
    this.watchMode = false;
    this.cancelBuild();
    logger.info('Watch mode stopped');
  }

  /**
   * Check if in watch mode
   */
  isWatching(): boolean {
    return this.watchMode;
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Cleanup and stop all processes
   */
  async cleanup(): Promise<void> {
    this.cancelBuild();
    await this.stopDevServer();
    this.stopWatch();
    this.removeAllListeners();
    
    logger.info('BuildManager cleaned up');
  }
}

// ============================================
// Dev Server Manager (Manages multiple servers)
// ============================================

/**
 * Dev Server Manager for multi-project support
 */
export class DevServerManager extends EventEmitter {
  private servers: Map<string, BuildManager> = new Map();

  /**
   * Get or create a build manager for a project
   */
  getManager(projectPath: string): BuildManager {
    const normalized = path.resolve(projectPath);
    
    if (!this.servers.has(normalized)) {
      const manager = new BuildManager({ projectPath: normalized });
      this.servers.set(normalized, manager);
    }

    return this.servers.get(normalized)!;
  }

  /**
   * List all running servers
   */
  listRunningServers(): Array<{ projectPath: string; info: DevServerInfo }> {
    const running: Array<{ projectPath: string; info: DevServerInfo }> = [];

    for (const [projectPath, manager] of this.servers) {
      const info = manager.getServerInfo();
      if (info.status === 'running') {
        running.push({ projectPath, info });
      }
    }

    return running;
  }

  /**
   * Stop all servers
   */
  async stopAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const manager of this.servers.values()) {
      promises.push(manager.cleanup());
    }

    await Promise.all(promises);
    this.servers.clear();
  }

  /**
   * Get total stats across all projects
   */
  getTotalStats(): {
    runningServers: number;
    totalBuilds: number;
    successfulBuilds: number;
    failedBuilds: number;
  } {
    let runningServers = 0;
    let totalBuilds = 0;
    let successfulBuilds = 0;
    let failedBuilds = 0;

    for (const manager of this.servers.values()) {
      const info = manager.getServerInfo();
      if (info.status === 'running') runningServers++;

      const stats = manager.getStats();
      totalBuilds += stats.totalBuilds;
      successfulBuilds += stats.successfulBuilds;
      failedBuilds += stats.failedBuilds;
    }

    return { runningServers, totalBuilds, successfulBuilds, failedBuilds };
  }
}

// ============================================
// Factory Functions
// ============================================

// Default singleton instance
let defaultBuilder: BuildManager | null = null;
let defaultServerManager: DevServerManager | null = null;

/**
 * Get or create the default build manager
 */
export function getBuildManager(projectPath?: string): BuildManager {
  const resolvedPath = projectPath || process.cwd();
  
  if (!defaultBuilder || defaultBuilder['config'].projectPath !== resolvedPath) {
    defaultBuilder = new BuildManager({ projectPath: resolvedPath });
  }
  
  return defaultBuilder;
}

/**
 * Create a new build manager
 */
export function createBuildManager(config: BuildConfig): BuildManager {
  return new BuildManager(config);
}

/**
 * Get the dev server manager singleton
 */
export function getDevServerManager(): DevServerManager {
  if (!defaultServerManager) {
    defaultServerManager = new DevServerManager();
  }
  return defaultServerManager;
}

// Export default instances
export const buildManager = getBuildManager();
export const devServerManager = getDevServerManager();

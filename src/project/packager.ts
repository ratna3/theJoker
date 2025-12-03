/**
 * The Joker - Agentic Terminal
 * Package Manager Integration
 * 
 * Handles automatic package installation, dependency resolution,
 * package manager detection, and lock file management.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import type { 
  PackageManagerType, 
  InstallResult 
} from '../types';

const execAsync = promisify(exec);
const fsPromises = fs.promises;

// ============================================
// Types
// ============================================

/**
 * Installed package information
 */
export interface InstalledPackage {
  name: string;
  version: string;
  dev: boolean;
}

/**
 * Package.json structure
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * npm registry package info
 */
export interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

/**
 * Dependency detection result
 */
export interface DependencyAnalysis {
  required: string[];
  installed: string[];
  missing: string[];
  devOnly: string[];
}

/**
 * Package manager events
 */
export interface PackagerEvents {
  'install:start': { packages: string[]; manager: PackageManagerType };
  'install:progress': { message: string };
  'install:complete': { result: InstallResult };
  'install:error': { error: Error };
  'detect:start': { projectPath: string };
  'detect:complete': { manager: PackageManagerType };
}

/**
 * Built-in Node.js modules that don't need to be installed
 */
const BUILTIN_MODULES = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'https',
  'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
  'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys',
  'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm',
  'wasi', 'worker_threads', 'zlib',
  // Node.js prefixed modules
  'node:assert', 'node:buffer', 'node:child_process', 'node:cluster',
  'node:console', 'node:constants', 'node:crypto', 'node:dgram', 'node:dns',
  'node:domain', 'node:events', 'node:fs', 'node:http', 'node:https',
  'node:module', 'node:net', 'node:os', 'node:path', 'node:perf_hooks',
  'node:process', 'node:punycode', 'node:querystring', 'node:readline',
  'node:repl', 'node:stream', 'node:string_decoder', 'node:sys', 'node:timers',
  'node:tls', 'node:trace_events', 'node:tty', 'node:url', 'node:util',
  'node:v8', 'node:vm', 'node:wasi', 'node:worker_threads', 'node:zlib'
]);

// ============================================
// PackageManager Class
// ============================================

/**
 * Package Manager - Handles package installation and dependency management
 */
export class PackageManager extends EventEmitter {
  private defaultManager: PackageManagerType = 'npm';

  constructor() {
    super();
  }

  /**
   * Detect the package manager used in a project
   */
  async detect(projectPath: string): Promise<PackageManagerType> {
    this.emit('detect:start', { projectPath });

    // Check for lock files (priority order: bun > pnpm > yarn > npm)
    const lockFiles: Array<{ file: string; manager: PackageManagerType }> = [
      { file: 'bun.lockb', manager: 'bun' },
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'yarn.lock', manager: 'yarn' },
      { file: 'package-lock.json', manager: 'npm' },
    ];

    for (const { file, manager } of lockFiles) {
      const lockPath = path.join(projectPath, file);
      if (await this.fileExists(lockPath)) {
        this.emit('detect:complete', { manager });
        return manager;
      }
    }

    // Check for package manager field in package.json
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const content = await fsPromises.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content) as PackageJson;
        
        if (packageJson.packageManager) {
          const pm = String(packageJson.packageManager);
          if (pm.startsWith('npm')) {
            this.emit('detect:complete', { manager: 'npm' });
            return 'npm';
          }
          if (pm.startsWith('yarn')) {
            this.emit('detect:complete', { manager: 'yarn' });
            return 'yarn';
          }
          if (pm.startsWith('pnpm')) {
            this.emit('detect:complete', { manager: 'pnpm' });
            return 'pnpm';
          }
          if (pm.startsWith('bun')) {
            this.emit('detect:complete', { manager: 'bun' });
            return 'bun';
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }

    // Check which package managers are globally installed
    const managers: PackageManagerType[] = ['bun', 'pnpm', 'yarn', 'npm'];
    for (const manager of managers) {
      if (await this.isInstalled(manager)) {
        this.emit('detect:complete', { manager });
        return manager;
      }
    }

    // Default fallback
    this.emit('detect:complete', { manager: this.defaultManager });
    return this.defaultManager;
  }

  /**
   * Install all dependencies from package.json
   */
  async install(projectPath: string, packages?: string[]): Promise<InstallResult> {
    const manager = await this.detect(projectPath);
    const startTime = Date.now();
    const packagesToInstall = packages || [];

    this.emit('install:start', { packages: packagesToInstall, manager });

    const command = this.buildInstallCommand(manager, packages);

    try {
      this.emit('install:progress', { message: `Running: ${command}` });
      const result = await this.executeCommand(command, projectPath);
      const duration = Date.now() - startTime;

      const installResult: InstallResult = {
        success: true,
        output: result.stdout + (result.stderr ? `\n${result.stderr}` : ''),
        duration,
        packagesInstalled: packages || ['all dependencies'],
      };

      this.emit('install:complete', { result: installResult });
      return installResult;
    } catch (error) {
      const err = error as Error & { stdout?: string; stderr?: string };
      const duration = Date.now() - startTime;

      const installResult: InstallResult = {
        success: false,
        output: (err.stdout || '') + (err.stderr || ''),
        duration,
        packagesInstalled: [],
        errors: [err.message],
      };

      this.emit('install:error', { error: err });
      return installResult;
    }
  }

  /**
   * Add new packages to the project
   */
  async add(
    projectPath: string, 
    packages: string[], 
    dev: boolean = false
  ): Promise<InstallResult> {
    if (packages.length === 0) {
      return {
        success: true,
        output: 'No packages specified',
        duration: 0,
        packagesInstalled: [],
      };
    }

    const manager = await this.detect(projectPath);
    const startTime = Date.now();

    this.emit('install:start', { packages, manager });

    const command = this.buildAddCommand(manager, packages, dev);

    try {
      this.emit('install:progress', { message: `Running: ${command}` });
      const result = await this.executeCommand(command, projectPath);
      const duration = Date.now() - startTime;

      const installResult: InstallResult = {
        success: true,
        output: result.stdout + (result.stderr ? `\n${result.stderr}` : ''),
        duration,
        packagesInstalled: packages,
      };

      this.emit('install:complete', { result: installResult });
      return installResult;
    } catch (error) {
      const err = error as Error & { stdout?: string; stderr?: string };
      const duration = Date.now() - startTime;

      const installResult: InstallResult = {
        success: false,
        output: (err.stdout || '') + (err.stderr || ''),
        duration,
        packagesInstalled: [],
        errors: [err.message],
      };

      this.emit('install:error', { error: err });
      return installResult;
    }
  }

  /**
   * Remove packages from the project
   */
  async remove(projectPath: string, packages: string[]): Promise<InstallResult> {
    if (packages.length === 0) {
      return {
        success: true,
        output: 'No packages specified',
        duration: 0,
        packagesInstalled: [],
      };
    }

    const manager = await this.detect(projectPath);
    const startTime = Date.now();

    const command = this.buildRemoveCommand(manager, packages);

    try {
      const result = await this.executeCommand(command, projectPath);
      const duration = Date.now() - startTime;

      return {
        success: true,
        output: result.stdout + (result.stderr ? `\n${result.stderr}` : ''),
        duration,
        packagesInstalled: packages, // Actually removed
      };
    } catch (error) {
      const err = error as Error & { stdout?: string; stderr?: string };
      const duration = Date.now() - startTime;

      return {
        success: false,
        output: (err.stdout || '') + (err.stderr || ''),
        duration,
        packagesInstalled: [],
        errors: [err.message],
      };
    }
  }

  /**
   * Update packages in the project
   */
  async update(projectPath: string, packages?: string[]): Promise<InstallResult> {
    const manager = await this.detect(projectPath);
    const startTime = Date.now();

    const command = this.buildUpdateCommand(manager, packages);

    try {
      const result = await this.executeCommand(command, projectPath);
      const duration = Date.now() - startTime;

      return {
        success: true,
        output: result.stdout + (result.stderr ? `\n${result.stderr}` : ''),
        duration,
        packagesInstalled: packages || ['all packages'],
      };
    } catch (error) {
      const err = error as Error & { stdout?: string; stderr?: string };
      const duration = Date.now() - startTime;

      return {
        success: false,
        output: (err.stdout || '') + (err.stderr || ''),
        duration,
        packagesInstalled: [],
        errors: [err.message],
      };
    }
  }

  /**
   * List all installed packages
   */
  async listInstalled(projectPath: string): Promise<InstalledPackage[]> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    if (!(await this.fileExists(packageJsonPath))) {
      return [];
    }

    try {
      const content = await fsPromises.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content) as PackageJson;
      const packages: InstalledPackage[] = [];

      // Add production dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          packages.push({ name, version, dev: false });
        }
      }

      // Add dev dependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          packages.push({ name, version, dev: true });
        }
      }

      return packages;
    } catch {
      return [];
    }
  }

  /**
   * Check if a package is installed
   */
  async isPackageInstalled(projectPath: string, packageName: string): Promise<boolean> {
    const installed = await this.listInstalled(projectPath);
    return installed.some(pkg => pkg.name === packageName);
  }

  /**
   * Get package version if installed
   */
  async getInstalledVersion(projectPath: string, packageName: string): Promise<string | null> {
    const installed = await this.listInstalled(projectPath);
    const pkg = installed.find(p => p.name === packageName);
    return pkg?.version || null;
  }

  /**
   * Run a package script
   */
  async runScript(projectPath: string, script: string): Promise<InstallResult> {
    const manager = await this.detect(projectPath);
    const startTime = Date.now();

    const command = this.buildScriptCommand(manager, script);

    try {
      const result = await this.executeCommand(command, projectPath);
      const duration = Date.now() - startTime;

      return {
        success: true,
        output: result.stdout + (result.stderr ? `\n${result.stderr}` : ''),
        duration,
        packagesInstalled: [],
      };
    } catch (error) {
      const err = error as Error & { stdout?: string; stderr?: string };
      const duration = Date.now() - startTime;

      return {
        success: false,
        output: (err.stdout || '') + (err.stderr || ''),
        duration,
        packagesInstalled: [],
        errors: [err.message],
      };
    }
  }

  /**
   * Initialize a new package.json
   */
  async init(projectPath: string, options?: Partial<PackageJson>): Promise<InstallResult> {
    const startTime = Date.now();
    const packageJsonPath = path.join(projectPath, 'package.json');

    try {
      // Create directory if it doesn't exist
      await fsPromises.mkdir(projectPath, { recursive: true });

      // Create default package.json
      const defaultPackageJson: PackageJson = {
        name: path.basename(projectPath),
        version: '1.0.0',
        description: '',
        main: 'index.js',
        scripts: {
          test: 'echo "Error: no test specified" && exit 1',
        },
        keywords: [],
        author: '',
        license: 'ISC',
        dependencies: {},
        devDependencies: {},
        ...options,
      };

      await fsPromises.writeFile(
        packageJsonPath,
        JSON.stringify(defaultPackageJson, null, 2),
        'utf-8'
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        output: `Created package.json at ${packageJsonPath}`,
        duration,
        packagesInstalled: [],
      };
    } catch (error) {
      const err = error as Error;
      const duration = Date.now() - startTime;

      return {
        success: false,
        output: '',
        duration,
        packagesInstalled: [],
        errors: [err.message],
      };
    }
  }

  // ============================================
  // Command Builders
  // ============================================

  private buildInstallCommand(manager: PackageManagerType, packages?: string[]): string {
    if (packages && packages.length > 0) {
      // Installing specific packages
      return this.buildAddCommand(manager, packages, false);
    }

    // Installing all dependencies from package.json
    const commands: Record<PackageManagerType, string> = {
      npm: 'npm install',
      yarn: 'yarn install',
      pnpm: 'pnpm install',
      bun: 'bun install',
    };

    return commands[manager];
  }

  private buildAddCommand(
    manager: PackageManagerType, 
    packages: string[], 
    dev: boolean
  ): string {
    const pkgList = packages.join(' ');

    const commands: Record<PackageManagerType, string> = {
      npm: dev ? `npm install -D ${pkgList}` : `npm install ${pkgList}`,
      yarn: dev ? `yarn add -D ${pkgList}` : `yarn add ${pkgList}`,
      pnpm: dev ? `pnpm add -D ${pkgList}` : `pnpm add ${pkgList}`,
      bun: dev ? `bun add -d ${pkgList}` : `bun add ${pkgList}`,
    };

    return commands[manager];
  }

  private buildRemoveCommand(manager: PackageManagerType, packages: string[]): string {
    const pkgList = packages.join(' ');

    const commands: Record<PackageManagerType, string> = {
      npm: `npm uninstall ${pkgList}`,
      yarn: `yarn remove ${pkgList}`,
      pnpm: `pnpm remove ${pkgList}`,
      bun: `bun remove ${pkgList}`,
    };

    return commands[manager];
  }

  private buildUpdateCommand(manager: PackageManagerType, packages?: string[]): string {
    const pkgList = packages?.join(' ') || '';

    const commands: Record<PackageManagerType, string> = {
      npm: pkgList ? `npm update ${pkgList}` : 'npm update',
      yarn: pkgList ? `yarn upgrade ${pkgList}` : 'yarn upgrade',
      pnpm: pkgList ? `pnpm update ${pkgList}` : 'pnpm update',
      bun: pkgList ? `bun update ${pkgList}` : 'bun update',
    };

    return commands[manager];
  }

  private buildScriptCommand(manager: PackageManagerType, script: string): string {
    const commands: Record<PackageManagerType, string> = {
      npm: `npm run ${script}`,
      yarn: `yarn ${script}`,
      pnpm: `pnpm run ${script}`,
      bun: `bun run ${script}`,
    };

    return commands[manager];
  }

  // ============================================
  // Utility Methods
  // ============================================

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async isInstalled(manager: PackageManagerType): Promise<boolean> {
    const commands: Record<PackageManagerType, string> = {
      npm: 'npm --version',
      yarn: 'yarn --version',
      pnpm: 'pnpm --version',
      bun: 'bun --version',
    };

    try {
      await execAsync(commands[manager]);
      return true;
    } catch {
      return false;
    }
  }

  private async executeCommand(
    command: string, 
    cwd: string
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          const err = error as Error & { stdout?: string; stderr?: string };
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }
}

// ============================================
// DependencyDetector Class
// ============================================

/**
 * Detects missing dependencies by analyzing source files
 */
export class DependencyDetector {
  private packageManager: PackageManager;
  private sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  constructor(packageManager?: PackageManager) {
    this.packageManager = packageManager || new PackageManager();
  }

  /**
   * Analyze project for missing dependencies
   */
  async analyze(projectPath: string): Promise<DependencyAnalysis> {
    const allFiles = await this.getAllSourceFiles(projectPath);
    const requiredPackages = new Set<string>();
    const devOnlyPackages = new Set<string>();

    for (const file of allFiles) {
      try {
        const content = await fsPromises.readFile(file, 'utf-8');
        const imports = this.extractImports(content);
        const isTestFile = this.isTestFile(file);

        for (const imp of imports) {
          const packageName = this.getPackageName(imp);
          if (packageName && !this.isBuiltinModule(packageName)) {
            if (isTestFile) {
              devOnlyPackages.add(packageName);
            } else {
              requiredPackages.add(packageName);
            }
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Remove packages that are in both (they're production dependencies)
    for (const pkg of requiredPackages) {
      devOnlyPackages.delete(pkg);
    }

    const installed = await this.packageManager.listInstalled(projectPath);
    const installedNames = new Set(installed.map(p => p.name));

    const allRequired = [...requiredPackages, ...devOnlyPackages];
    const missing = allRequired.filter(pkg => !installedNames.has(pkg));

    return {
      required: [...requiredPackages],
      installed: [...installedNames],
      missing,
      devOnly: [...devOnlyPackages],
    };
  }

  /**
   * Detect and return only missing dependencies
   */
  async detectMissing(projectPath: string): Promise<string[]> {
    const analysis = await this.analyze(projectPath);
    return analysis.missing;
  }

  /**
   * Auto-install missing dependencies
   */
  async autoInstall(projectPath: string): Promise<InstallResult> {
    const analysis = await this.analyze(projectPath);

    if (analysis.missing.length === 0) {
      return {
        success: true,
        output: 'All dependencies are already installed',
        duration: 0,
        packagesInstalled: [],
      };
    }

    // Separate production and dev dependencies
    const prodMissing = analysis.missing.filter(
      pkg => analysis.required.includes(pkg)
    );
    const devMissing = analysis.missing.filter(
      pkg => analysis.devOnly.includes(pkg)
    );

    const results: InstallResult[] = [];

    // Install production dependencies
    if (prodMissing.length > 0) {
      const result = await this.packageManager.add(projectPath, prodMissing, false);
      results.push(result);
    }

    // Install dev dependencies
    if (devMissing.length > 0) {
      const result = await this.packageManager.add(projectPath, devMissing, true);
      results.push(result);
    }

    // Combine results
    const success = results.every(r => r.success);
    const output = results.map(r => r.output).join('\n');
    const duration = results.reduce((sum, r) => sum + r.duration, 0);
    const packagesInstalled = results.flatMap(r => r.packagesInstalled);
    const errors = results.flatMap(r => r.errors || []);

    return {
      success,
      output,
      duration,
      packagesInstalled,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get all source files in a project
   */
  private async getAllSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules and hidden directories
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory()) {
          const subFiles = await this.getAllSourceFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (this.sourceExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories that can't be read
    }

    return files;
  }

  /**
   * Extract imports from source code
   */
  private extractImports(code: string): string[] {
    const imports: string[] = [];

    // ES6 imports: import ... from 'package'
    const es6ImportRegex = /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // Dynamic imports: import('package')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS require: require('package')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Get package name from import path
   */
  private getPackageName(importPath: string): string | null {
    // Skip relative imports
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      return null;
    }

    // Handle scoped packages (@org/package)
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return null;
    }

    // Regular package (package or package/subpath)
    return importPath.split('/')[0];
  }

  /**
   * Check if a module is a built-in Node.js module
   */
  private isBuiltinModule(moduleName: string): boolean {
    return BUILTIN_MODULES.has(moduleName);
  }

  /**
   * Check if a file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const name = path.basename(filePath);
    const dir = filePath.toLowerCase();
    
    return (
      name.includes('.test.') ||
      name.includes('.spec.') ||
      name.includes('__tests__') ||
      dir.includes('/test/') ||
      dir.includes('/tests/') ||
      dir.includes('/__tests__/')
    );
  }
}

// ============================================
// VersionResolver Class
// ============================================

/**
 * Resolves package versions from npm registry
 */
export class VersionResolver {
  private registryUrl = 'https://registry.npmjs.org';

  /**
   * Get the latest version of a package
   */
  async getLatestVersion(packageName: string): Promise<string | null> {
    try {
      const response = await this.fetchPackageInfo(packageName);
      return response?.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Get package info from npm registry
   */
  async getPackageInfo(packageName: string): Promise<NpmPackageInfo | null> {
    return this.fetchPackageInfo(packageName);
  }

  /**
   * Check if a package exists on npm
   */
  async packageExists(packageName: string): Promise<boolean> {
    try {
      const info = await this.fetchPackageInfo(packageName);
      return info !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get compatible version based on peer dependencies
   */
  async getCompatibleVersion(
    packageName: string,
    existingDeps: Record<string, string>
  ): Promise<string> {
    try {
      const info = await this.fetchPackageInfo(packageName);
      if (!info) {
        return 'latest';
      }

      // If no peer dependencies, return latest
      if (!info.peerDependencies) {
        return `^${info.version}`;
      }

      // Check peer dependency compatibility
      for (const [peerName, peerRange] of Object.entries(info.peerDependencies)) {
        if (existingDeps[peerName]) {
          const installed = existingDeps[peerName].replace(/[\^~]/, '');
          // Simple semver check - in production, use a proper semver library
          if (!this.isVersionInRange(installed, peerRange)) {
            // Return a warning but still install
            console.warn(
              `Warning: ${packageName} peer dependency ${peerName}@${peerRange} ` +
              `may not be compatible with installed ${peerName}@${installed}`
            );
          }
        }
      }

      return `^${info.version}`;
    } catch {
      return 'latest';
    }
  }

  /**
   * Fetch package info from registry
   */
  private async fetchPackageInfo(packageName: string): Promise<NpmPackageInfo | null> {
    // Use dynamic import for fetch in Node.js
    const https = await import('https');
    
    return new Promise((resolve, reject) => {
      const url = `${this.registryUrl}/${encodeURIComponent(packageName)}/latest`;
      
      https.get(url, (res) => {
        if (res.statusCode === 404) {
          resolve(null);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as NpmPackageInfo);
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Simple version range check
   */
  private isVersionInRange(version: string, range: string): boolean {
    // This is a simplified check - in production, use semver library
    // Handles: ^x.y.z, ~x.y.z, >=x.y.z, x.y.z
    
    const cleanRange = range.replace(/[\^~>=<]/g, '').trim();
    const [rangeMajor, rangeMinor] = cleanRange.split('.').map(Number);
    const [versionMajor, versionMinor] = version.split('.').map(Number);

    if (range.startsWith('^')) {
      // ^x.y.z - compatible with x.y.z
      return versionMajor === rangeMajor && versionMinor >= rangeMinor;
    }
    if (range.startsWith('~')) {
      // ~x.y.z - patch level changes
      return versionMajor === rangeMajor && versionMinor === rangeMinor;
    }
    if (range.startsWith('>=')) {
      return versionMajor >= rangeMajor;
    }

    // Exact match
    return version === cleanRange;
  }
}

// ============================================
// Exports
// ============================================

// Singleton instance
export const packageManager = new PackageManager();
export const dependencyDetector = new DependencyDetector(packageManager);
export const versionResolver = new VersionResolver();

// Re-export types
export type { PackageManagerType, InstallResult } from '../types';

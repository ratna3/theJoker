/**
 * The Joker - Agentic Terminal
 * File System Indexer
 * 
 * Indexes all project files, builds dependency graphs,
 * tracks file changes, and maintains project structure maps.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

// ============================================
// Indexer Types
// ============================================

/**
 * Information about a parsed function
 */
export interface FunctionInfo {
  name: string;
  line: number;
  column: number;
  endLine?: number;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  isArrow: boolean;
  jsdoc?: string;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

/**
 * Information about a parsed class
 */
export interface ClassInfo {
  name: string;
  line: number;
  column: number;
  endLine?: number;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements?: string[];
  isExported: boolean;
  isAbstract: boolean;
  jsdoc?: string;
}

/**
 * Method information
 */
export interface MethodInfo {
  name: string;
  line: number;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isStatic: boolean;
  isPrivate: boolean;
  isProtected: boolean;
  visibility: 'public' | 'private' | 'protected';
}

/**
 * Property information
 */
export interface PropertyInfo {
  name: string;
  line: number;
  type?: string;
  isStatic: boolean;
  isReadonly: boolean;
  visibility: 'public' | 'private' | 'protected';
  defaultValue?: string;
}

/**
 * Variable information
 */
export interface VariableInfo {
  name: string;
  line: number;
  column: number;
  type?: string;
  kind: 'const' | 'let' | 'var';
  isExported: boolean;
  value?: string;
}

/**
 * Import information
 */
export interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  line: number;
  isDefault: boolean;
  isNamespace: boolean;
  isDynamic: boolean;
}

/**
 * Import specifier
 */
export interface ImportSpecifier {
  name: string;
  alias?: string;
  isDefault: boolean;
}

/**
 * Export information
 */
export interface ExportInfo {
  name: string;
  line: number;
  isDefault: boolean;
  isReExport: boolean;
  source?: string;
}

/**
 * Extended file information for indexing
 */
export interface IndexedFileInfo {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  language: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  variables: VariableInfo[];
  dependencies: string[];
  dependents: string[];
  lastModified: Date;
  lastIndexed: Date;
  hash: string;
  lineCount: number;
}

/**
 * Directory information
 */
export interface DirectoryInfo {
  path: string;
  relativePath: string;
  name: string;
  fileCount: number;
  totalSize: number;
  children: string[];
}

/**
 * File change event
 */
export interface FileChange {
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  path: string;
  oldPath?: string;
  timestamp: Date;
}

/**
 * Project statistics
 */
export interface ProjectStatistics {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  totalLines: number;
  languageBreakdown: Record<string, number>;
  fileTypeBreakdown: Record<string, number>;
  largestFiles: Array<{ path: string; size: number }>;
  mostImported: Array<{ path: string; count: number }>;
  circularDependencies: string[][];
}

/**
 * Complete project index
 */
export interface ProjectIndex {
  rootPath: string;
  files: Map<string, IndexedFileInfo>;
  directories: Map<string, DirectoryInfo>;
  dependencyGraph: DependencyGraph;
  indexedAt: Date;
  statistics: ProjectStatistics;
  version: string;
}

/**
 * Search result
 */
export interface SearchResult {
  file: IndexedFileInfo;
  matches: SearchMatch[];
  score: number;
}

/**
 * Search match within a file
 */
export interface SearchMatch {
  type: 'function' | 'class' | 'variable' | 'import' | 'export' | 'content';
  name: string;
  line: number;
  context: string;
}

/**
 * Indexer options
 */
export interface IndexerOptions {
  /** File extensions to index */
  extensions?: string[];
  /** Directories to ignore */
  ignorePatterns?: string[];
  /** Maximum file size to parse (in bytes) */
  maxFileSize?: number;
  /** Whether to parse file contents for symbols */
  parseSymbols?: boolean;
  /** Whether to build dependency graph */
  buildDependencyGraph?: boolean;
  /** Whether to calculate file hashes */
  calculateHashes?: boolean;
}

// ============================================
// Dependency Graph
// ============================================

/**
 * Dependency graph for tracking file relationships
 */
export class DependencyGraph {
  private nodes: Set<string> = new Set();
  private edges: Map<string, Set<string>> = new Map();
  private reverseEdges: Map<string, Set<string>> = new Map();

  /**
   * Add a node (file) to the graph
   */
  addNode(filePath: string): void {
    this.nodes.add(filePath);
    if (!this.edges.has(filePath)) {
      this.edges.set(filePath, new Set());
    }
    if (!this.reverseEdges.has(filePath)) {
      this.reverseEdges.set(filePath, new Set());
    }
  }

  /**
   * Add an edge (dependency) from one file to another
   */
  addEdge(from: string, to: string): void {
    this.addNode(from);
    this.addNode(to);
    this.edges.get(from)?.add(to);
    this.reverseEdges.get(to)?.add(from);
  }

  /**
   * Remove a node and all its edges
   */
  removeNode(filePath: string): void {
    // Remove outgoing edges
    const deps = this.edges.get(filePath);
    if (deps) {
      for (const dep of deps) {
        this.reverseEdges.get(dep)?.delete(filePath);
      }
    }

    // Remove incoming edges
    const dependents = this.reverseEdges.get(filePath);
    if (dependents) {
      for (const dependent of dependents) {
        this.edges.get(dependent)?.delete(filePath);
      }
    }

    this.nodes.delete(filePath);
    this.edges.delete(filePath);
    this.reverseEdges.delete(filePath);
  }

  /**
   * Get all dependencies of a file
   */
  getDependencies(filePath: string): string[] {
    return Array.from(this.edges.get(filePath) || []);
  }

  /**
   * Get all files that depend on this file
   */
  getDependents(filePath: string): string[] {
    return Array.from(this.reverseEdges.get(filePath) || []);
  }

  /**
   * Get all files impacted by changes to a file (transitive dependents)
   */
  getImpactedFiles(filePath: string): string[] {
    const impacted = new Set<string>();
    const queue = [filePath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = this.getDependents(current);

      for (const dependent of dependents) {
        if (!impacted.has(dependent)) {
          impacted.add(dependent);
          queue.push(dependent);
        }
      }
    }

    return Array.from(impacted);
  }

  /**
   * Get all transitive dependencies of a file
   */
  getAllDependencies(filePath: string): string[] {
    const allDeps = new Set<string>();
    const queue = [filePath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const deps = this.getDependencies(current);

      for (const dep of deps) {
        if (!allDeps.has(dep)) {
          allDeps.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(allDeps);
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = this.getDependencies(node);
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          dfs(dep, [...path]);
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          const cycleStart = path.indexOf(dep);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            cycle.push(dep);
            cycles.push(cycle);
          }
        }
      }

      recursionStack.delete(node);
    };

    for (const node of this.nodes) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Get topologically sorted files (for build order)
   */
  getTopologicalSort(): string[] | null {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degrees
    for (const node of this.nodes) {
      inDegree.set(node, 0);
    }

    for (const [, deps] of this.edges) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
      }
    }

    // Find all nodes with no incoming edges
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      for (const dep of this.getDependencies(node)) {
        const newDegree = (inDegree.get(dep) || 0) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    // If result doesn't contain all nodes, there's a cycle
    if (result.length !== this.nodes.size) {
      return null;
    }

    return result;
  }

  /**
   * Check if there's a path from one file to another
   */
  hasPath(from: string, to: string): boolean {
    if (from === to) return true;

    const visited = new Set<string>();
    const queue = [from];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === to) return true;

      if (visited.has(current)) continue;
      visited.add(current);

      for (const dep of this.getDependencies(current)) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    nodes: number;
    edges: number;
    avgDependencies: number;
    maxDependencies: { file: string; count: number };
    maxDependents: { file: string; count: number };
  } {
    let totalEdges = 0;
    let maxDeps = { file: '', count: 0 };
    let maxDependents = { file: '', count: 0 };

    for (const [file, deps] of this.edges) {
      totalEdges += deps.size;
      if (deps.size > maxDeps.count) {
        maxDeps = { file, count: deps.size };
      }
    }

    for (const [file, dependents] of this.reverseEdges) {
      if (dependents.size > maxDependents.count) {
        maxDependents = { file, count: dependents.size };
      }
    }

    return {
      nodes: this.nodes.size,
      edges: totalEdges,
      avgDependencies: this.nodes.size > 0 ? totalEdges / this.nodes.size : 0,
      maxDependencies: maxDeps,
      maxDependents: maxDependents
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.reverseEdges.clear();
  }

  /**
   * Serialize graph to JSON
   */
  toJSON(): { nodes: string[]; edges: Array<{ from: string; to: string }> } {
    const edges: Array<{ from: string; to: string }> = [];
    for (const [from, deps] of this.edges) {
      for (const to of deps) {
        edges.push({ from, to });
      }
    }
    return {
      nodes: Array.from(this.nodes),
      edges
    };
  }

  /**
   * Deserialize graph from JSON
   */
  static fromJSON(data: { nodes: string[]; edges: Array<{ from: string; to: string }> }): DependencyGraph {
    const graph = new DependencyGraph();
    for (const node of data.nodes) {
      graph.addNode(node);
    }
    for (const { from, to } of data.edges) {
      graph.addEdge(from, to);
    }
    return graph;
  }
}

// ============================================
// File Indexer Class
// ============================================

/**
 * Indexes project files for fast search and analysis
 */
export class FileIndexer extends EventEmitter {
  private options: Required<IndexerOptions>;
  private index: ProjectIndex | null = null;

  private static readonly DEFAULT_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.vue', '.svelte',
    '.json', '.yaml', '.yml',
    '.md', '.mdx',
    '.css', '.scss', '.less', '.sass',
    '.html', '.htm',
    '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift'
  ];

  private static readonly DEFAULT_IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    '.cache',
    'coverage',
    '__pycache__',
    '.pytest_cache',
    'vendor',
    '.idea',
    '.vscode'
  ];

  constructor(options: IndexerOptions = {}) {
    super();
    this.options = {
      extensions: options.extensions || FileIndexer.DEFAULT_EXTENSIONS,
      ignorePatterns: options.ignorePatterns || FileIndexer.DEFAULT_IGNORE_PATTERNS,
      maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB default
      parseSymbols: options.parseSymbols ?? true,
      buildDependencyGraph: options.buildDependencyGraph ?? true,
      calculateHashes: options.calculateHashes ?? true
    };
  }

  // ============================================
  // Main Indexing Methods
  // ============================================

  /**
   * Index a project directory
   */
  async indexProject(projectPath: string): Promise<ProjectIndex> {
    const startTime = Date.now();
    logger.info('Starting project indexing', { projectPath });
    this.emit('index:start', { projectPath });

    const files = new Map<string, IndexedFileInfo>();
    const directories = new Map<string, DirectoryInfo>();
    const dependencyGraph = new DependencyGraph();

    // Get all files
    const allFiles = await this.getAllFiles(projectPath);
    const totalFiles = allFiles.length;
    let indexedCount = 0;

    this.emit('index:progress', { total: totalFiles, indexed: 0 });

    // Index each file
    for (const filePath of allFiles) {
      try {
        const fileInfo = await this.indexFile(filePath, projectPath);
        if (fileInfo) {
          files.set(fileInfo.relativePath, fileInfo);
          indexedCount++;

          if (indexedCount % 10 === 0) {
            this.emit('index:progress', { total: totalFiles, indexed: indexedCount });
          }
        }
      } catch (error) {
        logger.warn('Failed to index file', { filePath, error });
      }
    }

    // Index directories
    await this.indexDirectories(projectPath, directories, files);

    // Build dependency graph if enabled
    if (this.options.buildDependencyGraph) {
      await this.buildDependencyGraph(files, dependencyGraph, projectPath);
    }

    // Calculate statistics
    const statistics = this.calculateStatistics(files, directories, dependencyGraph);

    const index: ProjectIndex = {
      rootPath: projectPath,
      files,
      directories,
      dependencyGraph,
      indexedAt: new Date(),
      statistics,
      version: '1.0.0'
    };

    this.index = index;

    const duration = Date.now() - startTime;
    logger.info('Project indexing complete', { 
      projectPath, 
      files: files.size, 
      duration 
    });
    this.emit('index:complete', { index, duration });

    return index;
  }

  /**
   * Index a single file
   */
  async indexFile(filePath: string, rootPath: string): Promise<IndexedFileInfo | null> {
    try {
      const stats = await fs.stat(filePath);
      
      // Skip if too large
      if (stats.size > this.options.maxFileSize) {
        return null;
      }

      const relativePath = path.relative(rootPath, filePath);
      const extension = path.extname(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const language = this.detectLanguage(extension);

      let imports: ImportInfo[] = [];
      let exports: ExportInfo[] = [];
      let functions: FunctionInfo[] = [];
      let classes: ClassInfo[] = [];
      let variables: VariableInfo[] = [];

      // Parse symbols if enabled and file is parseable
      if (this.options.parseSymbols && this.isParseable(extension)) {
        const parsed = this.parseFileContent(content, language);
        imports = parsed.imports;
        exports = parsed.exports;
        functions = parsed.functions;
        classes = parsed.classes;
        variables = parsed.variables;
      }

      const hash = this.options.calculateHashes ? this.calculateHash(content) : '';

      return {
        path: filePath,
        relativePath,
        name: path.basename(filePath),
        extension,
        size: stats.size,
        language,
        imports,
        exports,
        functions,
        classes,
        variables,
        dependencies: [],
        dependents: [],
        lastModified: stats.mtime,
        lastIndexed: new Date(),
        hash,
        lineCount: content.split('\n').length
      };
    } catch (error) {
      logger.debug('Failed to index file', { filePath, error });
      return null;
    }
  }

  /**
   * Re-index a single file (after modification)
   */
  async reindexFile(filePath: string): Promise<IndexedFileInfo | null> {
    if (!this.index) {
      throw new Error('No index available. Run indexProject first.');
    }

    const fileInfo = await this.indexFile(filePath, this.index.rootPath);
    if (fileInfo) {
      const oldInfo = this.index.files.get(fileInfo.relativePath);
      
      // Update file in index
      this.index.files.set(fileInfo.relativePath, fileInfo);
      
      // Update dependency graph
      if (this.options.buildDependencyGraph) {
        this.updateDependencyGraph(fileInfo, oldInfo);
      }

      this.emit('file:reindexed', { fileInfo });
    }

    return fileInfo;
  }

  // ============================================
  // File Discovery
  // ============================================

  /**
   * Get all files in a directory recursively
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip ignored patterns
      if (this.shouldIgnore(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (this.options.extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Check if a path should be ignored
   */
  private shouldIgnore(name: string): boolean {
    return this.options.ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  /**
   * Index directory structure
   */
  private async indexDirectories(
    rootPath: string,
    directories: Map<string, DirectoryInfo>,
    files: Map<string, IndexedFileInfo>
  ): Promise<void> {
    const processDir = async (dirPath: string): Promise<void> => {
      const relativePath = path.relative(rootPath, dirPath);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      const children: string[] = [];
      let fileCount = 0;
      let totalSize = 0;

      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);
        const childRelative = path.relative(rootPath, fullPath);

        if (entry.isDirectory()) {
          children.push(childRelative);
          await processDir(fullPath);
          
          // Add child directory stats
          const childDir = directories.get(childRelative);
          if (childDir) {
            fileCount += childDir.fileCount;
            totalSize += childDir.totalSize;
          }
        } else if (entry.isFile()) {
          const fileInfo = files.get(childRelative);
          if (fileInfo) {
            fileCount++;
            totalSize += fileInfo.size;
            children.push(childRelative);
          }
        }
      }

      directories.set(relativePath || '.', {
        path: dirPath,
        relativePath: relativePath || '.',
        name: path.basename(dirPath),
        fileCount,
        totalSize,
        children
      });
    };

    await processDir(rootPath);
  }

  // ============================================
  // Code Parsing
  // ============================================

  /**
   * Check if file is parseable
   */
  private isParseable(extension: string): boolean {
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'].includes(extension);
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.mdx': 'mdx',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.html': 'html',
      '.py': 'python',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.kt': 'kotlin',
      '.swift': 'swift'
    };
    return languageMap[extension] || 'unknown';
  }

  /**
   * Parse file content for symbols (simplified regex-based parsing)
   */
  private parseFileContent(content: string, language: string): {
    imports: ImportInfo[];
    exports: ExportInfo[];
    functions: FunctionInfo[];
    classes: ClassInfo[];
    variables: VariableInfo[];
  } {
    const result = {
      imports: [] as ImportInfo[],
      exports: [] as ExportInfo[],
      functions: [] as FunctionInfo[],
      classes: [] as ClassInfo[],
      variables: [] as VariableInfo[]
    };

    if (language !== 'typescript' && language !== 'javascript') {
      return result;
    }

    const lines = content.split('\n');

    // Parse imports
    const importRegex = /^import\s+(?:(\*\s+as\s+\w+)|({[^}]+})|(\w+))(?:\s*,\s*({[^}]+}))?\s+from\s+['"]([^'"]+)['"]/;
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // ES6 imports
      const importMatch = trimmed.match(importRegex);
      if (importMatch) {
        const specifiers: ImportSpecifier[] = [];
        const source = importMatch[5];
        
        if (importMatch[1]) {
          // Namespace import: import * as name
          const name = importMatch[1].replace('* as ', '').trim();
          specifiers.push({ name, isDefault: false });
          result.imports.push({
            source,
            specifiers,
            line: index + 1,
            isDefault: false,
            isNamespace: true,
            isDynamic: false
          });
        } else if (importMatch[3]) {
          // Default import: import name
          specifiers.push({ name: importMatch[3], isDefault: true });
          
          // Also check for named imports: import name, { ... }
          if (importMatch[4]) {
            const namedImports = importMatch[4].replace(/[{}]/g, '').split(',');
            for (const imp of namedImports) {
              const parts = imp.trim().split(/\s+as\s+/);
              specifiers.push({
                name: parts[0].trim(),
                alias: parts[1]?.trim(),
                isDefault: false
              });
            }
          }
          
          result.imports.push({
            source,
            specifiers,
            line: index + 1,
            isDefault: true,
            isNamespace: false,
            isDynamic: false
          });
        } else if (importMatch[2]) {
          // Named imports only: import { name }
          const namedImports = importMatch[2].replace(/[{}]/g, '').split(',');
          for (const imp of namedImports) {
            const parts = imp.trim().split(/\s+as\s+/);
            if (parts[0].trim()) {
              specifiers.push({
                name: parts[0].trim(),
                alias: parts[1]?.trim(),
                isDefault: false
              });
            }
          }
          
          result.imports.push({
            source,
            specifiers,
            line: index + 1,
            isDefault: false,
            isNamespace: false,
            isDynamic: false
          });
        }
      }
    });

    // Dynamic imports
    let dynamicMatch;
    while ((dynamicMatch = dynamicImportRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, dynamicMatch.index).split('\n').length;
      result.imports.push({
        source: dynamicMatch[1],
        specifiers: [],
        line: lineNumber,
        isDefault: false,
        isNamespace: false,
        isDynamic: true
      });
    }

    // Parse exports
    const exportDefaultRegex = /^export\s+default\s+(?:class|function|const|let|var)?\s*(\w+)?/;
    const exportNamedRegex = /^export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/;
    const exportFromRegex = /^export\s+(?:{([^}]+)}|\*)\s+from\s+['"]([^'"]+)['"]/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Export default
      if (trimmed.startsWith('export default')) {
        const match = trimmed.match(exportDefaultRegex);
        result.exports.push({
          name: match?.[1] || 'default',
          line: index + 1,
          isDefault: true,
          isReExport: false
        });
      }
      // Export named
      else if (trimmed.match(/^export\s+(?:const|let|var|function|class|interface|type|enum)/)) {
        const match = trimmed.match(exportNamedRegex);
        if (match) {
          result.exports.push({
            name: match[1],
            line: index + 1,
            isDefault: false,
            isReExport: false
          });
        }
      }
      // Re-exports
      else if (trimmed.match(/^export\s+(?:{|\*)\s*.*\s*from/)) {
        const match = trimmed.match(exportFromRegex);
        if (match) {
          if (match[1]) {
            const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
            for (const name of names) {
              if (name) {
                result.exports.push({
                  name,
                  line: index + 1,
                  isDefault: false,
                  isReExport: true,
                  source: match[2]
                });
              }
            }
          } else {
            result.exports.push({
              name: '*',
              line: index + 1,
              isDefault: false,
              isReExport: true,
              source: match[2]
            });
          }
        }
      }
    });

    // Parse functions
    const functionRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/;
    const arrowFunctionRegex = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(?([^)]*)\)?\s*(?::\s*([^=]+))?\s*=>/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Regular function
      const funcMatch = trimmed.match(functionRegex);
      if (funcMatch) {
        result.functions.push({
          name: funcMatch[1],
          line: index + 1,
          column: line.indexOf(funcMatch[1]),
          parameters: this.parseParameters(funcMatch[2]),
          returnType: funcMatch[3]?.trim(),
          isAsync: trimmed.includes('async '),
          isExported: trimmed.startsWith('export'),
          isArrow: false
        });
      }

      // Arrow function
      const arrowMatch = trimmed.match(arrowFunctionRegex);
      if (arrowMatch) {
        result.functions.push({
          name: arrowMatch[1],
          line: index + 1,
          column: line.indexOf(arrowMatch[1]),
          parameters: this.parseParameters(arrowMatch[2]),
          returnType: arrowMatch[3]?.trim(),
          isAsync: trimmed.includes('async '),
          isExported: trimmed.startsWith('export'),
          isArrow: true
        });
      }
    });

    // Parse classes
    const classRegex = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const classMatch = trimmed.match(classRegex);
      
      if (classMatch) {
        result.classes.push({
          name: classMatch[1],
          line: index + 1,
          column: line.indexOf(classMatch[1]),
          methods: [],
          properties: [],
          extends: classMatch[2],
          implements: classMatch[3]?.split(',').map(s => s.trim()),
          isExported: trimmed.startsWith('export'),
          isAbstract: trimmed.includes('abstract ')
        });
      }
    });

    // Parse top-level variables
    const varRegex = /^(?:export\s+)?(const|let|var)\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip function declarations (already captured)
      if (trimmed.includes('=>') || trimmed.includes('function')) {
        return;
      }

      const varMatch = trimmed.match(varRegex);
      if (varMatch) {
        result.variables.push({
          name: varMatch[2],
          line: index + 1,
          column: line.indexOf(varMatch[2]),
          type: varMatch[3]?.trim(),
          kind: varMatch[1] as 'const' | 'let' | 'var',
          isExported: trimmed.startsWith('export')
        });
      }
    });

    return result;
  }

  /**
   * Parse function parameters
   */
  private parseParameters(paramString: string): ParameterInfo[] {
    if (!paramString.trim()) return [];

    const params: ParameterInfo[] = [];
    // Simple parsing - doesn't handle complex destructuring or nested types
    const paramParts = paramString.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const optional = trimmed.includes('?');
      const hasDefault = trimmed.includes('=');
      
      // Extract name and type
      const match = trimmed.match(/^(\w+)(\?)?(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?$/);
      if (match) {
        params.push({
          name: match[1],
          type: match[3]?.trim(),
          optional: optional || hasDefault,
          defaultValue: match[4]?.trim()
        });
      }
    }

    return params;
  }

  /**
   * Calculate simple hash of content
   */
  private calculateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  // ============================================
  // Dependency Graph Building
  // ============================================

  /**
   * Build dependency graph from indexed files
   */
  private async buildDependencyGraph(
    files: Map<string, IndexedFileInfo>,
    graph: DependencyGraph,
    rootPath: string
  ): Promise<void> {
    for (const [relativePath, fileInfo] of files) {
      graph.addNode(relativePath);

      for (const importInfo of fileInfo.imports) {
        const resolvedPath = await this.resolveImport(
          importInfo.source,
          fileInfo.path,
          rootPath
        );

        if (resolvedPath) {
          const relResolved = path.relative(rootPath, resolvedPath);
          if (files.has(relResolved)) {
            graph.addEdge(relativePath, relResolved);
            fileInfo.dependencies.push(relResolved);
            
            const depFile = files.get(relResolved);
            if (depFile) {
              depFile.dependents.push(relativePath);
            }
          }
        }
      }
    }
  }

  /**
   * Resolve import path to actual file
   */
  private async resolveImport(
    importPath: string,
    fromFile: string,
    rootPath: string
  ): Promise<string | null> {
    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const fromDir = path.dirname(fromFile);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

    for (const ext of extensions) {
      const fullPath = path.resolve(fromDir, importPath + ext);
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        // Try next extension
      }
    }

    return null;
  }

  /**
   * Update dependency graph for a single file
   */
  private updateDependencyGraph(
    newInfo: IndexedFileInfo,
    oldInfo?: IndexedFileInfo
  ): void {
    if (!this.index) return;

    const graph = this.index.dependencyGraph;
    const relativePath = newInfo.relativePath;

    // Remove old edges
    if (oldInfo) {
      for (const dep of oldInfo.dependencies) {
        const depFile = this.index.files.get(dep);
        if (depFile) {
          depFile.dependents = depFile.dependents.filter(d => d !== relativePath);
        }
      }
    }

    // Clear and rebuild edges for this file
    graph.removeNode(relativePath);
    graph.addNode(relativePath);

    // Add new edges
    newInfo.dependencies = [];
    for (const importInfo of newInfo.imports) {
      // Find the imported file in our index
      for (const [depPath, depFile] of this.index.files) {
        if (depPath === relativePath) continue;
        
        // Simple matching - could be improved
        if (importInfo.source.includes(depFile.name.replace(/\.[^.]+$/, ''))) {
          graph.addEdge(relativePath, depPath);
          newInfo.dependencies.push(depPath);
          depFile.dependents.push(relativePath);
          break;
        }
      }
    }
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Calculate project statistics
   */
  private calculateStatistics(
    files: Map<string, IndexedFileInfo>,
    directories: Map<string, DirectoryInfo>,
    graph: DependencyGraph
  ): ProjectStatistics {
    const languageBreakdown: Record<string, number> = {};
    const fileTypeBreakdown: Record<string, number> = {};
    const fileSizes: Array<{ path: string; size: number }> = [];
    const importCounts: Map<string, number> = new Map();

    let totalSize = 0;
    let totalLines = 0;

    for (const [relativePath, fileInfo] of files) {
      // Size and lines
      totalSize += fileInfo.size;
      totalLines += fileInfo.lineCount;
      fileSizes.push({ path: relativePath, size: fileInfo.size });

      // Language breakdown
      languageBreakdown[fileInfo.language] = (languageBreakdown[fileInfo.language] || 0) + 1;

      // File type breakdown
      fileTypeBreakdown[fileInfo.extension] = (fileTypeBreakdown[fileInfo.extension] || 0) + 1;

      // Import counts
      for (const dep of fileInfo.dependents) {
        importCounts.set(relativePath, (importCounts.get(relativePath) || 0) + 1);
      }
    }

    // Sort and get top files
    fileSizes.sort((a, b) => b.size - a.size);
    const largestFiles = fileSizes.slice(0, 10);

    const importCountsArray = Array.from(importCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count);
    const mostImported = importCountsArray.slice(0, 10);

    // Detect circular dependencies
    const circularDependencies = graph.detectCircularDependencies();

    return {
      totalFiles: files.size,
      totalDirectories: directories.size,
      totalSize,
      totalLines,
      languageBreakdown,
      fileTypeBreakdown,
      largestFiles,
      mostImported,
      circularDependencies
    };
  }

  // ============================================
  // Search Methods
  // ============================================

  /**
   * Search for files by query
   */
  searchFiles(query: string): SearchResult[] {
    if (!this.index) {
      throw new Error('No index available. Run indexProject first.');
    }

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const [, fileInfo] of this.index.files) {
      const matches: SearchMatch[] = [];
      let score = 0;

      // Match file name
      if (fileInfo.name.toLowerCase().includes(queryLower)) {
        score += 10;
        matches.push({
          type: 'content',
          name: fileInfo.name,
          line: 1,
          context: `File: ${fileInfo.name}`
        });
      }

      // Match functions
      for (const func of fileInfo.functions) {
        if (func.name.toLowerCase().includes(queryLower)) {
          score += 5;
          matches.push({
            type: 'function',
            name: func.name,
            line: func.line,
            context: `function ${func.name}(${func.parameters.map(p => p.name).join(', ')})`
          });
        }
      }

      // Match classes
      for (const cls of fileInfo.classes) {
        if (cls.name.toLowerCase().includes(queryLower)) {
          score += 5;
          matches.push({
            type: 'class',
            name: cls.name,
            line: cls.line,
            context: `class ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ''}`
          });
        }
      }

      // Match variables
      for (const variable of fileInfo.variables) {
        if (variable.name.toLowerCase().includes(queryLower)) {
          score += 3;
          matches.push({
            type: 'variable',
            name: variable.name,
            line: variable.line,
            context: `${variable.kind} ${variable.name}${variable.type ? `: ${variable.type}` : ''}`
          });
        }
      }

      // Match exports
      for (const exp of fileInfo.exports) {
        if (exp.name.toLowerCase().includes(queryLower)) {
          score += 4;
          matches.push({
            type: 'export',
            name: exp.name,
            line: exp.line,
            context: `export ${exp.isDefault ? 'default ' : ''}${exp.name}`
          });
        }
      }

      if (matches.length > 0) {
        results.push({ file: fileInfo, matches, score });
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Find all usages of a symbol
   */
  findUsages(symbolName: string): SearchResult[] {
    if (!this.index) {
      throw new Error('No index available. Run indexProject first.');
    }

    const results: SearchResult[] = [];

    for (const [, fileInfo] of this.index.files) {
      const matches: SearchMatch[] = [];

      // Check if it's defined here
      const definedFunc = fileInfo.functions.find(f => f.name === symbolName);
      const definedClass = fileInfo.classes.find(c => c.name === symbolName);
      const definedVar = fileInfo.variables.find(v => v.name === symbolName);

      if (definedFunc) {
        matches.push({
          type: 'function',
          name: symbolName,
          line: definedFunc.line,
          context: `[definition] function ${symbolName}`
        });
      }

      if (definedClass) {
        matches.push({
          type: 'class',
          name: symbolName,
          line: definedClass.line,
          context: `[definition] class ${symbolName}`
        });
      }

      if (definedVar) {
        matches.push({
          type: 'variable',
          name: symbolName,
          line: definedVar.line,
          context: `[definition] ${definedVar.kind} ${symbolName}`
        });
      }

      // Check imports
      for (const imp of fileInfo.imports) {
        const specifier = imp.specifiers.find(s => s.name === symbolName || s.alias === symbolName);
        if (specifier) {
          matches.push({
            type: 'import',
            name: symbolName,
            line: imp.line,
            context: `import { ${symbolName} } from '${imp.source}'`
          });
        }
      }

      if (matches.length > 0) {
        results.push({ file: fileInfo, matches, score: matches.length });
      }
    }

    return results;
  }

  // ============================================
  // Getters
  // ============================================

  /**
   * Get current index
   */
  getIndex(): ProjectIndex | null {
    return this.index;
  }

  /**
   * Get file info by relative path
   */
  getFileInfo(relativePath: string): IndexedFileInfo | undefined {
    return this.index?.files.get(relativePath);
  }

  /**
   * Get all files matching a pattern
   */
  getFilesByPattern(pattern: RegExp): IndexedFileInfo[] {
    if (!this.index) return [];

    const results: IndexedFileInfo[] = [];
    for (const [relativePath, fileInfo] of this.index.files) {
      if (pattern.test(relativePath)) {
        results.push(fileInfo);
      }
    }
    return results;
  }

  /**
   * Get files by language
   */
  getFilesByLanguage(language: string): IndexedFileInfo[] {
    if (!this.index) return [];

    const results: IndexedFileInfo[] = [];
    for (const [, fileInfo] of this.index.files) {
      if (fileInfo.language === language) {
        results.push(fileInfo);
      }
    }
    return results;
  }
}

// ============================================
// Singleton Export
// ============================================

export const fileIndexer = new FileIndexer();

export default FileIndexer;

/**
 * The Joker - Agentic Terminal
 * Multi-File Operations
 * 
 * Handles batch file operations, cross-file refactoring,
 * import management, and consistency checks across codebases.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { FileOperations, fileOps } from './operations';
import type { ProjectIndex, IndexedFileInfo, ImportInfo, ExportInfo } from '../coding/indexer';

// ============================================
// Types
// ============================================

/**
 * File creation request
 */
export interface FileCreationRequest {
  /** Relative or absolute file path */
  path: string;
  /** File content */
  content: string;
  /** Whether to overwrite if exists */
  overwrite?: boolean;
  /** File encoding */
  encoding?: BufferEncoding;
}

/**
 * Batch creation result
 */
export interface BatchCreationResult {
  success: boolean;
  created: string[];
  failed: Array<{ path: string; error: string }>;
  skipped: string[];
  totalTime: number;
}

/**
 * Refactoring operation
 */
export interface RefactorOperation {
  type: 'rename' | 'move' | 'extract' | 'inline' | 'change-signature';
  targetPath: string;
  symbolName?: string;
  newName?: string;
  newPath?: string;
  options?: Record<string, unknown>;
}

/**
 * Refactoring result
 */
export interface RefactorResult {
  success: boolean;
  operation: RefactorOperation;
  affectedFiles: string[];
  changes: FileChange[];
  errors: string[];
}

/**
 * File change
 */
export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete' | 'rename';
  oldContent?: string;
  newContent?: string;
  diff?: string;
}

/**
 * Import update request
 */
export interface ImportUpdateRequest {
  filePath: string;
  action: 'add' | 'remove' | 'update' | 'organize';
  importSource?: string;
  importNames?: string[];
  isDefault?: boolean;
  alias?: string;
}

/**
 * Import analysis result
 */
export interface ImportAnalysis {
  filePath: string;
  imports: ImportInfo[];
  unusedImports: string[];
  missingImports: string[];
  duplicateImports: string[];
  circularImports: string[];
}

/**
 * Consistency check result
 */
export interface ConsistencyCheckResult {
  isConsistent: boolean;
  issues: ConsistencyIssue[];
  suggestions: string[];
}

/**
 * Consistency issue
 */
export interface ConsistencyIssue {
  type: 'missing-export' | 'broken-import' | 'unused-export' | 'naming-mismatch' | 'circular-dependency';
  severity: 'error' | 'warning' | 'info';
  filePath: string;
  line?: number;
  message: string;
  suggestion?: string;
}

/**
 * Multi-file operation options
 */
export interface MultiFileOptions {
  /** Base directory for operations */
  basePath?: string;
  /** Dry run mode (don't actually make changes) */
  dryRun?: boolean;
  /** Create backups before changes */
  backup?: boolean;
  /** Backup directory */
  backupDir?: string;
  /** Patterns to ignore */
  ignorePatterns?: string[];
  /** File encoding */
  encoding?: BufferEncoding;
}

/**
 * Rename operation options
 */
export interface RenameOptions {
  /** Update all references */
  updateReferences?: boolean;
  /** Update imports */
  updateImports?: boolean;
  /** Preserve case patterns */
  preserveCase?: boolean;
}

/**
 * Move operation options
 */
export interface MoveOptions {
  /** Update imports in moved file */
  updateMovedFileImports?: boolean;
  /** Update imports in other files */
  updateExternalImports?: boolean;
  /** Create directory if needed */
  createDirectory?: boolean;
}

// ============================================
// Multi-File Operator Class
// ============================================

/**
 * Multi-file operations for batch processing and cross-file refactoring
 */
export class MultiFileOperator extends EventEmitter {
  private options: Required<MultiFileOptions>;
  private fileOps: FileOperations;
  private changeLog: FileChange[] = [];

  constructor(options: MultiFileOptions = {}) {
    super();
    this.options = {
      basePath: options.basePath ?? process.cwd(),
      dryRun: options.dryRun ?? false,
      backup: options.backup ?? true,
      backupDir: options.backupDir ?? '.backups',
      ignorePatterns: options.ignorePatterns ?? ['node_modules', '.git', 'dist', 'build'],
      encoding: options.encoding ?? 'utf-8'
    };
    this.fileOps = fileOps;
  }

  // ============================================
  // Batch File Creation
  // ============================================

  /**
   * Create multiple files in batch
   */
  async createBatch(files: FileCreationRequest[]): Promise<BatchCreationResult> {
    const startTime = Date.now();
    const result: BatchCreationResult = {
      success: true,
      created: [],
      failed: [],
      skipped: [],
      totalTime: 0
    };

    this.emit('batchStart', { count: files.length });

    for (const file of files) {
      try {
        const fullPath = this.resolvePath(file.path);
        
        // Check if file exists
        const exists = await this.fileOps.exists(fullPath);
        
        if (exists && !file.overwrite) {
          result.skipped.push(fullPath);
          this.emit('fileSkipped', { path: fullPath, reason: 'exists' });
          continue;
        }

        // Create backup if file exists and backup is enabled
        if (exists && this.options.backup && !this.options.dryRun) {
          await this.createBackup(fullPath);
        }

        // Create file
        if (!this.options.dryRun) {
          await this.fileOps.writeFile(fullPath, file.content, {
            encoding: file.encoding ?? this.options.encoding
          });
        }

        result.created.push(fullPath);
        this.logChange({
          path: fullPath,
          type: exists ? 'modify' : 'create',
          newContent: file.content
        });

        this.emit('fileCreated', { path: fullPath });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed.push({ path: file.path, error: errorMessage });
        result.success = false;
        this.emit('fileError', { path: file.path, error: errorMessage });
      }
    }

    result.totalTime = Date.now() - startTime;
    this.emit('batchComplete', result);

    logger.info('Batch creation complete', {
      created: result.created.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
      time: result.totalTime
    });

    return result;
  }

  /**
   * Create files from a template structure
   */
  async createFromTemplate(
    template: Record<string, string>,
    targetDir: string,
    variables?: Record<string, string>
  ): Promise<BatchCreationResult> {
    const files: FileCreationRequest[] = [];

    for (const [relativePath, content] of Object.entries(template)) {
      let processedContent = content;

      // Replace template variables
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          processedContent = processedContent.replace(pattern, value);
        }
      }

      files.push({
        path: path.join(targetDir, relativePath),
        content: processedContent,
        overwrite: false
      });
    }

    return this.createBatch(files);
  }

  // ============================================
  // Cross-File Refactoring
  // ============================================

  /**
   * Rename a symbol across all files
   */
  async renameSymbol(
    symbolName: string,
    newName: string,
    projectIndex: ProjectIndex,
    options: RenameOptions = {}
  ): Promise<RefactorResult> {
    const result: RefactorResult = {
      success: true,
      operation: { type: 'rename', targetPath: '', symbolName, newName },
      affectedFiles: [],
      changes: [],
      errors: []
    };

    const opts: Required<RenameOptions> = {
      updateReferences: options.updateReferences ?? true,
      updateImports: options.updateImports ?? true,
      preserveCase: options.preserveCase ?? false
    };

    this.emit('refactorStart', { type: 'rename', symbolName, newName });

    try {
      // Find all files containing the symbol
      const affectedFiles = this.findSymbolUsages(symbolName, projectIndex);

      for (const filePath of affectedFiles) {
        try {
          const content = await this.fileOps.readFile(filePath);
          let newContent = content;

          // Replace symbol occurrences
          if (opts.preserveCase) {
            newContent = this.replaceWithCasePreservation(content, symbolName, newName);
          } else {
            // Word-boundary aware replacement
            const regex = new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`, 'g');
            newContent = content.replace(regex, newName);
          }

          if (newContent !== content) {
            if (!this.options.dryRun) {
              if (this.options.backup) {
                await this.createBackup(filePath);
              }
              await this.fileOps.writeFile(filePath, newContent);
            }

            result.affectedFiles.push(filePath);
            result.changes.push({
              path: filePath,
              type: 'modify',
              oldContent: content,
              newContent: newContent
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error processing ${filePath}: ${errorMessage}`);
        }
      }
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
    }

    this.emit('refactorComplete', result);
    return result;
  }

  /**
   * Move a file and update all imports
   */
  async moveFile(
    sourcePath: string,
    destPath: string,
    projectIndex: ProjectIndex,
    options: MoveOptions = {}
  ): Promise<RefactorResult> {
    const result: RefactorResult = {
      success: true,
      operation: { type: 'move', targetPath: sourcePath, newPath: destPath },
      affectedFiles: [],
      changes: [],
      errors: []
    };

    const opts: Required<MoveOptions> = {
      updateMovedFileImports: options.updateMovedFileImports ?? true,
      updateExternalImports: options.updateExternalImports ?? true,
      createDirectory: options.createDirectory ?? true
    };

    const fullSourcePath = this.resolvePath(sourcePath);
    const fullDestPath = this.resolvePath(destPath);

    this.emit('refactorStart', { type: 'move', sourcePath, destPath });

    try {
      // Check if source exists
      const sourceExists = await this.fileOps.exists(fullSourcePath);
      if (!sourceExists) {
        throw new Error(`Source file does not exist: ${fullSourcePath}`);
      }

      // Create destination directory if needed
      if (opts.createDirectory && !this.options.dryRun) {
        await this.fileOps.ensureDir(path.dirname(fullDestPath));
      }

      // Read source file content
      let sourceContent = await this.fileOps.readFile(fullSourcePath);

      // Update imports in the moved file
      if (opts.updateMovedFileImports) {
        sourceContent = this.updateImportsForMove(
          sourceContent,
          fullSourcePath,
          fullDestPath,
          projectIndex
        );
      }

      // Move the file
      if (!this.options.dryRun) {
        if (this.options.backup) {
          await this.createBackup(fullSourcePath);
        }
        await this.fileOps.writeFile(fullDestPath, sourceContent);
        await this.fileOps.remove(fullSourcePath);
      }

      result.affectedFiles.push(fullSourcePath, fullDestPath);
      result.changes.push({
        path: fullSourcePath,
        type: 'delete'
      });
      result.changes.push({
        path: fullDestPath,
        type: 'create',
        newContent: sourceContent
      });

      // Update imports in other files
      if (opts.updateExternalImports) {
        const importUpdates = await this.updateExternalImports(
          fullSourcePath,
          fullDestPath,
          projectIndex
        );
        result.affectedFiles.push(...importUpdates.affectedFiles);
        result.changes.push(...importUpdates.changes);
      }

    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
    }

    this.emit('refactorComplete', result);
    return result;
  }

  /**
   * Extract code to a new file
   */
  async extractToFile(
    sourceFile: string,
    code: string,
    newFilePath: string,
    exportName: string
  ): Promise<RefactorResult> {
    const result: RefactorResult = {
      success: true,
      operation: { type: 'extract', targetPath: sourceFile, newPath: newFilePath },
      affectedFiles: [],
      changes: [],
      errors: []
    };

    const fullSourcePath = this.resolvePath(sourceFile);
    const fullNewPath = this.resolvePath(newFilePath);

    try {
      // Create the new file with the extracted code
      const extractedContent = this.wrapExtractedCode(code, exportName, newFilePath);

      if (!this.options.dryRun) {
        await this.fileOps.writeFile(fullNewPath, extractedContent);
      }

      result.changes.push({
        path: fullNewPath,
        type: 'create',
        newContent: extractedContent
      });

      // Update the source file to import from new file
      const sourceContent = await this.fileOps.readFile(fullSourcePath);
      const relativePath = this.getRelativeImportPath(fullSourcePath, fullNewPath);
      const importStatement = `import { ${exportName} } from '${relativePath}';\n`;
      
      // Remove the extracted code and add import
      let newSourceContent = sourceContent.replace(code, exportName);
      
      // Add import at the top (after existing imports)
      const importInsertIndex = this.findImportInsertPosition(newSourceContent);
      newSourceContent = 
        newSourceContent.slice(0, importInsertIndex) +
        importStatement +
        newSourceContent.slice(importInsertIndex);

      if (!this.options.dryRun) {
        if (this.options.backup) {
          await this.createBackup(fullSourcePath);
        }
        await this.fileOps.writeFile(fullSourcePath, newSourceContent);
      }

      result.changes.push({
        path: fullSourcePath,
        type: 'modify',
        oldContent: sourceContent,
        newContent: newSourceContent
      });

      result.affectedFiles.push(fullSourcePath, fullNewPath);
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
    }

    return result;
  }

  // ============================================
  // Import Management
  // ============================================

  /**
   * Add an import to a file
   */
  async addImport(
    filePath: string,
    importSource: string,
    importNames: string[],
    options: { isDefault?: boolean; alias?: string } = {}
  ): Promise<FileChange | null> {
    const fullPath = this.resolvePath(filePath);
    
    try {
      const content = await this.fileOps.readFile(fullPath);
      let importStatement: string;

      if (options.isDefault) {
        const name = options.alias ?? importNames[0];
        importStatement = `import ${name} from '${importSource}';\n`;
      } else if (importNames.length === 1 && options.alias) {
        importStatement = `import { ${importNames[0]} as ${options.alias} } from '${importSource}';\n`;
      } else {
        importStatement = `import { ${importNames.join(', ')} } from '${importSource}';\n`;
      }

      // Check if import already exists
      if (content.includes(importSource)) {
        // Try to merge with existing import
        const merged = this.mergeImport(content, importSource, importNames, options.isDefault);
        if (merged !== content) {
          if (!this.options.dryRun) {
            if (this.options.backup) {
              await this.createBackup(fullPath);
            }
            await this.fileOps.writeFile(fullPath, merged);
          }
          return {
            path: fullPath,
            type: 'modify',
            oldContent: content,
            newContent: merged
          };
        }
        return null; // Already imported
      }

      // Add import at appropriate position
      const insertIndex = this.findImportInsertPosition(content);
      const newContent = 
        content.slice(0, insertIndex) +
        importStatement +
        content.slice(insertIndex);

      if (!this.options.dryRun) {
        if (this.options.backup) {
          await this.createBackup(fullPath);
        }
        await this.fileOps.writeFile(fullPath, newContent);
      }

      return {
        path: fullPath,
        type: 'modify',
        oldContent: content,
        newContent: newContent
      };
    } catch (error) {
      logger.error('Failed to add import', { filePath, error });
      return null;
    }
  }

  /**
   * Remove an import from a file
   */
  async removeImport(
    filePath: string,
    importSource: string,
    importNames?: string[]
  ): Promise<FileChange | null> {
    const fullPath = this.resolvePath(filePath);

    try {
      const content = await this.fileOps.readFile(fullPath);
      let newContent: string;

      if (importNames && importNames.length > 0) {
        // Remove specific imports
        newContent = this.removeSpecificImports(content, importSource, importNames);
      } else {
        // Remove entire import statement
        const importRegex = new RegExp(
          `^import\\s+(?:[\\w\\s{},*]+\\s+from\\s+)?['"]${this.escapeRegex(importSource)}['"];?\\s*$`,
          'gm'
        );
        newContent = content.replace(importRegex, '').replace(/\n\n\n+/g, '\n\n');
      }

      if (newContent !== content) {
        if (!this.options.dryRun) {
          if (this.options.backup) {
            await this.createBackup(fullPath);
          }
          await this.fileOps.writeFile(fullPath, newContent);
        }

        return {
          path: fullPath,
          type: 'modify',
          oldContent: content,
          newContent: newContent
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to remove import', { filePath, error });
      return null;
    }
  }

  /**
   * Organize imports in a file (sort, group, remove unused)
   */
  async organizeImports(filePath: string): Promise<FileChange | null> {
    const fullPath = this.resolvePath(filePath);

    try {
      const content = await this.fileOps.readFile(fullPath);
      
      // Extract all imports
      const importMatches = content.match(/^import\s+.+from\s+['"].+['"];?\s*$/gm) || [];
      
      if (importMatches.length === 0) {
        return null;
      }

      // Categorize imports
      const nodeImports: string[] = [];
      const externalImports: string[] = [];
      const internalImports: string[] = [];
      const typeImports: string[] = [];

      for (const imp of importMatches) {
        if (imp.includes('type ') || imp.includes('type{')) {
          typeImports.push(imp);
        } else if (this.isNodeBuiltin(imp)) {
          nodeImports.push(imp);
        } else if (imp.includes("'./") || imp.includes("'../") || imp.includes('"./' ) || imp.includes('"../')) {
          internalImports.push(imp);
        } else {
          externalImports.push(imp);
        }
      }

      // Sort each category
      nodeImports.sort();
      externalImports.sort();
      internalImports.sort();
      typeImports.sort();

      // Build organized import block
      const organizedImports: string[] = [];
      
      if (nodeImports.length > 0) {
        organizedImports.push(...nodeImports, '');
      }
      if (externalImports.length > 0) {
        organizedImports.push(...externalImports, '');
      }
      if (internalImports.length > 0) {
        organizedImports.push(...internalImports, '');
      }
      if (typeImports.length > 0) {
        organizedImports.push(...typeImports, '');
      }

      // Remove trailing empty string if present
      while (organizedImports.length > 0 && organizedImports[organizedImports.length - 1] === '') {
        organizedImports.pop();
      }

      // Find import block boundaries
      const firstImport = importMatches[0]!;
      const lastImport = importMatches[importMatches.length - 1]!;
      const firstImportIndex = content.indexOf(firstImport);
      const lastImportIndex = content.lastIndexOf(lastImport) + lastImport.length;

      // Replace import block
      const beforeImports = content.slice(0, firstImportIndex);
      const afterImports = content.slice(lastImportIndex);
      const newContent = beforeImports + organizedImports.join('\n') + afterImports;

      if (newContent !== content) {
        if (!this.options.dryRun) {
          if (this.options.backup) {
            await this.createBackup(fullPath);
          }
          await this.fileOps.writeFile(fullPath, newContent);
        }

        return {
          path: fullPath,
          type: 'modify',
          oldContent: content,
          newContent: newContent
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to organize imports', { filePath, error });
      return null;
    }
  }

  /**
   * Analyze imports in a file
   */
  async analyzeImports(
    filePath: string,
    projectIndex?: ProjectIndex
  ): Promise<ImportAnalysis> {
    const fullPath = this.resolvePath(filePath);
    const content = await this.fileOps.readFile(fullPath);
    
    const imports = this.parseImports(content);
    const unusedImports: string[] = [];
    const missingImports: string[] = [];
    const duplicateImports: string[] = [];
    const circularImports: string[] = [];

    // Check for duplicate imports
    const seenSources = new Map<string, string[]>();
    for (const imp of imports) {
      const existing = seenSources.get(imp.source);
      if (existing) {
        duplicateImports.push(imp.source);
      } else {
        seenSources.set(imp.source, imp.specifiers.map(s => s.name));
      }
    }

    // Check for unused imports (simple heuristic)
    for (const imp of imports) {
      for (const spec of imp.specifiers) {
        const regex = new RegExp(`\\b${spec.alias || spec.name}\\b`, 'g');
        const matches = content.match(regex) || [];
        // If only 1 match (the import itself), it's unused
        if (matches.length <= 1) {
          unusedImports.push(`${spec.name} from '${imp.source}'`);
        }
      }
    }

    // Check for circular imports if project index is provided
    if (projectIndex) {
      const fileInfo = projectIndex.files.get(fullPath);
      if (fileInfo) {
        for (const dep of fileInfo.dependencies) {
          const depInfo = projectIndex.files.get(dep);
          if (depInfo && depInfo.dependencies.includes(fullPath)) {
            circularImports.push(dep);
          }
        }
      }
    }

    return {
      filePath: fullPath,
      imports,
      unusedImports,
      missingImports,
      duplicateImports,
      circularImports
    };
  }

  // ============================================
  // Consistency Checks
  // ============================================

  /**
   * Check consistency across project files
   */
  async checkConsistency(projectIndex: ProjectIndex): Promise<ConsistencyCheckResult> {
    const issues: ConsistencyIssue[] = [];
    const suggestions: string[] = [];

    this.emit('consistencyCheckStart');

    // Check for broken imports
    for (const [filePath, fileInfo] of projectIndex.files) {
      for (const imp of fileInfo.imports) {
        // Skip external packages
        if (!imp.source.startsWith('.')) continue;

        const resolvedPath = this.resolveImportPath(filePath, imp.source);
        const exists = projectIndex.files.has(resolvedPath) || 
                       projectIndex.files.has(resolvedPath + '.ts') ||
                       projectIndex.files.has(resolvedPath + '.tsx') ||
                       projectIndex.files.has(resolvedPath + '/index.ts');

        if (!exists) {
          issues.push({
            type: 'broken-import',
            severity: 'error',
            filePath,
            line: imp.line,
            message: `Import '${imp.source}' could not be resolved`,
            suggestion: `Check if the file exists or fix the import path`
          });
        }
      }
    }

    // Check for unused exports
    const exportUsage = new Map<string, Set<string>>();
    for (const [filePath, fileInfo] of projectIndex.files) {
      for (const exp of fileInfo.exports) {
        const key = `${filePath}:${exp.name}`;
        if (!exportUsage.has(key)) {
          exportUsage.set(key, new Set());
        }
      }

      // Track import usage
      for (const imp of fileInfo.imports) {
        const resolvedPath = this.resolveImportPath(filePath, imp.source);
        for (const spec of imp.specifiers) {
          const key = `${resolvedPath}:${spec.name}`;
          const usage = exportUsage.get(key);
          if (usage) {
            usage.add(filePath);
          }
        }
      }
    }

    for (const [key, usages] of exportUsage) {
      if (usages.size === 0) {
        const [filePath, exportName] = key.split(':');
        // Skip index files and entry points
        if (!filePath.endsWith('index.ts') && exportName !== 'default') {
          issues.push({
            type: 'unused-export',
            severity: 'warning',
            filePath,
            message: `Export '${exportName}' is not imported anywhere`,
            suggestion: `Consider removing the export or adding it to the public API`
          });
        }
      }
    }

    // Check for circular dependencies
    const circular = projectIndex.dependencyGraph.detectCircularDependencies();
    for (const cycle of circular) {
      issues.push({
        type: 'circular-dependency',
        severity: 'warning',
        filePath: cycle[0],
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
        suggestion: `Refactor to break the circular dependency`
      });
    }

    // Generate suggestions
    if (issues.filter(i => i.type === 'broken-import').length > 0) {
      suggestions.push('Run import validation to fix broken import paths');
    }
    if (issues.filter(i => i.type === 'unused-export').length > 3) {
      suggestions.push('Consider consolidating unused exports or marking them as internal');
    }
    if (issues.filter(i => i.type === 'circular-dependency').length > 0) {
      suggestions.push('Refactor circular dependencies to improve code maintainability');
    }

    const result: ConsistencyCheckResult = {
      isConsistent: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      suggestions
    };

    this.emit('consistencyCheckComplete', result);
    return result;
  }

  /**
   * Fix common consistency issues automatically
   */
  async autoFixConsistency(
    projectIndex: ProjectIndex,
    options: { fixBrokenImports?: boolean; removeUnused?: boolean } = {}
  ): Promise<RefactorResult> {
    const result: RefactorResult = {
      success: true,
      operation: { type: 'inline', targetPath: '' },
      affectedFiles: [],
      changes: [],
      errors: []
    };

    const checkResult = await this.checkConsistency(projectIndex);

    if (options.removeUnused) {
      for (const issue of checkResult.issues) {
        if (issue.type === 'unused-export') {
          // Would need more sophisticated handling
          // For now, just log
          logger.info('Would remove unused export', {
            file: issue.filePath,
            message: issue.message
          });
        }
      }
    }

    return result;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Resolve path relative to base
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.options.basePath, filePath);
  }

  /**
   * Create a backup of a file
   */
  private async createBackup(filePath: string): Promise<string> {
    const backupDir = path.join(this.options.basePath, this.options.backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const relativePath = path.relative(this.options.basePath, filePath);
    const backupPath = path.join(backupDir, `${relativePath}.${timestamp}.bak`);

    await this.fileOps.copy(filePath, backupPath);
    logger.debug('Backup created', { original: filePath, backup: backupPath });
    return backupPath;
  }

  /**
   * Log a file change
   */
  private logChange(change: FileChange): void {
    this.changeLog.push(change);
    this.emit('fileChanged', change);
  }

  /**
   * Find all usages of a symbol in the project
   */
  private findSymbolUsages(symbolName: string, projectIndex: ProjectIndex): string[] {
    const files: string[] = [];

    for (const [filePath, fileInfo] of projectIndex.files) {
      // Check functions
      if (fileInfo.functions.some(f => f.name === symbolName)) {
        files.push(filePath);
        continue;
      }

      // Check classes
      if (fileInfo.classes.some(c => c.name === symbolName)) {
        files.push(filePath);
        continue;
      }

      // Check variables
      if (fileInfo.variables.some(v => v.name === symbolName)) {
        files.push(filePath);
        continue;
      }

      // Check exports
      if (fileInfo.exports.some(e => e.name === symbolName)) {
        files.push(filePath);
        continue;
      }

      // Check imports
      if (fileInfo.imports.some(i => 
        i.specifiers.some(s => s.name === symbolName || s.alias === symbolName)
      )) {
        files.push(filePath);
      }
    }

    return files;
  }

  /**
   * Replace with case preservation
   */
  private replaceWithCasePreservation(
    content: string,
    oldName: string,
    newName: string
  ): string {
    const regex = new RegExp(`\\b${this.escapeRegex(oldName)}\\b`, 'gi');
    return content.replace(regex, (match) => {
      if (match === match.toUpperCase()) {
        return newName.toUpperCase();
      }
      if (match === match.toLowerCase()) {
        return newName.toLowerCase();
      }
      if (match[0] === match[0].toUpperCase()) {
        return newName[0].toUpperCase() + newName.slice(1);
      }
      return newName;
    });
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Update imports in a file being moved
   */
  private updateImportsForMove(
    content: string,
    oldPath: string,
    newPath: string,
    projectIndex: ProjectIndex
  ): string {
    const importRegex = /import\s+(?:(.+?)\s+from\s+)?['"](.+?)['"]/g;
    let result = content;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[2];
      
      // Only update relative imports
      if (!importPath.startsWith('.')) continue;

      const oldResolved = this.resolveImportPath(oldPath, importPath);
      const newRelative = this.getRelativeImportPath(newPath, oldResolved);

      if (newRelative !== importPath) {
        result = result.replace(
          `'${importPath}'`,
          `'${newRelative}'`
        ).replace(
          `"${importPath}"`,
          `"${newRelative}"`
        );
      }
    }

    return result;
  }

  /**
   * Update imports in other files pointing to moved file
   */
  private async updateExternalImports(
    oldPath: string,
    newPath: string,
    projectIndex: ProjectIndex
  ): Promise<{ affectedFiles: string[]; changes: FileChange[] }> {
    const affectedFiles: string[] = [];
    const changes: FileChange[] = [];

    for (const [filePath, fileInfo] of projectIndex.files) {
      if (filePath === oldPath) continue;

      let hasChanges = false;
      let content = await this.fileOps.readFile(filePath);
      const originalContent = content;

      for (const imp of fileInfo.imports) {
        const resolvedPath = this.resolveImportPath(filePath, imp.source);
        
        if (resolvedPath === oldPath || 
            resolvedPath === oldPath.replace(/\.[jt]sx?$/, '') ||
            resolvedPath + '.ts' === oldPath ||
            resolvedPath + '.tsx' === oldPath) {
          
          const newRelative = this.getRelativeImportPath(filePath, newPath);
          content = content.replace(
            new RegExp(`(['"])${this.escapeRegex(imp.source)}\\1`, 'g'),
            `$1${newRelative}$1`
          );
          hasChanges = true;
        }
      }

      if (hasChanges) {
        if (!this.options.dryRun) {
          if (this.options.backup) {
            await this.createBackup(filePath);
          }
          await this.fileOps.writeFile(filePath, content);
        }

        affectedFiles.push(filePath);
        changes.push({
          path: filePath,
          type: 'modify',
          oldContent: originalContent,
          newContent: content
        });
      }
    }

    return { affectedFiles, changes };
  }

  /**
   * Resolve import path to absolute path
   */
  private resolveImportPath(fromFile: string, importPath: string): string {
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);
    
    // Remove extension for matching
    resolved = resolved.replace(/\.[jt]sx?$/, '');
    
    return resolved;
  }

  /**
   * Get relative import path between two files
   */
  private getRelativeImportPath(fromFile: string, toFile: string): string {
    const fromDir = path.dirname(fromFile);
    let relative = path.relative(fromDir, toFile);
    
    // Remove extension
    relative = relative.replace(/\.[jt]sx?$/, '');
    
    // Ensure it starts with . or ..
    if (!relative.startsWith('.')) {
      relative = './' + relative;
    }
    
    // Use forward slashes
    relative = relative.replace(/\\/g, '/');
    
    return relative;
  }

  /**
   * Find position to insert import statement
   */
  private findImportInsertPosition(content: string): number {
    const lines = content.split('\n');
    let lastImportLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.startsWith('import{')) {
        lastImportLine = i;
      } else if (lastImportLine >= 0 && line && !line.startsWith('//')) {
        break;
      }
    }

    if (lastImportLine >= 0) {
      // Position after last import
      return content.split('\n').slice(0, lastImportLine + 1).join('\n').length + 1;
    }

    // No imports, add at top (after any comments or 'use strict')
    let insertLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || 
          line === '' || line.includes("'use strict'") || line.includes('"use strict"')) {
        insertLine = i + 1;
      } else {
        break;
      }
    }

    return content.split('\n').slice(0, insertLine).join('\n').length + (insertLine > 0 ? 1 : 0);
  }

  /**
   * Wrap extracted code with exports
   */
  private wrapExtractedCode(code: string, exportName: string, filePath: string): string {
    const ext = path.extname(filePath);
    const isTypeScript = ext === '.ts' || ext === '.tsx';

    // Simple wrapper - more sophisticated extraction would need AST analysis
    if (code.includes('function ') || code.includes('const ') || code.includes('class ')) {
      return `/**\n * Extracted from parent file\n */\n\nexport ${code}\n`;
    }

    // Wrap as a function if it's just a code block
    return `/**\n * Extracted from parent file\n */\n\nexport function ${exportName}()${isTypeScript ? ': void' : ''} {\n  ${code.split('\n').join('\n  ')}\n}\n`;
  }

  /**
   * Merge import into existing import statement
   */
  private mergeImport(
    content: string,
    importSource: string,
    importNames: string[],
    isDefault?: boolean
  ): string {
    const escapedSource = this.escapeRegex(importSource);
    
    if (isDefault) {
      // Can't merge default imports
      return content;
    }

    // Find existing named import from same source
    const namedImportRegex = new RegExp(
      `import\\s*{([^}]+)}\\s*from\\s*['"]${escapedSource}['"]`,
      'g'
    );

    const match = namedImportRegex.exec(content);
    if (match) {
      const existingImports = match[1].split(',').map(s => s.trim());
      const newImports = [...new Set([...existingImports, ...importNames])];
      
      return content.replace(
        match[0],
        `import { ${newImports.join(', ')} } from '${importSource}'`
      );
    }

    return content;
  }

  /**
   * Remove specific imports from an import statement
   */
  private removeSpecificImports(
    content: string,
    importSource: string,
    importNames: string[]
  ): string {
    const escapedSource = this.escapeRegex(importSource);
    
    const namedImportRegex = new RegExp(
      `import\\s*{([^}]+)}\\s*from\\s*['"]${escapedSource}['"];?`,
      'g'
    );

    return content.replace(namedImportRegex, (match, imports) => {
      const existing = imports.split(',').map((s: string) => s.trim());
      const remaining = existing.filter((imp: string) => {
        const name = imp.split(' as ')[0].trim();
        return !importNames.includes(name);
      });

      if (remaining.length === 0) {
        return ''; // Remove entire import
      }

      return `import { ${remaining.join(', ')} } from '${importSource}';`;
    });
  }

  /**
   * Check if import is a Node.js builtin
   */
  private isNodeBuiltin(importStatement: string): boolean {
    const builtins = [
      'fs', 'path', 'http', 'https', 'url', 'util', 'os', 'crypto',
      'stream', 'events', 'buffer', 'child_process', 'cluster',
      'net', 'dns', 'readline', 'querystring', 'string_decoder',
      'timers', 'tty', 'dgram', 'v8', 'vm', 'worker_threads',
      'async_hooks', 'perf_hooks', 'assert', 'zlib'
    ];

    return builtins.some(b => 
      importStatement.includes(`'${b}'`) || 
      importStatement.includes(`"${b}"`) ||
      importStatement.includes(`'node:${b}'`) ||
      importStatement.includes(`"node:${b}"`)
    );
  }

  /**
   * Parse imports from file content
   */
  private parseImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');
    
    const importRegex = /^import\s+(?:(.+?)\s+from\s+)?['"](.+?)['"]/;

    lines.forEach((line, index) => {
      const match = importRegex.exec(line.trim());
      if (match) {
        const importClause = match[1] || '';
        const source = match[2];
        const specifiers: Array<{ name: string; alias?: string; isDefault: boolean }> = [];

        // Parse default import
        const defaultMatch = importClause.match(/^(\w+)/);
        if (defaultMatch && !importClause.startsWith('{') && !importClause.startsWith('*')) {
          specifiers.push({
            name: defaultMatch[1],
            isDefault: true
          });
        }

        // Parse named imports
        const namedMatch = importClause.match(/\{([^}]+)\}/);
        if (namedMatch) {
          const named = namedMatch[1].split(',');
          for (const n of named) {
            const parts = n.trim().split(/\s+as\s+/);
            specifiers.push({
              name: parts[0].trim(),
              alias: parts[1]?.trim(),
              isDefault: false
            });
          }
        }

        // Parse namespace import
        const namespaceMatch = importClause.match(/\*\s+as\s+(\w+)/);
        if (namespaceMatch) {
          specifiers.push({
            name: '*',
            alias: namespaceMatch[1],
            isDefault: false
          });
        }

        imports.push({
          source,
          specifiers,
          line: index + 1,
          isDefault: specifiers.some(s => s.isDefault),
          isNamespace: !!namespaceMatch,
          isDynamic: false
        });
      }
    });

    return imports;
  }

  /**
   * Get change log
   */
  getChangeLog(): FileChange[] {
    return [...this.changeLog];
  }

  /**
   * Clear change log
   */
  clearChangeLog(): void {
    this.changeLog = [];
  }

  /**
   * Rollback changes (restore from backups)
   */
  async rollback(): Promise<number> {
    let rolledBack = 0;
    const backupDir = path.join(this.options.basePath, this.options.backupDir);

    if (!await this.fileOps.exists(backupDir)) {
      return 0;
    }

    const backups = await this.fileOps.listDir(backupDir, { recursive: true });
    
    for (const backup of backups) {
      if (!backup.isFile || !backup.name.endsWith('.bak')) continue;

      // Extract original path from backup name
      const relativePath = path.relative(backupDir, backup.path);
      const originalPath = relativePath
        .replace(/\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.bak$/, '');
      
      const fullOriginalPath = path.join(this.options.basePath, originalPath);
      
      await this.fileOps.copy(backup.path, fullOriginalPath, { overwrite: true });
      await this.fileOps.remove(backup.path);
      rolledBack++;
    }

    logger.info('Rollback complete', { filesRestored: rolledBack });
    return rolledBack;
  }
}

// ============================================
// Singleton and Exports
// ============================================

let multiFileOperatorInstance: MultiFileOperator | null = null;

/**
 * Get the singleton multi-file operator instance
 */
export function getMultiFileOperator(options?: MultiFileOptions): MultiFileOperator {
  if (!multiFileOperatorInstance) {
    multiFileOperatorInstance = new MultiFileOperator(options);
  }
  return multiFileOperatorInstance;
}

/**
 * Create a new multi-file operator instance
 */
export function createMultiFileOperator(options?: MultiFileOptions): MultiFileOperator {
  return new MultiFileOperator(options);
}

export const multiFileOps = getMultiFileOperator();

export default MultiFileOperator;

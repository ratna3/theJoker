/**
 * Code Analyzer - Phase 15: Code Understanding & Context
 * Provides semantic analysis, usage tracking, and code summarization
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import LMStudioClient from '../llm/client';
import { logger } from '../utils/logger';
import type { ProjectIndex, IndexedFileInfo, FunctionInfo, ClassInfo, ImportSpecifier } from './indexer';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Usage {
  filePath: string;
  line: number;
  column: number;
  context: string;
  type: 'definition' | 'reference' | 'call' | 'import' | 'export';
  symbolName: string;
}

export interface AnalysisComplexityMetrics {
  totalFiles: number;
  totalLines: number;
  averageComplexity: number;
  maxComplexity: number;
  complexFiles: Array<{ filePath: string; complexity: number }>;
}

export interface AnalysisCodeSmell {
  type: string;
  severity: 'low' | 'medium' | 'high';
  filePath: string;
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
}

export interface Duplicate {
  files: string[];
  lines: Array<{ filePath: string; startLine: number; endLine: number }>;
  similarity: number;
  content: string;
}

export interface UnusedCode {
  type: 'function' | 'class' | 'variable' | 'export' | 'import';
  name: string;
  filePath: string;
  line: number;
}

export interface Suggestion {
  type: string;
  priority: 'low' | 'medium' | 'high';
  filePath: string;
  line?: number;
  message: string;
  fix?: string;
}

export interface AnalysisResult {
  complexity: AnalysisComplexityMetrics;
  codeSmells: AnalysisCodeSmell[];
  duplicates: Duplicate[];
  unused: UnusedCode[];
  suggestions: Suggestion[];
  analyzedAt: Date;
  analyzedFiles: number;
}

export interface ExportSummary {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  description?: string;
}

export interface CodeSummary {
  filePath: string;
  fileName: string;
  purpose: string;
  exports: ExportSummary[];
  complexity: number;
  dependencies: string[];
  dependents: string[];
  suggestions: string[];
  lineCount: number;
  mainConcepts: string[];
}

export interface AnalyzerSearchResult {
  filePath: string;
  line: number;
  column: number;
  type: 'function' | 'class' | 'variable' | 'import' | 'export';
  name: string;
  score: number;
  snippet: string;
  matchedIn: 'name' | 'content' | 'comment';
}

export interface AnalyzerOptions {
  maxFileSize?: number;
  ignorePatterns?: string[];
  smellThresholds?: {
    maxParameters?: number;
    maxFileLines?: number;
    maxFunctionLines?: number;
    maxComplexity?: number;
  };
  useLLM?: boolean;
}

// ============================================================================
// Code Analyzer Implementation
// ============================================================================

export class CodeAnalyzer extends EventEmitter {
  private llm: LMStudioClient | null = null;
  private options: Required<AnalyzerOptions>;
  private usageCache: Map<string, Usage[]> = new Map();

  constructor(options: AnalyzerOptions = {}) {
    super();
    this.options = {
      maxFileSize: options.maxFileSize ?? 1024 * 1024, // 1MB
      ignorePatterns: options.ignorePatterns ?? ['node_modules', '.git', 'dist', 'build'],
      smellThresholds: {
        maxParameters: options.smellThresholds?.maxParameters ?? 5,
        maxFileLines: options.smellThresholds?.maxFileLines ?? 500,
        maxFunctionLines: options.smellThresholds?.maxFunctionLines ?? 50,
        maxComplexity: options.smellThresholds?.maxComplexity ?? 10
      },
      useLLM: options.useLLM ?? true
    };
    
    if (this.options.useLLM) {
      this.llm = new LMStudioClient();
    }
  }

  /**
   * Perform comprehensive analysis on a project index
   */
  async analyze(projectIndex: ProjectIndex): Promise<AnalysisResult> {
    logger.info('Starting code analysis', { 
      rootPath: projectIndex.rootPath,
      fileCount: projectIndex.files.size 
    });

    this.emit('analysisStart', { fileCount: projectIndex.files.size });

    const [complexity, codeSmells, duplicates, unused] = await Promise.all([
      this.calculateComplexity(projectIndex),
      this.detectCodeSmells(projectIndex),
      this.findDuplicates(projectIndex),
      this.findUnusedCode(projectIndex)
    ]);

    const suggestions = this.generateSuggestions(codeSmells, unused, complexity);

    const result: AnalysisResult = {
      complexity,
      codeSmells,
      duplicates,
      unused,
      suggestions,
      analyzedAt: new Date(),
      analyzedFiles: projectIndex.files.size
    };

    this.emit('analysisComplete', result);
    logger.info('Code analysis complete', {
      smells: codeSmells.length,
      duplicates: duplicates.length,
      unused: unused.length,
      suggestions: suggestions.length
    });

    return result;
  }

  /**
   * Find all usages of a symbol across the project
   */
  async findUsages(symbol: string, projectIndex: ProjectIndex): Promise<Usage[]> {
    // Check cache first
    const cacheKey = `${projectIndex.rootPath}:${symbol}`;
    if (this.usageCache.has(cacheKey)) {
      return this.usageCache.get(cacheKey)!;
    }

    const usages: Usage[] = [];
    const symbolRegex = new RegExp(`\\b${this.escapeRegex(symbol)}\\b`, 'g');

    for (const [, fileInfo] of projectIndex.files) {
      try {
        const content = await fs.readFile(fileInfo.path, 'utf-8');
        const lines = content.split('\n');

        // Find definitions
        this.findDefinitions(symbol, fileInfo, usages);

        // Find references in code
        lines.forEach((line, index) => {
          let match;
          symbolRegex.lastIndex = 0;
          while ((match = symbolRegex.exec(line)) !== null) {
            const usageType = this.determineUsageType(line, match.index, symbol);
            
            // Avoid duplicate definitions
            if (usageType !== 'definition' || !usages.some(u => 
              u.filePath === fileInfo.relativePath && 
              u.line === index + 1 && 
              u.type === 'definition'
            )) {
              usages.push({
                filePath: fileInfo.relativePath,
                line: index + 1,
                column: match.index + 1,
                context: line.trim(),
                type: usageType,
                symbolName: symbol
              });
            }
          }
        });
      } catch (error) {
        logger.warn('Failed to read file for usage search', { 
          file: fileInfo.path, 
          error 
        });
      }
    }

    // Cache results
    this.usageCache.set(cacheKey, usages);

    return usages;
  }

  /**
   * Generate a summary of a code file using LLM
   */
  async generateSummary(filePath: string, projectIndex?: ProjectIndex): Promise<CodeSummary> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const fileName = path.basename(filePath);
    const relativePath = projectIndex 
      ? path.relative(projectIndex.rootPath, filePath)
      : filePath;

    // Get file info from index if available
    const fileInfo = projectIndex?.files.get(relativePath);

    // Basic summary without LLM
    const basicSummary: CodeSummary = {
      filePath: relativePath,
      fileName,
      purpose: this.inferPurpose(fileName, content),
      exports: this.extractExportSummaries(fileInfo, content),
      complexity: this.calculateFileComplexity(content),
      dependencies: fileInfo?.imports.map(i => i.source) ?? [],
      dependents: fileInfo?.dependents ?? [],
      suggestions: [],
      lineCount: lines.length,
      mainConcepts: this.extractMainConcepts(fileInfo, content)
    };

    // Use LLM for enhanced summary if enabled
    if (this.options.useLLM && this.llm) {
      try {
        const enhancedSummary = await this.generateLLMSummary(
          filePath, 
          content, 
          basicSummary
        );
        return { ...basicSummary, ...enhancedSummary };
      } catch (error) {
        logger.warn('LLM summary generation failed, using basic summary', { error });
      }
    }

    return basicSummary;
  }

  /**
   * Suggest improvements for a file
   */
  async suggestImprovements(filePath: string, projectIndex?: ProjectIndex): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = projectIndex 
      ? path.relative(projectIndex.rootPath, filePath)
      : filePath;

    const fileInfo = projectIndex?.files.get(relativePath);
    const thresholds = this.options.smellThresholds;
    const maxFileLines = thresholds.maxFileLines ?? 500;
    const maxParams = thresholds.maxParameters ?? 5;

    // Check for long file
    if (lines.length > maxFileLines) {
      suggestions.push({
        type: 'file-size',
        priority: 'medium',
        filePath: relativePath,
        message: `File has ${lines.length} lines. Consider splitting into smaller modules.`,
        fix: 'Extract related functionality into separate files'
      });
    }

    // Check for long functions
    if (fileInfo) {
      for (const func of fileInfo.functions) {
        if (func.parameters.length > maxParams) {
          suggestions.push({
            type: 'too-many-parameters',
            priority: 'medium',
            filePath: relativePath,
            line: func.line,
            message: `Function '${func.name}' has ${func.parameters.length} parameters.`,
            fix: 'Consider using an options object or breaking down the function'
          });
        }
      }
    }

    // Check for missing JSDoc
    if (fileInfo?.functions) {
      for (const func of fileInfo.functions) {
        if (func.isExported) {
          const funcLine = lines[func.line - 2] ?? '';
          if (!funcLine.includes('*/') && !funcLine.includes('*')) {
            suggestions.push({
              type: 'missing-documentation',
              priority: 'low',
              filePath: relativePath,
              line: func.line,
              message: `Exported function '${func.name}' lacks documentation.`,
              fix: 'Add JSDoc comments describing the function'
            });
          }
        }
      }
    }

    // Check for console.log statements
    lines.forEach((line, index) => {
      if (line.includes('console.log') && !line.trim().startsWith('//')) {
        suggestions.push({
          type: 'console-statement',
          priority: 'low',
          filePath: relativePath,
          line: index + 1,
          message: 'Console statement found. Consider using a logger.',
          fix: 'Replace with logger.debug() or remove'
        });
      }
    });

    // Use LLM for more suggestions if enabled
    if (this.options.useLLM && this.llm) {
      try {
        const llmSuggestions = await this.generateLLMSuggestions(filePath, content);
        suggestions.push(...llmSuggestions);
      } catch (error) {
        logger.warn('LLM suggestion generation failed', { error });
      }
    }

    return suggestions;
  }

  /**
   * Semantic search across the codebase
   */
  async search(query: string, projectIndex: ProjectIndex): Promise<AnalyzerSearchResult[]> {
    const results: AnalyzerSearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    for (const [relativePath, fileInfo] of projectIndex.files) {
      // Search in function names
      for (const func of fileInfo.functions) {
        const score = this.calculateRelevance(queryWords, func.name, queryLower);
        if (score > 0.3) {
          results.push({
            filePath: relativePath,
            line: func.line,
            column: func.column,
            type: 'function',
            name: func.name,
            score,
            snippet: await this.getCodeSnippet(fileInfo.path, func.line),
            matchedIn: 'name'
          });
        }
      }

      // Search in class names
      for (const cls of fileInfo.classes) {
        const score = this.calculateRelevance(queryWords, cls.name, queryLower);
        if (score > 0.3) {
          results.push({
            filePath: relativePath,
            line: cls.line,
            column: cls.column,
            type: 'class',
            name: cls.name,
            score,
            snippet: await this.getCodeSnippet(fileInfo.path, cls.line),
            matchedIn: 'name'
          });
        }
      }

      // Search in exports
      for (const exp of fileInfo.exports) {
        const score = this.calculateRelevance(queryWords, exp.name, queryLower);
        if (score > 0.3) {
          results.push({
            filePath: relativePath,
            line: exp.line,
            column: 1,
            type: 'export',
            name: exp.name,
            score,
            snippet: await this.getCodeSnippet(fileInfo.path, exp.line),
            matchedIn: 'name'
          });
        }
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, 20);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async calculateComplexity(projectIndex: ProjectIndex): Promise<AnalysisComplexityMetrics> {
    let totalLines = 0;
    let totalComplexity = 0;
    const complexFiles: Array<{ filePath: string; complexity: number }> = [];
    const thresholds = this.options.smellThresholds;
    const maxComplexityThreshold = thresholds.maxComplexity ?? 10;

    for (const [relativePath, fileInfo] of projectIndex.files) {
      totalLines += fileInfo.lineCount;
      // Calculate complexity from functions and classes
      const complexity = this.estimateFileComplexity(fileInfo);
      totalComplexity += complexity;

      if (complexity > maxComplexityThreshold) {
        complexFiles.push({ filePath: relativePath, complexity });
      }
    }

    complexFiles.sort((a, b) => b.complexity - a.complexity);

    return {
      totalFiles: projectIndex.files.size,
      totalLines,
      averageComplexity: projectIndex.files.size > 0 
        ? totalComplexity / projectIndex.files.size 
        : 0,
      maxComplexity: complexFiles[0]?.complexity ?? 0,
      complexFiles: complexFiles.slice(0, 10)
    };
  }
  
  /**
   * Estimate file complexity from its structure
   */
  private estimateFileComplexity(fileInfo: IndexedFileInfo): number {
    // Base complexity from functions
    let complexity = fileInfo.functions.length;
    
    // Add complexity from classes and their methods
    for (const cls of fileInfo.classes) {
      complexity += cls.methods.length;
    }
    
    // Add complexity for dependencies
    complexity += Math.min(fileInfo.dependencies.length, 5);
    
    return complexity;
  }

  private async detectCodeSmells(projectIndex: ProjectIndex): Promise<AnalysisCodeSmell[]> {
    const smells: AnalysisCodeSmell[] = [];
    const thresholds = this.options.smellThresholds;
    const maxParams = thresholds.maxParameters ?? 5;
    const maxComplexityThreshold = thresholds.maxComplexity ?? 10;

    for (const [relativePath, fileInfo] of projectIndex.files) {
      // Too many parameters
      for (const func of fileInfo.functions) {
        if (func.parameters.length > maxParams) {
          smells.push({
            type: 'too-many-parameters',
            severity: func.parameters.length > 8 ? 'high' : 'medium',
            filePath: relativePath,
            line: func.line,
            column: func.column,
            message: `Function '${func.name}' has ${func.parameters.length} parameters`,
            suggestion: 'Consider using an options object or splitting the function'
          });
        }
      }

      // Large file
      if (fileInfo.size > this.options.maxFileSize) {
        smells.push({
          type: 'large-file',
          severity: 'medium',
          filePath: relativePath,
          line: 1,
          message: `File is ${Math.round(fileInfo.size / 1024)}KB`,
          suggestion: 'Consider splitting into smaller modules'
        });
      }

      // High complexity (calculate instead of using missing property)
      const complexity = this.estimateFileComplexity(fileInfo);
      if (complexity > maxComplexityThreshold) {
        smells.push({
          type: 'high-complexity',
          severity: complexity > 20 ? 'high' : 'medium',
          filePath: relativePath,
          line: 1,
          message: `File has complexity score of ${complexity}`,
          suggestion: 'Refactor complex logic into smaller functions'
        });
      }

      // Deeply nested classes
      for (const cls of fileInfo.classes) {
        if (cls.methods.length > 20) {
          smells.push({
            type: 'god-class',
            severity: 'medium',
            filePath: relativePath,
            line: cls.line,
            message: `Class '${cls.name}' has ${cls.methods.length} methods`,
            suggestion: 'Consider splitting into smaller, focused classes'
          });
        }
      }
    }

    return smells;
  }

  private async findDuplicates(projectIndex: ProjectIndex): Promise<Duplicate[]> {
    const duplicates: Duplicate[] = [];
    const fileContents: Map<string, { path: string; lines: string[] }> = new Map();

    // Read all file contents
    for (const [relativePath, fileInfo] of projectIndex.files) {
      try {
        const content = await fs.readFile(fileInfo.path, 'utf-8');
        fileContents.set(relativePath, {
          path: relativePath,
          lines: content.split('\n')
        });
      } catch {
        // Skip files that can't be read
      }
    }

    // Simple duplicate detection: look for identical non-trivial blocks
    const blockHashes: Map<string, Array<{ path: string; startLine: number }>> = new Map();
    const minBlockSize = 5;

    for (const [filePath, { lines }] of fileContents) {
      for (let i = 0; i <= lines.length - minBlockSize; i++) {
        const block = lines.slice(i, i + minBlockSize).join('\n').trim();
        
        // Skip trivial blocks
        if (block.length < 100 || block.split('\n').every(l => l.trim().length < 5)) {
          continue;
        }

        const hash = this.hashString(block);
        
        if (!blockHashes.has(hash)) {
          blockHashes.set(hash, []);
        }
        blockHashes.get(hash)!.push({ path: filePath, startLine: i + 1 });
      }
    }

    // Report duplicates
    for (const [hash, locations] of blockHashes) {
      if (locations.length > 1) {
        // Get unique files
        const uniqueFiles = [...new Set(locations.map(l => l.path))];
        if (uniqueFiles.length > 1) {
          duplicates.push({
            files: uniqueFiles,
            lines: locations.map(l => ({
              filePath: l.path,
              startLine: l.startLine,
              endLine: l.startLine + minBlockSize - 1
            })),
            similarity: 1.0,
            content: hash.substring(0, 50) + '...'
          });
        }
      }
    }

    return duplicates.slice(0, 20); // Limit results
  }

  private async findUnusedCode(projectIndex: ProjectIndex): Promise<UnusedCode[]> {
    const unused: UnusedCode[] = [];
    const allExports = new Map<string, { file: string; line: number }>();
    const allImports = new Set<string>();

    // Collect all exports and imports
    for (const [relativePath, fileInfo] of projectIndex.files) {
      for (const exp of fileInfo.exports) {
        allExports.set(`${relativePath}:${exp.name}`, {
          file: relativePath,
          line: exp.line
        });
      }

      for (const imp of fileInfo.imports) {
        for (const spec of imp.specifiers) {
          allImports.add(spec.name || spec.alias || '');
        }
      }
    }

    // Find unused exports (not imported anywhere)
    for (const [key, { file, line }] of allExports) {
      const exportName = key.split(':')[1];
      
      // Skip index files and main entry points
      if (file.includes('index.') || exportName === 'default') {
        continue;
      }

      // Check if this export is used
      let isUsed = false;
      for (const [, fileInfo] of projectIndex.files) {
        if (fileInfo.relativePath === file) continue;
        
        for (const imp of fileInfo.imports) {
          if (imp.specifiers.some(s => 
            s.name === exportName || s.alias === exportName
          )) {
            isUsed = true;
            break;
          }
        }
        if (isUsed) break;
      }

      if (!isUsed) {
        unused.push({
          type: 'export',
          name: exportName,
          filePath: file,
          line
        });
      }
    }

    return unused.slice(0, 50); // Limit results
  }

  private generateSuggestions(
    smells: AnalysisCodeSmell[],
    unused: UnusedCode[],
    complexity: AnalysisComplexityMetrics
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Suggestions based on code smells
    const smellGroups = this.groupBy(smells, s => s.type);
    for (const [type, items] of Object.entries(smellGroups)) {
      if (items.length >= 3) {
        suggestions.push({
          type: 'pattern',
          priority: 'medium',
          filePath: '*',
          message: `Found ${items.length} instances of '${type}'. Consider a codebase-wide refactoring.`
        });
      }
    }

    // Suggestions based on unused code
    if (unused.length > 10) {
      suggestions.push({
        type: 'cleanup',
        priority: 'low',
        filePath: '*',
        message: `Found ${unused.length} unused exports. Consider removing dead code.`
      });
    }

    // Suggestions based on complexity
    if (complexity.averageComplexity > 5) {
      suggestions.push({
        type: 'complexity',
        priority: 'high',
        filePath: '*',
        message: `Average complexity is ${complexity.averageComplexity.toFixed(1)}. Consider simplifying code.`
      });
    }

    return suggestions;
  }

  private findDefinitions(symbol: string, fileInfo: IndexedFileInfo, usages: Usage[]): void {
    // Check functions
    const func = fileInfo.functions.find(f => f.name === symbol);
    if (func) {
      usages.push({
        filePath: fileInfo.relativePath,
        line: func.line,
        column: func.column,
        context: `function ${func.name}(...)`,
        type: 'definition',
        symbolName: symbol
      });
    }

    // Check classes
    const cls = fileInfo.classes.find(c => c.name === symbol);
    if (cls) {
      usages.push({
        filePath: fileInfo.relativePath,
        line: cls.line,
        column: cls.column,
        context: `class ${cls.name}`,
        type: 'definition',
        symbolName: symbol
      });
    }

    // Check variables
    const variable = fileInfo.variables.find(v => v.name === symbol);
    if (variable) {
      usages.push({
        filePath: fileInfo.relativePath,
        line: variable.line,
        column: variable.column,
        context: `${variable.kind} ${variable.name}`,
        type: 'definition',
        symbolName: symbol
      });
    }
  }

  private determineUsageType(
    line: string, 
    position: number, 
    symbol: string
  ): 'definition' | 'reference' | 'call' | 'import' | 'export' {
    const beforeMatch = line.substring(0, position).trim();
    const afterMatch = line.substring(position + symbol.length).trim();

    if (beforeMatch.match(/import\s+.*\{?$/)) {
      return 'import';
    }
    if (beforeMatch.match(/export\s+(const|let|function|class|default)?$/)) {
      return 'export';
    }
    if (beforeMatch.match(/(function|class|const|let|var)\s+$/)) {
      return 'definition';
    }
    if (afterMatch.startsWith('(')) {
      return 'call';
    }

    return 'reference';
  }

  private inferPurpose(fileName: string, content: string): string {
    const name = path.basename(fileName, path.extname(fileName));
    
    // Check for common patterns
    if (name.includes('test') || name.includes('spec')) {
      return 'Test file';
    }
    if (name === 'index') {
      return 'Module entry point / barrel file';
    }
    if (name.includes('config')) {
      return 'Configuration file';
    }
    if (name.includes('util') || name.includes('helper')) {
      return 'Utility functions';
    }
    if (name.includes('type') || name.includes('interface')) {
      return 'Type definitions';
    }

    // Check content patterns
    if (content.includes('React') || content.includes('Component')) {
      return 'React component';
    }
    if (content.includes('express') || content.includes('router')) {
      return 'Express route handler';
    }
    if (content.includes('class') && content.includes('extends')) {
      return 'Class implementation';
    }

    return `${name} module`;
  }

  private extractExportSummaries(
    fileInfo: IndexedFileInfo | undefined, 
    content: string
  ): ExportSummary[] {
    if (!fileInfo) return [];

    const summaries: ExportSummary[] = [];

    for (const exp of fileInfo.exports) {
      let type: ExportSummary['type'] = 'variable';
      
      // Determine export type
      const func = fileInfo.functions.find(f => f.name === exp.name);
      if (func) {
        type = 'function';
      } else {
        const cls = fileInfo.classes.find(c => c.name === exp.name);
        if (cls) {
          type = 'class';
        }
      }

      summaries.push({
        name: exp.name,
        type,
        description: undefined // Could be extracted from JSDoc
      });
    }

    return summaries;
  }

  private extractMainConcepts(
    fileInfo: IndexedFileInfo | undefined,
    content: string
  ): string[] {
    const concepts: string[] = [];

    if (fileInfo) {
      // Add class names
      concepts.push(...fileInfo.classes.map(c => c.name));
      // Add main function names (exported ones)
      concepts.push(
        ...fileInfo.functions
          .filter(f => f.isExported)
          .map(f => f.name)
      );
    }

    // Extract from imports
    const importMatches = content.match(/from\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      const packages = importMatches
        .map(m => m.replace(/from\s+['"]/, '').replace(/['"]/, ''))
        .filter(p => !p.startsWith('.'))
        .slice(0, 5);
      concepts.push(...packages);
    }

    return [...new Set(concepts)].slice(0, 10);
  }

  private calculateFileComplexity(content: string): number {
    let complexity = 1;
    
    // Count control flow statements
    const patterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\?/g,
      /\?[^:]/g,
      /&&/g,
      /\|\|/g
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private async generateLLMSummary(
    filePath: string,
    content: string,
    basicSummary: CodeSummary
  ): Promise<Partial<CodeSummary>> {
    const prompt = `Analyze this code file and provide a summary:

File: ${path.basename(filePath)}
Lines: ${basicSummary.lineCount}
Exports: ${basicSummary.exports.map(e => e.name).join(', ') || 'none'}
Dependencies: ${basicSummary.dependencies.slice(0, 5).join(', ') || 'none'}

Code (first 1500 chars):
\`\`\`
${content.substring(0, 1500)}
\`\`\`

Provide a JSON response with:
{
  "purpose": "one sentence describing what this file does",
  "suggestions": ["up to 3 improvement suggestions"]
}`;

    if (!this.llm) {
      return {};
    }
    
    const response = await this.llm.chat([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      maxTokens: 300
    });

    try {
      const parsed = JSON.parse(this.extractJSON(response.content));
      return {
        purpose: parsed.purpose || basicSummary.purpose,
        suggestions: parsed.suggestions || []
      };
    } catch {
      return {};
    }
  }

  private async generateLLMSuggestions(
    filePath: string,
    content: string
  ): Promise<Suggestion[]> {
    const prompt = `Review this code for improvements:

File: ${path.basename(filePath)}

Code (first 2000 chars):
\`\`\`
${content.substring(0, 2000)}
\`\`\`

Provide up to 3 specific improvement suggestions as JSON:
[
  { "type": "string", "priority": "low|medium|high", "message": "suggestion text", "line": number or null }
]`;

    if (!this.llm) {
      return [];
    }
    
    const response = await this.llm.chat([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      maxTokens: 400
    });

    try {
      const parsed = JSON.parse(this.extractJSON(response.content));
      const relativePath = path.basename(filePath);
      
      return parsed.map((s: { type: string; priority: 'low' | 'medium' | 'high'; message: string; line?: number }) => ({
        type: s.type || 'llm-suggestion',
        priority: s.priority || 'low',
        filePath: relativePath,
        line: s.line,
        message: s.message
      }));
    } catch {
      return [];
    }
  }

  private async getCodeSnippet(filePath: string, line: number): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(0, line - 2);
      const end = Math.min(lines.length, line + 2);
      return lines.slice(start, end).join('\n');
    } catch {
      return '';
    }
  }

  private calculateRelevance(queryWords: string[], target: string, query: string): number {
    const targetLower = target.toLowerCase();
    
    // Exact match
    if (targetLower === query) {
      return 1.0;
    }
    
    // Contains full query
    if (targetLower.includes(query)) {
      return 0.9;
    }

    // Count matching words
    let matchCount = 0;
    for (const word of queryWords) {
      if (targetLower.includes(word)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      return 0.5 + (matchCount / queryWords.length) * 0.4;
    }

    // Fuzzy match using Levenshtein distance
    const distance = this.levenshteinDistance(query, targetLower);
    const maxLen = Math.max(query.length, targetLower.length);
    const similarity = 1 - distance / maxLen;

    return similarity > 0.6 ? similarity * 0.5 : 0;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  private extractJSON(text: string): string {
    // Try to find JSON in markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find raw JSON
    const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return text;
  }

  /**
   * Clear the usage cache
   */
  clearCache(): void {
    this.usageCache.clear();
  }
}

// ============================================================================
// Semantic Code Search (Enhanced)
// ============================================================================

export class SemanticCodeSearch {
  private analyzer: CodeAnalyzer;

  constructor(analyzer?: CodeAnalyzer) {
    this.analyzer = analyzer ?? new CodeAnalyzer();
  }

  /**
   * Perform a semantic search across the project
   */
  async search(query: string, projectIndex: ProjectIndex): Promise<AnalyzerSearchResult[]> {
    return this.analyzer.search(query, projectIndex);
  }

  /**
   * Find similar code patterns
   */
  async findSimilar(
    code: string, 
    projectIndex: ProjectIndex
  ): Promise<AnalyzerSearchResult[]> {
    // Extract key identifiers from the code
    const identifiers = this.extractIdentifiers(code);
    
    if (identifiers.length === 0) {
      return [];
    }

    // Search for each identifier
    const allResults: AnalyzerSearchResult[] = [];
    for (const id of identifiers.slice(0, 3)) {
      const results = await this.analyzer.search(id, projectIndex);
      allResults.push(...results);
    }

    // Deduplicate and score
    const seen = new Set<string>();
    return allResults
      .filter(r => {
        const key = `${r.filePath}:${r.line}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private extractIdentifiers(code: string): string[] {
    const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const matches = code.match(identifierRegex) || [];
    
    // Filter out common keywords
    const keywords = new Set([
      'const', 'let', 'var', 'function', 'class', 'return', 'if', 'else',
      'for', 'while', 'switch', 'case', 'break', 'continue', 'try', 'catch',
      'throw', 'new', 'this', 'import', 'export', 'from', 'async', 'await',
      'true', 'false', 'null', 'undefined', 'typeof', 'instanceof'
    ]);

    return [...new Set(matches)]
      .filter(m => !keywords.has(m) && m.length > 2);
  }
}

// ============================================================================
// Exports
// ============================================================================

/** Lazy singleton code analyzer instance */
let _codeAnalyzer: CodeAnalyzer | null = null;
export function getCodeAnalyzer(): CodeAnalyzer {
  if (!_codeAnalyzer) {
    _codeAnalyzer = new CodeAnalyzer({ useLLM: false });
  }
  return _codeAnalyzer;
}

/** For backward compatibility */
export const codeAnalyzer = { 
  get instance() { return getCodeAnalyzer(); }
};

/** Lazy singleton semantic search instance */
let _semanticSearch: SemanticCodeSearch | null = null;
export function getSemanticSearch(): SemanticCodeSearch {
  if (!_semanticSearch) {
    _semanticSearch = new SemanticCodeSearch(getCodeAnalyzer());
  }
  return _semanticSearch;
}

/** For backward compatibility */  
export const semanticSearch = {
  get instance() { return getSemanticSearch(); }
};

/** Create a new analyzer with custom options */
export function createAnalyzer(options?: AnalyzerOptions): CodeAnalyzer {
  return new CodeAnalyzer(options);
}

export default CodeAnalyzer;

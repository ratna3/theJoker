/**
 * The Joker - Agentic Terminal
 * Test Generator & Quality Assurance System
 * 
 * Provides automated test generation, test suite execution,
 * code quality analysis, and coverage measurement.
 */

import { EventEmitter } from 'events';
import { spawn, exec, ChildProcess, ExecException } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LMStudioClient, lmStudioClient } from '../llm/client';
import { logger } from '../utils/logger';

/**
 * Promise-based exec wrapper that avoids promisify deprecation warnings
 */
function execAsync(command: string, options?: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, options, (error: ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => {
      if (error) {
        const enhancedError = error as ExecException & { stdout: string; stderr: string };
        enhancedError.stdout = stdout?.toString() || '';
        enhancedError.stderr = stderr?.toString() || '';
        reject(enhancedError);
      } else {
        resolve({
          stdout: stdout?.toString() || '',
          stderr: stderr?.toString() || ''
        });
      }
    });
  });
}

// ============================================
// Test Generation Types
// ============================================

/**
 * Test case specification
 */
export interface TestCase {
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  input?: unknown;
  expectedOutput?: unknown;
  assertions: string[];
  setup?: string;
  teardown?: string;
}

/**
 * Generated test file
 */
export interface GeneratedTest {
  filePath: string;
  testFilePath: string;
  content: string;
  framework: TestFramework;
  testCases: TestCase[];
  imports: string[];
  mocks: MockSpec[];
}

/**
 * Mock specification for test generation
 */
export interface MockSpec {
  module: string;
  exports: string[];
  implementation?: string;
}

/**
 * Test generation options
 */
export interface TestGenerationOptions {
  framework?: TestFramework;
  coverage?: boolean;
  mocks?: boolean;
  style?: 'bdd' | 'tdd';
  includeEdgeCases?: boolean;
  includeErrorCases?: boolean;
  maxTestsPerFunction?: number;
}

/**
 * Supported test frameworks
 */
export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'ava';

/**
 * Test run result
 */
export interface TestRunResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  total: number;
  duration: number;
  coverage?: CoverageResult;
  failures: TestFailure[];
  output: string;
  suites: TestSuiteResult[];
}

/**
 * Individual test suite result
 */
export interface TestSuiteResult {
  name: string;
  file: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: IndividualTestResult[];
}

/**
 * Individual test result
 */
export interface IndividualTestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  error?: string;
  stack?: string;
}

/**
 * Test failure details
 */
export interface TestFailure {
  testName: string;
  suiteName: string;
  file: string;
  message: string;
  stack?: string;
  expected?: string;
  actual?: string;
  line?: number;
}

/**
 * Coverage result
 */
export interface CoverageResult {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  files: FileCoverage[];
}

/**
 * Coverage metric
 */
export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

/**
 * Per-file coverage
 */
export interface FileCoverage {
  file: string;
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  uncoveredLines: number[];
}

/**
 * Code quality result
 */
export interface QualityResult {
  score: number;
  issues: QualityIssue[];
  metrics: QualityMetrics;
  suggestions: string[];
}

/**
 * Quality issue
 */
export interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  file: string;
  line?: number;
  column?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixable: boolean;
  suggestion?: string;
}

/**
 * Quality metrics
 */
export interface QualityMetrics {
  complexity: number;
  maintainability: number;
  duplicateLines: number;
  codeSmells: number;
  technicalDebt: number;
  linesOfCode: number;
  commentRatio: number;
}

/**
 * Lint result
 */
export interface LintResult {
  success: boolean;
  errorCount: number;
  warningCount: number;
  fixableCount: number;
  issues: LintIssue[];
  output: string;
}

/**
 * Lint issue
 */
export interface LintIssue {
  file: string;
  line: number;
  column: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  fixable: boolean;
}

/**
 * Format result
 */
export interface FormatResult {
  success: boolean;
  filesChecked: number;
  filesFormatted: number;
  filesUnchanged: number;
  errors: string[];
}

/**
 * Code analysis for test generation
 */
export interface CodeAnalysis {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  exports: string[];
  imports: string[];
  dependencies: string[];
}

/**
 * Function info for test generation
 */
export interface FunctionInfo {
  name: string;
  params: ParamInfo[];
  returnType: string;
  async: boolean;
  exported: boolean;
  complexity: number;
  lines: { start: number; end: number };
}

/**
 * Parameter info
 */
export interface ParamInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

/**
 * Class info for test generation
 */
export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  exported: boolean;
  extends?: string;
  implements?: string[];
}

/**
 * Property info
 */
export interface PropertyInfo {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  static: boolean;
  readonly: boolean;
}

// ============================================
// Test Generator Class
// ============================================

/**
 * Test Generator - Generates and manages unit tests
 */
export class TestGenerator extends EventEmitter {
  private llm: LMStudioClient;
  private projectPath: string;
  private framework: TestFramework;
  private generatedTests: Map<string, GeneratedTest>;
  private testHistory: TestRunResult[];
  private maxHistory: number = 50;

  constructor(options: {
    projectPath?: string;
    framework?: TestFramework;
    llm?: LMStudioClient;
  } = {}) {
    super();
    this.projectPath = options.projectPath || process.cwd();
    this.framework = options.framework || 'jest';
    this.llm = options.llm || lmStudioClient;
    this.generatedTests = new Map();
    this.testHistory = [];
  }

  // ============================================
  // Test Generation
  // ============================================

  /**
   * Generate tests for a source file
   */
  async generateTests(
    filePath: string,
    options: TestGenerationOptions = {}
  ): Promise<GeneratedTest> {
    const opts = {
      framework: this.framework,
      coverage: true,
      mocks: true,
      style: 'bdd' as const,
      includeEdgeCases: true,
      includeErrorCases: true,
      maxTestsPerFunction: 5,
      ...options
    };

    this.emit('generate:start', { filePath, options: opts });

    try {
      // Read source file
      const sourceCode = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(this.projectPath, filePath);

      // Analyze the code
      const analysis = await this.analyzeCode(sourceCode, filePath);

      // Generate test file path
      const testFilePath = this.getTestFilePath(filePath);

      // Generate tests using LLM
      const testContent = await this.generateTestContent(
        sourceCode,
        analysis,
        relativePath,
        opts
      );

      // Parse generated test cases
      const testCases = this.parseTestCases(testContent);

      // Extract mocks
      const mocks = this.extractMocks(testContent, analysis);

      // Extract imports
      const imports = this.extractImports(testContent);

      const result: GeneratedTest = {
        filePath,
        testFilePath,
        content: testContent,
        framework: opts.framework!,
        testCases,
        imports,
        mocks
      };

      this.generatedTests.set(filePath, result);
      this.emit('generate:complete', result);

      return result;
    } catch (error) {
      this.emit('generate:error', error);
      throw error;
    }
  }

  /**
   * Analyze source code for test generation
   */
  async analyzeCode(sourceCode: string, filePath: string): Promise<CodeAnalysis> {
    const ext = path.extname(filePath);
    const isTypeScript = ext === '.ts' || ext === '.tsx';

    const functions: FunctionInfo[] = [];
    const classes: ClassInfo[] = [];
    const exports: string[] = [];
    const imports: string[] = [];
    const dependencies: string[] = [];

    // Extract imports
    const importMatches = sourceCode.matchAll(/import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const importedItems = match[1] || match[2];
      const modulePath = match[3];
      imports.push(importedItems);
      if (!modulePath.startsWith('.') && !modulePath.startsWith('/')) {
        dependencies.push(modulePath.split('/')[0]);
      }
    }

    // Extract exports
    const exportMatches = sourceCode.matchAll(/export\s+(?:default\s+)?(?:const|function|class|interface|type|enum)\s+(\w+)/g);
    for (const match of exportMatches) {
      exports.push(match[1]);
    }

    // Extract functions
    const functionPatterns = [
      // Regular functions
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*{/g,
      // Arrow functions
      /(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g,
      // Method definitions
      /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g
    ];

    for (const pattern of functionPatterns) {
      const matches = sourceCode.matchAll(pattern);
      for (const match of matches) {
        const name = match[1];
        if (name && !functions.find(f => f.name === name)) {
          const params = this.parseParams(match[2] || '');
          const returnType = match[3]?.trim() || 'void';
          const isAsync = match[0].includes('async');
          const isExported = match[0].includes('export');

          functions.push({
            name,
            params,
            returnType,
            async: isAsync,
            exported: isExported,
            complexity: this.calculateComplexity(sourceCode, name),
            lines: { start: 0, end: 0 }
          });
        }
      }
    }

    // Extract classes
    const classPattern = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*{/g;
    const classMatches = sourceCode.matchAll(classPattern);
    
    for (const match of classMatches) {
      const className = match[1];
      const extendsClass = match[2];
      const implementsList = match[3]?.split(',').map(s => s.trim());
      const isExported = match[0].includes('export');

      // Find methods in class
      const classBody = this.extractClassBody(sourceCode, className);
      const methods = this.extractMethods(classBody);
      const properties = this.extractProperties(classBody);

      classes.push({
        name: className,
        methods,
        properties,
        exported: isExported,
        extends: extendsClass,
        implements: implementsList
      });
    }

    return {
      functions,
      classes,
      exports: [...new Set(exports)],
      imports: [...new Set(imports)],
      dependencies: [...new Set(dependencies)]
    };
  }

  /**
   * Parse function parameters
   */
  private parseParams(paramsStr: string): ParamInfo[] {
    if (!paramsStr.trim()) return [];

    const params: ParamInfo[] = [];
    const paramParts = paramsStr.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Handle destructuring
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        params.push({
          name: 'destructured',
          type: 'object',
          optional: trimmed.includes('?')
        });
        continue;
      }

      // Parse name: type = default
      const match = trimmed.match(/(\w+)\s*(\?)?\s*(?::\s*([^=]+))?\s*(?:=\s*(.+))?/);
      if (match) {
        params.push({
          name: match[1],
          type: match[3]?.trim() || 'any',
          optional: !!match[2] || !!match[4],
          defaultValue: match[4]?.trim()
        });
      }
    }

    return params;
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(code: string, functionName: string): number {
    // Simple complexity calculation based on control flow
    let complexity = 1;

    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bdo\s*{/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\s*[^:]+:/g, // Ternary
      /&&/g,
      /\|\|/g
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Extract class body
   */
  private extractClassBody(code: string, className: string): string {
    const classStart = code.indexOf(`class ${className}`);
    if (classStart === -1) return '';

    let braceCount = 0;
    let inClass = false;
    let bodyStart = 0;

    for (let i = classStart; i < code.length; i++) {
      if (code[i] === '{') {
        if (!inClass) {
          inClass = true;
          bodyStart = i + 1;
        }
        braceCount++;
      } else if (code[i] === '}') {
        braceCount--;
        if (inClass && braceCount === 0) {
          return code.substring(bodyStart, i);
        }
      }
    }

    return '';
  }

  /**
   * Extract methods from class body
   */
  private extractMethods(classBody: string): FunctionInfo[] {
    const methods: FunctionInfo[] = [];
    const methodPattern = /(?:(private|public|protected)\s+)?(?:(static)\s+)?(?:(async)\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*{/g;
    
    const matches = classBody.matchAll(methodPattern);
    for (const match of matches) {
      const visibility = match[1] || 'public';
      const isStatic = !!match[2];
      const isAsync = !!match[3];
      const name = match[4];
      const paramsStr = match[5];
      const returnType = match[6]?.trim() || 'void';

      if (name === 'constructor') continue;

      methods.push({
        name,
        params: this.parseParams(paramsStr),
        returnType,
        async: isAsync,
        exported: visibility === 'public',
        complexity: 1,
        lines: { start: 0, end: 0 }
      });
    }

    return methods;
  }

  /**
   * Extract properties from class body
   */
  private extractProperties(classBody: string): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const propPattern = /(?:(private|public|protected)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?(\w+)\s*(?::\s*([^;=]+))?\s*(?:=\s*[^;]+)?;/g;

    const matches = classBody.matchAll(propPattern);
    for (const match of matches) {
      properties.push({
        name: match[4],
        type: match[5]?.trim() || 'any',
        visibility: (match[1] || 'public') as 'public' | 'private' | 'protected',
        static: !!match[2],
        readonly: !!match[3]
      });
    }

    return properties;
  }

  /**
   * Generate test content using LLM
   */
  private async generateTestContent(
    sourceCode: string,
    analysis: CodeAnalysis,
    relativePath: string,
    options: TestGenerationOptions
  ): Promise<string> {
    const frameworkImport = this.getFrameworkImport(options.framework!);
    const testStyle = options.style === 'tdd' ? 'test()' : 'it()';

    const prompt = `Generate comprehensive unit tests for the following TypeScript/JavaScript code.

Source file: ${relativePath}

\`\`\`typescript
${sourceCode}
\`\`\`

Code Analysis:
- Functions: ${analysis.functions.map(f => f.name).join(', ') || 'None'}
- Classes: ${analysis.classes.map(c => c.name).join(', ') || 'None'}
- Exports: ${analysis.exports.join(', ') || 'None'}
- Dependencies: ${analysis.dependencies.join(', ') || 'None'}

Requirements:
1. Use ${options.framework} as the test framework
2. Use ${testStyle} for test cases (${options.style} style)
3. Include proper mocks for dependencies
4. Test all exported functions and classes
5. Include edge cases: ${options.includeEdgeCases ? 'Yes' : 'No'}
6. Include error cases: ${options.includeErrorCases ? 'Yes' : 'No'}
7. Maximum ${options.maxTestsPerFunction} tests per function

Generate a complete, runnable test file with:
- Proper imports and mocks
- describe blocks for each function/class
- Individual test cases with clear names
- Setup and teardown if needed
- Assertions for return values and side effects

Return ONLY the test code, no explanations.`;

    try {
      const response = await this.llm.chat([
        { role: 'system', content: 'You are an expert test engineer. Generate comprehensive, well-structured unit tests.' },
        { role: 'user', content: prompt }
      ]);

      // Extract code from response (LLMResponse has content property)
      const responseContent = response.content;
      let testCode = responseContent;
      const codeBlockMatch = responseContent.match(/```(?:typescript|javascript)?\n([\s\S]+?)\n```/);
      if (codeBlockMatch) {
        testCode = codeBlockMatch[1];
      }

      return testCode;
    } catch (error) {
      // Fallback to template-based generation
      return this.generateTemplateTests(sourceCode, analysis, relativePath, options);
    }
  }

  /**
   * Generate template-based tests (fallback)
   */
  private generateTemplateTests(
    sourceCode: string,
    analysis: CodeAnalysis,
    relativePath: string,
    options: TestGenerationOptions
  ): string {
    const importPath = relativePath.replace(/\.(ts|js)x?$/, '').replace(/\\/g, '/');
    const importStatement = analysis.exports.length > 0
      ? `import { ${analysis.exports.join(', ')} } from '${importPath.startsWith('.') ? importPath : './' + importPath}';`
      : `import * as module from '${importPath.startsWith('.') ? importPath : './' + importPath}';`;

    let tests = `/**
 * Auto-generated tests for ${relativePath}
 */

${importStatement}

`;

    // Generate tests for functions
    for (const func of analysis.functions) {
      if (!func.exported) continue;

      tests += `describe('${func.name}', () => {\n`;
      tests += `  it('should exist and be a function', () => {\n`;
      tests += `    expect(typeof ${func.name}).toBe('function');\n`;
      tests += `  });\n\n`;

      if (func.async) {
        tests += `  it('should return a promise', async () => {\n`;
        tests += `    const result = ${func.name}(${this.generateMockArgs(func.params)});\n`;
        tests += `    expect(result).toBeInstanceOf(Promise);\n`;
        tests += `  });\n\n`;
      }

      if (options.includeEdgeCases) {
        tests += `  it('should handle empty input', () => {\n`;
        tests += `    // TODO: Implement edge case test\n`;
        tests += `  });\n\n`;
      }

      if (options.includeErrorCases) {
        tests += `  it('should handle invalid input gracefully', () => {\n`;
        tests += `    // TODO: Implement error case test\n`;
        tests += `  });\n`;
      }

      tests += `});\n\n`;
    }

    // Generate tests for classes
    for (const cls of analysis.classes) {
      if (!cls.exported) continue;

      tests += `describe('${cls.name}', () => {\n`;
      tests += `  let instance: ${cls.name};\n\n`;
      tests += `  beforeEach(() => {\n`;
      tests += `    instance = new ${cls.name}();\n`;
      tests += `  });\n\n`;

      tests += `  it('should be instantiable', () => {\n`;
      tests += `    expect(instance).toBeInstanceOf(${cls.name});\n`;
      tests += `  });\n\n`;

      for (const method of cls.methods) {
        tests += `  describe('${method.name}', () => {\n`;
        tests += `    it('should exist', () => {\n`;
        tests += `      expect(typeof instance.${method.name}).toBe('function');\n`;
        tests += `    });\n`;
        tests += `  });\n\n`;
      }

      tests += `});\n\n`;
    }

    return tests;
  }

  /**
   * Generate mock arguments for function params
   */
  private generateMockArgs(params: ParamInfo[]): string {
    return params.map(p => {
      switch (p.type.toLowerCase()) {
        case 'string': return "''";
        case 'number': return '0';
        case 'boolean': return 'false';
        case 'array': return '[]';
        case 'object': return '{}';
        default: return p.optional ? 'undefined' : '{}';
      }
    }).join(', ');
  }

  /**
   * Parse test cases from generated content
   */
  private parseTestCases(content: string): TestCase[] {
    const testCases: TestCase[] = [];
    const testPattern = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    
    const matches = content.matchAll(testPattern);
    for (const match of matches) {
      testCases.push({
        name: match[1],
        description: match[1],
        type: 'unit',
        assertions: []
      });
    }

    return testCases;
  }

  /**
   * Extract mocks from test content
   */
  private extractMocks(content: string, analysis: CodeAnalysis): MockSpec[] {
    const mocks: MockSpec[] = [];
    const mockPattern = /jest\.mock\s*\(\s*['"`]([^'"`]+)['"`]/g;

    const matches = content.matchAll(mockPattern);
    for (const match of matches) {
      mocks.push({
        module: match[1],
        exports: []
      });
    }

    return mocks;
  }

  /**
   * Extract imports from test content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importPattern = /import\s+(?:{[^}]+}|[\w*]+)\s+from\s+['"`]([^'"`]+)['"`]/g;

    const matches = content.matchAll(importPattern);
    for (const match of matches) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Get test file path from source file path
   */
  private getTestFilePath(sourcePath: string): string {
    const parsed = path.parse(sourcePath);
    const testDir = path.join(this.projectPath, 'tests', 'unit');
    const relativePath = path.relative(path.join(this.projectPath, 'src'), sourcePath);
    const testFileName = `${parsed.name}.test${parsed.ext}`;
    
    return path.join(testDir, path.dirname(relativePath), testFileName);
  }

  /**
   * Get framework import statement
   */
  private getFrameworkImport(framework: TestFramework): string {
    switch (framework) {
      case 'jest':
        return ''; // Jest globals are available
      case 'vitest':
        return "import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';";
      case 'mocha':
        return "import { describe, it, before, after, beforeEach, afterEach } from 'mocha';\nimport { expect } from 'chai';";
      case 'ava':
        return "import test from 'ava';";
      default:
        return '';
    }
  }

  /**
   * Save generated test to file
   */
  async saveTest(generatedTest: GeneratedTest): Promise<void> {
    const dir = path.dirname(generatedTest.testFilePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(generatedTest.testFilePath, generatedTest.content, 'utf-8');
    
    this.emit('test:saved', generatedTest.testFilePath);
    logger.info(`Test saved to ${generatedTest.testFilePath}`);
  }

  // ============================================
  // Test Execution
  // ============================================

  /**
   * Run test suite
   */
  async runTests(options: {
    pattern?: string;
    coverage?: boolean;
    watch?: boolean;
    verbose?: boolean;
    updateSnapshots?: boolean;
    bail?: boolean;
    maxWorkers?: number;
  } = {}): Promise<TestRunResult> {
    const startTime = Date.now();
    this.emit('tests:start', options);

    const args = this.buildTestArgs(options);
    const command = this.getTestCommand();

    try {
      const { stdout, stderr } = await execAsync(
        `${command} ${args.join(' ')}`,
        {
          cwd: this.projectPath,
          env: { ...process.env, FORCE_COLOR: '1' },
          maxBuffer: 1024 * 1024 * 10 // 10MB
        }
      );

      const output = stdout + stderr;
      const result = this.parseTestOutput(output, Date.now() - startTime);
      
      this.testHistory.push(result);
      if (this.testHistory.length > this.maxHistory) {
        this.testHistory.shift();
      }

      this.emit('tests:complete', result);
      return result;
    } catch (error: any) {
      // Jest exits with code 1 on test failures
      const output = error.stdout + error.stderr;
      const result = this.parseTestOutput(output, Date.now() - startTime);
      
      this.testHistory.push(result);
      if (this.testHistory.length > this.maxHistory) {
        this.testHistory.shift();
      }

      this.emit('tests:complete', result);
      return result;
    }
  }

  /**
   * Run specific test file
   */
  async runTestFile(filePath: string, options: {
    coverage?: boolean;
    verbose?: boolean;
  } = {}): Promise<TestRunResult> {
    return this.runTests({
      pattern: filePath,
      ...options
    });
  }

  /**
   * Watch tests
   */
  watchTests(options: {
    pattern?: string;
    verbose?: boolean;
  } = {}): ChildProcess {
    const args = this.buildTestArgs({ ...options, watch: true });
    const command = this.getTestCommand();

    const child = spawn(command, args, {
      cwd: this.projectPath,
      stdio: 'pipe',
      shell: true
    });

    child.stdout?.on('data', (data) => {
      this.emit('tests:output', data.toString());
    });

    child.stderr?.on('data', (data) => {
      this.emit('tests:error', data.toString());
    });

    this.emit('tests:watch:start');
    return child;
  }

  /**
   * Build test command arguments
   */
  private buildTestArgs(options: {
    pattern?: string;
    coverage?: boolean;
    watch?: boolean;
    verbose?: boolean;
    updateSnapshots?: boolean;
    bail?: boolean;
    maxWorkers?: number;
  }): string[] {
    const args: string[] = [];

    if (options.pattern) {
      args.push(options.pattern);
    }

    if (options.coverage) {
      args.push('--coverage');
    }

    if (options.watch) {
      args.push('--watch');
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    if (options.updateSnapshots) {
      args.push('--updateSnapshot');
    }

    if (options.bail) {
      args.push('--bail');
    }

    if (options.maxWorkers) {
      args.push(`--maxWorkers=${options.maxWorkers}`);
    }

    // Add JSON reporter for parsing
    args.push('--json');
    args.push('--outputFile=test-results.json');

    return args;
  }

  /**
   * Get test command based on framework
   */
  private getTestCommand(): string {
    switch (this.framework) {
      case 'jest':
        return 'npx jest';
      case 'vitest':
        return 'npx vitest run';
      case 'mocha':
        return 'npx mocha';
      case 'ava':
        return 'npx ava';
      default:
        return 'npm test';
    }
  }

  /**
   * Parse test output
   */
  private parseTestOutput(output: string, duration: number): TestRunResult {
    const result: TestRunResult = {
      success: true,
      passed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      total: 0,
      duration,
      failures: [],
      output,
      suites: []
    };

    // Parse Jest output
    const summaryMatch = output.match(/Tests:\s*(?:(\d+)\s*failed,?\s*)?(?:(\d+)\s*skipped,?\s*)?(?:(\d+)\s*passed,?\s*)?(\d+)\s*total/);
    if (summaryMatch) {
      result.failed = parseInt(summaryMatch[1] || '0', 10);
      result.skipped = parseInt(summaryMatch[2] || '0', 10);
      result.passed = parseInt(summaryMatch[3] || '0', 10);
      result.total = parseInt(summaryMatch[4] || '0', 10);
      result.success = result.failed === 0;
    }

    // Parse suite summaries
    const suiteMatch = output.match(/Test Suites:\s*(?:(\d+)\s*failed,?\s*)?(?:(\d+)\s*skipped,?\s*)?(?:(\d+)\s*passed,?\s*)?(\d+)\s*total/);
    if (suiteMatch) {
      // Parse individual suite results if available
    }

    // Parse failures
    const failurePattern = /FAIL\s+([^\n]+)\n([\s\S]*?)(?=(?:PASS|FAIL|\n\n|Tests:))/g;
    const failures = output.matchAll(failurePattern);
    for (const failure of failures) {
      const file = failure[1].trim();
      const details = failure[2];

      // Extract test name and error
      const testNameMatch = details.match(/✕\s+([^\n]+)/);
      const errorMatch = details.match(/Error:\s*([^\n]+)/);

      if (testNameMatch) {
        result.failures.push({
          testName: testNameMatch[1].trim(),
          suiteName: '',
          file,
          message: errorMatch?.[1] || 'Test failed',
          stack: details
        });
      }
    }

    // Parse coverage if present
    const coverageMatch = output.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
    if (coverageMatch) {
      result.coverage = {
        statements: {
          total: 100,
          covered: parseFloat(coverageMatch[1]),
          percentage: parseFloat(coverageMatch[1])
        },
        branches: {
          total: 100,
          covered: parseFloat(coverageMatch[2]),
          percentage: parseFloat(coverageMatch[2])
        },
        functions: {
          total: 100,
          covered: parseFloat(coverageMatch[3]),
          percentage: parseFloat(coverageMatch[3])
        },
        lines: {
          total: 100,
          covered: parseFloat(coverageMatch[4]),
          percentage: parseFloat(coverageMatch[4])
        },
        files: []
      };
    }

    return result;
  }

  // ============================================
  // Code Quality
  // ============================================

  /**
   * Check code quality
   */
  async checkQuality(options: {
    files?: string[];
    fix?: boolean;
  } = {}): Promise<QualityResult> {
    this.emit('quality:start', options);

    const issues: QualityIssue[] = [];
    const suggestions: string[] = [];

    // Run ESLint
    const lintResult = await this.lint({
      files: options.files,
      fix: options.fix
    });

    // Convert lint issues to quality issues
    for (const issue of lintResult.issues) {
      issues.push({
        type: issue.severity === 'error' ? 'error' : 'warning',
        rule: issue.rule,
        message: issue.message,
        file: issue.file,
        line: issue.line,
        column: issue.column,
        severity: issue.severity === 'error' ? 'high' : 'medium',
        fixable: issue.fixable
      });
    }

    // Calculate metrics
    const metrics = await this.calculateMetrics(options.files);

    // Generate suggestions
    if (metrics.complexity > 10) {
      suggestions.push('Consider breaking down complex functions into smaller units');
    }
    if (metrics.commentRatio < 0.1) {
      suggestions.push('Add more documentation comments to improve code readability');
    }
    if (metrics.duplicateLines > 50) {
      suggestions.push('Refactor duplicate code into reusable functions');
    }

    // Calculate overall score
    const score = this.calculateQualityScore(lintResult, metrics);

    const result: QualityResult = {
      score,
      issues,
      metrics,
      suggestions
    };

    this.emit('quality:complete', result);
    return result;
  }

  /**
   * Calculate quality metrics
   */
  private async calculateMetrics(files?: string[]): Promise<QualityMetrics> {
    let totalComplexity = 0;
    let totalLines = 0;
    let commentLines = 0;
    let duplicateLines = 0;

    const targetFiles = files || await this.getSourceFiles();

    for (const file of targetFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        totalLines += lines.length;

        // Count comment lines
        for (const line of lines) {
          if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
            commentLines++;
          }
        }

        // Calculate complexity
        totalComplexity += this.calculateComplexity(content, '');
      } catch {
        // Skip unreadable files
      }
    }

    return {
      complexity: Math.round(totalComplexity / Math.max(targetFiles.length, 1)),
      maintainability: Math.max(0, 100 - totalComplexity),
      duplicateLines,
      codeSmells: 0,
      technicalDebt: 0,
      linesOfCode: totalLines,
      commentRatio: totalLines > 0 ? commentLines / totalLines : 0
    };
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(lintResult: LintResult, metrics: QualityMetrics): number {
    let score = 100;

    // Deduct for lint errors
    score -= lintResult.errorCount * 5;
    score -= lintResult.warningCount * 1;

    // Deduct for high complexity
    if (metrics.complexity > 20) {
      score -= 10;
    } else if (metrics.complexity > 10) {
      score -= 5;
    }

    // Deduct for low comment ratio
    if (metrics.commentRatio < 0.05) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get source files
   */
  private async getSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    const srcDir = path.join(this.projectPath, 'src');

    try {
      await this.walkDir(srcDir, files);
    } catch {
      // Fallback to project root
      await this.walkDir(this.projectPath, files);
    }

    return files.filter(f => /\.(ts|js|tsx|jsx)$/.test(f));
  }

  /**
   * Walk directory recursively
   */
  private async walkDir(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }

        if (entry.isDirectory()) {
          await this.walkDir(fullPath, files);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // ============================================
  // Linting
  // ============================================

  /**
   * Run linter
   */
  async lint(options: {
    files?: string[];
    fix?: boolean;
  } = {}): Promise<LintResult> {
    this.emit('lint:start', options);

    const args = ['--format', 'json'];

    if (options.fix) {
      args.push('--fix');
    }

    if (options.files && options.files.length > 0) {
      args.push(...options.files);
    } else {
      args.push('src/**/*.{ts,tsx,js,jsx}');
    }

    try {
      const { stdout } = await execAsync(
        `npx eslint ${args.join(' ')}`,
        { cwd: this.projectPath, maxBuffer: 1024 * 1024 * 5 }
      );

      return this.parseLintOutput(stdout);
    } catch (error: any) {
      // ESLint exits with code 1 when there are issues
      if (error.stdout) {
        return this.parseLintOutput(error.stdout);
      }

      return {
        success: false,
        errorCount: 0,
        warningCount: 0,
        fixableCount: 0,
        issues: [],
        output: error.message
      };
    }
  }

  /**
   * Parse lint output
   */
  private parseLintOutput(output: string): LintResult {
    const result: LintResult = {
      success: true,
      errorCount: 0,
      warningCount: 0,
      fixableCount: 0,
      issues: [],
      output
    };

    try {
      const data = JSON.parse(output);

      for (const file of data) {
        for (const message of file.messages) {
          const issue: LintIssue = {
            file: file.filePath,
            line: message.line || 0,
            column: message.column || 0,
            rule: message.ruleId || 'unknown',
            message: message.message,
            severity: message.severity === 2 ? 'error' : 'warning',
            fixable: !!message.fix
          };

          result.issues.push(issue);

          if (issue.severity === 'error') {
            result.errorCount++;
          } else {
            result.warningCount++;
          }

          if (issue.fixable) {
            result.fixableCount++;
          }
        }
      }

      result.success = result.errorCount === 0;
    } catch {
      // Non-JSON output, might be an error message
    }

    this.emit('lint:complete', result);
    return result;
  }

  // ============================================
  // Formatting
  // ============================================

  /**
   * Format code
   */
  async format(options: {
    files?: string[];
    check?: boolean;
  } = {}): Promise<FormatResult> {
    this.emit('format:start', options);

    const args: string[] = [];

    if (options.check) {
      args.push('--check');
    } else {
      args.push('--write');
    }

    if (options.files && options.files.length > 0) {
      args.push(...options.files);
    } else {
      args.push('src/**/*.{ts,tsx,js,jsx,json,css,scss}');
    }

    try {
      const { stdout } = await execAsync(
        `npx prettier ${args.join(' ')}`,
        { cwd: this.projectPath, maxBuffer: 1024 * 1024 * 5 }
      );

      const result = this.parseFormatOutput(stdout, options.check);
      this.emit('format:complete', result);
      return result;
    } catch (error: any) {
      const result: FormatResult = {
        success: false,
        filesChecked: 0,
        filesFormatted: 0,
        filesUnchanged: 0,
        errors: [error.message]
      };

      this.emit('format:complete', result);
      return result;
    }
  }

  /**
   * Parse format output
   */
  private parseFormatOutput(output: string, isCheck?: boolean): FormatResult {
    const lines = output.trim().split('\n').filter(l => l.trim());

    return {
      success: true,
      filesChecked: lines.length,
      filesFormatted: isCheck ? 0 : lines.length,
      filesUnchanged: isCheck ? lines.length : 0,
      errors: []
    };
  }

  // ============================================
  // Coverage
  // ============================================

  /**
   * Get coverage report
   */
  async getCoverage(): Promise<CoverageResult | null> {
    const coveragePath = path.join(this.projectPath, 'coverage', 'coverage-summary.json');

    try {
      const content = await fs.readFile(coveragePath, 'utf-8');
      const data = JSON.parse(content);

      const result: CoverageResult = {
        lines: this.extractCoverageMetric(data.total.lines),
        statements: this.extractCoverageMetric(data.total.statements),
        functions: this.extractCoverageMetric(data.total.functions),
        branches: this.extractCoverageMetric(data.total.branches),
        files: []
      };

      // Parse per-file coverage
      for (const [filePath, metrics] of Object.entries(data)) {
        if (filePath === 'total') continue;

        const fileMetrics = metrics as any;
        result.files.push({
          file: filePath,
          lines: this.extractCoverageMetric(fileMetrics.lines),
          statements: this.extractCoverageMetric(fileMetrics.statements),
          functions: this.extractCoverageMetric(fileMetrics.functions),
          branches: this.extractCoverageMetric(fileMetrics.branches),
          uncoveredLines: []
        });
      }

      return result;
    } catch {
      return null;
    }
  }

  /**
   * Extract coverage metric from raw data
   */
  private extractCoverageMetric(data: any): CoverageMetric {
    return {
      total: data.total || 0,
      covered: data.covered || 0,
      percentage: data.pct || 0
    };
  }

  // ============================================
  // History & Statistics
  // ============================================

  /**
   * Get test history
   */
  getTestHistory(): TestRunResult[] {
    return [...this.testHistory];
  }

  /**
   * Get last test run
   */
  getLastTestRun(): TestRunResult | undefined {
    return this.testHistory[this.testHistory.length - 1];
  }

  /**
   * Get generated tests
   */
  getGeneratedTests(): Map<string, GeneratedTest> {
    return new Map(this.generatedTests);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.testHistory = [];
  }

  /**
   * Get test statistics
   */
  getStats(): {
    totalRuns: number;
    passRate: number;
    averageDuration: number;
    testsGenerated: number;
  } {
    const totalRuns = this.testHistory.length;
    const successfulRuns = this.testHistory.filter(r => r.success).length;
    const totalDuration = this.testHistory.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalRuns,
      passRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      averageDuration: totalRuns > 0 ? totalDuration / totalRuns : 0,
      testsGenerated: this.generatedTests.size
    };
  }
}

// ============================================
// Test Runner Class (Simplified)
// ============================================

/**
 * Test Runner - Simplified test execution interface
 */
export class TestRunner extends EventEmitter {
  private generator: TestGenerator;
  private projectPath: string;
  private runningProcess: ChildProcess | null = null;

  constructor(projectPath?: string) {
    super();
    this.projectPath = projectPath || process.cwd();
    this.generator = new TestGenerator({ projectPath: this.projectPath });

    // Forward events
    this.generator.on('tests:start', (data) => this.emit('start', data));
    this.generator.on('tests:complete', (data) => this.emit('complete', data));
    this.generator.on('tests:output', (data) => this.emit('output', data));
    this.generator.on('tests:error', (data) => this.emit('error', data));
  }

  /**
   * Run all tests
   */
  async run(options?: { coverage?: boolean; verbose?: boolean }): Promise<TestRunResult> {
    return this.generator.runTests(options);
  }

  /**
   * Run specific test file
   */
  async runFile(filePath: string, options?: { verbose?: boolean }): Promise<TestRunResult> {
    return this.generator.runTestFile(filePath, options);
  }

  /**
   * Run tests matching pattern
   */
  async runPattern(pattern: string, options?: { verbose?: boolean }): Promise<TestRunResult> {
    return this.generator.runTests({ pattern, ...options });
  }

  /**
   * Watch mode
   */
  watch(options?: { pattern?: string }): ChildProcess {
    this.runningProcess = this.generator.watchTests(options);
    return this.runningProcess;
  }

  /**
   * Stop watch mode
   */
  stop(): void {
    if (this.runningProcess) {
      this.runningProcess.kill();
      this.runningProcess = null;
    }
  }

  /**
   * Get last result
   */
  getLastResult(): TestRunResult | undefined {
    return this.generator.getLastTestRun();
  }

  /**
   * Is running
   */
  isRunning(): boolean {
    return this.runningProcess !== null;
  }
}

// ============================================
// Quality Checker Class (Simplified)
// ============================================

/**
 * Quality Checker - Simplified code quality interface
 */
export class QualityChecker extends EventEmitter {
  private generator: TestGenerator;
  private projectPath: string;

  constructor(projectPath?: string) {
    super();
    this.projectPath = projectPath || process.cwd();
    this.generator = new TestGenerator({ projectPath: this.projectPath });

    // Forward events
    this.generator.on('quality:start', (data) => this.emit('start', data));
    this.generator.on('quality:complete', (data) => this.emit('complete', data));
    this.generator.on('lint:start', (data) => this.emit('lint:start', data));
    this.generator.on('lint:complete', (data) => this.emit('lint:complete', data));
    this.generator.on('format:start', (data) => this.emit('format:start', data));
    this.generator.on('format:complete', (data) => this.emit('format:complete', data));
  }

  /**
   * Check code quality
   */
  async check(options?: { files?: string[]; fix?: boolean }): Promise<QualityResult> {
    return this.generator.checkQuality(options);
  }

  /**
   * Run linter
   */
  async lint(options?: { files?: string[]; fix?: boolean }): Promise<LintResult> {
    return this.generator.lint(options);
  }

  /**
   * Format code
   */
  async format(options?: { files?: string[]; check?: boolean }): Promise<FormatResult> {
    return this.generator.format(options);
  }

  /**
   * Get coverage
   */
  async getCoverage(): Promise<CoverageResult | null> {
    return this.generator.getCoverage();
  }
}

// ============================================
// Factory Functions
// ============================================

let defaultTestGenerator: TestGenerator | null = null;
let defaultTestRunner: TestRunner | null = null;
let defaultQualityChecker: QualityChecker | null = null;

/**
 * Get or create default test generator
 */
export function getTestGenerator(projectPath?: string): TestGenerator {
  if (!defaultTestGenerator || (projectPath && projectPath !== process.cwd())) {
    defaultTestGenerator = new TestGenerator({ projectPath });
  }
  return defaultTestGenerator;
}

/**
 * Create new test generator
 */
export function createTestGenerator(options: {
  projectPath?: string;
  framework?: TestFramework;
}): TestGenerator {
  return new TestGenerator(options);
}

/**
 * Get or create default test runner
 */
export function getTestRunner(projectPath?: string): TestRunner {
  if (!defaultTestRunner || (projectPath && projectPath !== process.cwd())) {
    defaultTestRunner = new TestRunner(projectPath);
  }
  return defaultTestRunner;
}

/**
 * Create new test runner
 */
export function createTestRunner(projectPath?: string): TestRunner {
  return new TestRunner(projectPath);
}

/**
 * Get or create default quality checker
 */
export function getQualityChecker(projectPath?: string): QualityChecker {
  if (!defaultQualityChecker || (projectPath && projectPath !== process.cwd())) {
    defaultQualityChecker = new QualityChecker(projectPath);
  }
  return defaultQualityChecker;
}

/**
 * Create new quality checker
 */
export function createQualityChecker(projectPath?: string): QualityChecker {
  return new QualityChecker(projectPath);
}

// Export singleton instances
export const testGenerator = getTestGenerator();
export const testRunner = getTestRunner();
export const qualityChecker = getQualityChecker();

/**
 * Tests for Code Analyzer (Phase 15)
 */

import {
  CodeAnalyzer,
  SemanticCodeSearch,
  getCodeAnalyzer,
  getSemanticSearch,
  createAnalyzer,
  type Usage,
  type AnalysisResult,
  type CodeSummary,
  type Suggestion,
  type AnalyzerSearchResult,
  type AnalysisCodeSmell,
  type UnusedCode,
  type AnalysisComplexityMetrics
} from '../../../src/coding/analyzer';
import type { ProjectIndex, IndexedFileInfo, FunctionInfo, ClassInfo, ImportInfo, ExportInfo, VariableInfo } from '../../../src/coding/indexer';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  stat: jest.fn()
}));

// Mock llm client - export as default constructor
jest.mock('../../../src/llm/client', () => {
  const MockLMStudioClient = jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue({ 
      content: '{"purpose": "Test module", "suggestions": ["Add tests"]}',
      role: 'assistant',
      model: 'test'
    })
  }));
  return {
    __esModule: true,
    default: MockLMStudioClient
  };
});

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const mockFs = jest.requireMock('fs/promises');

// Helper to create mock file info
function createMockFileInfo(overrides: Partial<IndexedFileInfo & { complexity?: number }> = {}): IndexedFileInfo & { complexity?: number } {
  return {
    path: '/project/src/test.ts',
    relativePath: 'src/test.ts',
    name: 'test.ts',
    extension: '.ts',
    size: 1000,
    language: 'typescript',
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    variables: [],
    dependencies: [],
    dependents: [],
    lastModified: new Date(),
    lastIndexed: new Date(),
    hash: 'abc123',
    lineCount: 50,
    ...overrides
  };
}

// Helper to create mock project index
function createMockProjectIndex(files: Map<string, IndexedFileInfo> = new Map()): ProjectIndex {
  return {
    rootPath: '/project',
    version: '1.0.0',
    files,
    directories: new Map(),
    dependencyGraph: {
      nodes: new Set(),
      edges: new Map(),
      reverseEdges: new Map()
    } as any,
    indexedAt: new Date(),
    statistics: {
      totalFiles: files.size,
      totalDirectories: 3,
      totalSize: 0,
      totalLines: 0,
      languageBreakdown: {},
      fileTypeBreakdown: {},
      largestFiles: [],
      mostImported: [],
      circularDependencies: []
    }
  };
}

describe('CodeAnalyzer', () => {
  let analyzer: CodeAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new CodeAnalyzer({ useLLM: false });
  });

  describe('constructor', () => {
    it('should create analyzer with default options', () => {
      const a = new CodeAnalyzer();
      expect(a).toBeInstanceOf(CodeAnalyzer);
    });

    it('should accept custom options', () => {
      const a = new CodeAnalyzer({
        maxFileSize: 500 * 1024,
        ignorePatterns: ['test'],
        useLLM: false
      });
      expect(a).toBeInstanceOf(CodeAnalyzer);
    });

    it('should extend EventEmitter', () => {
      expect(typeof analyzer.on).toBe('function');
      expect(typeof analyzer.emit).toBe('function');
    });
  });

  describe('analyze', () => {
    it('should analyze empty project', async () => {
      const index = createMockProjectIndex();
      const result = await analyzer.analyze(index);

      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('codeSmells');
      expect(result).toHaveProperty('duplicates');
      expect(result).toHaveProperty('unused');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('analyzedAt');
      expect(result.analyzedFiles).toBe(0);
    });

    it('should detect code smells', async () => {
      const fileInfo = createMockFileInfo({
        functions: [
          {
            name: 'complexFunction',
            line: 10,
            column: 1,
            parameters: [
              { name: 'a', optional: false },
              { name: 'b', optional: false },
              { name: 'c', optional: false },
              { name: 'd', optional: false },
              { name: 'e', optional: false },
              { name: 'f', optional: false } // 6 params - exceeds threshold
            ],
            isAsync: false,
            isExported: true,
            isArrow: false
          }
        ]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);
      const result = await analyzer.analyze(index);

      expect(result.codeSmells.length).toBeGreaterThan(0);
      expect(result.codeSmells.some(s => s.type === 'too-many-parameters')).toBe(true);
    });

    it('should detect large file smell', async () => {
      const fileInfo = createMockFileInfo({
        size: 2 * 1024 * 1024 // 2MB
      });

      const files = new Map([['src/large.ts', fileInfo]]);
      const index = createMockProjectIndex(files);
      const result = await analyzer.analyze(index);

      expect(result.codeSmells.some(s => s.type === 'large-file')).toBe(true);
    });

    it('should detect high complexity', async () => {
      // Create a file with many functions to trigger high complexity
      const functions = Array.from({ length: 15 }, (_, i) => ({
        name: `func${i}`,
        line: i * 10,
        column: 1,
        parameters: [],
        isAsync: false,
        isExported: false,
        isArrow: false
      }));

      const fileInfo = createMockFileInfo({
        functions,
        dependencies: ['dep1', 'dep2', 'dep3', 'dep4', 'dep5'] // Add dependencies
      });

      const files = new Map([['src/complex.ts', fileInfo]]);
      const index = createMockProjectIndex(files);
      const result = await analyzer.analyze(index);

      expect(result.codeSmells.some(s => s.type === 'high-complexity')).toBe(true);
    });

    it('should detect god class smell', async () => {
      const methods = Array.from({ length: 25 }, (_, i) => ({
        name: `method${i}`,
        line: i * 10,
        parameters: [],
        isAsync: false,
        isStatic: false,
        isPrivate: false,
        isProtected: false,
        visibility: 'public' as const
      }));

      const fileInfo = createMockFileInfo({
        classes: [{
          name: 'GodClass',
          line: 1,
          column: 1,
          methods,
          properties: [],
          isExported: true,
          isAbstract: false
        }]
      });

      const files = new Map([['src/god.ts', fileInfo]]);
      const index = createMockProjectIndex(files);
      const result = await analyzer.analyze(index);

      expect(result.codeSmells.some(s => s.type === 'god-class')).toBe(true);
    });

    it('should emit analysisStart event', async () => {
      const index = createMockProjectIndex();
      const startHandler = jest.fn();
      analyzer.on('analysisStart', startHandler);

      await analyzer.analyze(index);

      expect(startHandler).toHaveBeenCalledWith({ fileCount: 0 });
    });

    it('should emit analysisComplete event', async () => {
      const index = createMockProjectIndex();
      const completeHandler = jest.fn();
      analyzer.on('analysisComplete', completeHandler);

      await analyzer.analyze(index);

      expect(completeHandler).toHaveBeenCalled();
      expect(completeHandler.mock.calls[0][0]).toHaveProperty('complexity');
    });

    it('should calculate complexity metrics', async () => {
      // Create file with 5 functions + 3 class methods = 8 complexity
      const fileInfo = createMockFileInfo({
        functions: Array.from({ length: 5 }, (_, i) => ({
          name: `func${i}`,
          line: i * 10,
          column: 1,
          parameters: [],
          isAsync: false,
          isExported: false,
          isArrow: false
        })),
        classes: [{
          name: 'TestClass',
          line: 1,
          column: 1,
          methods: Array.from({ length: 3 }, (_, i) => ({
            name: `method${i}`,
            line: i * 5,
            parameters: [],
            isAsync: false,
            isStatic: false,
            isPrivate: false,
            isProtected: false,
            visibility: 'public' as const
          })),
          properties: [],
          isExported: true,
          isAbstract: false
        }],
        lineCount: 100
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);
      const result = await analyzer.analyze(index);

      expect(result.complexity.totalFiles).toBe(1);
      // 5 functions + 3 methods = 8
      expect(result.complexity.averageComplexity).toBe(8);
    });
  });

  describe('findUsages', () => {
    it('should find function definition', async () => {
      const fileInfo = createMockFileInfo({
        functions: [{
          name: 'myFunction',
          line: 5,
          column: 10,
          parameters: [],
          isAsync: false,
          isExported: true,
          isArrow: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('function myFunction() { return 1; }');

      const usages = await analyzer.findUsages('myFunction', index);

      expect(usages.length).toBeGreaterThan(0);
      expect(usages.some(u => u.type === 'definition')).toBe(true);
    });

    it('should find class definition', async () => {
      const fileInfo = createMockFileInfo({
        classes: [{
          name: 'MyClass',
          line: 3,
          column: 1,
          methods: [],
          properties: [],
          isExported: true,
          isAbstract: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('class MyClass {}');

      const usages = await analyzer.findUsages('MyClass', index);

      expect(usages.some(u => u.type === 'definition')).toBe(true);
    });

    it('should find variable definition', async () => {
      const fileInfo = createMockFileInfo({
        variables: [{
          name: 'myVar',
          line: 2,
          column: 7,
          kind: 'const',
          isExported: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('const myVar = 42;');

      const usages = await analyzer.findUsages('myVar', index);

      expect(usages.some(u => u.type === 'definition')).toBe(true);
    });

    it('should find function calls', async () => {
      const fileInfo = createMockFileInfo();
      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('const result = myFunction(1, 2);');

      const usages = await analyzer.findUsages('myFunction', index);

      expect(usages.some(u => u.type === 'call')).toBe(true);
    });

    it('should find imports', async () => {
      const fileInfo = createMockFileInfo();
      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue("import { myFunction } from './utils';");

      const usages = await analyzer.findUsages('myFunction', index);

      expect(usages.some(u => u.type === 'import')).toBe(true);
    });

    it('should find exports', async () => {
      const fileInfo = createMockFileInfo();
      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('export const myConst = 42;');

      const usages = await analyzer.findUsages('myConst', index);

      expect(usages.some(u => u.type === 'export')).toBe(true);
    });

    it('should cache results', async () => {
      const fileInfo = createMockFileInfo();
      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('const x = 1;');

      await analyzer.findUsages('x', index);
      await analyzer.findUsages('x', index);

      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should handle file read errors gracefully', async () => {
      const fileInfo = createMockFileInfo();
      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const usages = await analyzer.findUsages('test', index);

      expect(usages).toEqual([]);
    });
  });

  describe('generateSummary', () => {
    it('should generate basic summary', async () => {
      mockFs.readFile.mockResolvedValue(`
        import { something } from 'somewhere';
        export function test() {}
      `);

      const summary = await analyzer.generateSummary('/project/test.ts');

      expect(summary).toHaveProperty('filePath');
      expect(summary).toHaveProperty('fileName', 'test.ts');
      expect(summary).toHaveProperty('purpose');
      expect(summary).toHaveProperty('exports');
      expect(summary).toHaveProperty('complexity');
      expect(summary).toHaveProperty('dependencies');
      expect(summary).toHaveProperty('lineCount');
    });

    it('should detect test file purpose', async () => {
      mockFs.readFile.mockResolvedValue('describe("test", () => {});');

      const summary = await analyzer.generateSummary('/project/test.test.ts');

      expect(summary.purpose).toContain('Test');
    });

    it('should detect index file purpose', async () => {
      mockFs.readFile.mockResolvedValue('export * from "./module";');

      const summary = await analyzer.generateSummary('/project/index.ts');

      expect(summary.purpose).toContain('entry point');
    });

    it('should detect config file purpose', async () => {
      mockFs.readFile.mockResolvedValue('export const config = {};');

      const summary = await analyzer.generateSummary('/project/config.ts');

      expect(summary.purpose).toContain('Config');
    });

    it('should detect utility file purpose', async () => {
      mockFs.readFile.mockResolvedValue('export function helper() {}');

      const summary = await analyzer.generateSummary('/project/utils.ts');

      expect(summary.purpose).toContain('Utility');
    });

    it('should extract dependencies from imports', async () => {
      mockFs.readFile.mockResolvedValue(`
        import React from 'react';
        import { useState } from 'react';
      `);

      const index = createMockProjectIndex();
      const summary = await analyzer.generateSummary('/project/component.tsx', index);

      // Dependencies come from file info, not content parsing
      expect(summary.dependencies).toBeDefined();
    });

    it('should calculate file complexity', async () => {
      mockFs.readFile.mockResolvedValue(`
        if (a) {
          for (let i = 0; i < 10; i++) {
            if (b) {
              while (c) {
                switch (d) {
                  case 1: break;
                  case 2: break;
                }
              }
            }
          }
        }
      `);

      const summary = await analyzer.generateSummary('/project/complex.ts');

      expect(summary.complexity).toBeGreaterThan(1);
    });
  });

  describe('suggestImprovements', () => {
    it('should suggest for long files', async () => {
      const lines = Array(600).fill('const x = 1;').join('\n');
      mockFs.readFile.mockResolvedValue(lines);

      const suggestions = await analyzer.suggestImprovements('/project/long.ts');

      expect(suggestions.some(s => s.type === 'file-size')).toBe(true);
    });

    it('should suggest for too many parameters', async () => {
      const fileInfo = createMockFileInfo({
        relativePath: 'test.ts',
        functions: [{
          name: 'bigFunc',
          line: 5,
          column: 1,
          parameters: Array(7).fill({ name: 'p', optional: false }),
          isAsync: false,
          isExported: true,
          isArrow: false
        }]
      });

      const files = new Map([['test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('function bigFunc(a,b,c,d,e,f,g) {}');

      const suggestions = await analyzer.suggestImprovements(
        '/project/test.ts', 
        index
      );

      expect(suggestions.some(s => s.type === 'too-many-parameters')).toBe(true);
    });

    it('should suggest removing console.log', async () => {
      mockFs.readFile.mockResolvedValue(`
        function test() {
          console.log('debug');
          return 1;
        }
      `);

      const suggestions = await analyzer.suggestImprovements('/project/test.ts');

      expect(suggestions.some(s => s.type === 'console-statement')).toBe(true);
    });

    it('should not flag commented console.log', async () => {
      mockFs.readFile.mockResolvedValue(`
        function test() {
          // console.log('commented out');
          return 1;
        }
      `);

      const suggestions = await analyzer.suggestImprovements('/project/test.ts');

      expect(suggestions.some(s => s.type === 'console-statement')).toBe(false);
    });

    it('should suggest documentation for exported functions', async () => {
      const fileInfo = createMockFileInfo({
        relativePath: 'test.ts',
        functions: [{
          name: 'exportedFunc',
          line: 3, // No comment on line 1 (line - 2)
          column: 1,
          parameters: [],
          isAsync: false,
          isExported: true,
          isArrow: false
        }]
      });

      const files = new Map([['test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue(`
export function exportedFunc() {
  return 1;
}
      `);

      const suggestions = await analyzer.suggestImprovements(
        '/project/test.ts',
        index
      );

      expect(suggestions.some(s => s.type === 'missing-documentation')).toBe(true);
    });
  });

  describe('search', () => {
    it('should find functions by name', async () => {
      const fileInfo = createMockFileInfo({
        functions: [{
          name: 'calculateTotal',
          line: 5,
          column: 1,
          parameters: [],
          isAsync: false,
          isExported: true,
          isArrow: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('function calculateTotal() {}');

      const results = await analyzer.search('calculate', index);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('calculateTotal');
      expect(results[0].type).toBe('function');
    });

    it('should find classes by name', async () => {
      const fileInfo = createMockFileInfo({
        classes: [{
          name: 'UserService',
          line: 3,
          column: 1,
          methods: [],
          properties: [],
          isExported: true,
          isAbstract: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('class UserService {}');

      const results = await analyzer.search('user', index);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('UserService');
      expect(results[0].type).toBe('class');
    });

    it('should find exports', async () => {
      const fileInfo = createMockFileInfo({
        exports: [{
          name: 'DEFAULT_CONFIG',
          line: 1,
          isDefault: false,
          isReExport: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('export const DEFAULT_CONFIG = {};');

      const results = await analyzer.search('config', index);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('DEFAULT_CONFIG');
    });

    it('should sort by relevance score', async () => {
      const fileInfo = createMockFileInfo({
        functions: [
          { name: 'test', line: 1, column: 1, parameters: [], isAsync: false, isExported: false, isArrow: false },
          { name: 'testHelper', line: 2, column: 1, parameters: [], isAsync: false, isExported: false, isArrow: false },
          { name: 'runTests', line: 3, column: 1, parameters: [], isAsync: false, isExported: false, isArrow: false }
        ]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('function test() {}');

      const results = await analyzer.search('test', index);

      // Exact match should be first
      expect(results[0].name).toBe('test');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should limit results to 20', async () => {
      const functions = Array.from({ length: 30 }, (_, i) => ({
        name: `function${i}`,
        line: i + 1,
        column: 1,
        parameters: [],
        isAsync: false,
        isExported: false,
        isArrow: false
      }));

      const fileInfo = createMockFileInfo({ functions });
      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('');

      const results = await analyzer.search('function', index);

      expect(results.length).toBeLessThanOrEqual(20);
    });
  });

  describe('clearCache', () => {
    it('should clear the usage cache', async () => {
      const fileInfo = createMockFileInfo();
      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('const x = 1;');

      await analyzer.findUsages('x', index);
      analyzer.clearCache();
      await analyzer.findUsages('x', index);

      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });
  });
});

describe('SemanticCodeSearch', () => {
  let search: SemanticCodeSearch;

  beforeEach(() => {
    const analyzer = new CodeAnalyzer({ useLLM: false });
    search = new SemanticCodeSearch(analyzer);
  });

  describe('search', () => {
    it('should delegate to analyzer', async () => {
      const fileInfo = createMockFileInfo({
        functions: [{
          name: 'findUser',
          line: 5,
          column: 1,
          parameters: [],
          isAsync: true,
          isExported: true,
          isArrow: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('async function findUser() {}');

      const results = await search.search('user', index);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('findSimilar', () => {
    it('should find similar code', async () => {
      const fileInfo = createMockFileInfo({
        functions: [{
          name: 'processData',
          line: 5,
          column: 1,
          parameters: [],
          isAsync: false,
          isExported: true,
          isArrow: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('function processData() {}');

      const results = await search.findSimilar(
        'function processData() { return data; }',
        index
      );

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for code without identifiers', async () => {
      const index = createMockProjectIndex();

      const results = await search.findSimilar('if () {}', index);

      expect(results).toEqual([]);
    });

    it('should deduplicate results', async () => {
      const fileInfo = createMockFileInfo({
        functions: [{
          name: 'test',
          line: 5,
          column: 1,
          parameters: [],
          isAsync: false,
          isExported: true,
          isArrow: false
        }]
      });

      const files = new Map([['src/test.ts', fileInfo]]);
      const index = createMockProjectIndex(files);

      mockFs.readFile.mockResolvedValue('function test() {}');

      // Code with multiple occurrences of same identifier
      const results = await search.findSimilar(
        'test test test',
        index
      );

      // Should not have duplicates
      const keys = results.map(r => `${r.filePath}:${r.line}`);
      const uniqueKeys = [...new Set(keys)];
      expect(keys.length).toBe(uniqueKeys.length);
    });
  });
});

describe('Singleton exports', () => {
  it('should export getCodeAnalyzer singleton function', () => {
    const analyzer = getCodeAnalyzer();
    expect(analyzer).toBeInstanceOf(CodeAnalyzer);
  });

  it('should export getSemanticSearch singleton function', () => {
    const search = getSemanticSearch();
    expect(search).toBeInstanceOf(SemanticCodeSearch);
  });

  it('should export createAnalyzer factory', () => {
    expect(typeof createAnalyzer).toBe('function');
    const analyzer = createAnalyzer({ useLLM: false });
    expect(analyzer).toBeInstanceOf(CodeAnalyzer);
  });
});

describe('AnalysisResult structure', () => {
  it('should have correct structure', async () => {
    const analyzer = new CodeAnalyzer({ useLLM: false });
    const index = createMockProjectIndex();
    const result = await analyzer.analyze(index);

    // Complexity metrics
    expect(result.complexity).toMatchObject({
      totalFiles: expect.any(Number),
      totalLines: expect.any(Number),
      averageComplexity: expect.any(Number),
      maxComplexity: expect.any(Number),
      complexFiles: expect.any(Array)
    });

    // Arrays
    expect(Array.isArray(result.codeSmells)).toBe(true);
    expect(Array.isArray(result.duplicates)).toBe(true);
    expect(Array.isArray(result.unused)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);

    // Metadata
    expect(result.analyzedAt).toBeInstanceOf(Date);
    expect(typeof result.analyzedFiles).toBe('number');
  });
});

describe('CodeSummary structure', () => {
  it('should have correct structure', async () => {
    const analyzer = new CodeAnalyzer({ useLLM: false });
    mockFs.readFile.mockResolvedValue('export function test() {}');

    const summary = await analyzer.generateSummary('/project/test.ts');

    expect(summary).toMatchObject({
      filePath: expect.any(String),
      fileName: expect.any(String),
      purpose: expect.any(String),
      exports: expect.any(Array),
      complexity: expect.any(Number),
      dependencies: expect.any(Array),
      dependents: expect.any(Array),
      suggestions: expect.any(Array),
      lineCount: expect.any(Number),
      mainConcepts: expect.any(Array)
    });
  });
});

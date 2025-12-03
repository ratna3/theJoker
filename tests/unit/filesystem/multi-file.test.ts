/**
 * Tests for Multi-File Operations (Phase 16)
 */

import {
  MultiFileOperator,
  createMultiFileOperator,
  getMultiFileOperator,
  multiFileOps,
  type BatchCreationResult,
  type FileCreationRequest,
  type RefactorResult,
  type FileChange,
  type ImportAnalysis,
  type ConsistencyCheckResult,
  type MultiFileOptions
} from '../../../src/filesystem/multi-file';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Test helpers
let testDir: string;
let tempFiles: string[] = [];

beforeAll(async () => {
  // Create a temporary directory for tests
  testDir = path.join(os.tmpdir(), 'multifile-test-' + Date.now());
  await fs.mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  // Clean up test directory
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
});

beforeEach(async () => {
  tempFiles = [];
});

afterEach(async () => {
  // Clean up any files created during tests
  for (const file of tempFiles) {
    try {
      await fs.unlink(file);
    } catch (e) {
      // Ignore if already deleted
    }
  }
});

// Helper function to create a test file
async function createTestFile(name: string, content: string): Promise<string> {
  const filePath = path.join(testDir, name);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  tempFiles.push(filePath);
  return filePath;
}

// Helper to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('MultiFileOperator', () => {
  let operator: MultiFileOperator;

  beforeEach(() => {
    operator = createMultiFileOperator({ basePath: testDir });
  });

  describe('createBatch', () => {
    it('should create multiple files at once', async () => {
      const files: FileCreationRequest[] = [
        { path: 'batch1.txt', content: 'Content 1' },
        { path: 'batch2.txt', content: 'Content 2' },
        { path: 'batch3.txt', content: 'Content 3' }
      ];

      // Track for cleanup
      files.forEach(f => tempFiles.push(path.join(testDir, f.path)));

      const result = await operator.createBatch(files);

      expect(result.success).toBe(true);
      expect(result.created.length).toBe(3);
      expect(result.failed.length).toBe(0);
      
      // Verify files were created
      for (const file of files) {
        const fullPath = path.join(testDir, file.path);
        const exists = await fileExists(fullPath);
        expect(exists).toBe(true);
        const content = await fs.readFile(fullPath, 'utf-8');
        expect(content).toBe(file.content);
      }
    });

    it('should create directories if they do not exist', async () => {
      const nestedFile = 'nested/dir/file.txt';
      tempFiles.push(path.join(testDir, nestedFile));

      const result = await operator.createBatch([
        { path: nestedFile, content: 'Nested content' }
      ]);

      expect(result.success).toBe(true);
      expect(await fileExists(path.join(testDir, nestedFile))).toBe(true);
    });

    it('should skip files that already exist without overwrite flag', async () => {
      const existingFile = await createTestFile('existing.txt', 'Original');
      const relativePath = path.relative(testDir, existingFile);

      const result = await operator.createBatch([
        { path: relativePath, content: 'New content', overwrite: false }
      ]);

      expect(result.skipped.length).toBe(1);
      
      // Original content should be preserved
      const content = await fs.readFile(existingFile, 'utf-8');
      expect(content).toBe('Original');
    });

    it('should overwrite files when overwrite flag is set', async () => {
      const existingFile = await createTestFile('overwrite.txt', 'Original');
      const relativePath = path.relative(testDir, existingFile);

      const result = await operator.createBatch([
        { path: relativePath, content: 'New content', overwrite: true }
      ]);

      expect(result.success).toBe(true);
      const content = await fs.readFile(existingFile, 'utf-8');
      expect(content).toBe('New content');
    });

    it('should handle empty file array', async () => {
      const result = await operator.createBatch([]);

      expect(result.success).toBe(true);
      expect(result.created.length).toBe(0);
    });

    it('should respect dryRun option', async () => {
      const dryRunOperator = createMultiFileOperator({ basePath: testDir, dryRun: true });
      const newFile = 'dryrun.txt';

      const result = await dryRunOperator.createBatch([
        { path: newFile, content: 'Dry run content' }
      ]);

      expect(result.success).toBe(true);
      // File should not actually be created in dry run
      expect(await fileExists(path.join(testDir, newFile))).toBe(false);
    });
  });

  describe('createFromTemplate', () => {
    it('should create files from template with variable substitution', async () => {
      const template = {
        'src/index.ts': 'export const name = "{{PROJECT_NAME}}";',
        'package.json': '{"name": "{{PROJECT_NAME}}", "version": "1.0.0"}'
      };

      const targetDir = path.join(testDir, 'template-project');
      tempFiles.push(path.join(targetDir, 'src/index.ts'));
      tempFiles.push(path.join(targetDir, 'package.json'));

      const result = await operator.createFromTemplate(
        template,
        targetDir,
        { PROJECT_NAME: 'my-project' }
      );

      expect(result.success).toBe(true);
      
      const indexContent = await fs.readFile(path.join(targetDir, 'src/index.ts'), 'utf-8');
      expect(indexContent).toContain('my-project');
      
      const pkgContent = await fs.readFile(path.join(targetDir, 'package.json'), 'utf-8');
      expect(pkgContent).toContain('"name": "my-project"');

      // Cleanup
      await fs.rm(targetDir, { recursive: true, force: true });
    });
  });

  describe('addImport', () => {
    it('should add an import to a file', async () => {
      const file = await createTestFile('add-import.ts', `
const x = 1;
export default x;
`);

      const change = await operator.addImport(
        file,
        'lodash',
        ['map', 'filter']
      );

      expect(change).not.toBeNull();
      const content = await fs.readFile(file, 'utf-8');
      expect(content).toContain("import { map, filter } from 'lodash'");
    });

    it('should add a default import', async () => {
      const file = await createTestFile('add-default-import.ts', `
const x = 1;
`);

      const change = await operator.addImport(
        file,
        'lodash',
        ['_'],
        { isDefault: true }
      );

      expect(change).not.toBeNull();
      const content = await fs.readFile(file, 'utf-8');
      expect(content).toContain("import _ from 'lodash'");
    });
  });

  describe('removeImport', () => {
    it('should remove an entire import statement', async () => {
      const file = await createTestFile('remove-import.ts', `
import { map } from 'lodash';
import { something } from './local';

const x = something();
`);

      const change = await operator.removeImport(file, 'lodash');

      expect(change).not.toBeNull();
      const content = await fs.readFile(file, 'utf-8');
      expect(content).not.toContain('lodash');
      expect(content).toContain('./local');
    });
  });

  describe('organizeImports', () => {
    it('should organize imports in a file', async () => {
      const file = await createTestFile('messy-imports.ts', `
import { z } from 'z-lib';
import { a } from './local/a';
import fs from 'fs';
import { b } from './local/b';
import path from 'path';
import { x } from 'x-lib';

const test = 1;
`);

      const change = await operator.organizeImports(file);

      expect(change).not.toBeNull();
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      // Find import lines
      const importLines = lines.filter(l => l.startsWith('import'));
      expect(importLines.length).toBeGreaterThan(0);
    });

    it('should handle file with no imports', async () => {
      const file = await createTestFile('no-imports.ts', `
const test = 1;
export default test;
`);

      const change = await operator.organizeImports(file);
      expect(change).toBeNull(); // No changes needed
    });
  });

  describe('analyzeImports', () => {
    it('should analyze imports in a file', async () => {
      const file = await createTestFile('analyze-imports.ts', `
import { map } from 'lodash';
import { something } from './local';
import { map } from 'lodash';

const x = something();
`);

      const analysis = await operator.analyzeImports(file);

      expect(analysis.filePath).toBe(file);
      expect(analysis.imports.length).toBeGreaterThan(0);
      expect(analysis.duplicateImports.length).toBeGreaterThan(0);
    });
  });
});

describe('Singleton Instances', () => {
  describe('multiFileOps', () => {
    it('should be a valid MultiFileOperator instance', () => {
      expect(multiFileOps).toBeInstanceOf(MultiFileOperator);
    });

    it('should have createBatch method', () => {
      expect(typeof multiFileOps.createBatch).toBe('function');
    });

    it('should have import management methods', () => {
      expect(typeof multiFileOps.addImport).toBe('function');
      expect(typeof multiFileOps.removeImport).toBe('function');
      expect(typeof multiFileOps.organizeImports).toBe('function');
      expect(typeof multiFileOps.analyzeImports).toBe('function');
    });
  });
});

describe('Factory Functions', () => {
  describe('createMultiFileOperator', () => {
    it('should create a new MultiFileOperator instance', () => {
      const operator = createMultiFileOperator();
      expect(operator).toBeInstanceOf(MultiFileOperator);
    });

    it('should create independent instances', () => {
      const operator1 = createMultiFileOperator();
      const operator2 = createMultiFileOperator();
      expect(operator1).not.toBe(operator2);
    });

    it('should accept options', () => {
      const options: MultiFileOptions = {
        basePath: testDir,
        dryRun: true,
        backup: false
      };
      const operator = createMultiFileOperator(options);
      expect(operator).toBeInstanceOf(MultiFileOperator);
    });
  });

  describe('getMultiFileOperator', () => {
    it('should return singleton instance', () => {
      const instance1 = getMultiFileOperator();
      const instance2 = getMultiFileOperator();
      expect(instance1).toBe(instance2);
    });
  });
});

describe('BatchCreationResult Interface', () => {
  it('should have proper structure from batch operations', async () => {
    const operator = createMultiFileOperator({ basePath: testDir });
    tempFiles.push(path.join(testDir, 'batch-result-test.txt'));

    const result = await operator.createBatch([
      { path: 'batch-result-test.txt', content: 'test' }
    ]);

    // Verify BatchCreationResult structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('failed');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('totalTime');

    expect(typeof result.success).toBe('boolean');
    expect(Array.isArray(result.created)).toBe(true);
    expect(Array.isArray(result.failed)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
    expect(typeof result.totalTime).toBe('number');
  });
});

describe('Edge Cases', () => {
  describe('MultiFileOperator edge cases', () => {
    it('should handle special characters in file names', async () => {
      const operator = createMultiFileOperator({ basePath: testDir });
      const specialFile = 'file with spaces.txt';
      tempFiles.push(path.join(testDir, specialFile));

      const result = await operator.createBatch([
        { path: specialFile, content: 'Special content' }
      ]);

      expect(result.success).toBe(true);
      expect(await fileExists(path.join(testDir, specialFile))).toBe(true);
    });

    it('should handle empty content', async () => {
      const operator = createMultiFileOperator({ basePath: testDir });
      const emptyFile = 'empty.txt';
      tempFiles.push(path.join(testDir, emptyFile));

      const result = await operator.createBatch([
        { path: emptyFile, content: '' }
      ]);

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(testDir, emptyFile), 'utf-8');
      expect(content).toBe('');
    });

    it('should handle large content', async () => {
      const operator = createMultiFileOperator({ basePath: testDir });
      const largeContent = 'x'.repeat(1024 * 100); // 100KB
      const largeFile = 'large.txt';
      tempFiles.push(path.join(testDir, largeFile));

      const result = await operator.createBatch([
        { path: largeFile, content: largeContent }
      ]);

      expect(result.success).toBe(true);
    });

    it('should handle deeply nested paths', async () => {
      const operator = createMultiFileOperator({ basePath: testDir });
      const deepPath = 'a/b/c/d/e/f/g/deep.txt';
      tempFiles.push(path.join(testDir, deepPath));

      const result = await operator.createBatch([
        { path: deepPath, content: 'Deep content' }
      ]);

      expect(result.success).toBe(true);
      expect(await fileExists(path.join(testDir, deepPath))).toBe(true);
    });
  });

  describe('Import management edge cases', () => {
    it('should handle empty file for organizeImports', async () => {
      const operator = createMultiFileOperator({ basePath: testDir });
      const emptyFile = await createTestFile('empty-imports.ts', '');

      const change = await operator.organizeImports(emptyFile);
      expect(change).toBeNull();
    });

    it('should handle file with only comments', async () => {
      const operator = createMultiFileOperator({ basePath: testDir });
      const commentFile = await createTestFile('comments-only.ts', `
// This is a comment
/* Multi-line
   comment */
`);

      const change = await operator.organizeImports(commentFile);
      expect(change).toBeNull();
    });
  });
});

describe('Concurrent Operations', () => {
  it('should handle multiple concurrent batch operations', async () => {
    const operator = createMultiFileOperator({ basePath: testDir });
    
    const files1: FileCreationRequest[] = [
      { path: 'concurrent1.txt', content: 'Content 1' }
    ];
    const files2: FileCreationRequest[] = [
      { path: 'concurrent2.txt', content: 'Content 2' }
    ];
    const files3: FileCreationRequest[] = [
      { path: 'concurrent3.txt', content: 'Content 3' }
    ];

    tempFiles.push(path.join(testDir, 'concurrent1.txt'));
    tempFiles.push(path.join(testDir, 'concurrent2.txt'));
    tempFiles.push(path.join(testDir, 'concurrent3.txt'));

    const [result1, result2, result3] = await Promise.all([
      operator.createBatch(files1),
      operator.createBatch(files2),
      operator.createBatch(files3)
    ]);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result3.success).toBe(true);
  });
});

describe('Performance', () => {
  it('should handle batch creation of many files efficiently', async () => {
    const operator = createMultiFileOperator({ basePath: testDir });
    const count = 50;
    const files: FileCreationRequest[] = Array.from({ length: count }, (_, i) => ({
      path: `perf-${i}.txt`,
      content: `Content ${i}`
    }));

    files.forEach(f => tempFiles.push(path.join(testDir, f.path)));

    const startTime = Date.now();
    const result = await operator.createBatch(files);
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.created.length).toBe(count);
    // Should complete in reasonable time (less than 10 seconds for 50 files)
    expect(duration).toBeLessThan(10000);
  });
});

describe('Event Emission', () => {
  it('should emit events during batch operations', async () => {
    const operator = createMultiFileOperator({ basePath: testDir });
    const events: string[] = [];

    operator.on('batchStart', () => events.push('batchStart'));
    operator.on('fileCreated', () => events.push('fileCreated'));
    operator.on('batchComplete', () => events.push('batchComplete'));

    tempFiles.push(path.join(testDir, 'events-test.txt'));
    await operator.createBatch([{ path: 'events-test.txt', content: 'test' }]);

    expect(events).toContain('batchStart');
    expect(events).toContain('fileCreated');
    expect(events).toContain('batchComplete');
  });
});

describe('Backup Functionality', () => {
  it('should create backups when overwriting files', async () => {
    const operator = createMultiFileOperator({ basePath: testDir, backup: true });
    const existingFile = await createTestFile('backup-test.txt', 'Original');
    const relativePath = path.relative(testDir, existingFile);

    await operator.createBatch([
      { path: relativePath, content: 'New content', overwrite: true }
    ]);

    // Verify new content
    const content = await fs.readFile(existingFile, 'utf-8');
    expect(content).toBe('New content');

    // Check for backup directory
    const backupDir = path.join(testDir, '.backups');
    const backupExists = await fileExists(backupDir);
    expect(backupExists).toBe(true);

    // Cleanup backup dir
    try {
      await fs.rm(backupDir, { recursive: true, force: true });
    } catch {}
  });
});

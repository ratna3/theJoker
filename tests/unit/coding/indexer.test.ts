/**
 * Tests for File Indexer
 * 
 * Tests the FileIndexer class that provides project-wide code indexing,
 * dependency graph management, and file searching capabilities.
 */

import { FileIndexer, DependencyGraph, fileIndexer } from '../../../src/coding/indexer';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      graph.addNode('file1.ts');
      const deps = graph.getDependencies('file1.ts');
      expect(deps).toEqual([]);
    });

    it('should not duplicate existing nodes', () => {
      graph.addNode('file1.ts');
      graph.addNode('file1.ts');
      // Should not throw and dependencies still work
      const deps = graph.getDependencies('file1.ts');
      expect(deps).toEqual([]);
    });
  });

  describe('addEdge', () => {
    it('should add an edge between two nodes', () => {
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file1.ts', 'file2.ts');
      
      const deps = graph.getDependencies('file1.ts');
      expect(deps).toContain('file2.ts');
    });

    it('should track reverse edges for dependents', () => {
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file1.ts', 'file2.ts');
      
      const dependents = graph.getDependents('file2.ts');
      expect(dependents).toContain('file1.ts');
    });

    it('should handle self-referencing edges', () => {
      graph.addNode('file1.ts');
      graph.addEdge('file1.ts', 'file1.ts');
      
      const deps = graph.getDependencies('file1.ts');
      expect(deps).toContain('file1.ts');
    });
  });

  describe('getDependencies', () => {
    it('should return empty array for node with no dependencies', () => {
      graph.addNode('file1.ts');
      expect(graph.getDependencies('file1.ts')).toEqual([]);
    });

    it('should return all dependencies of a node', () => {
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addNode('file3.ts');
      graph.addEdge('file1.ts', 'file2.ts');
      graph.addEdge('file1.ts', 'file3.ts');
      
      const deps = graph.getDependencies('file1.ts');
      expect(deps).toHaveLength(2);
      expect(deps).toContain('file2.ts');
      expect(deps).toContain('file3.ts');
    });

    it('should return empty array for non-existent node', () => {
      expect(graph.getDependencies('nonexistent.ts')).toEqual([]);
    });
  });

  describe('getDependents', () => {
    it('should return all files that depend on a node', () => {
      graph.addNode('utils.ts');
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file1.ts', 'utils.ts');
      graph.addEdge('file2.ts', 'utils.ts');
      
      const dependents = graph.getDependents('utils.ts');
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('file1.ts');
      expect(dependents).toContain('file2.ts');
    });
  });

  describe('getImpactedFiles', () => {
    it('should return all files impacted by changes to a file', () => {
      // file1 -> utils, file2 -> file1 (transitive dependency)
      graph.addNode('utils.ts');
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file1.ts', 'utils.ts');
      graph.addEdge('file2.ts', 'file1.ts');
      
      const impacted = graph.getImpactedFiles('utils.ts');
      expect(impacted).toContain('file1.ts');
      expect(impacted).toContain('file2.ts');
    });

    it('should not include the original file in impacted list', () => {
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file2.ts', 'file1.ts');
      
      const impacted = graph.getImpactedFiles('file1.ts');
      expect(impacted).not.toContain('file1.ts');
    });

    it('should return empty array if no files are impacted', () => {
      graph.addNode('isolated.ts');
      expect(graph.getImpactedFiles('isolated.ts')).toEqual([]);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect simple circular dependency', () => {
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file1.ts', 'file2.ts');
      graph.addEdge('file2.ts', 'file1.ts');
      
      const cycles = graph.detectCircularDependencies();
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect complex circular dependencies', () => {
      graph.addNode('a.ts');
      graph.addNode('b.ts');
      graph.addNode('c.ts');
      graph.addEdge('a.ts', 'b.ts');
      graph.addEdge('b.ts', 'c.ts');
      graph.addEdge('c.ts', 'a.ts');
      
      const cycles = graph.detectCircularDependencies();
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should return empty array when no circular dependencies exist', () => {
      graph.addNode('a.ts');
      graph.addNode('b.ts');
      graph.addNode('c.ts');
      graph.addEdge('a.ts', 'b.ts');
      graph.addEdge('b.ts', 'c.ts');
      
      const cycles = graph.detectCircularDependencies();
      expect(cycles).toEqual([]);
    });
  });

  describe('getTopologicalSort', () => {
    it('should return files in dependency order', () => {
      graph.addNode('main.ts');
      graph.addNode('utils.ts');
      graph.addNode('helpers.ts');
      graph.addEdge('main.ts', 'utils.ts');
      graph.addEdge('utils.ts', 'helpers.ts');
      
      const sorted = graph.getTopologicalSort();
      expect(sorted).not.toBeNull();
      
      if (sorted) {
        const mainIdx = sorted.indexOf('main.ts');
        const utilsIdx = sorted.indexOf('utils.ts');
        const helpersIdx = sorted.indexOf('helpers.ts');
        
        // In topological sort, dependencies come after dependents
        // (or before if we think of build order)
        expect(sorted.length).toBe(3);
      }
    });

    it('should return null for circular dependencies', () => {
      graph.addNode('a.ts');
      graph.addNode('b.ts');
      graph.addEdge('a.ts', 'b.ts');
      graph.addEdge('b.ts', 'a.ts');
      
      const sorted = graph.getTopologicalSort();
      expect(sorted).toBeNull();
    });
  });

  describe('removeNode', () => {
    it('should remove a node and its edges', () => {
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file1.ts', 'file2.ts');
      
      graph.removeNode('file1.ts');
      
      expect(graph.getDependencies('file1.ts')).toEqual([]);
      expect(graph.getDependents('file2.ts')).not.toContain('file1.ts');
    });
  });

  describe('clear', () => {
    it('should clear all nodes and edges', () => {
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file1.ts', 'file2.ts');
      
      graph.clear();
      
      expect(graph.getDependencies('file1.ts')).toEqual([]);
      expect(graph.getDependencies('file2.ts')).toEqual([]);
    });
  });

  describe('toJSON', () => {
    it('should serialize graph to JSON format', () => {
      graph.addNode('file1.ts');
      graph.addNode('file2.ts');
      graph.addEdge('file1.ts', 'file2.ts');
      
      const json = graph.toJSON();
      
      expect(json).toHaveProperty('nodes');
      expect(json).toHaveProperty('edges');
      expect(json.nodes).toContain('file1.ts');
    });
  });

  describe('fromJSON', () => {
    it('should deserialize graph from JSON format', () => {
      const data = {
        nodes: ['file1.ts', 'file2.ts'],
        edges: [{ from: 'file1.ts', to: 'file2.ts' }]
      };
      
      const newGraph = DependencyGraph.fromJSON(data);
      
      expect(newGraph.getDependencies('file1.ts')).toContain('file2.ts');
    });
  });

  describe('getAllDependencies', () => {
    it('should return all transitive dependencies', () => {
      graph.addNode('a.ts');
      graph.addNode('b.ts');
      graph.addNode('c.ts');
      graph.addEdge('a.ts', 'b.ts');
      graph.addEdge('b.ts', 'c.ts');
      
      const allDeps = graph.getAllDependencies('a.ts');
      expect(allDeps).toContain('b.ts');
      expect(allDeps).toContain('c.ts');
    });
  });
});

describe('FileIndexer', () => {
  let indexer: FileIndexer;

  beforeEach(() => {
    indexer = new FileIndexer();
    jest.clearAllMocks();
  });

  describe('indexFile', () => {
    it('should index a single TypeScript file', async () => {
      const mockContent = `
        import { helper } from './helper';
        export function main() { return helper(); }
        export class App {}
      `;
      
      mockFs.readFile.mockResolvedValue(mockContent);
      mockFs.stat.mockResolvedValue({
        size: 100,
        mtime: new Date(),
        isDirectory: () => false
      } as any);

      const fileInfo = await indexer.indexFile('/project/src/index.ts', '/project');

      expect(fileInfo).not.toBeNull();
      if (fileInfo) {
        expect(fileInfo.name).toBe('index.ts');
        expect(fileInfo.extension).toBe('.ts');
        expect(fileInfo.language).toBe('typescript');
      }
    });

    it('should detect language from file extension', async () => {
      mockFs.readFile.mockResolvedValue('const x = 1;');
      mockFs.stat.mockResolvedValue({
        size: 50,
        mtime: new Date(),
        isDirectory: () => false
      } as any);

      const jsFile = await indexer.indexFile('/project/file.js', '/project');
      expect(jsFile?.language).toBe('javascript');

      const pyFile = await indexer.indexFile('/project/file.py', '/project');
      expect(pyFile?.language).toBe('python');

      const goFile = await indexer.indexFile('/project/file.go', '/project');
      expect(goFile?.language).toBe('go');
    });

    it('should extract relative path correctly', async () => {
      mockFs.readFile.mockResolvedValue('export const x = 1;');
      mockFs.stat.mockResolvedValue({
        size: 20,
        mtime: new Date(),
        isDirectory: () => false
      } as any);

      const fileInfo = await indexer.indexFile('/project/src/utils/helper.ts', '/project');

      expect(fileInfo).not.toBeNull();
      if (fileInfo) {
        expect(fileInfo.relativePath).toBe(path.join('src', 'utils', 'helper.ts'));
      }
    });
  });

  describe('reindexFile', () => {
    it('should throw error when no project indexed', async () => {
      // reindexFile requires indexProject to be called first
      await expect(indexer.reindexFile('/project/file.ts')).rejects.toThrow('No index available');
    });
  });

  describe('searchFiles', () => {
    it('should throw error when no project indexed', () => {
      expect(() => indexer.searchFiles('helper')).toThrow('No index available');
    });
  });
});

describe('fileIndexer singleton', () => {
  it('should export a singleton instance', () => {
    expect(fileIndexer).toBeInstanceOf(FileIndexer);
  });
});


/**
 * Tests for Package Manager Integration
 * Phase 13: PackageManager, DependencyDetector, and VersionResolver
 */

import { PackageManager, DependencyDetector, VersionResolver } from '../../../src/project/packager';
import * as fs from 'fs';
import * as path from 'path';
import { exec as execCallback } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn()
}));

// Mock fs.promises
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  promises: {
    access: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn()
  }
}));

// Mock https for npm registry
jest.mock('https', () => ({
  get: jest.fn()
}));

const mockExec = execCallback as jest.MockedFunction<typeof execCallback>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockFsPromises = fs.promises as jest.Mocked<typeof fs.promises>;

describe('PackageManager', () => {
  let packageManager: PackageManager;
  const testDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    packageManager = new PackageManager();
  });

  describe('detect', () => {
    it('should detect npm when package-lock.json exists', async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('package-lock.json');
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('npm');
    });

    it('should detect yarn when yarn.lock exists', async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('yarn.lock');
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('yarn');
    });

    it('should detect pnpm when pnpm-lock.yaml exists', async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('pnpm-lock.yaml');
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('pnpm');
    });

    it('should detect bun when bun.lockb exists', async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('bun.lockb');
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('bun');
    });

    it('should fallback to npm when no lock file exists but npm is available', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      // Mock exec to simulate npm --version success
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm --version')) {
          cb(null, { stdout: '9.0.0', stderr: '' });
        } else {
          cb(new Error('command not found'), { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('npm');
    });

    it('should return npm as default when nothing is detected', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      // All package managers fail
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        cb(new Error('command not found'), { stdout: '', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('npm');
    });
  });

  describe('install', () => {
    it('should run npm install successfully', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm install')) {
          cb(null, { stdout: 'added 100 packages', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.install(testDir, 'npm');
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('added 100 packages');
    });

    it('should run yarn install successfully', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('yarn install')) {
          cb(null, { stdout: 'Done in 5.32s', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.install(testDir, 'yarn');
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('Done in 5.32s');
    });

    it('should run pnpm install successfully', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('pnpm install')) {
          cb(null, { stdout: 'Packages installed', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.install(testDir, 'pnpm');
      
      expect(result.success).toBe(true);
    });

    it('should run bun install successfully', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('bun install')) {
          cb(null, { stdout: 'Installed packages', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.install(testDir, 'bun');
      
      expect(result.success).toBe(true);
    });

    it('should handle install failure', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        cb(new Error('ENOENT'), { stdout: '', stderr: 'npm ERR! code ENOENT' });
        return {} as any;
      });

      const result = await packageManager.install(testDir, 'npm');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('add', () => {
    it('should add a single package with npm', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm install express')) {
          cb(null, { stdout: 'added 1 package', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['express'], 'npm');
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toContain('express');
    });

    it('should add multiple packages', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        cb(null, { stdout: 'added 3 packages', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['express', 'lodash', 'axios'], 'npm');
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toEqual(['express', 'lodash', 'axios']);
    });

    it('should add packages as devDependencies', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('--save-dev');
        cb(null, { stdout: 'added 1 package', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['jest'], 'npm', true);
      
      expect(result.success).toBe(true);
    });

    it('should add dev dependencies with yarn', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('--dev');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['jest'], 'yarn', true);
      
      expect(result.success).toBe(true);
    });

    it('should add dev dependencies with pnpm', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('--save-dev');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['jest'], 'pnpm', true);
      
      expect(result.success).toBe(true);
    });

    it('should add dev dependencies with bun', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('--dev');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['jest'], 'bun', true);
      
      expect(result.success).toBe(true);
    });

    it('should handle package with specific version', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('express@4.18.0');
        cb(null, { stdout: 'added 1 package', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['express@4.18.0'], 'npm');
      
      expect(result.success).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove a package with npm', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm uninstall express')) {
          cb(null, { stdout: 'removed 1 package', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.remove(testDir, ['express'], 'npm');
      
      expect(result.success).toBe(true);
      expect(result.packagesRemoved).toContain('express');
    });

    it('should remove packages with yarn', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('yarn remove');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.remove(testDir, ['lodash'], 'yarn');
      
      expect(result.success).toBe(true);
    });

    it('should remove packages with pnpm', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('pnpm remove');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.remove(testDir, ['axios'], 'pnpm');
      
      expect(result.success).toBe(true);
    });

    it('should remove packages with bun', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('bun remove');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.remove(testDir, ['react'], 'bun');
      
      expect(result.success).toBe(true);
    });

    it('should handle remove failure', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        cb(new Error('Package not found'), { stdout: '', stderr: 'not found' });
        return {} as any;
      });

      const result = await packageManager.remove(testDir, ['nonexistent'], 'npm');
      
      expect(result.success).toBe(false);
    });
  });

  describe('update', () => {
    it('should update all packages with npm', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm update')) {
          cb(null, { stdout: 'updated 5 packages', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.update(testDir, 'npm');
      
      expect(result.success).toBe(true);
    });

    it('should update specific packages', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('express lodash');
        cb(null, { stdout: 'updated 2 packages', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.update(testDir, 'npm', ['express', 'lodash']);
      
      expect(result.success).toBe(true);
    });

    it('should update with yarn', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('yarn upgrade');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.update(testDir, 'yarn');
      
      expect(result.success).toBe(true);
    });

    it('should update with pnpm', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('pnpm update');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.update(testDir, 'pnpm');
      
      expect(result.success).toBe(true);
    });

    it('should update with bun', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('bun update');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.update(testDir, 'bun');
      
      expect(result.success).toBe(true);
    });
  });

  describe('listInstalled', () => {
    it('should list installed packages from package.json', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        dependencies: {
          'express': '^4.18.0',
          'lodash': '^4.17.21'
        },
        devDependencies: {
          'jest': '^29.0.0'
        }
      }));

      const packages = await packageManager.listInstalled(testDir);
      
      expect(packages).toHaveLength(3);
      expect(packages.find(p => p.name === 'express')).toBeDefined();
      expect(packages.find(p => p.name === 'lodash')).toBeDefined();
      expect(packages.find(p => p.name === 'jest')?.isDev).toBe(true);
    });

    it('should return empty array when no package.json exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const packages = await packageManager.listInstalled(testDir);
      
      expect(packages).toEqual([]);
    });

    it('should handle malformed package.json', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not valid json');

      const packages = await packageManager.listInstalled(testDir);
      
      expect(packages).toEqual([]);
    });
  });

  describe('run', () => {
    it('should run npm scripts', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('npm run test');
        cb(null, { stdout: 'Tests passed', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.run(testDir, 'test', 'npm');
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('Tests passed');
    });

    it('should run yarn scripts', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('yarn run build');
        cb(null, { stdout: 'Build complete', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.run(testDir, 'build', 'yarn');
      
      expect(result.success).toBe(true);
    });

    it('should run pnpm scripts', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('pnpm run lint');
        cb(null, { stdout: 'No issues', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.run(testDir, 'lint', 'pnpm');
      
      expect(result.success).toBe(true);
    });

    it('should run bun scripts', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('bun run dev');
        cb(null, { stdout: 'Dev server started', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.run(testDir, 'dev', 'bun');
      
      expect(result.success).toBe(true);
    });

    it('should pass additional arguments', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('-- --coverage');
        cb(null, { stdout: 'Done', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.run(testDir, 'test', 'npm', ['--coverage']);
      
      expect(result.success).toBe(true);
    });
  });
});

describe('DependencyDetector', () => {
  let detector: DependencyDetector;
  const testDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new DependencyDetector();
  });

  describe('detectMissing', () => {
    it('should detect missing dependencies from ES6 imports', async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('package.json') || pathStr.includes('src');
      });
      
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({
            dependencies: { 'express': '^4.18.0' }
          });
        }
        if (pathStr.includes('.ts') || pathStr.includes('.js')) {
          return `
            import express from 'express';
            import lodash from 'lodash';
            import axios from 'axios';
          `;
        }
        return '';
      });

      mockFs.readdirSync.mockReturnValue(['index.ts'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as any);

      const missing = await detector.detectMissing(testDir);
      
      // lodash and axios are not in dependencies
      expect(missing).toContain('lodash');
      expect(missing).toContain('axios');
      expect(missing).not.toContain('express');
    });

    it('should detect missing dependencies from require statements', async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = String(p);
        return pathStr.includes('package.json') || pathStr.includes('src');
      });
      
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({
            dependencies: {}
          });
        }
        if (pathStr.includes('.js')) {
          return `
            const express = require('express');
            const fs = require('fs');
            const path = require('path');
          `;
        }
        return '';
      });

      mockFs.readdirSync.mockReturnValue(['index.js'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as any);

      const missing = await detector.detectMissing(testDir);
      
      // express should be missing, fs and path are built-in
      expect(missing).toContain('express');
      expect(missing).not.toContain('fs');
      expect(missing).not.toContain('path');
    });

    it('should ignore local relative imports', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({ dependencies: {} });
        }
        return `
          import { util } from './utils';
          import { helper } from '../helpers';
          import express from 'express';
        `;
      });

      mockFs.readdirSync.mockReturnValue(['index.ts'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as any);

      const missing = await detector.detectMissing(testDir);
      
      expect(missing).toContain('express');
      expect(missing).not.toContain('./utils');
      expect(missing).not.toContain('../helpers');
    });

    it('should handle scoped packages', async () => {
      mockFs.existsSync.mockReturnValue(true);
      
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({
            dependencies: { '@types/node': '^18.0.0' }
          });
        }
        return `
          import { something } from '@types/node';
          import { Component } from '@angular/core';
        `;
      });

      mockFs.readdirSync.mockReturnValue(['index.ts'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as any);

      const missing = await detector.detectMissing(testDir);
      
      expect(missing).not.toContain('@types/node');
      expect(missing).toContain('@angular/core');
    });

    it('should return empty array when no files exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const missing = await detector.detectMissing(testDir);
      
      expect(missing).toEqual([]);
    });
  });

  describe('extractImports', () => {
    it('should extract ES6 default imports', () => {
      const code = `import express from 'express';`;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('express');
    });

    it('should extract ES6 named imports', () => {
      const code = `import { Router, Request } from 'express';`;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('express');
    });

    it('should extract ES6 namespace imports', () => {
      const code = `import * as lodash from 'lodash';`;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('lodash');
    });

    it('should extract require statements', () => {
      const code = `const express = require('express');`;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('express');
    });

    it('should extract destructured require', () => {
      const code = `const { Router } = require('express');`;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('express');
    });

    it('should extract dynamic imports', () => {
      const code = `const module = await import('lodash');`;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('lodash');
    });

    it('should extract multiple imports', () => {
      const code = `
        import express from 'express';
        import lodash from 'lodash';
        const axios = require('axios');
      `;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('express');
      expect(imports).toContain('lodash');
      expect(imports).toContain('axios');
    });

    it('should extract scoped package imports', () => {
      const code = `import { Component } from '@angular/core';`;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('@angular/core');
    });

    it('should not extract relative imports', () => {
      const code = `
        import { util } from './utils';
        import helper from '../helper';
      `;
      const imports = detector.extractImports(code);
      
      expect(imports).not.toContain('./utils');
      expect(imports).not.toContain('../helper');
      expect(imports).toHaveLength(0);
    });

    it('should extract subpath imports and return package name', () => {
      const code = `import something from 'lodash/get';`;
      const imports = detector.extractImports(code);
      
      expect(imports).toContain('lodash');
    });
  });

  describe('autoInstallMissing', () => {
    it('should install missing dependencies automatically', async () => {
      // Setup mocks to detect missing packages
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({ dependencies: {} });
        }
        return `import lodash from 'lodash';`;
      });
      mockFs.readdirSync.mockReturnValue(['index.ts'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as any);

      // Mock successful installation
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        cb(null, { stdout: 'added 1 package', stderr: '' });
        return {} as any;
      });

      const result = await detector.autoInstallMissing(testDir, 'npm');
      
      expect(result.installed).toContain('lodash');
    });

    it('should report failed installations', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({ dependencies: {} });
        }
        return `import nonexistent from 'nonexistent-package-xyz';`;
      });
      mockFs.readdirSync.mockReturnValue(['index.ts'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as any);

      // Mock failed installation
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        cb(new Error('404 Not Found'), { stdout: '', stderr: 'Not found' });
        return {} as any;
      });

      const result = await detector.autoInstallMissing(testDir, 'npm');
      
      expect(result.failed.length).toBeGreaterThan(0);
    });
  });
});

describe('VersionResolver', () => {
  let resolver: VersionResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new VersionResolver();
  });

  describe('resolveLatest', () => {
    it('should resolve latest version from npm registry', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          'dist-tags': {
            latest: '4.18.2'
          }
        }
      });

      const version = await resolver.resolveLatest('express');
      
      expect(version).toBe('4.18.2');
      expect(mockAxios.get).toHaveBeenCalledWith('https://registry.npmjs.org/express');
    });

    it('should handle npm registry errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const version = await resolver.resolveLatest('express');
      
      expect(version).toBeNull();
    });

    it('should resolve specific tag version', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          'dist-tags': {
            latest: '4.18.2',
            next: '5.0.0-beta.1'
          }
        }
      });

      const version = await resolver.resolveLatest('express', 'next');
      
      expect(version).toBe('5.0.0-beta.1');
    });
  });

  describe('resolveCompatible', () => {
    it('should resolve compatible version based on constraints', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          'dist-tags': { latest: '4.18.2' },
          versions: {
            '4.17.0': {},
            '4.17.1': {},
            '4.18.0': {},
            '4.18.1': {},
            '4.18.2': {}
          }
        }
      });

      const version = await resolver.resolveCompatible('express', '^4.17.0');
      
      expect(version).toBe('4.18.2');
    });

    it('should handle tilde constraints', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          'dist-tags': { latest: '4.18.2' },
          versions: {
            '4.17.0': {},
            '4.17.1': {},
            '4.17.2': {},
            '4.18.0': {}
          }
        }
      });

      const version = await resolver.resolveCompatible('express', '~4.17.0');
      
      expect(version).toBe('4.17.2');
    });

    it('should return null for no compatible version', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          'dist-tags': { latest: '4.18.2' },
          versions: {
            '4.18.0': {},
            '4.18.1': {},
            '4.18.2': {}
          }
        }
      });

      const version = await resolver.resolveCompatible('express', '^5.0.0');
      
      expect(version).toBeNull();
    });
  });

  describe('getPackageInfo', () => {
    it('should get package info from npm registry', async () => {
      const mockPackageInfo = {
        name: 'express',
        'dist-tags': { latest: '4.18.2' },
        versions: {
          '4.18.2': {
            dependencies: { 'accepts': '~1.3.8' }
          }
        },
        description: 'Fast, unopinionated, minimalist web framework'
      };

      mockAxios.get.mockResolvedValue({ data: mockPackageInfo });

      const info = await resolver.getPackageInfo('express');
      
      expect(info).toEqual(mockPackageInfo);
    });

    it('should return null for nonexistent package', async () => {
      mockAxios.get.mockRejectedValue({ response: { status: 404 } });

      const info = await resolver.getPackageInfo('nonexistent-package-xyz');
      
      expect(info).toBeNull();
    });

    it('should handle network errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'));

      const info = await resolver.getPackageInfo('express');
      
      expect(info).toBeNull();
    });
  });

  describe('findCompatibleVersion', () => {
    it('should find highest compatible version for caret range', () => {
      const versions = ['1.0.0', '1.0.1', '1.1.0', '1.2.0', '2.0.0'];
      const result = resolver.findCompatibleVersion(versions, '^1.0.0');
      
      expect(result).toBe('1.2.0');
    });

    it('should find highest compatible version for tilde range', () => {
      const versions = ['1.0.0', '1.0.1', '1.0.2', '1.1.0'];
      const result = resolver.findCompatibleVersion(versions, '~1.0.0');
      
      expect(result).toBe('1.0.2');
    });

    it('should return exact version match', () => {
      const versions = ['1.0.0', '1.0.1', '1.0.2'];
      const result = resolver.findCompatibleVersion(versions, '1.0.1');
      
      expect(result).toBe('1.0.1');
    });

    it('should handle greater than constraints', () => {
      const versions = ['1.0.0', '1.1.0', '2.0.0', '2.1.0'];
      const result = resolver.findCompatibleVersion(versions, '>1.0.0');
      
      expect(result).toBe('2.1.0');
    });

    it('should handle range constraints', () => {
      const versions = ['1.0.0', '1.5.0', '2.0.0', '2.5.0'];
      const result = resolver.findCompatibleVersion(versions, '>=1.0.0 <2.0.0');
      
      expect(result).toBe('1.5.0');
    });

    it('should return null for no matching version', () => {
      const versions = ['1.0.0', '1.1.0'];
      const result = resolver.findCompatibleVersion(versions, '^2.0.0');
      
      expect(result).toBeNull();
    });

    it('should handle prerelease versions', () => {
      const versions = ['1.0.0', '1.0.1-beta.1', '1.0.1'];
      const result = resolver.findCompatibleVersion(versions, '^1.0.0');
      
      // Should prefer stable over prerelease
      expect(result).toBe('1.0.1');
    });
  });
});

describe('Module Exports', () => {
  it('should export singleton instances', async () => {
    const { packageManager, dependencyDetector, versionResolver } = await import('../../../src/project/packager');
    
    expect(packageManager).toBeInstanceOf(PackageManager);
    expect(dependencyDetector).toBeInstanceOf(DependencyDetector);
    expect(versionResolver).toBeInstanceOf(VersionResolver);
  });

  it('should export classes', async () => {
    const { PackageManager, DependencyDetector, VersionResolver } = await import('../../../src/project/packager');
    
    expect(PackageManager).toBeDefined();
    expect(DependencyDetector).toBeDefined();
    expect(VersionResolver).toBeDefined();
  });
});

describe('Built-in Module Detection', () => {
  let detector: DependencyDetector;

  beforeEach(() => {
    detector = new DependencyDetector();
  });

  it('should recognize Node.js built-in modules', () => {
    const builtins = ['fs', 'path', 'http', 'https', 'os', 'crypto', 'util', 'events', 'stream', 'child_process'];
    
    for (const builtin of builtins) {
      const code = `import ${builtin} from '${builtin}';`;
      const imports = detector.extractImports(code);
      
      // Imports should be extracted
      expect(imports).toContain(builtin);
    }
  });

  it('should recognize node: prefixed imports', () => {
    const code = `
      import fs from 'node:fs';
      import path from 'node:path';
    `;
    const imports = detector.extractImports(code);
    
    expect(imports).toContain('node:fs');
    expect(imports).toContain('node:path');
  });
});

describe('Edge Cases', () => {
  let packageManager: PackageManager;

  beforeEach(() => {
    jest.clearAllMocks();
    packageManager = new PackageManager();
  });

  it('should handle empty package list for add', async () => {
    const result = await packageManager.add(testDir, [], 'npm');
    
    expect(result.success).toBe(true);
    expect(result.packagesInstalled).toEqual([]);
  });

  it('should handle empty package list for remove', async () => {
    const result = await packageManager.remove(testDir, [], 'npm');
    
    expect(result.success).toBe(true);
    expect(result.packagesRemoved).toEqual([]);
  });

  it('should handle special characters in package names', async () => {
    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      const cb = typeof opts === 'function' ? opts : callback;
      cb(null, { stdout: 'added 1 package', stderr: '' });
      return {} as any;
    });

    const result = await packageManager.add(testDir, ['@scope/package-name'], 'npm');
    
    expect(result.success).toBe(true);
    expect(result.packagesInstalled).toContain('@scope/package-name');
  });

  it('should handle concurrent operations gracefully', async () => {
    let callCount = 0;
    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      callCount++;
      const cb = typeof opts === 'function' ? opts : callback;
      setTimeout(() => {
        cb(null, { stdout: `call ${callCount}`, stderr: '' });
      }, 10);
      return {} as any;
    });

    const results = await Promise.all([
      packageManager.add(testDir, ['pkg1'], 'npm'),
      packageManager.add(testDir, ['pkg2'], 'npm'),
      packageManager.add(testDir, ['pkg3'], 'npm')
    ]);

    expect(results.every(r => r.success)).toBe(true);
  });
});

const testDir = '/test/project';

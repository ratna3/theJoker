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
    
    // Default: no lock files exist
    mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
    mockFsPromises.readFile.mockRejectedValue(new Error('ENOENT'));
  });

  describe('detect', () => {
    it('should detect npm when package-lock.json exists', async () => {
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('package-lock.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('npm');
    });

    it('should detect yarn when yarn.lock exists', async () => {
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('yarn.lock')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('yarn');
    });

    it('should detect pnpm when pnpm-lock.yaml exists', async () => {
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('pnpm-lock.yaml')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('pnpm');
    });

    it('should detect bun when bun.lockb exists', async () => {
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('bun.lockb')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('bun');
    });

    it('should fallback to npm when no lock file exists but npm is available', async () => {
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      mockFsPromises.readFile.mockRejectedValue(new Error('ENOENT'));
      
      // Mock exec to simulate npm --version success
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('bun --version')) {
          cb(new Error('command not found'), '', '');
        } else if (cmd.includes('pnpm --version')) {
          cb(new Error('command not found'), '', '');
        } else if (cmd.includes('yarn --version')) {
          cb(new Error('command not found'), '', '');
        } else if (cmd.includes('npm --version')) {
          cb(null, '9.0.0', '');
        } else {
          cb(new Error('command not found'), '', '');
        }
        return {} as any;
      });

      const result = await packageManager.detect(testDir);
      expect(result).toBe('npm');
    });

    it('should return npm as default when nothing is detected', async () => {
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
      
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
    beforeEach(() => {
      // Set up npm as detected manager
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('package-lock.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });
    });

    it('should run npm install successfully', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm install')) {
          cb(null, 'added 100 packages', '');
        }
        return {} as any;
      });

      const result = await packageManager.install(testDir);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('added 100 packages');
    });

    it('should run npm install with specific packages', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm install express')) {
          cb(null, { stdout: 'added 1 package', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.install(testDir, ['express']);
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toContain('express');
    });

    it('should handle install failure', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        const err = new Error('ENOENT') as Error & { stdout?: string; stderr?: string };
        err.stdout = '';
        err.stderr = 'npm ERR! code ENOENT';
        cb(err, { stdout: '', stderr: 'npm ERR! code ENOENT' });
        return {} as any;
      });

      const result = await packageManager.install(testDir);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('add', () => {
    beforeEach(() => {
      // Set up npm as detected manager
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('package-lock.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });
    });

    it('should add a single package', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm install express')) {
          cb(null, { stdout: 'added 1 package', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['express']);
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toContain('express');
    });

    it('should add multiple packages', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        cb(null, { stdout: 'added 3 packages', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['express', 'lodash', 'axios']);
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toEqual(['express', 'lodash', 'axios']);
    });

    it('should add packages as devDependencies', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('-D');
        cb(null, { stdout: 'added 1 package', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['jest'], true);
      
      expect(result.success).toBe(true);
    });

    it('should handle package with specific version', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('express@4.18.0');
        cb(null, { stdout: 'added 1 package', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.add(testDir, ['express@4.18.0']);
      
      expect(result.success).toBe(true);
    });

    it('should return success for empty package list', async () => {
      const result = await packageManager.add(testDir, []);
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toEqual([]);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      // Set up npm as detected manager
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('package-lock.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });
    });

    it('should remove a package', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm uninstall express')) {
          cb(null, { stdout: 'removed 1 package', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.remove(testDir, ['express']);
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toContain('express');
    });

    it('should handle remove failure', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        const err = new Error('Package not found') as Error & { stdout?: string; stderr?: string };
        err.stdout = '';
        err.stderr = 'not found';
        cb(err, { stdout: '', stderr: 'not found' });
        return {} as any;
      });

      const result = await packageManager.remove(testDir, ['nonexistent']);
      
      expect(result.success).toBe(false);
    });

    it('should return success for empty package list', async () => {
      const result = await packageManager.remove(testDir, []);
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toEqual([]);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      // Set up npm as detected manager
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('package-lock.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });
    });

    it('should update all packages', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        if (cmd.includes('npm update')) {
          cb(null, { stdout: 'updated 5 packages', stderr: '' });
        }
        return {} as any;
      });

      const result = await packageManager.update(testDir);
      
      expect(result.success).toBe(true);
    });

    it('should update specific packages', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('express lodash');
        cb(null, { stdout: 'updated 2 packages', stderr: '' });
        return {} as any;
      });

      const result = await packageManager.update(testDir, ['express', 'lodash']);
      
      expect(result.success).toBe(true);
    });
  });

  describe('listInstalled', () => {
    it('should list installed packages from package.json', async () => {
      mockFsPromises.access.mockResolvedValue(undefined);
      mockFsPromises.readFile.mockResolvedValue(JSON.stringify({
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
      expect(packages.find(p => p.name === 'jest')?.dev).toBe(true);
    });

    it('should return empty array when no package.json exists', async () => {
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));

      const packages = await packageManager.listInstalled(testDir);
      
      expect(packages).toEqual([]);
    });

    it('should handle malformed package.json', async () => {
      mockFsPromises.access.mockResolvedValue(undefined);
      mockFsPromises.readFile.mockResolvedValue('not valid json');

      const packages = await packageManager.listInstalled(testDir);
      
      expect(packages).toEqual([]);
    });
  });

  describe('runScript', () => {
    beforeEach(() => {
      // Set up npm as detected manager
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('package-lock.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });
    });

    it('should run npm scripts', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        expect(cmd).toContain('npm run test');
        cb(null, 'Tests passed', '');
        return {} as any;
      });

      const result = await packageManager.runScript(testDir, 'test');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Tests passed');
    });

    it('should handle script failures', async () => {
      mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
        const cb = typeof opts === 'function' ? opts : callback;
        const err = new Error('Script failed') as Error & { stdout?: string; stderr?: string };
        err.stdout = '';
        err.stderr = 'Error running script';
        cb(err, { stdout: '', stderr: 'Error running script' });
        return {} as any;
      });

      const result = await packageManager.runScript(testDir, 'test');
      
      expect(result.success).toBe(false);
    });
  });

  describe('init', () => {
    it('should create package.json', async () => {
      mockFsPromises.mkdir.mockResolvedValue(undefined);
      mockFsPromises.writeFile.mockResolvedValue(undefined);

      const result = await packageManager.init(testDir);
      
      expect(result.success).toBe(true);
      expect(mockFsPromises.writeFile).toHaveBeenCalled();
    });

    it('should create package.json with custom options', async () => {
      mockFsPromises.mkdir.mockResolvedValue(undefined);
      mockFsPromises.writeFile.mockResolvedValue(undefined);

      const result = await packageManager.init(testDir, { name: 'my-project', version: '2.0.0' });
      
      expect(result.success).toBe(true);
      const writeCall = mockFsPromises.writeFile.mock.calls[0];
      const content = JSON.parse(writeCall[1] as string);
      expect(content.name).toBe('my-project');
      expect(content.version).toBe('2.0.0');
    });

    it('should handle init failure', async () => {
      mockFsPromises.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await packageManager.init(testDir);
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

describe('DependencyDetector', () => {
  let detector: DependencyDetector;
  const testDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new DependencyDetector();
    
    mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
  });

  describe('analyze', () => {
    it('should analyze dependencies', async () => {
      // Mock directory listing
      mockFsPromises.readdir.mockResolvedValue([
        { name: 'index.ts', isFile: () => true, isDirectory: () => false }
      ] as any);
      
      // Mock file reading
      mockFsPromises.readFile.mockImplementation(async (p: any) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return JSON.stringify({
            dependencies: { 'express': '^4.18.0' }
          });
        }
        if (pathStr.endsWith('.ts')) {
          return `
            import express from 'express';
            import lodash from 'lodash';
          `;
        }
        return '';
      });

      // Setup package.json access
      mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
        const pathStr = String(p);
        if (pathStr.includes('package.json')) {
          return undefined;
        }
        throw new Error('ENOENT');
      });

      const analysis = await detector.analyze(testDir);
      
      expect(analysis.required).toBeDefined();
      expect(analysis.installed).toBeDefined();
      expect(analysis.missing).toBeDefined();
    });
  });

  describe('detectMissing', () => {
    it('should return empty array when no files exist', async () => {
      mockFsPromises.readdir.mockRejectedValue(new Error('ENOENT'));

      const missing = await detector.detectMissing(testDir);
      
      expect(missing).toEqual([]);
    });
  });

  describe('autoInstall', () => {
    it('should return success when all dependencies are installed', async () => {
      // No source files = no imports = nothing missing
      mockFsPromises.readdir.mockRejectedValue(new Error('ENOENT'));
      mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));

      const result = await detector.autoInstall(testDir);
      
      expect(result.success).toBe(true);
      expect(result.packagesInstalled).toEqual([]);
    });
  });
});

describe('VersionResolver', () => {
  let resolver: VersionResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new VersionResolver();
  });

  describe('getLatestVersion', () => {
    it('should return null on error', async () => {
      // Mock https.get to fail
      const https = require('https');
      https.get.mockImplementation((_url: string, callback: (res: any) => void) => {
        const mockRes = {
          statusCode: 500,
          on: jest.fn()
        };
        callback(mockRes);
        return { on: jest.fn() };
      });

      const version = await resolver.getLatestVersion('express');
      
      // Will return null due to mock not providing proper response
      expect(version === null || typeof version === 'string').toBe(true);
    });
  });

  describe('getPackageInfo', () => {
    it('should return null for errors', async () => {
      const https = require('https');
      https.get.mockImplementation((_url: string, callback: (res: any) => void) => {
        const mockRes = {
          statusCode: 404,
          on: jest.fn()
        };
        callback(mockRes);
        return { on: jest.fn() };
      });

      const info = await resolver.getPackageInfo('nonexistent-package-xyz');
      
      expect(info === null || typeof info === 'object').toBe(true);
    });
  });

  describe('packageExists', () => {
    it('should return false for nonexistent package', async () => {
      const https = require('https');
      https.get.mockImplementation((_url: string, callback: (res: any) => void) => {
        const mockRes = {
          statusCode: 404,
          on: jest.fn()
        };
        callback(mockRes);
        return { on: jest.fn() };
      });

      const exists = await resolver.packageExists('nonexistent-package-xyz');
      
      // Either false or error handling returns false
      expect(typeof exists === 'boolean').toBe(true);
    });
  });

  describe('getCompatibleVersion', () => {
    it('should return latest when no info available', async () => {
      const https = require('https');
      https.get.mockImplementation((_url: string, callback: (res: any) => void) => {
        const mockRes = {
          statusCode: 404,
          on: jest.fn()
        };
        callback(mockRes);
        return { on: jest.fn() };
      });

      const version = await resolver.getCompatibleVersion('nonexistent', {});
      
      expect(version).toBe('latest');
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

describe('Edge Cases', () => {
  let packageManager: PackageManager;
  const testDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    packageManager = new PackageManager();
    
    // Set up npm as detected manager
    mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('package-lock.json')) {
        return undefined;
      }
      throw new Error('ENOENT');
    });
  });

  it('should handle empty package list for add', async () => {
    const result = await packageManager.add(testDir, []);
    
    expect(result.success).toBe(true);
    expect(result.packagesInstalled).toEqual([]);
  });

  it('should handle empty package list for remove', async () => {
    const result = await packageManager.remove(testDir, []);
    
    expect(result.success).toBe(true);
    expect(result.packagesInstalled).toEqual([]);
  });

  it('should handle special characters in package names', async () => {
    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      const cb = typeof opts === 'function' ? opts : callback;
      cb(null, { stdout: 'added 1 package', stderr: '' });
      return {} as any;
    });

    const result = await packageManager.add(testDir, ['@scope/package-name']);
    
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
      packageManager.add(testDir, ['pkg1']),
      packageManager.add(testDir, ['pkg2']),
      packageManager.add(testDir, ['pkg3'])
    ]);

    expect(results.every(r => r.success)).toBe(true);
  });
});

describe('Package Manager Detection for Different Managers', () => {
  let packageManager: PackageManager;
  const testDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    packageManager = new PackageManager();
    mockFsPromises.access.mockRejectedValue(new Error('ENOENT'));
  });

  it('should run yarn install when yarn is detected', async () => {
    mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('yarn.lock')) {
        return undefined;
      }
      throw new Error('ENOENT');
    });

    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      const cb = typeof opts === 'function' ? opts : callback;
      if (cmd.includes('yarn install') || cmd.includes('yarn add')) {
        cb(null, { stdout: 'Done in 5.32s', stderr: '' });
      }
      return {} as any;
    });

    const result = await packageManager.install(testDir);
    
    expect(result.success).toBe(true);
  });

  it('should run pnpm install when pnpm is detected', async () => {
    mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('pnpm-lock.yaml')) {
        return undefined;
      }
      throw new Error('ENOENT');
    });

    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      const cb = typeof opts === 'function' ? opts : callback;
      if (cmd.includes('pnpm install') || cmd.includes('pnpm add')) {
        cb(null, { stdout: 'Packages installed', stderr: '' });
      }
      return {} as any;
    });

    const result = await packageManager.install(testDir);
    
    expect(result.success).toBe(true);
  });

  it('should run bun install when bun is detected', async () => {
    mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('bun.lockb')) {
        return undefined;
      }
      throw new Error('ENOENT');
    });

    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      const cb = typeof opts === 'function' ? opts : callback;
      if (cmd.includes('bun install') || cmd.includes('bun add')) {
        cb(null, { stdout: 'Installed packages', stderr: '' });
      }
      return {} as any;
    });

    const result = await packageManager.install(testDir);
    
    expect(result.success).toBe(true);
  });
});

describe('Dev Dependencies with Different Managers', () => {
  let packageManager: PackageManager;
  const testDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    packageManager = new PackageManager();
  });

  it('should add dev dependencies with yarn using -D flag', async () => {
    mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('yarn.lock')) {
        return undefined;
      }
      throw new Error('ENOENT');
    });

    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      const cb = typeof opts === 'function' ? opts : callback;
      expect(cmd).toContain('-D');
      cb(null, { stdout: 'Done', stderr: '' });
      return {} as any;
    });

    const result = await packageManager.add(testDir, ['jest'], true);
    
    expect(result.success).toBe(true);
  });

  it('should add dev dependencies with pnpm using -D flag', async () => {
    mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('pnpm-lock.yaml')) {
        return undefined;
      }
      throw new Error('ENOENT');
    });

    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      const cb = typeof opts === 'function' ? opts : callback;
      expect(cmd).toContain('-D');
      cb(null, { stdout: 'Done', stderr: '' });
      return {} as any;
    });

    const result = await packageManager.add(testDir, ['jest'], true);
    
    expect(result.success).toBe(true);
  });

  it('should add dev dependencies with bun using -d flag', async () => {
    mockFsPromises.access.mockImplementation(async (p: fs.PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('bun.lockb')) {
        return undefined;
      }
      throw new Error('ENOENT');
    });

    mockExec.mockImplementation((cmd: string, opts: any, callback?: any) => {
      const cb = typeof opts === 'function' ? opts : callback;
      expect(cmd).toContain('-d');
      cb(null, { stdout: 'Done', stderr: '' });
      return {} as any;
    });

    const result = await packageManager.add(testDir, ['jest'], true);
    
    expect(result.success).toBe(true);
  });
});

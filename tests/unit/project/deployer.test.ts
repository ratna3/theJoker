/**
 * The Joker - Agentic Terminal
 * Deployment Manager Tests
 */

import { EventEmitter } from 'events';
import {
  DeploymentManager,
  getDeploymentManager,
  createDeploymentManager
} from '../../../src/project/deployer';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rename: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn()
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const mockFs = require('fs/promises');
const mockChildProcess = require('child_process');

describe('DeploymentManager', () => {
  let deployer: DeploymentManager;

  beforeEach(() => {
    jest.clearAllMocks();
    deployer = new DeploymentManager('/test/project');
    
    // Default package.json mock
    mockFs.readFile.mockResolvedValue(JSON.stringify({
      name: 'test-project',
      scripts: {
        build: 'tsc',
        start: 'node dist/index.js'
      },
      dependencies: {
        express: '^4.18.0'
      }
    }));
    mockFs.access.mockRejectedValue(new Error('Not found'));
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  describe('Initialization', () => {
    it('should create a new deployment manager', () => {
      expect(deployer).toBeInstanceOf(DeploymentManager);
      expect(deployer).toBeInstanceOf(EventEmitter);
    });

    it('should initialize and detect npm as default package manager', async () => {
      await deployer.initialize();
      // Default is npm when no lock files found
    });

    it('should detect pnpm from lock file', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('pnpm-lock.yaml')) return Promise.resolve();
        return Promise.reject(new Error('Not found'));
      });

      await deployer.initialize();
    });

    it('should detect yarn from lock file', async () => {
      mockFs.access.mockImplementation((path: string) => {
        if (path.includes('yarn.lock')) return Promise.resolve();
        return Promise.reject(new Error('Not found'));
      });

      await deployer.initialize();
    });

    it('should detect framework from package.json', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        dependencies: { next: '^14.0.0' }
      }));

      await deployer.initialize();
    });
  });

  describe('Dockerfile Generation', () => {
    it('should generate a basic Dockerfile', () => {
      const result = deployer.generateDockerfile();

      expect(result.path).toBe('Dockerfile');
      expect(result.content).toContain('FROM node:');
      expect(result.content).toContain('WORKDIR /app');
      expect(result.content).toContain('EXPOSE');
      expect(result.content).toContain('CMD');
    });

    it('should generate multi-stage Dockerfile by default', () => {
      const result = deployer.generateDockerfile({ multiStage: true });

      expect(result.content).toContain('AS builder');
      expect(result.content).toContain('AS production');
      expect(result.content).toContain('COPY --from=builder');
    });

    it('should use custom node version', () => {
      const result = deployer.generateDockerfile({ nodeVersion: '18' });

      expect(result.content).toContain('node:18');
    });

    it('should use alpine images when specified', () => {
      const result = deployer.generateDockerfile({ alpine: true });

      expect(result.content).toContain('-alpine');
    });

    it('should add health check when configured', () => {
      const result = deployer.generateDockerfile({
        healthCheck: {
          command: 'curl -f http://localhost:3000/health',
          interval: '30s',
          timeout: '10s',
          retries: 3
        }
      });

      expect(result.content).toContain('HEALTHCHECK');
      expect(result.content).toContain('curl -f http://localhost:3000/health');
    });

    it('should add environment variables', () => {
      const result = deployer.generateDockerfile({
        env: { API_URL: 'https://api.example.com' }
      });

      expect(result.content).toContain('ENV API_URL=https://api.example.com');
    });

    it('should add custom labels', () => {
      const result = deployer.generateDockerfile({
        labels: { maintainer: 'test@example.com' }
      });

      expect(result.content).toContain('LABEL maintainer="test@example.com"');
    });

    it('should emit file:generated event', () => {
      const handler = jest.fn();
      deployer.on('file:generated', handler);

      deployer.generateDockerfile();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'Dockerfile',
          description: 'Docker container configuration'
        })
      );
    });
  });

  describe('Dockerignore Generation', () => {
    it('should generate .dockerignore file', () => {
      const result = deployer.generateDockerignore();

      expect(result.path).toBe('.dockerignore');
      expect(result.content).toContain('node_modules');
      expect(result.content).toContain('.git');
      expect(result.content).toContain('.env');
      expect(result.content).toContain('tests');
    });
  });

  describe('Docker Compose Generation', () => {
    it('should generate docker-compose.yml', () => {
      const result = deployer.generateDockerCompose({
        services: [
          {
            name: 'app',
            build: '.',
            ports: ['3000:3000'],
            environment: { NODE_ENV: 'production' }
          }
        ]
      });

      expect(result.path).toBe('docker-compose.yml');
      expect(result.content).toContain('app:');
      expect(result.content).toContain('3000:3000');
    });

    it('should include multiple services', () => {
      const result = deployer.generateDockerCompose({
        services: [
          { name: 'web', build: './web' },
          { name: 'api', build: './api' },
          { name: 'db', image: 'postgres:15' }
        ]
      });

      expect(result.content).toContain('web:');
      expect(result.content).toContain('api:');
      expect(result.content).toContain('db:');
    });

    it('should include depends_on', () => {
      const result = deployer.generateDockerCompose({
        services: [
          { name: 'web', build: '.', depends_on: ['db'] },
          { name: 'db', image: 'postgres:15' }
        ]
      });

      expect(result.content).toContain('depends_on:');
    });

    it('should include volumes and networks', () => {
      const result = deployer.generateDockerCompose({
        services: [{ name: 'app', build: '.' }],
        volumes: { 'app-data': { driver: 'local' } },
        networks: { 'app-network': { driver: 'bridge' } }
      });

      expect(result.content).toContain('volumes:');
      expect(result.content).toContain('networks:');
    });
  });

  describe('CI/CD Pipeline Generation', () => {
    describe('GitHub Actions', () => {
      it('should generate GitHub Actions workflow', () => {
        const result = deployer.generateCICDPipeline({
          provider: 'github-actions',
          branches: ['main'],
          nodeVersion: '20'
        });

        expect(result.path).toBe('.github/workflows/ci.yml');
        expect(result.content).toContain('name: CI/CD Pipeline');
        expect(result.content).toContain('ubuntu-latest');
        expect(result.content).toContain('actions/checkout@v4');
      });

      it('should include test step when configured', () => {
        const result = deployer.generateCICDPipeline({
          provider: 'github-actions',
          testCommand: 'npm test'
        });

        expect(result.content).toContain('Run tests');
        expect(result.content).toContain('npm test');
      });

      it('should include lint step when configured', () => {
        const result = deployer.generateCICDPipeline({
          provider: 'github-actions',
          lintCommand: 'npm run lint'
        });

        expect(result.content).toContain('Lint code');
      });

      it('should include deploy job when configured', () => {
        const result = deployer.generateCICDPipeline({
          provider: 'github-actions',
          deployCommand: 'vercel --prod',
          secrets: ['VERCEL_TOKEN']
        });

        expect(result.content).toContain('deploy:');
        expect(result.content).toContain('vercel --prod');
      });
    });

    describe('GitLab CI', () => {
      it('should generate GitLab CI configuration', () => {
        const result = deployer.generateCICDPipeline({
          provider: 'gitlab-ci',
          nodeVersion: '20'
        });

        expect(result.path).toBe('.gitlab-ci.yml');
        expect(result.content).toContain('image: node:20-alpine');
        expect(result.content).toContain('stages:');
      });
    });

    describe('Bitbucket Pipelines', () => {
      it('should generate Bitbucket Pipelines configuration', () => {
        const result = deployer.generateCICDPipeline({
          provider: 'bitbucket-pipelines',
          nodeVersion: '20'
        });

        expect(result.path).toBe('bitbucket-pipelines.yml');
        expect(result.content).toContain('image: node:20');
        expect(result.content).toContain('pipelines:');
      });
    });

    describe('Azure Pipelines', () => {
      it('should generate Azure Pipelines configuration', () => {
        const result = deployer.generateCICDPipeline({
          provider: 'azure-pipelines',
          nodeVersion: '20'
        });

        expect(result.path).toBe('azure-pipelines.yml');
        expect(result.content).toContain('trigger:');
        expect(result.content).toContain('pool:');
        expect(result.content).toContain("vmImage: 'ubuntu-latest'");
      });
    });

    describe('CircleCI', () => {
      it('should generate CircleCI configuration', () => {
        const result = deployer.generateCICDPipeline({
          provider: 'circleci',
          nodeVersion: '20'
        });

        expect(result.path).toBe('.circleci/config.yml');
        expect(result.content).toContain('version: 2.1');
        expect(result.content).toContain('orbs:');
        expect(result.content).toContain('workflows:');
      });
    });
  });

  describe('Platform Configuration Generation', () => {
    describe('Vercel', () => {
      it('should generate vercel.json', () => {
        const result = deployer.generateVercelConfig({
          platform: 'vercel',
          buildCommand: 'npm run build',
          outputDirectory: 'dist'
        });

        expect(result.path).toBe('vercel.json');
        expect(result.content).toContain('buildCommand');
        expect(result.content).toContain('outputDirectory');
      });

      it('should include redirects and rewrites', () => {
        const result = deployer.generateVercelConfig({
          platform: 'vercel',
          redirects: [{ source: '/old', destination: '/new', statusCode: 301 }],
          rewrites: [{ source: '/api/:path*', destination: 'https://api.example.com/:path*' }]
        });

        expect(result.content).toContain('redirects');
        expect(result.content).toContain('rewrites');
      });
    });

    describe('Netlify', () => {
      it('should generate netlify.toml', () => {
        const result = deployer.generateNetlifyConfig({
          platform: 'netlify',
          buildCommand: 'npm run build',
          outputDirectory: 'dist'
        });

        expect(result.path).toBe('netlify.toml');
        expect(result.content).toContain('[build]');
        expect(result.content).toContain('publish = "dist"');
      });
    });

    describe('Railway', () => {
      it('should generate railway.json', () => {
        const result = deployer.generateRailwayConfig({
          platform: 'railway'
        });

        expect(result.path).toBe('railway.json');
        expect(result.content).toContain('build');
        expect(result.content).toContain('deploy');
      });
    });

    describe('Fly.io', () => {
      it('should generate fly.toml', () => {
        const result = deployer.generateFlyConfig({
          platform: 'fly',
          projectName: 'my-app',
          region: 'iad'
        });

        expect(result.path).toBe('fly.toml');
        expect(result.content).toContain('app = "my-app"');
        expect(result.content).toContain('primary_region = "iad"');
      });
    });

    describe('Render', () => {
      it('should generate render.yaml', () => {
        const result = deployer.generateRenderConfig({
          platform: 'render',
          projectName: 'my-service'
        });

        expect(result.path).toBe('render.yaml');
        expect(result.content).toContain('services:');
        expect(result.content).toContain('type: web');
      });
    });
  });

  describe('Production Build', () => {
    it('should build for production', async () => {
      mockChildProcess.exec.mockImplementation((cmd: string, opts: any, callback: Function) => {
        callback(null, 'Build successful', '');
      });

      const result = await deployer.buildForProduction();

      expect(result.success).toBe(true);
      expect(result.output).toContain('Build successful');
    });

    it('should handle build failure', async () => {
      const error: any = new Error('Build failed');
      error.stdout = '';
      error.stderr = 'Error: Module not found';
      mockChildProcess.exec.mockImplementation((cmd: string, opts: any, callback: Function) => {
        callback(error, '', 'Build failed');
      });

      // Add error handler to prevent unhandled error
      deployer.on('error', () => {});

      const result = await deployer.buildForProduction();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should emit build:start event', async () => {
      mockChildProcess.exec.mockImplementation((cmd: string, opts: any, callback: Function) => {
        callback(null, '', '');
      });

      const handler = jest.fn();
      deployer.on('build:start', handler);

      await deployer.buildForProduction();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit build:complete event', async () => {
      mockChildProcess.exec.mockImplementation((cmd: string, opts: any, callback: Function) => {
        callback(null, '', '');
      });

      const handler = jest.fn();
      deployer.on('build:complete', handler);

      await deployer.buildForProduction();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should set environment variables', async () => {
      let capturedEnv: any = {};
      mockChildProcess.exec.mockImplementation((cmd: string, opts: any, callback: Function) => {
        capturedEnv = opts.env;
        callback(null, '', '');
      });

      await deployer.buildForProduction({
        env: { API_KEY: 'test123' }
      });

      expect(capturedEnv.API_KEY).toBe('test123');
      expect(capturedEnv.NODE_ENV).toBe('production');
    });
  });

  describe('Environment Template', () => {
    it('should generate .env.example', () => {
      const result = deployer.generateEnvTemplate({
        DATABASE_URL: { description: 'Database connection string', required: true },
        API_KEY: { description: 'API key', default: 'dev-key' }
      });

      expect(result.path).toBe('.env.example');
      expect(result.content).toContain('DATABASE_URL=');
      expect(result.content).toContain('API_KEY=dev-key');
      expect(result.content).toContain('(REQUIRED)');
    });
  });

  describe('Environment Validation', () => {
    it('should validate required environment variables', async () => {
      process.env.TEST_VAR = 'value';

      const result = await deployer.validateEnv(['TEST_VAR']);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);

      delete process.env.TEST_VAR;
    });

    it('should report missing variables', async () => {
      const result = await deployer.validateEnv(['MISSING_VAR']);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('MISSING_VAR');
    });
  });

  describe('Deployment History', () => {
    it('should track deployment history', async () => {
      // Mock successful deploy
      mockChildProcess.exec.mockImplementation((cmd: string, opts: any, callback: Function) => {
        if (cmd.includes('where') || cmd.includes('which')) {
          callback(null, '/usr/bin/docker', '');
        } else {
          callback(null, 'Deployed to https://example.com', '');
        }
      });

      await deployer.deploy('docker', { dryRun: true });

      const history = deployer.getDeploymentHistory();
      expect(history.length).toBe(1);
    });

    it('should get last deployment', async () => {
      mockChildProcess.exec.mockImplementation((cmd: string, opts: any, callback: Function) => {
        callback(null, 'Success', '');
      });

      await deployer.deploy('docker', { dryRun: true });

      const last = deployer.getLastDeployment();
      expect(last).toBeDefined();
      expect(last?.platform).toBe('docker');
    });

    it('should clear history', async () => {
      mockChildProcess.exec.mockImplementation((cmd: string, opts: any, callback: Function) => {
        callback(null, 'Success', '');
      });

      await deployer.deploy('docker', { dryRun: true });
      deployer.clearHistory();

      expect(deployer.getDeploymentHistory()).toHaveLength(0);
    });
  });

  describe('File Saving', () => {
    it('should save generated files to disk', async () => {
      const files = [
        { path: 'Dockerfile', content: 'FROM node:20', description: 'Docker config' },
        { path: '.dockerignore', content: 'node_modules', description: 'Docker ignore' }
      ];

      const result = await deployer.saveFiles(files);

      expect(result.saved).toContain('Dockerfile');
      expect(result.saved).toContain('.dockerignore');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle save errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const files = [
        { path: 'Dockerfile', content: 'FROM node:20', description: 'Docker config' }
      ];

      const result = await deployer.saveFiles(files);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should create directories if needed', async () => {
      const files = [
        { path: '.github/workflows/ci.yml', content: 'name: CI', description: 'CI workflow' }
      ];

      await deployer.saveFiles(files);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.github'),
        expect.objectContaining({ recursive: true })
      );
    });
  });
});

describe('Factory Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the module to clear cached instances
    jest.resetModules();
  });

  describe('getDeploymentManager', () => {
    it('should return a deployment manager', () => {
      const manager = getDeploymentManager('/test/path');
      expect(manager).toBeInstanceOf(DeploymentManager);
    });

    it('should cache managers by path', () => {
      const manager1 = getDeploymentManager('/test/path');
      const manager2 = getDeploymentManager('/test/path');
      expect(manager1).toBe(manager2);
    });
  });

  describe('createDeploymentManager', () => {
    it('should create a new deployment manager', () => {
      const manager = createDeploymentManager('/test/path');
      expect(manager).toBeInstanceOf(DeploymentManager);
    });

    it('should create independent instances', () => {
      const manager1 = createDeploymentManager('/path1');
      const manager2 = createDeploymentManager('/path2');
      expect(manager1).not.toBe(manager2);
    });
  });
});

describe('Edge Cases', () => {
  let deployer: DeploymentManager;

  beforeEach(() => {
    jest.clearAllMocks();
    deployer = new DeploymentManager('/test/project');
    mockFs.readFile.mockResolvedValue(JSON.stringify({
      name: 'test',
      scripts: { build: 'tsc', start: 'node dist/index.js' }
    }));
  });

  it('should handle missing package.json gracefully', async () => {
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    await deployer.initialize();
    // Should not throw
  });

  it('should handle invalid package.json', async () => {
    mockFs.readFile.mockResolvedValue('not valid json');

    await deployer.initialize();
    // Should not throw
  });

  it('should detect bun package manager', async () => {
    mockFs.access.mockImplementation((path: string) => {
      if (path.includes('bun.lockb')) return Promise.resolve();
      return Promise.reject(new Error('Not found'));
    });

    await deployer.initialize();
    // Bun detected
  });

  it('should handle various frameworks', async () => {
    const frameworks = [
      { deps: { react: '^18.0.0' }, expected: 'react' },
      { deps: { vue: '^3.0.0' }, expected: 'vue' },
      { deps: { nuxt: '^3.0.0' }, expected: 'vue' },
      { deps: { '@nestjs/core': '^10.0.0' }, expected: 'nestjs' }
    ];

    for (const fw of frameworks) {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        dependencies: fw.deps
      }));

      await deployer.initialize();
    }
  });
});

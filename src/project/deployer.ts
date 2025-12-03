/**
 * The Joker - Agentic Terminal
 * Deployment Automation System
 * 
 * Handles production builds, Dockerfile generation, CI/CD pipeline setup,
 * and deployment to cloud platforms (Vercel, Netlify, AWS, Azure, Docker).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { Framework, PackageManagerType } from '../types';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

/**
 * Deployment platform options
 */
export type DeploymentPlatform = 'vercel' | 'netlify' | 'aws' | 'azure' | 'docker' | 'railway' | 'fly' | 'render' | 'heroku';

/**
 * CI/CD provider options
 */
export type CICDProvider = 'github-actions' | 'gitlab-ci' | 'bitbucket-pipelines' | 'jenkins' | 'circleci' | 'azure-pipelines';

/**
 * Build mode
 */
export type BuildMode = 'development' | 'production' | 'staging' | 'test';

/**
 * Deployment status
 */
export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'deployed' | 'failed' | 'cancelled' | 'rollback';

/**
 * Container runtime
 */
export type ContainerRuntime = 'docker' | 'podman' | 'containerd';

/**
 * Dockerfile configuration
 */
export interface DockerConfig {
  baseImage?: string;
  nodeVersion?: string;
  exposePort?: number;
  workDir?: string;
  buildCommand?: string;
  startCommand?: string;
  env?: Record<string, string>;
  copyFiles?: string[];
  healthCheck?: {
    command: string;
    interval?: string;
    timeout?: string;
    retries?: number;
  };
  multiStage?: boolean;
  alpine?: boolean;
  user?: string;
  labels?: Record<string, string>;
}

/**
 * Docker Compose service configuration
 */
export interface ComposeServiceConfig {
  name: string;
  build?: string;
  image?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: string[];
  command?: string;
  networks?: string[];
  restart?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
  healthcheck?: {
    test: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
  };
}

/**
 * Docker Compose configuration
 */
export interface ComposeConfig {
  version?: string;
  services: ComposeServiceConfig[];
  networks?: Record<string, { driver?: string }>;
  volumes?: Record<string, { driver?: string }>;
}

/**
 * CI/CD pipeline configuration
 */
export interface CICDConfig {
  provider: CICDProvider;
  branches?: string[];
  triggers?: ('push' | 'pull_request' | 'tag' | 'schedule' | 'manual')[];
  nodeVersion?: string;
  installCommand?: string;
  buildCommand?: string;
  testCommand?: string;
  lintCommand?: string;
  deployCommand?: string;
  cacheDirectories?: string[];
  env?: Record<string, string>;
  secrets?: string[];
  stages?: {
    name: string;
    jobs: string[];
    when?: string;
  }[];
}

/**
 * Platform deployment configuration
 */
export interface PlatformConfig {
  platform: DeploymentPlatform;
  projectName?: string;
  region?: string;
  team?: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  framework?: string;
  nodeVersion?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  redirects?: { source: string; destination: string; statusCode?: number }[];
  rewrites?: { source: string; destination: string }[];
}

/**
 * Build optimization options
 */
export interface BuildOptimization {
  minify?: boolean;
  treeshake?: boolean;
  splitChunks?: boolean;
  sourceMaps?: boolean | 'hidden';
  analyze?: boolean;
  compress?: boolean;
  parallel?: boolean;
  cache?: boolean;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  success: boolean;
  status: DeploymentStatus;
  platform: DeploymentPlatform;
  url?: string;
  deploymentId?: string;
  buildTime?: number;
  deployTime?: number;
  logs: string[];
  errors: string[];
  artifacts?: string[];
}

/**
 * Generated file result
 */
export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

/**
 * Deployment manager events
 */
export interface DeployerEvents {
  'build:start': { projectPath: string; mode: BuildMode };
  'build:progress': { message: string; progress: number };
  'build:complete': { success: boolean; duration: number };
  'deploy:start': { platform: DeploymentPlatform };
  'deploy:progress': { message: string; step: string };
  'deploy:complete': DeploymentResult;
  'file:generated': GeneratedFile;
  'error': { message: string; code: string };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get clean environment variables (filter out undefined values)
 */
function getCleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

/**
 * Execute command as promise
 */
function execAsync(command: string, options?: { cwd?: string; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, {
      cwd: options?.cwd,
      env: { ...getCleanEnv(), ...options?.env },
      maxBuffer: 1024 * 1024 * 10
    }, (error, stdout, stderr) => {
      if (error) {
        const enhancedError: any = error;
        enhancedError.stdout = stdout;
        enhancedError.stderr = stderr;
        reject(enhancedError);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Check if command exists
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    await execAsync(checkCmd);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// DeploymentManager Class
// ============================================

/**
 * Manages deployment automation for projects
 */
export class DeploymentManager extends EventEmitter {
  private projectPath: string;
  private packageManager: PackageManagerType;
  private framework: Framework | null;
  private deploymentHistory: DeploymentResult[];
  private currentDeployment: ChildProcess | null;

  constructor(projectPath: string = process.cwd()) {
    super();
    this.projectPath = path.resolve(projectPath);
    this.packageManager = 'npm';
    this.framework = null;
    this.deploymentHistory = [];
    this.currentDeployment = null;
  }

  /**
   * Initialize and detect project configuration
   */
  async initialize(): Promise<void> {
    try {
      // Detect package manager
      if (await this.fileExists('pnpm-lock.yaml')) {
        this.packageManager = 'pnpm';
      } else if (await this.fileExists('yarn.lock')) {
        this.packageManager = 'yarn';
      } else if (await this.fileExists('bun.lockb')) {
        this.packageManager = 'bun';
      }

      // Detect framework
      const packageJson = await this.readPackageJson();
      if (packageJson) {
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.next) this.framework = 'nextjs';
        else if (deps.nuxt) this.framework = 'vue';
        else if (deps.react) this.framework = 'react';
        else if (deps.vue) this.framework = 'vue';
        else if (deps['@nestjs/core']) this.framework = 'nestjs';
        else if (deps.express) this.framework = 'express';
        else this.framework = 'node';
      }

      logger.info('DeploymentManager initialized', { packageManager: this.packageManager, framework: this.framework });
    } catch (error) {
      logger.error('Failed to initialize DeploymentManager', error);
    }
  }

  // ============================================
  // Production Build
  // ============================================

  /**
   * Build project for production
   */
  async buildForProduction(options: {
    mode?: BuildMode;
    optimization?: BuildOptimization;
    env?: Record<string, string>;
    outputDir?: string;
  } = {}): Promise<{ success: boolean; duration: number; output: string; errors: string[] }> {
    const { mode = 'production', optimization = {}, env = {}, outputDir } = options;
    const startTime = Date.now();
    const errors: string[] = [];
    let output = '';

    this.emit('build:start', { projectPath: this.projectPath, mode });

    try {
      // Set environment
      const buildEnv: Record<string, string> = {
        NODE_ENV: mode,
        ...env
      };

      // Add optimization flags
      if (optimization.sourceMaps === false) {
        buildEnv.GENERATE_SOURCEMAP = 'false';
      }
      if (optimization.analyze) {
        buildEnv.ANALYZE = 'true';
      }

      // Get build command
      const packageJson = await this.readPackageJson();
      let buildCommand = packageJson?.scripts?.build || 'npm run build';
      
      // Modify for package manager
      if (this.packageManager !== 'npm') {
        buildCommand = buildCommand.replace(/^npm run/, `${this.packageManager} run`);
      }

      this.emit('build:progress', { message: 'Running build command...', progress: 30 });

      // Execute build
      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: this.projectPath,
        env: buildEnv
      });

      output = stdout + stderr;

      // Check for output directory
      if (outputDir) {
        const defaultOutputs = ['dist', 'build', '.next', 'out'];
        for (const dir of defaultOutputs) {
          const sourcePath = path.join(this.projectPath, dir);
          if (await this.fileExists(sourcePath)) {
            const targetPath = path.join(this.projectPath, outputDir);
            if (sourcePath !== targetPath) {
              await fs.rename(sourcePath, targetPath);
            }
            break;
          }
        }
      }

      const duration = Date.now() - startTime;
      this.emit('build:complete', { success: true, duration });
      this.emit('build:progress', { message: 'Build completed successfully', progress: 100 });

      return { success: true, duration, output, errors };
    } catch (error: any) {
      errors.push(error.message || 'Build failed');
      if (error.stderr) errors.push(error.stderr);
      
      const duration = Date.now() - startTime;
      this.emit('build:complete', { success: false, duration });
      this.emit('error', { message: 'Build failed', code: 'BUILD_FAILED' });

      return { success: false, duration, output: error.stdout || '', errors };
    }
  }

  // ============================================
  // Dockerfile Generation
  // ============================================

  /**
   * Generate Dockerfile for the project
   */
  generateDockerfile(config: DockerConfig = {}): GeneratedFile {
    const {
      baseImage,
      nodeVersion = '20',
      exposePort = 3000,
      workDir = '/app',
      buildCommand,
      startCommand,
      env = {},
      healthCheck,
      multiStage = true,
      alpine = true,
      user = 'node',
      labels = {}
    } = config;

    const imageSuffix = alpine ? '-alpine' : '';
    const defaultBaseImage = baseImage || `node:${nodeVersion}${imageSuffix}`;
    const pmCommands = this.getPackageManagerCommands();

    let dockerfile = '';

    if (multiStage) {
      // Multi-stage build for smaller production images
      dockerfile = `# Build stage
FROM ${defaultBaseImage} AS builder

WORKDIR ${workDir}

# Copy package files
COPY package*.json ./
${this.packageManager === 'pnpm' ? 'COPY pnpm-lock.yaml ./\n' : ''}${this.packageManager === 'yarn' ? 'COPY yarn.lock ./\n' : ''}

# Install dependencies
RUN ${pmCommands.install}

# Copy source files
COPY . .

# Build application
RUN ${buildCommand || pmCommands.build}

# Production stage
FROM ${defaultBaseImage} AS production

WORKDIR ${workDir}

# Set environment variables
ENV NODE_ENV=production
${Object.entries(env).map(([key, value]) => `ENV ${key}=${value}`).join('\n')}

# Copy package files for production dependencies
COPY package*.json ./
${this.packageManager === 'pnpm' ? 'COPY pnpm-lock.yaml ./\n' : ''}${this.packageManager === 'yarn' ? 'COPY yarn.lock ./\n' : ''}

# Install production dependencies only
RUN ${pmCommands.installProd}

# Copy built application from builder stage
COPY --from=builder ${workDir}/dist ./dist
${this.framework === 'nextjs' ? `COPY --from=builder ${workDir}/.next ./.next\nCOPY --from=builder ${workDir}/public ./public\n` : ''}

# Add labels
${Object.entries(labels).map(([key, value]) => `LABEL ${key}="${value}"`).join('\n')}

# Create non-root user for security
USER ${user}

# Expose port
EXPOSE ${exposePort}

${healthCheck ? `# Health check
HEALTHCHECK --interval=${healthCheck.interval || '30s'} --timeout=${healthCheck.timeout || '10s'} --retries=${healthCheck.retries || 3} \\
  CMD ${healthCheck.command}

` : ''}# Start application
CMD ${JSON.stringify((startCommand || pmCommands.start).split(' '))}
`;
    } else {
      // Single stage build
      dockerfile = `FROM ${defaultBaseImage}

WORKDIR ${workDir}

# Set environment variables
ENV NODE_ENV=production
${Object.entries(env).map(([key, value]) => `ENV ${key}=${value}`).join('\n')}

# Copy package files
COPY package*.json ./
${this.packageManager === 'pnpm' ? 'COPY pnpm-lock.yaml ./\n' : ''}${this.packageManager === 'yarn' ? 'COPY yarn.lock ./\n' : ''}

# Install dependencies
RUN ${pmCommands.install}

# Copy source files
COPY . .

# Build application
RUN ${buildCommand || pmCommands.build}

# Add labels
${Object.entries(labels).map(([key, value]) => `LABEL ${key}="${value}"`).join('\n')}

# Create non-root user for security
USER ${user}

# Expose port
EXPOSE ${exposePort}

${healthCheck ? `# Health check
HEALTHCHECK --interval=${healthCheck.interval || '30s'} --timeout=${healthCheck.timeout || '10s'} --retries=${healthCheck.retries || 3} \\
  CMD ${healthCheck.command}

` : ''}# Start application
CMD ${JSON.stringify((startCommand || pmCommands.start).split(' '))}
`;
    }

    const result: GeneratedFile = {
      path: 'Dockerfile',
      content: dockerfile,
      description: 'Docker container configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate .dockerignore file
   */
  generateDockerignore(): GeneratedFile {
    const content = `# Dependencies
node_modules
npm-debug.log
yarn-error.log
.pnpm-store

# Build output (will be built in container)
dist
build
.next
out

# Development files
.git
.gitignore
*.md
LICENSE

# IDE
.vscode
.idea
*.swp
*.swo

# Environment files (should be passed at runtime)
.env
.env.*
!.env.example

# Test files
tests
__tests__
*.test.ts
*.test.js
*.spec.ts
*.spec.js
coverage
.nyc_output

# Documentation
docs
*.md

# OS files
.DS_Store
Thumbs.db

# Logs
logs
*.log

# Temporary files
tmp
temp
*.tmp
`;

    const result: GeneratedFile = {
      path: '.dockerignore',
      content,
      description: 'Docker build ignore patterns'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate Docker Compose file
   */
  generateDockerCompose(config: ComposeConfig): GeneratedFile {
    const { services, networks = {}, volumes = {} } = config;

    const composeObj: any = {
      version: config.version || '3.8',
      services: {}
    };

    for (const service of services) {
      const serviceConfig: any = {};
      
      if (service.build) serviceConfig.build = service.build;
      if (service.image) serviceConfig.image = service.image;
      if (service.ports && service.ports.length > 0) serviceConfig.ports = service.ports;
      if (service.environment) serviceConfig.environment = service.environment;
      if (service.volumes && service.volumes.length > 0) serviceConfig.volumes = service.volumes;
      if (service.depends_on && service.depends_on.length > 0) serviceConfig.depends_on = service.depends_on;
      if (service.command) serviceConfig.command = service.command;
      if (service.networks && service.networks.length > 0) serviceConfig.networks = service.networks;
      if (service.restart) serviceConfig.restart = service.restart;
      if (service.healthcheck) serviceConfig.healthcheck = service.healthcheck;

      composeObj.services[service.name] = serviceConfig;
    }

    if (Object.keys(networks).length > 0) {
      composeObj.networks = networks;
    }
    if (Object.keys(volumes).length > 0) {
      composeObj.volumes = volumes;
    }

    // Convert to YAML-like format
    const content = this.toYaml(composeObj);

    const result: GeneratedFile = {
      path: 'docker-compose.yml',
      content,
      description: 'Docker Compose multi-container configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  // ============================================
  // CI/CD Pipeline Generation
  // ============================================

  /**
   * Generate CI/CD pipeline configuration
   */
  generateCICDPipeline(config: CICDConfig): GeneratedFile {
    switch (config.provider) {
      case 'github-actions':
        return this.generateGitHubActions(config);
      case 'gitlab-ci':
        return this.generateGitLabCI(config);
      case 'bitbucket-pipelines':
        return this.generateBitbucketPipelines(config);
      case 'azure-pipelines':
        return this.generateAzurePipelines(config);
      case 'circleci':
        return this.generateCircleCI(config);
      default:
        return this.generateGitHubActions(config);
    }
  }

  /**
   * Generate GitHub Actions workflow
   */
  private generateGitHubActions(config: CICDConfig): GeneratedFile {
    const {
      branches = ['main', 'master'],
      triggers = ['push', 'pull_request'],
      nodeVersion = '20',
      installCommand,
      buildCommand,
      testCommand,
      lintCommand,
      deployCommand,
      cacheDirectories = ['node_modules'],
      env = {},
      secrets = []
    } = config;

    const pmCommands = this.getPackageManagerCommands();
    const cacheKey = this.packageManager === 'pnpm' ? 'pnpm' : 
                     this.packageManager === 'yarn' ? 'yarn' : 'npm';

    const workflow: any = {
      name: 'CI/CD Pipeline',
      on: {}
    };

    if (triggers.includes('push')) {
      workflow.on.push = { branches };
    }
    if (triggers.includes('pull_request')) {
      workflow.on.pull_request = { branches };
    }
    if (triggers.includes('manual')) {
      workflow.on.workflow_dispatch = {};
    }

    workflow.env = {
      NODE_ENV: 'test',
      ...env
    };

    workflow.jobs = {
      build: {
        'runs-on': 'ubuntu-latest',
        steps: [
          {
            name: 'Checkout code',
            uses: 'actions/checkout@v4'
          },
          {
            name: 'Setup Node.js',
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': nodeVersion,
              cache: cacheKey
            }
          }
        ]
      }
    };

    // Add pnpm setup if needed
    if (this.packageManager === 'pnpm') {
      workflow.jobs.build.steps.push({
        name: 'Setup pnpm',
        uses: 'pnpm/action-setup@v2',
        with: { version: 8 }
      });
    }

    // Install dependencies
    workflow.jobs.build.steps.push({
      name: 'Install dependencies',
      run: installCommand || pmCommands.install
    });

    // Lint step
    if (lintCommand) {
      workflow.jobs.build.steps.push({
        name: 'Lint code',
        run: lintCommand
      });
    }

    // Test step
    if (testCommand) {
      workflow.jobs.build.steps.push({
        name: 'Run tests',
        run: testCommand
      });
    }

    // Build step
    workflow.jobs.build.steps.push({
      name: 'Build application',
      run: buildCommand || pmCommands.build
    });

    // Upload artifact
    workflow.jobs.build.steps.push({
      name: 'Upload build artifact',
      uses: 'actions/upload-artifact@v4',
      with: {
        name: 'build',
        path: this.framework === 'nextjs' ? '.next' : 'dist'
      }
    });

    // Deploy job if configured
    if (deployCommand) {
      workflow.jobs.deploy = {
        needs: 'build',
        'runs-on': 'ubuntu-latest',
        if: "github.ref == 'refs/heads/main'",
        steps: [
          {
            name: 'Checkout code',
            uses: 'actions/checkout@v4'
          },
          {
            name: 'Download build artifact',
            uses: 'actions/download-artifact@v4',
            with: { name: 'build' }
          },
          {
            name: 'Deploy',
            run: deployCommand,
            env: secrets.reduce((acc, secret) => {
              acc[secret] = `\${{ secrets.${secret} }}`;
              return acc;
            }, {} as Record<string, string>)
          }
        ]
      };
    }

    const content = this.toYaml(workflow);

    const result: GeneratedFile = {
      path: '.github/workflows/ci.yml',
      content,
      description: 'GitHub Actions CI/CD workflow'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate GitLab CI configuration
   */
  private generateGitLabCI(config: CICDConfig): GeneratedFile {
    const {
      nodeVersion = '20',
      installCommand,
      buildCommand,
      testCommand,
      lintCommand,
      cacheDirectories = ['node_modules'],
      stages = []
    } = config;

    const pmCommands = this.getPackageManagerCommands();

    let content = `image: node:${nodeVersion}-alpine

stages:
  - install
  - lint
  - test
  - build
  - deploy

cache:
  key: \${CI_COMMIT_REF_SLUG}
  paths:
${cacheDirectories.map(dir => `    - ${dir}/`).join('\n')}

install:
  stage: install
  script:
    - ${installCommand || pmCommands.install}
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour

`;

    if (lintCommand) {
      content += `lint:
  stage: lint
  needs: [install]
  script:
    - ${lintCommand}

`;
    }

    if (testCommand) {
      content += `test:
  stage: test
  needs: [install]
  script:
    - ${testCommand}
  coverage: '/Lines\\s*:\\s*(\\d+\\.?\\d*)%/'

`;
    }

    content += `build:
  stage: build
  needs: [install${lintCommand ? ', lint' : ''}${testCommand ? ', test' : ''}]
  script:
    - ${buildCommand || pmCommands.build}
  artifacts:
    paths:
      - ${this.framework === 'nextjs' ? '.next/' : 'dist/'}
    expire_in: 1 week

deploy:
  stage: deploy
  needs: [build]
  script:
    - echo "Deploying application..."
  only:
    - main
    - master
  when: manual
`;

    const result: GeneratedFile = {
      path: '.gitlab-ci.yml',
      content,
      description: 'GitLab CI/CD pipeline configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate Bitbucket Pipelines configuration
   */
  private generateBitbucketPipelines(config: CICDConfig): GeneratedFile {
    const { nodeVersion = '20', installCommand, buildCommand, testCommand } = config;
    const pmCommands = this.getPackageManagerCommands();

    const content = `image: node:${nodeVersion}

definitions:
  caches:
    nodemodules: node_modules

pipelines:
  default:
    - step:
        name: Install and Test
        caches:
          - nodemodules
        script:
          - ${installCommand || pmCommands.install}
${testCommand ? `          - ${testCommand}\n` : ''}
    - step:
        name: Build
        caches:
          - nodemodules
        script:
          - ${installCommand || pmCommands.install}
          - ${buildCommand || pmCommands.build}
        artifacts:
          - ${this.framework === 'nextjs' ? '.next/**' : 'dist/**'}

  branches:
    main:
      - step:
          name: Install and Test
          caches:
            - nodemodules
          script:
            - ${installCommand || pmCommands.install}
${testCommand ? `            - ${testCommand}\n` : ''}
      - step:
          name: Build and Deploy
          deployment: production
          caches:
            - nodemodules
          script:
            - ${installCommand || pmCommands.install}
            - ${buildCommand || pmCommands.build}
            - echo "Deploying to production..."
`;

    const result: GeneratedFile = {
      path: 'bitbucket-pipelines.yml',
      content,
      description: 'Bitbucket Pipelines CI/CD configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate Azure Pipelines configuration
   */
  private generateAzurePipelines(config: CICDConfig): GeneratedFile {
    const { nodeVersion = '20', installCommand, buildCommand, testCommand } = config;
    const pmCommands = this.getPackageManagerCommands();

    const content = `trigger:
  branches:
    include:
      - main
      - master

pool:
  vmImage: 'ubuntu-latest'

variables:
  NODE_VERSION: '${nodeVersion}'

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        displayName: 'Build'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '\$(NODE_VERSION)'
            displayName: 'Install Node.js'

          - script: ${installCommand || pmCommands.install}
            displayName: 'Install dependencies'

${testCommand ? `          - script: ${testCommand}
            displayName: 'Run tests'\n` : ''}
          - script: ${buildCommand || pmCommands.build}
            displayName: 'Build application'

          - task: PublishBuildArtifacts@1
            inputs:
              PathtoPublish: '${this.framework === 'nextjs' ? '.next' : 'dist'}'
              ArtifactName: 'build'
            displayName: 'Publish artifacts'

  - stage: Deploy
    displayName: 'Deploy'
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployJob
        displayName: 'Deploy to Production'
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - script: echo "Deploying application..."
                  displayName: 'Deploy'
`;

    const result: GeneratedFile = {
      path: 'azure-pipelines.yml',
      content,
      description: 'Azure Pipelines CI/CD configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate CircleCI configuration
   */
  private generateCircleCI(config: CICDConfig): GeneratedFile {
    const { nodeVersion = '20', installCommand, buildCommand, testCommand } = config;
    const pmCommands = this.getPackageManagerCommands();

    const content = `version: 2.1

orbs:
  node: circleci/node@5.0

jobs:
  build-and-test:
    docker:
      - image: cimg/node:${nodeVersion}
    steps:
      - checkout
      - node/install-packages:
          pkg-manager: ${this.packageManager}
${testCommand ? `      - run:
          name: Run tests
          command: ${testCommand}\n` : ''}      - run:
          name: Build application
          command: ${buildCommand || pmCommands.build}
      - persist_to_workspace:
          root: .
          paths:
            - ${this.framework === 'nextjs' ? '.next' : 'dist'}

  deploy:
    docker:
      - image: cimg/node:${nodeVersion}
    steps:
      - checkout
      - attach_workspace:
          at: .
      - run:
          name: Deploy
          command: echo "Deploying application..."

workflows:
  build-deploy:
    jobs:
      - build-and-test
      - deploy:
          requires:
            - build-and-test
          filters:
            branches:
              only:
                - main
                - master
`;

    const result: GeneratedFile = {
      path: '.circleci/config.yml',
      content,
      description: 'CircleCI CI/CD configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  // ============================================
  // Platform-Specific Configurations
  // ============================================

  /**
   * Generate Vercel configuration
   */
  generateVercelConfig(config: PlatformConfig): GeneratedFile {
    const vercelConfig: any = {
      framework: config.framework || this.detectFrameworkForVercel()
    };

    if (config.buildCommand) {
      vercelConfig.buildCommand = config.buildCommand;
    }
    if (config.outputDirectory) {
      vercelConfig.outputDirectory = config.outputDirectory;
    }
    if (config.installCommand) {
      vercelConfig.installCommand = config.installCommand;
    }
    if (config.headers) {
      vercelConfig.headers = Object.entries(config.headers).map(([source, value]) => ({
        source,
        headers: [{ key: source.split(':')[0], value }]
      }));
    }
    if (config.redirects && config.redirects.length > 0) {
      vercelConfig.redirects = config.redirects;
    }
    if (config.rewrites && config.rewrites.length > 0) {
      vercelConfig.rewrites = config.rewrites;
    }

    const content = JSON.stringify(vercelConfig, null, 2);

    const result: GeneratedFile = {
      path: 'vercel.json',
      content,
      description: 'Vercel deployment configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate Netlify configuration
   */
  generateNetlifyConfig(config: PlatformConfig): GeneratedFile {
    const pmCommands = this.getPackageManagerCommands();

    let content = `[build]
  publish = "${config.outputDirectory || this.getDefaultOutputDir()}"
  command = "${config.buildCommand || pmCommands.build}"

[build.environment]
  NODE_VERSION = "${config.nodeVersion || '20'}"

`;

    if (config.redirects && config.redirects.length > 0) {
      content += `# Redirects\n`;
      for (const redirect of config.redirects) {
        content += `[[redirects]]
  from = "${redirect.source}"
  to = "${redirect.destination}"
  status = ${redirect.statusCode || 301}

`;
      }
    }

    if (config.headers) {
      content += `# Headers\n`;
      for (const [path, value] of Object.entries(config.headers)) {
        content += `[[headers]]
  for = "${path}"
  [headers.values]
    ${value}

`;
      }
    }

    // Add functions config if needed
    content += `# Functions (optional)
[functions]
  directory = "netlify/functions"
`;

    const result: GeneratedFile = {
      path: 'netlify.toml',
      content,
      description: 'Netlify deployment configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate Railway configuration
   */
  generateRailwayConfig(config: PlatformConfig): GeneratedFile {
    const pmCommands = this.getPackageManagerCommands();

    const railwayConfig = {
      build: {
        builder: 'nixpacks',
        buildCommand: config.buildCommand || pmCommands.build
      },
      deploy: {
        startCommand: pmCommands.start,
        healthcheckPath: '/health',
        restartPolicyType: 'ON_FAILURE'
      }
    };

    const content = JSON.stringify(railwayConfig, null, 2);

    const result: GeneratedFile = {
      path: 'railway.json',
      content,
      description: 'Railway deployment configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate Fly.io configuration
   */
  generateFlyConfig(config: PlatformConfig): GeneratedFile {
    const appName = config.projectName || 'my-app';
    const region = config.region || 'iad';

    const content = `# fly.toml app configuration file
#
# See https://fly.io/docs/reference/configuration/ for information about how to use this file.
#

app = "${appName}"
primary_region = "${region}"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256

[checks]
  [checks.health]
    grace_period = "10s"
    interval = "30s"
    method = "get"
    path = "/health"
    timeout = "5s"
    type = "http"
`;

    const result: GeneratedFile = {
      path: 'fly.toml',
      content,
      description: 'Fly.io deployment configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Generate Render configuration
   */
  generateRenderConfig(config: PlatformConfig): GeneratedFile {
    const pmCommands = this.getPackageManagerCommands();

    const renderConfig = {
      services: [
        {
          type: 'web',
          name: config.projectName || 'web-service',
          env: 'node',
          plan: 'free',
          buildCommand: `${pmCommands.install} && ${pmCommands.build}`,
          startCommand: pmCommands.start,
          healthCheckPath: '/health',
          envVars: Object.entries(config.env || {}).map(([key, value]) => ({
            key,
            value
          }))
        }
      ]
    };

    const content = this.toYaml(renderConfig);

    const result: GeneratedFile = {
      path: 'render.yaml',
      content,
      description: 'Render deployment configuration'
    };

    this.emit('file:generated', result);
    return result;
  }

  // ============================================
  // Deployment Execution
  // ============================================

  /**
   * Deploy to a platform
   */
  async deploy(platform: DeploymentPlatform, options: {
    env?: Record<string, string>;
    production?: boolean;
    dryRun?: boolean;
  } = {}): Promise<DeploymentResult> {
    const { env = {}, production = true, dryRun = false } = options;
    const startTime = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];

    this.emit('deploy:start', { platform });

    const result: DeploymentResult = {
      success: false,
      status: 'pending',
      platform,
      logs,
      errors
    };

    try {
      // Check if platform CLI is installed
      const cliCommands: Record<DeploymentPlatform, string> = {
        vercel: 'vercel',
        netlify: 'netlify',
        aws: 'aws',
        azure: 'az',
        docker: 'docker',
        railway: 'railway',
        fly: 'fly',
        render: 'render',
        heroku: 'heroku'
      };

      const cliCommand = cliCommands[platform];
      const cliExists = await commandExists(cliCommand);

      if (!cliExists && !dryRun) {
        throw new Error(`${platform} CLI is not installed. Please install ${cliCommand} first.`);
      }

      result.status = 'building';
      this.emit('deploy:progress', { message: 'Building for production...', step: 'build' });

      // Build for production
      if (!dryRun) {
        const buildResult = await this.buildForProduction({ 
          mode: 'production',
          env 
        });

        if (!buildResult.success) {
          throw new Error('Production build failed: ' + buildResult.errors.join(', '));
        }
        logs.push('Build completed successfully');
      } else {
        logs.push('[DRY RUN] Would build for production');
      }

      result.status = 'deploying';
      this.emit('deploy:progress', { message: `Deploying to ${platform}...`, step: 'deploy' });

      // Execute platform-specific deployment
      let deployCommand = '';
      switch (platform) {
        case 'vercel':
          deployCommand = production ? 'vercel --prod' : 'vercel';
          break;
        case 'netlify':
          deployCommand = production ? 'netlify deploy --prod' : 'netlify deploy';
          break;
        case 'railway':
          deployCommand = 'railway up';
          break;
        case 'fly':
          deployCommand = 'fly deploy';
          break;
        case 'docker':
          deployCommand = 'docker build -t app . && docker push app';
          break;
        default:
          deployCommand = `echo "Deployment to ${platform} - configure manually"`;
      }

      if (!dryRun) {
        const { stdout, stderr } = await execAsync(deployCommand, {
          cwd: this.projectPath,
          env: { ...getCleanEnv(), ...env }
        });
        logs.push(stdout);
        if (stderr) logs.push(stderr);

        // Try to extract URL from output
        const urlMatch = stdout.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          result.url = urlMatch[0];
        }
      } else {
        logs.push(`[DRY RUN] Would run: ${deployCommand}`);
      }

      result.success = true;
      result.status = 'deployed';
      result.deployTime = Date.now() - startTime;

      this.deploymentHistory.push(result);
      this.emit('deploy:complete', result);

      return result;
    } catch (error: any) {
      result.success = false;
      result.status = 'failed';
      result.errors.push(error.message || 'Deployment failed');
      
      this.emit('error', { message: error.message, code: 'DEPLOY_FAILED' });
      this.deploymentHistory.push(result);

      return result;
    }
  }

  /**
   * Cancel current deployment
   */
  cancelDeployment(): boolean {
    if (this.currentDeployment) {
      this.currentDeployment.kill('SIGTERM');
      this.currentDeployment = null;
      return true;
    }
    return false;
  }

  // ============================================
  // Environment Management
  // ============================================

  /**
   * Generate environment template file
   */
  generateEnvTemplate(variables: Record<string, { description: string; default?: string; required?: boolean }>): GeneratedFile {
    let content = '# Environment Variables\n# Generated by The Joker Deployment Manager\n\n';

    for (const [key, config] of Object.entries(variables)) {
      content += `# ${config.description}${config.required ? ' (REQUIRED)' : ''}\n`;
      content += `${key}=${config.default || ''}\n\n`;
    }

    const result: GeneratedFile = {
      path: '.env.example',
      content,
      description: 'Environment variables template'
    };

    this.emit('file:generated', result);
    return result;
  }

  /**
   * Validate environment variables
   */
  async validateEnv(requiredVars: string[]): Promise<{ valid: boolean; missing: string[] }> {
    const missing: string[] = [];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get deployment history
   */
  getDeploymentHistory(): DeploymentResult[] {
    return [...this.deploymentHistory];
  }

  /**
   * Get last deployment
   */
  getLastDeployment(): DeploymentResult | null {
    return this.deploymentHistory.length > 0 
      ? this.deploymentHistory[this.deploymentHistory.length - 1] 
      : null;
  }

  /**
   * Clear deployment history
   */
  clearHistory(): void {
    this.deploymentHistory = [];
  }

  /**
   * Save generated files to disk
   */
  async saveFiles(files: GeneratedFile[]): Promise<{ saved: string[]; errors: string[] }> {
    const saved: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.projectPath, file.path);
        const dir = path.dirname(filePath);
        
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf-8');
        
        saved.push(file.path);
        logger.info(`Generated: ${file.path}`);
      } catch (error: any) {
        errors.push(`Failed to save ${file.path}: ${error.message}`);
      }
    }

    return { saved, errors };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectPath, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  private async readPackageJson(): Promise<any | null> {
    try {
      const content = await fs.readFile(path.join(this.projectPath, 'package.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private getPackageManagerCommands(): { install: string; installProd: string; build: string; start: string } {
    switch (this.packageManager) {
      case 'yarn':
        return {
          install: 'yarn install --frozen-lockfile',
          installProd: 'yarn install --frozen-lockfile --production',
          build: 'yarn build',
          start: 'yarn start'
        };
      case 'pnpm':
        return {
          install: 'pnpm install --frozen-lockfile',
          installProd: 'pnpm install --frozen-lockfile --prod',
          build: 'pnpm build',
          start: 'pnpm start'
        };
      case 'bun':
        return {
          install: 'bun install --frozen-lockfile',
          installProd: 'bun install --frozen-lockfile --production',
          build: 'bun run build',
          start: 'bun run start'
        };
      default:
        return {
          install: 'npm ci',
          installProd: 'npm ci --only=production',
          build: 'npm run build',
          start: 'npm start'
        };
    }
  }

  private detectFrameworkForVercel(): string | undefined {
    switch (this.framework) {
      case 'nextjs': return 'nextjs';
      case 'react': return 'create-react-app';
      case 'vue': return 'vue';
      default: return undefined;
    }
  }

  private getDefaultOutputDir(): string {
    switch (this.framework) {
      case 'nextjs': return '.next';
      case 'react': return 'build';
      default: return 'dist';
    }
  }

  private toYaml(obj: any, indent = 0): string {
    let result = '';
    const spaces = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        result += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            result += `${spaces}  -\n${this.toYaml(item, indent + 2).replace(/^(\s*)(\S)/gm, '$1  $2')}`;
          } else {
            result += `${spaces}  - ${item}\n`;
          }
        }
      } else if (typeof value === 'object') {
        result += `${spaces}${key}:\n${this.toYaml(value, indent + 1)}`;
      } else if (typeof value === 'string' && (value.includes('\n') || value.includes(':'))) {
        result += `${spaces}${key}: "${value.replace(/"/g, '\\"')}"\n`;
      } else {
        result += `${spaces}${key}: ${value}\n`;
      }
    }

    return result;
  }
}

// ============================================
// Factory Functions & Singletons
// ============================================

let defaultDeployer: DeploymentManager | null = null;
const deployerCache = new Map<string, DeploymentManager>();

/**
 * Get or create the default deployment manager
 */
export function getDeploymentManager(projectPath?: string): DeploymentManager {
  const resolvedPath = path.resolve(projectPath || process.cwd());
  
  if (deployerCache.has(resolvedPath)) {
    return deployerCache.get(resolvedPath)!;
  }

  const deployer = new DeploymentManager(resolvedPath);
  deployerCache.set(resolvedPath, deployer);
  
  if (!defaultDeployer) {
    defaultDeployer = deployer;
  }

  return deployer;
}

/**
 * Create a new deployment manager
 */
export function createDeploymentManager(projectPath?: string): DeploymentManager {
  return new DeploymentManager(projectPath);
}

/**
 * Default deployer instance
 */
export const deploymentManager = getDeploymentManager();

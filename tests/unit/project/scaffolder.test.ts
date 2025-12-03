/**
 * The Joker - Agentic Terminal
 * Project Scaffolder Tests
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  ProjectScaffolder, 
  FrameworkDetectionResult,
  ScaffoldOptions 
} from '../../../src/project/scaffolder';
import { ProjectSpec, ScaffoldResult, Framework } from '../../../src/types';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Helper to normalize paths for cross-platform tests
const normalizePath = (p: string): string => p.replace(/\\/g, '/');

// Mock LMStudioClient
const mockLLMClient = {
  chat: jest.fn(),
  healthCheck: jest.fn()
};

describe('ProjectScaffolder', () => {
  let scaffolder: ProjectScaffolder;

  beforeEach(() => {
    jest.clearAllMocks();
    scaffolder = new ProjectScaffolder();
    
    // Default mock implementations
    mockFs.access.mockRejectedValue(new Error('ENOENT'));
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  // ============================================
  // Constructor & Configuration Tests
  // ============================================

  describe('constructor', () => {
    it('should create scaffolder without LLM client', () => {
      const s = new ProjectScaffolder();
      expect(s).toBeInstanceOf(ProjectScaffolder);
    });

    it('should create scaffolder with LLM client', () => {
      const s = new ProjectScaffolder(mockLLMClient as any);
      expect(s).toBeInstanceOf(ProjectScaffolder);
    });
  });

  describe('setLLMClient', () => {
    it('should set the LLM client', () => {
      scaffolder.setLLMClient(mockLLMClient as any);
      // No error means success
      expect(true).toBe(true);
    });
  });

  // ============================================
  // React Project Tests
  // ============================================

  describe('create - React', () => {
    const reactSpec: ProjectSpec = {
      name: 'test-react-app',
      framework: 'react',
      language: 'typescript',
      features: [],
      path: '/projects'
    };

    it('should create a React TypeScript project', async () => {
      const result = await scaffolder.create(reactSpec);

      expect(result.success).toBe(true);
      expect(normalizePath(result.projectPath)).toBe('/projects/test-react-app');
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('index.html');
      expect(result.filesCreated).toContain('src/main.tsx');
      expect(result.filesCreated).toContain('src/App.tsx');
      expect(result.filesCreated).toContain('vite.config.ts');
      expect(result.filesCreated).toContain('tsconfig.json');
      expect(result.commands).toContain('npm install');
      expect(result.commands).toContain('npm run dev');
    });

    it('should create a React JavaScript project', async () => {
      const jsSpec = { ...reactSpec, language: 'javascript' as const };
      const result = await scaffolder.create(jsSpec);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('src/main.jsx');
      expect(result.filesCreated).toContain('src/App.jsx');
      expect(result.filesCreated).not.toContain('tsconfig.json');
    });

    it('should add Tailwind CSS files when specified', async () => {
      const tailwindSpec = { ...reactSpec, styling: 'tailwind' as const };
      const result = await scaffolder.create(tailwindSpec);

      expect(result.filesCreated).toContain('tailwind.config.js');
      expect(result.filesCreated).toContain('postcss.config.js');
    });

    it('should emit events during scaffolding', async () => {
      const events: string[] = [];
      scaffolder.on('start', () => events.push('start'));
      scaffolder.on('directory-created', () => events.push('directory-created'));
      scaffolder.on('file-created', () => events.push('file-created'));
      scaffolder.on('complete', () => events.push('complete'));

      await scaffolder.create(reactSpec);

      expect(events).toContain('start');
      expect(events).toContain('directory-created');
      expect(events).toContain('file-created');
      expect(events).toContain('complete');
    });

    it('should throw if directory exists without overwrite option', async () => {
      mockFs.access.mockResolvedValue(undefined); // Directory exists

      await expect(scaffolder.create(reactSpec))
        .rejects.toThrow('already exists');
    });

    it('should overwrite existing directory when option is set', async () => {
      mockFs.access.mockResolvedValue(undefined); // Directory exists

      const result = await scaffolder.create(reactSpec, { overwrite: true });

      expect(result.success).toBe(true);
    });

    it('should add gitignore when gitInit option is true', async () => {
      const result = await scaffolder.create(reactSpec, { gitInit: true });

      expect(result.filesCreated).toContain('.gitignore');
    });
  });

  // ============================================
  // Next.js Project Tests
  // ============================================

  describe('create - Next.js', () => {
    const nextSpec: ProjectSpec = {
      name: 'test-next-app',
      framework: 'nextjs',
      language: 'typescript',
      features: [],
      path: '/projects'
    };

    it('should create a Next.js TypeScript project', async () => {
      const result = await scaffolder.create(nextSpec);

      expect(result.success).toBe(true);
      expect(normalizePath(result.projectPath)).toBe('/projects/test-next-app');
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('app/layout.tsx');
      expect(result.filesCreated).toContain('app/page.tsx');
      expect(result.filesCreated).toContain('app/api/hello/route.ts');
      expect(result.filesCreated).toContain('next.config.js');
      expect(result.filesCreated).toContain('tsconfig.json');
    });

    it('should create a Next.js JavaScript project', async () => {
      const jsSpec = { ...nextSpec, language: 'javascript' as const };
      const result = await scaffolder.create(jsSpec);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('app/layout.jsx');
      expect(result.filesCreated).toContain('app/page.jsx');
    });

    it('should have proper next steps', async () => {
      const result = await scaffolder.create(nextSpec);

      expect(result.nextSteps).toContain('npm install');
      expect(result.nextSteps).toContain('npm run dev');
      expect(result.nextSteps.some((s: string) => s.includes('localhost:3000'))).toBe(true);
    });
  });

  // ============================================
  // Vue Project Tests
  // ============================================

  describe('create - Vue', () => {
    const vueSpec: ProjectSpec = {
      name: 'test-vue-app',
      framework: 'vue',
      language: 'typescript',
      features: [],
      path: '/projects'
    };

    it('should create a Vue TypeScript project', async () => {
      const result = await scaffolder.create(vueSpec);

      expect(result.success).toBe(true);
      expect(normalizePath(result.projectPath)).toBe('/projects/test-vue-app');
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('src/main.ts');
      expect(result.filesCreated).toContain('src/App.vue');
      expect(result.filesCreated).toContain('src/components/HelloWorld.vue');
      expect(result.filesCreated).toContain('vite.config.ts');
      expect(result.filesCreated).toContain('tsconfig.json');
      expect(result.filesCreated).toContain('env.d.ts');
    });

    it('should create a Vue JavaScript project', async () => {
      const jsSpec = { ...vueSpec, language: 'javascript' as const };
      const result = await scaffolder.create(jsSpec);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('src/main.js');
      expect(result.filesCreated).not.toContain('env.d.ts');
    });
  });

  // ============================================
  // Express Project Tests
  // ============================================

  describe('create - Express', () => {
    const expressSpec: ProjectSpec = {
      name: 'test-express-api',
      framework: 'express',
      language: 'typescript',
      features: [],
      path: '/projects'
    };

    it('should create an Express TypeScript project', async () => {
      const result = await scaffolder.create(expressSpec);

      expect(result.success).toBe(true);
      expect(normalizePath(result.projectPath)).toBe('/projects/test-express-api');
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('src/index.ts');
      expect(result.filesCreated).toContain('src/app.ts');
      expect(result.filesCreated).toContain('src/routes/index.ts');
      expect(result.filesCreated).toContain('src/middleware/errorHandler.ts');
      expect(result.filesCreated).toContain('tsconfig.json');
      expect(result.filesCreated).toContain('.env.example');
    });

    it('should create an Express JavaScript project', async () => {
      const jsSpec = { ...expressSpec, language: 'javascript' as const };
      const result = await scaffolder.create(jsSpec);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('src/index.js');
      expect(result.filesCreated).toContain('src/app.js');
    });

    it('should have API-focused next steps', async () => {
      const result = await scaffolder.create(expressSpec);

      expect(result.nextSteps.some((s: string) => s.includes('API'))).toBe(true);
      expect(result.nextSteps.some((s: string) => s.includes('localhost:3000'))).toBe(true);
    });
  });

  // ============================================
  // NestJS Project Tests
  // ============================================

  describe('create - NestJS', () => {
    const nestSpec: ProjectSpec = {
      name: 'test-nest-api',
      framework: 'nestjs',
      language: 'typescript',
      features: [],
      path: '/projects'
    };

    it('should create a NestJS project', async () => {
      const result = await scaffolder.create(nestSpec);

      expect(result.success).toBe(true);
      expect(normalizePath(result.projectPath)).toBe('/projects/test-nest-api');
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('src/main.ts');
      expect(result.filesCreated).toContain('src/modules/app/app.module.ts');
      expect(result.filesCreated).toContain('src/modules/app/app.controller.ts');
      expect(result.filesCreated).toContain('src/modules/app/app.service.ts');
      expect(result.filesCreated).toContain('tsconfig.json');
      expect(result.filesCreated).toContain('nest-cli.json');
    });

    it('should have proper dev command', async () => {
      const result = await scaffolder.create(nestSpec);

      expect(result.commands).toContain('npm run start:dev');
    });
  });

  // ============================================
  // Node.js Project Tests
  // ============================================

  describe('create - Node', () => {
    const nodeSpec: ProjectSpec = {
      name: 'test-node-cli',
      framework: 'node',
      language: 'typescript',
      features: [],
      path: '/projects'
    };

    it('should create a Node.js TypeScript project', async () => {
      const result = await scaffolder.create(nodeSpec);

      expect(result.success).toBe(true);
      expect(normalizePath(result.projectPath)).toBe('/projects/test-node-cli');
      expect(result.filesCreated).toContain('package.json');
      expect(result.filesCreated).toContain('src/index.ts');
      expect(result.filesCreated).toContain('bin/cli.ts');
      expect(result.filesCreated).toContain('tsconfig.json');
    });

    it('should create a Node.js JavaScript project', async () => {
      const jsSpec = { ...nodeSpec, language: 'javascript' as const };
      const result = await scaffolder.create(jsSpec);

      expect(result.success).toBe(true);
      expect(result.filesCreated).toContain('src/index.js');
      expect(result.filesCreated).toContain('bin/cli.js');
    });
  });

  // ============================================
  // Framework Detection Tests (Rule-based)
  // ============================================

  describe('detectFramework - Rule-based', () => {
    it('should detect Next.js for SSR requirements', async () => {
      const result = await scaffolder.detectFramework('I need a blog with SSR for SEO');
      
      expect(result.framework).toBe('nextjs');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect Next.js for server-side rendering mention', async () => {
      const result = await scaffolder.detectFramework('Server-side rendered app');
      
      expect(result.framework).toBe('nextjs');
    });

    it('should detect Vue for Vue.js requirements', async () => {
      const result = await scaffolder.detectFramework('I want to build a Vue app');
      
      expect(result.framework).toBe('vue');
    });

    it('should detect Express for API requirements', async () => {
      const result = await scaffolder.detectFramework('I need a REST API backend');
      
      expect(result.framework).toBe('express');
    });

    it('should detect NestJS for enterprise backend', async () => {
      const result = await scaffolder.detectFramework('Build enterprise NestJS microservices backend');
      
      expect(result.framework).toBe('nestjs');
    });

    it('should detect Node for CLI requirements', async () => {
      const result = await scaffolder.detectFramework('Create a CLI tool for automation');
      
      expect(result.framework).toBe('node');
    });

    it('should detect React for frontend/SPA requirements', async () => {
      const result = await scaffolder.detectFramework('I need a frontend SPA');
      
      expect(result.framework).toBe('react');
    });

    it('should detect React for explicit React mention', async () => {
      const result = await scaffolder.detectFramework('Build a React application');
      
      expect(result.framework).toBe('react');
    });

    it('should default to React for generic web apps', async () => {
      const result = await scaffolder.detectFramework('Build a web application');
      
      expect(result.framework).toBe('react');
    });

    it('should return features based on detection', async () => {
      const result = await scaffolder.detectFramework('I need an SSR app');
      
      expect(result.features.length).toBeGreaterThan(0);
    });

    it('should recommend TypeScript by default', async () => {
      const result = await scaffolder.detectFramework('Any web app');
      
      expect(result.language).toBe('typescript');
    });

    it('should include confidence score', async () => {
      const result = await scaffolder.detectFramework('Build a React app');
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include a reason', async () => {
      const result = await scaffolder.detectFramework('Build a React app');
      
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Framework Detection Tests (LLM-based)
  // ============================================

  describe('detectFramework - LLM-based', () => {
    beforeEach(() => {
      scaffolder.setLLMClient(mockLLMClient as any);
    });

    it('should use LLM when available', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          framework: 'nextjs',
          reason: 'SSR is best for SEO',
          language: 'typescript',
          features: ['ssr', 'api-routes'],
          confidence: 0.95
        })
      });

      const result = await scaffolder.detectFramework('SEO-focused blog');

      expect(mockLLMClient.chat).toHaveBeenCalled();
      expect(result.framework).toBe('nextjs');
      expect(result.confidence).toBe(0.95);
    });

    it('should fall back to rule-based on LLM error', async () => {
      mockLLMClient.chat.mockRejectedValue(new Error('LLM error'));

      const result = await scaffolder.detectFramework('Build a React app');

      expect(result.framework).toBe('react');
    });

    it('should fall back on invalid JSON response', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'Invalid response without JSON'
      });

      const result = await scaffolder.detectFramework('Build a React app');

      expect(result.framework).toBe('react');
    });

    it('should extract JSON from mixed response', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'Here is my analysis: { "framework": "vue", "reason": "test", "language": "typescript", "features": [], "confidence": 0.9 }'
      });

      const result = await scaffolder.detectFramework('Vue project');

      expect(result.framework).toBe('vue');
    });
  });

  // ============================================
  // Initialize Project Tests
  // ============================================

  describe('initializeProject', () => {
    it('should initialize a project in an existing directory', async () => {
      const result = await scaffolder.initializeProject(
        '/existing/my-app',
        'react'
      );

      expect(result.success).toBe(true);
      expect(normalizePath(result.projectPath)).toBe('/existing/my-app');
    });

    it('should use provided spec options', async () => {
      const result = await scaffolder.initializeProject(
        '/existing/my-app',
        'react',
        { styling: 'tailwind' }
      );

      expect(result.filesCreated).toContain('tailwind.config.js');
    });

    it('should default to TypeScript', async () => {
      const result = await scaffolder.initializeProject(
        '/existing/my-app',
        'react'
      );

      expect(result.filesCreated).toContain('tsconfig.json');
    });
  });

  // ============================================
  // Package.json Generation Tests
  // ============================================

  describe('package.json generation', () => {
    it('should include correct dependencies for React', async () => {
      let packageContent = '';
      mockFs.writeFile.mockImplementation(async (filePath, content) => {
        if (String(filePath).includes('package.json')) {
          packageContent = String(content);
        }
      });

      await scaffolder.create({
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const pkg = JSON.parse(packageContent);
      expect(pkg.dependencies.react).toBeDefined();
      expect(pkg.dependencies['react-dom']).toBeDefined();
      expect(pkg.devDependencies.vite).toBeDefined();
      expect(pkg.devDependencies.typescript).toBeDefined();
    });

    it('should include Tailwind dependencies when specified', async () => {
      let packageContent = '';
      mockFs.writeFile.mockImplementation(async (filePath, content) => {
        if (String(filePath).includes('package.json')) {
          packageContent = String(content);
        }
      });

      await scaffolder.create({
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        styling: 'tailwind',
        path: '/projects'
      });

      const pkg = JSON.parse(packageContent);
      expect(pkg.devDependencies.tailwindcss).toBeDefined();
      expect(pkg.devDependencies.postcss).toBeDefined();
      expect(pkg.devDependencies.autoprefixer).toBeDefined();
    });

    it('should include Jest dependencies when specified', async () => {
      let packageContent = '';
      mockFs.writeFile.mockImplementation(async (filePath, content) => {
        if (String(filePath).includes('package.json')) {
          packageContent = String(content);
        }
      });

      await scaffolder.create({
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        testing: 'jest',
        path: '/projects'
      });

      const pkg = JSON.parse(packageContent);
      expect(pkg.devDependencies.jest).toBeDefined();
      expect(pkg.scripts.test).toBe('jest');
    });

    it('should include Vitest dependencies when specified', async () => {
      let packageContent = '';
      mockFs.writeFile.mockImplementation(async (filePath, content) => {
        if (String(filePath).includes('package.json')) {
          packageContent = String(content);
        }
      });

      await scaffolder.create({
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        testing: 'vitest',
        path: '/projects'
      });

      const pkg = JSON.parse(packageContent);
      expect(pkg.devDependencies.vitest).toBeDefined();
      expect(pkg.scripts.test).toBe('vitest');
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should throw for unsupported framework', async () => {
      await expect(scaffolder.create({
        name: 'test',
        framework: 'unknown' as Framework,
        language: 'typescript',
        features: [],
        path: '/projects'
      })).rejects.toThrow('not supported');
    });

    it('should emit error event on failure', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      const errorHandler = jest.fn();
      scaffolder.on('error', errorHandler);

      await expect(scaffolder.create({
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        path: '/projects'
      })).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  // ============================================
  // File Content Tests
  // ============================================

  describe('file content generation', () => {
    let writtenFiles: Map<string, string>;

    beforeEach(() => {
      writtenFiles = new Map();
      mockFs.writeFile.mockImplementation(async (filePath, content) => {
        writtenFiles.set(String(filePath), String(content));
      });
    });

    it('should generate valid React App component', async () => {
      await scaffolder.create({
        name: 'my-app',
        framework: 'react',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const appContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('App.tsx'))?.[1];

      expect(appContent).toContain('function App');
      expect(appContent).toContain('my-app');
      expect(appContent).toContain('export default App');
    });

    it('should generate valid Next.js layout', async () => {
      await scaffolder.create({
        name: 'my-app',
        framework: 'nextjs',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const layoutContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('layout.tsx'))?.[1];

      expect(layoutContent).toContain('RootLayout');
      expect(layoutContent).toContain('my-app');
      expect(layoutContent).toContain('Metadata');
    });

    it('should generate valid Vue App component', async () => {
      await scaffolder.create({
        name: 'my-app',
        framework: 'vue',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const appContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('App.vue'))?.[1];

      expect(appContent).toContain('<script setup');
      expect(appContent).toContain('<template>');
      expect(appContent).toContain('my-app');
    });

    it('should generate valid Express app setup', async () => {
      await scaffolder.create({
        name: 'my-api',
        framework: 'express',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const appContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('app.ts'))?.[1];

      expect(appContent).toContain('express');
      expect(appContent).toContain('helmet');
      expect(appContent).toContain('cors');
    });

    it('should generate valid NestJS module', async () => {
      await scaffolder.create({
        name: 'my-api',
        framework: 'nestjs',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const moduleContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('app.module.ts'))?.[1];

      expect(moduleContent).toContain('@Module');
      expect(moduleContent).toContain('AppController');
      expect(moduleContent).toContain('AppService');
    });
  });

  // ============================================
  // TypeScript Config Tests
  // ============================================

  describe('tsconfig generation', () => {
    let writtenFiles: Map<string, string>;

    beforeEach(() => {
      writtenFiles = new Map();
      mockFs.writeFile.mockImplementation(async (filePath, content) => {
        writtenFiles.set(String(filePath), String(content));
      });
    });

    it('should generate valid React tsconfig', async () => {
      await scaffolder.create({
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const tsconfigContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('tsconfig.json'))?.[1];

      const tsconfig = JSON.parse(tsconfigContent!);
      expect(tsconfig.compilerOptions.jsx).toBe('react-jsx');
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('should generate valid Next.js tsconfig', async () => {
      await scaffolder.create({
        name: 'test',
        framework: 'nextjs',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const tsconfigContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('tsconfig.json'))?.[1];

      const tsconfig = JSON.parse(tsconfigContent!);
      expect(tsconfig.compilerOptions.jsx).toBe('preserve');
      expect(tsconfig.compilerOptions.plugins).toEqual([{ name: 'next' }]);
    });

    it('should generate valid Express tsconfig', async () => {
      await scaffolder.create({
        name: 'test',
        framework: 'express',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const tsconfigContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('tsconfig.json'))?.[1];

      const tsconfig = JSON.parse(tsconfigContent!);
      expect(tsconfig.compilerOptions.module).toBe('commonjs');
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    });

    it('should generate valid NestJS tsconfig', async () => {
      await scaffolder.create({
        name: 'test',
        framework: 'nestjs',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      const tsconfigContent = Array.from(writtenFiles.entries())
        .find(([path]) => path.includes('tsconfig.json'))?.[1];

      const tsconfig = JSON.parse(tsconfigContent!);
      expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBe(true);
      expect(tsconfig.compilerOptions.experimentalDecorators).toBe(true);
    });
  });

  // ============================================
  // Event Emission Tests
  // ============================================

  describe('event emission', () => {
    it('should emit start event with spec and path', async () => {
      const startHandler = jest.fn();
      scaffolder.on('start', startHandler);

      const spec: ProjectSpec = {
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        path: '/projects'
      };

      await scaffolder.create(spec);

      expect(startHandler).toHaveBeenCalled();
      const callArgs = startHandler.mock.calls[0][0];
      expect(callArgs.spec).toEqual(spec);
      expect(normalizePath(callArgs.projectPath)).toBe('/projects/test');
    });

    it('should emit file-created events for each file', async () => {
      const fileEvents: string[] = [];
      scaffolder.on('file-created', (path) => fileEvents.push(path));

      await scaffolder.create({
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      expect(fileEvents.length).toBeGreaterThan(0);
    });

    it('should emit complete event with result', async () => {
      const completeHandler = jest.fn();
      scaffolder.on('complete', completeHandler);

      await scaffolder.create({
        name: 'test',
        framework: 'react',
        language: 'typescript',
        features: [],
        path: '/projects'
      });

      expect(completeHandler).toHaveBeenCalled();
      const result = completeHandler.mock.calls[0][0];
      expect(result.success).toBe(true);
    });
  });
});

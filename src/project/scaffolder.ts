/**
 * The Joker - Agentic Terminal
 * Project Scaffolding System
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Framework, ProjectSpec, ScaffoldResult } from '../types';
import { LMStudioClient } from '../llm/client';
import { logger } from '../utils/logger';

// ============================================
// Scaffolder Types
// ============================================

export interface FrameworkDetectionResult {
  framework: Framework;
  reason: string;
  language: 'typescript' | 'javascript';
  features: string[];
  confidence: number;
}

export interface ScaffoldOptions {
  overwrite?: boolean;
  skipInstall?: boolean;
  gitInit?: boolean;
}

export interface FileTemplate {
  path: string;
  content: string;
}

export interface PackageJsonSpec {
  name: string;
  version: string;
  private: boolean;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

// ============================================
// Project Scaffolder
// ============================================

/**
 * Project Scaffolder for creating new project structures
 */
export class ProjectScaffolder extends EventEmitter {
  private llm: LMStudioClient | null = null;

  constructor(llmClient?: LMStudioClient) {
    super();
    this.llm = llmClient || null;
  }

  /**
   * Set the LLM client
   */
  setLLMClient(client: LMStudioClient): void {
    this.llm = client;
  }

  // ============================================
  // Main Scaffolding Methods
  // ============================================

  /**
   * Create a new project from specification
   */
  async create(spec: ProjectSpec, options: ScaffoldOptions = {}): Promise<ScaffoldResult> {
    const projectPath = path.join(spec.path, spec.name);
    
    this.emit('start', { spec, projectPath });
    logger.info(`Creating ${spec.framework} project: ${spec.name}`);

    try {
      // Check if directory exists
      const exists = await this.directoryExists(projectPath);
      if (exists && !options.overwrite) {
        throw new Error(`Directory ${projectPath} already exists. Use overwrite option to proceed.`);
      }

      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });
      this.emit('directory-created', projectPath);

      // Initialize based on framework
      let result: ScaffoldResult;
      
      switch (spec.framework) {
        case 'react':
          result = await this.createReactApp(projectPath, spec);
          break;
        case 'nextjs':
          result = await this.createNextApp(projectPath, spec);
          break;
        case 'vue':
          result = await this.createVueApp(projectPath, spec);
          break;
        case 'express':
          result = await this.createExpressApp(projectPath, spec);
          break;
        case 'nestjs':
          result = await this.createNestApp(projectPath, spec);
          break;
        case 'node':
          result = await this.createNodeApp(projectPath, spec);
          break;
        default:
          throw new Error(`Framework ${spec.framework} not supported`);
      }

      // Initialize git if requested
      if (options.gitInit) {
        await this.writeFile(projectPath, '.gitignore', this.generateGitignore(spec.framework));
        result.filesCreated.push('.gitignore');
      }

      this.emit('complete', result);
      logger.info(`Project ${spec.name} created successfully`);
      
      return result;
    } catch (error) {
      this.emit('error', error);
      logger.error('Failed to create project', error);
      throw error;
    }
  }

  /**
   * Detect the best framework for a project description
   */
  async detectFramework(description: string): Promise<FrameworkDetectionResult> {
    // If no LLM client, use rule-based detection
    if (!this.llm) {
      return this.detectFrameworkRuleBased(description);
    }

    try {
      const prompt = `
Analyze this project description and determine the best framework:

"${description}"

Consider:
- React: For SPAs, component-based UIs, client-side apps
- Next.js: For SSR, SSG, full-stack React apps, SEO-critical sites
- Vue: For progressive frameworks, lighter SPAs, gradual adoption
- Express: For REST APIs, backend services, microservices
- NestJS: For enterprise Node.js backends, complex APIs
- Node: For CLI tools, scripts, utilities

Respond with JSON only:
{
  "framework": "react|nextjs|vue|express|nestjs|node",
  "reason": "concise explanation why this framework fits best",
  "language": "typescript|javascript",
  "features": ["feature1", "feature2"],
  "confidence": 0.0-1.0
}`;

      const response = await this.llm.chat([
        { role: 'system', content: 'You are an expert software architect. Respond only with valid JSON.' },
        { role: 'user', content: prompt }
      ]);

      // Parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          framework: result.framework as Framework,
          reason: result.reason || 'Based on project requirements',
          language: result.language || 'typescript',
          features: result.features || [],
          confidence: result.confidence || 0.8
        };
      }
    } catch (error) {
      logger.warn('LLM detection failed, falling back to rule-based', error);
    }

    return this.detectFrameworkRuleBased(description);
  }

  /**
   * Rule-based framework detection fallback
   */
  private detectFrameworkRuleBased(description: string): FrameworkDetectionResult {
    const lower = description.toLowerCase();
    
    // Check for specific frameworks mentioned
    if (lower.includes('next') || lower.includes('ssr') || lower.includes('ssg') || lower.includes('server-side')) {
      return {
        framework: 'nextjs',
        reason: 'SSR/SSG requirements detected',
        language: 'typescript',
        features: ['ssr', 'routing', 'api-routes'],
        confidence: 0.9
      };
    }
    
    if (lower.includes('vue') || lower.includes('nuxt')) {
      return {
        framework: 'vue',
        reason: 'Vue.js requirements detected',
        language: 'typescript',
        features: ['components', 'composition-api'],
        confidence: 0.9
      };
    }
    
    if (lower.includes('api') || lower.includes('rest') || lower.includes('backend') || lower.includes('server')) {
      if (lower.includes('nest') || lower.includes('enterprise') || lower.includes('microservice')) {
        return {
          framework: 'nestjs',
          reason: 'Enterprise backend requirements detected',
          language: 'typescript',
          features: ['rest-api', 'dependency-injection', 'modules'],
          confidence: 0.85
        };
      }
      return {
        framework: 'express',
        reason: 'REST API requirements detected',
        language: 'typescript',
        features: ['rest-api', 'middleware', 'routing'],
        confidence: 0.85
      };
    }
    
    if (lower.includes('cli') || lower.includes('script') || lower.includes('tool') || lower.includes('utility')) {
      return {
        framework: 'node',
        reason: 'CLI/utility requirements detected',
        language: 'typescript',
        features: ['cli', 'async'],
        confidence: 0.8
      };
    }
    
    if (lower.includes('react') || lower.includes('spa') || lower.includes('frontend') || lower.includes('ui')) {
      return {
        framework: 'react',
        reason: 'SPA/frontend requirements detected',
        language: 'typescript',
        features: ['components', 'hooks', 'state-management'],
        confidence: 0.85
      };
    }

    // Default to React for web apps
    return {
      framework: 'react',
      reason: 'Default recommendation for web applications',
      language: 'typescript',
      features: ['components', 'hooks'],
      confidence: 0.6
    };
  }

  /**
   * Initialize a project in an existing directory
   */
  async initializeProject(projectPath: string, framework: Framework, spec?: Partial<ProjectSpec>): Promise<ScaffoldResult> {
    const name = path.basename(projectPath);
    const fullSpec: ProjectSpec = {
      name,
      framework,
      language: spec?.language || 'typescript',
      features: spec?.features || [],
      styling: spec?.styling,
      testing: spec?.testing,
      path: path.dirname(projectPath)
    };

    return this.create(fullSpec, { overwrite: true });
  }

  // ============================================
  // Framework-Specific Scaffolding
  // ============================================

  /**
   * Create a React application (Vite-based)
   */
  private async createReactApp(projectPath: string, spec: ProjectSpec): Promise<ScaffoldResult> {
    const filesCreated: string[] = [];
    const ext = spec.language === 'typescript' ? 'tsx' : 'jsx';
    const configExt = spec.language === 'typescript' ? 'ts' : 'js';

    // Create directory structure
    await this.createDirectories(projectPath, [
      'src',
      'src/components',
      'src/pages',
      'src/hooks',
      'src/utils',
      'src/styles',
      'public'
    ]);

    // Generate package.json
    const packageJson = this.generateReactPackageJson(spec);
    await this.writeFile(projectPath, 'package.json', JSON.stringify(packageJson, null, 2));
    filesCreated.push('package.json');

    // Generate index.html
    await this.writeFile(projectPath, 'index.html', this.generateIndexHtml(spec));
    filesCreated.push('index.html');

    // Generate main entry
    await this.writeFile(projectPath, `src/main.${ext}`, this.generateReactMain(spec));
    filesCreated.push(`src/main.${ext}`);

    // Generate App component
    await this.writeFile(projectPath, `src/App.${ext}`, this.generateReactAppComponent(spec));
    filesCreated.push(`src/App.${ext}`);

    // Generate styles
    await this.writeFile(projectPath, 'src/styles/index.css', this.generateBaseStyles());
    filesCreated.push('src/styles/index.css');

    // Generate Vite config
    await this.writeFile(projectPath, `vite.config.${configExt}`, this.generateViteConfig(spec));
    filesCreated.push(`vite.config.${configExt}`);

    // TypeScript config
    if (spec.language === 'typescript') {
      await this.writeFile(projectPath, 'tsconfig.json', JSON.stringify(this.generateTsConfig('react'), null, 2));
      filesCreated.push('tsconfig.json');
    }

    // Tailwind config if needed
    if (spec.styling === 'tailwind') {
      await this.writeFile(projectPath, 'tailwind.config.js', this.generateTailwindConfig());
      filesCreated.push('tailwind.config.js');
      await this.writeFile(projectPath, 'postcss.config.js', this.generatePostCSSConfig());
      filesCreated.push('postcss.config.js');
    }

    return {
      success: true,
      projectPath,
      filesCreated,
      commands: ['npm install', 'npm run dev'],
      nextSteps: [
        `cd ${spec.name}`,
        'npm install',
        'npm run dev',
        'Open http://localhost:5173 in your browser'
      ]
    };
  }

  /**
   * Create a Next.js application
   */
  private async createNextApp(projectPath: string, spec: ProjectSpec): Promise<ScaffoldResult> {
    const filesCreated: string[] = [];
    const ext = spec.language === 'typescript' ? 'tsx' : 'jsx';

    // Create directory structure (App Router)
    await this.createDirectories(projectPath, [
      'app',
      'app/api',
      'app/api/hello',
      'components',
      'lib',
      'public',
      'styles'
    ]);

    // Generate package.json
    const packageJson = this.generateNextPackageJson(spec);
    await this.writeFile(projectPath, 'package.json', JSON.stringify(packageJson, null, 2));
    filesCreated.push('package.json');

    // Generate root layout
    await this.writeFile(projectPath, `app/layout.${ext}`, this.generateNextLayout(spec));
    filesCreated.push(`app/layout.${ext}`);

    // Generate root page
    await this.writeFile(projectPath, `app/page.${ext}`, this.generateNextPage(spec));
    filesCreated.push(`app/page.${ext}`);

    // Generate API route example
    await this.writeFile(projectPath, `app/api/hello/route.ts`, this.generateNextApiRoute());
    filesCreated.push('app/api/hello/route.ts');

    // Generate globals.css
    await this.writeFile(projectPath, 'styles/globals.css', this.generateBaseStyles());
    filesCreated.push('styles/globals.css');

    // Generate next.config
    await this.writeFile(projectPath, 'next.config.js', this.generateNextConfig(spec));
    filesCreated.push('next.config.js');

    // TypeScript config
    if (spec.language === 'typescript') {
      await this.writeFile(projectPath, 'tsconfig.json', JSON.stringify(this.generateTsConfig('nextjs'), null, 2));
      filesCreated.push('tsconfig.json');
    }

    // Tailwind config if needed
    if (spec.styling === 'tailwind') {
      await this.writeFile(projectPath, 'tailwind.config.js', this.generateTailwindConfig());
      filesCreated.push('tailwind.config.js');
      await this.writeFile(projectPath, 'postcss.config.js', this.generatePostCSSConfig());
      filesCreated.push('postcss.config.js');
    }

    return {
      success: true,
      projectPath,
      filesCreated,
      commands: ['npm install', 'npm run dev'],
      nextSteps: [
        `cd ${spec.name}`,
        'npm install',
        'npm run dev',
        'Open http://localhost:3000 in your browser'
      ]
    };
  }

  /**
   * Create a Vue application (Vite-based)
   */
  private async createVueApp(projectPath: string, spec: ProjectSpec): Promise<ScaffoldResult> {
    const filesCreated: string[] = [];
    const ext = spec.language === 'typescript' ? 'ts' : 'js';

    // Create directory structure
    await this.createDirectories(projectPath, [
      'src',
      'src/components',
      'src/views',
      'src/composables',
      'src/stores',
      'src/assets',
      'public'
    ]);

    // Generate package.json
    const packageJson = this.generateVuePackageJson(spec);
    await this.writeFile(projectPath, 'package.json', JSON.stringify(packageJson, null, 2));
    filesCreated.push('package.json');

    // Generate index.html
    await this.writeFile(projectPath, 'index.html', this.generateVueIndexHtml(spec));
    filesCreated.push('index.html');

    // Generate main entry
    await this.writeFile(projectPath, `src/main.${ext}`, this.generateVueMain(spec));
    filesCreated.push(`src/main.${ext}`);

    // Generate App.vue
    await this.writeFile(projectPath, 'src/App.vue', this.generateVueAppComponent(spec));
    filesCreated.push('src/App.vue');

    // Generate HelloWorld component
    await this.writeFile(projectPath, 'src/components/HelloWorld.vue', this.generateVueHelloWorld(spec));
    filesCreated.push('src/components/HelloWorld.vue');

    // Generate styles
    await this.writeFile(projectPath, 'src/assets/main.css', this.generateBaseStyles());
    filesCreated.push('src/assets/main.css');

    // Generate Vite config
    await this.writeFile(projectPath, `vite.config.${ext}`, this.generateVueViteConfig(spec));
    filesCreated.push(`vite.config.${ext}`);

    // TypeScript config
    if (spec.language === 'typescript') {
      await this.writeFile(projectPath, 'tsconfig.json', JSON.stringify(this.generateTsConfig('vue'), null, 2));
      filesCreated.push('tsconfig.json');
      await this.writeFile(projectPath, 'env.d.ts', this.generateVueEnvDts());
      filesCreated.push('env.d.ts');
    }

    return {
      success: true,
      projectPath,
      filesCreated,
      commands: ['npm install', 'npm run dev'],
      nextSteps: [
        `cd ${spec.name}`,
        'npm install',
        'npm run dev',
        'Open http://localhost:5173 in your browser'
      ]
    };
  }

  /**
   * Create an Express application
   */
  private async createExpressApp(projectPath: string, spec: ProjectSpec): Promise<ScaffoldResult> {
    const filesCreated: string[] = [];
    const ext = spec.language === 'typescript' ? 'ts' : 'js';

    // Create directory structure
    await this.createDirectories(projectPath, [
      'src',
      'src/routes',
      'src/controllers',
      'src/middleware',
      'src/services',
      'src/utils',
      'src/types'
    ]);

    // Generate package.json
    const packageJson = this.generateExpressPackageJson(spec);
    await this.writeFile(projectPath, 'package.json', JSON.stringify(packageJson, null, 2));
    filesCreated.push('package.json');

    // Generate main entry
    await this.writeFile(projectPath, `src/index.${ext}`, this.generateExpressMain(spec));
    filesCreated.push(`src/index.${ext}`);

    // Generate app setup
    await this.writeFile(projectPath, `src/app.${ext}`, this.generateExpressAppSetup(spec));
    filesCreated.push(`src/app.${ext}`);

    // Generate example route
    await this.writeFile(projectPath, `src/routes/index.${ext}`, this.generateExpressRoutes(spec));
    filesCreated.push(`src/routes/index.${ext}`);

    // Generate error handler middleware
    await this.writeFile(projectPath, `src/middleware/errorHandler.${ext}`, this.generateExpressErrorHandler(spec));
    filesCreated.push(`src/middleware/errorHandler.${ext}`);

    // TypeScript config
    if (spec.language === 'typescript') {
      await this.writeFile(projectPath, 'tsconfig.json', JSON.stringify(this.generateTsConfig('express'), null, 2));
      filesCreated.push('tsconfig.json');
    }

    // Generate .env.example
    await this.writeFile(projectPath, '.env.example', this.generateEnvExample());
    filesCreated.push('.env.example');

    return {
      success: true,
      projectPath,
      filesCreated,
      commands: ['npm install', 'npm run dev'],
      nextSteps: [
        `cd ${spec.name}`,
        'npm install',
        'npm run dev',
        'API available at http://localhost:3000'
      ]
    };
  }

  /**
   * Create a NestJS application
   */
  private async createNestApp(projectPath: string, spec: ProjectSpec): Promise<ScaffoldResult> {
    const filesCreated: string[] = [];

    // Create directory structure
    await this.createDirectories(projectPath, [
      'src',
      'src/modules',
      'src/modules/app',
      'test'
    ]);

    // Generate package.json
    const packageJson = this.generateNestPackageJson(spec);
    await this.writeFile(projectPath, 'package.json', JSON.stringify(packageJson, null, 2));
    filesCreated.push('package.json');

    // Generate main entry
    await this.writeFile(projectPath, 'src/main.ts', this.generateNestMain());
    filesCreated.push('src/main.ts');

    // Generate App Module
    await this.writeFile(projectPath, 'src/modules/app/app.module.ts', this.generateNestAppModule());
    filesCreated.push('src/modules/app/app.module.ts');

    // Generate App Controller
    await this.writeFile(projectPath, 'src/modules/app/app.controller.ts', this.generateNestAppController());
    filesCreated.push('src/modules/app/app.controller.ts');

    // Generate App Service
    await this.writeFile(projectPath, 'src/modules/app/app.service.ts', this.generateNestAppService());
    filesCreated.push('src/modules/app/app.service.ts');

    // TypeScript config
    await this.writeFile(projectPath, 'tsconfig.json', JSON.stringify(this.generateTsConfig('nestjs'), null, 2));
    filesCreated.push('tsconfig.json');

    // Nest CLI config
    await this.writeFile(projectPath, 'nest-cli.json', JSON.stringify(this.generateNestCliConfig(), null, 2));
    filesCreated.push('nest-cli.json');

    return {
      success: true,
      projectPath,
      filesCreated,
      commands: ['npm install', 'npm run start:dev'],
      nextSteps: [
        `cd ${spec.name}`,
        'npm install',
        'npm run start:dev',
        'API available at http://localhost:3000'
      ]
    };
  }

  /**
   * Create a Node.js application (CLI/Script)
   */
  private async createNodeApp(projectPath: string, spec: ProjectSpec): Promise<ScaffoldResult> {
    const filesCreated: string[] = [];
    const ext = spec.language === 'typescript' ? 'ts' : 'js';

    // Create directory structure
    await this.createDirectories(projectPath, [
      'src',
      'src/commands',
      'src/utils',
      'bin'
    ]);

    // Generate package.json
    const packageJson = this.generateNodePackageJson(spec);
    await this.writeFile(projectPath, 'package.json', JSON.stringify(packageJson, null, 2));
    filesCreated.push('package.json');

    // Generate main entry
    await this.writeFile(projectPath, `src/index.${ext}`, this.generateNodeMain(spec));
    filesCreated.push(`src/index.${ext}`);

    // Generate CLI entry
    await this.writeFile(projectPath, `bin/cli.${ext}`, this.generateNodeCli(spec));
    filesCreated.push(`bin/cli.${ext}`);

    // TypeScript config
    if (spec.language === 'typescript') {
      await this.writeFile(projectPath, 'tsconfig.json', JSON.stringify(this.generateTsConfig('node'), null, 2));
      filesCreated.push('tsconfig.json');
    }

    return {
      success: true,
      projectPath,
      filesCreated,
      commands: ['npm install', 'npm run build', 'npm start'],
      nextSteps: [
        `cd ${spec.name}`,
        'npm install',
        'npm run build',
        'npm start'
      ]
    };
  }

  // ============================================
  // Package.json Generators
  // ============================================

  private generateReactPackageJson(spec: ProjectSpec): PackageJsonSpec {
    const deps: Record<string, string> = {
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    };

    const devDeps: Record<string, string> = {
      '@vitejs/plugin-react': '^4.2.0',
      'vite': '^5.0.0'
    };

    if (spec.language === 'typescript') {
      devDeps['typescript'] = '^5.3.0';
      devDeps['@types/react'] = '^18.2.0';
      devDeps['@types/react-dom'] = '^18.2.0';
    }

    this.addStylingDeps(deps, devDeps, spec);
    this.addTestingDeps(devDeps, spec);

    return {
      name: spec.name,
      version: '0.1.0',
      private: true,
      scripts: {
        'dev': 'vite',
        'build': 'vite build',
        'preview': 'vite preview',
        'test': this.getTestScript(spec)
      },
      dependencies: deps,
      devDependencies: devDeps
    };
  }

  private generateNextPackageJson(spec: ProjectSpec): PackageJsonSpec {
    const deps: Record<string, string> = {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    };

    const devDeps: Record<string, string> = {
      'eslint': '^8.0.0',
      'eslint-config-next': '^14.0.0'
    };

    if (spec.language === 'typescript') {
      devDeps['typescript'] = '^5.3.0';
      devDeps['@types/node'] = '^20.0.0';
      devDeps['@types/react'] = '^18.2.0';
      devDeps['@types/react-dom'] = '^18.2.0';
    }

    this.addStylingDeps(deps, devDeps, spec);

    return {
      name: spec.name,
      version: '0.1.0',
      private: true,
      scripts: {
        'dev': 'next dev',
        'build': 'next build',
        'start': 'next start',
        'lint': 'next lint'
      },
      dependencies: deps,
      devDependencies: devDeps
    };
  }

  private generateVuePackageJson(spec: ProjectSpec): PackageJsonSpec {
    const deps: Record<string, string> = {
      'vue': '^3.3.0'
    };

    const devDeps: Record<string, string> = {
      '@vitejs/plugin-vue': '^4.5.0',
      'vite': '^5.0.0'
    };

    if (spec.language === 'typescript') {
      devDeps['typescript'] = '^5.3.0';
      devDeps['vue-tsc'] = '^1.8.0';
    }

    this.addStylingDeps(deps, devDeps, spec);

    return {
      name: spec.name,
      version: '0.1.0',
      private: true,
      scripts: {
        'dev': 'vite',
        'build': spec.language === 'typescript' ? 'vue-tsc && vite build' : 'vite build',
        'preview': 'vite preview'
      },
      dependencies: deps,
      devDependencies: devDeps
    };
  }

  private generateExpressPackageJson(spec: ProjectSpec): PackageJsonSpec {
    const deps: Record<string, string> = {
      'express': '^4.18.0',
      'cors': '^2.8.0',
      'helmet': '^7.1.0',
      'dotenv': '^16.3.0'
    };

    const devDeps: Record<string, string> = {
      'nodemon': '^3.0.0'
    };

    if (spec.language === 'typescript') {
      devDeps['typescript'] = '^5.3.0';
      devDeps['ts-node'] = '^10.9.0';
      devDeps['@types/node'] = '^20.0.0';
      devDeps['@types/express'] = '^4.17.0';
      devDeps['@types/cors'] = '^2.8.0';
    }

    this.addTestingDeps(devDeps, spec);

    return {
      name: spec.name,
      version: '0.1.0',
      private: true,
      scripts: {
        'dev': spec.language === 'typescript' ? 'nodemon --exec ts-node src/index.ts' : 'nodemon src/index.js',
        'build': spec.language === 'typescript' ? 'tsc' : 'echo "No build step"',
        'start': spec.language === 'typescript' ? 'node dist/index.js' : 'node src/index.js',
        'test': this.getTestScript(spec)
      },
      dependencies: deps,
      devDependencies: devDeps
    };
  }

  private generateNestPackageJson(spec: ProjectSpec): PackageJsonSpec {
    return {
      name: spec.name,
      version: '0.1.0',
      private: true,
      scripts: {
        'build': 'nest build',
        'start': 'nest start',
        'start:dev': 'nest start --watch',
        'start:prod': 'node dist/main',
        'test': 'jest'
      },
      dependencies: {
        '@nestjs/common': '^10.0.0',
        '@nestjs/core': '^10.0.0',
        '@nestjs/platform-express': '^10.0.0',
        'reflect-metadata': '^0.1.0',
        'rxjs': '^7.8.0'
      },
      devDependencies: {
        '@nestjs/cli': '^10.0.0',
        '@nestjs/testing': '^10.0.0',
        '@types/node': '^20.0.0',
        '@types/express': '^4.17.0',
        'typescript': '^5.3.0',
        'ts-node': '^10.9.0',
        'jest': '^29.0.0',
        '@types/jest': '^29.0.0',
        'ts-jest': '^29.0.0'
      }
    };
  }

  private generateNodePackageJson(spec: ProjectSpec): PackageJsonSpec {
    const deps: Record<string, string> = {};

    const devDeps: Record<string, string> = {};

    if (spec.language === 'typescript') {
      devDeps['typescript'] = '^5.3.0';
      devDeps['ts-node'] = '^10.9.0';
      devDeps['@types/node'] = '^20.0.0';
    }

    return {
      name: spec.name,
      version: '0.1.0',
      private: true,
      scripts: {
        'build': spec.language === 'typescript' ? 'tsc' : 'echo "No build step"',
        'start': spec.language === 'typescript' ? 'node dist/index.js' : 'node src/index.js',
        'dev': spec.language === 'typescript' ? 'ts-node src/index.ts' : 'node src/index.js'
      },
      dependencies: deps,
      devDependencies: devDeps
    };
  }

  private addStylingDeps(deps: Record<string, string>, devDeps: Record<string, string>, spec: ProjectSpec): void {
    if (spec.styling === 'tailwind') {
      devDeps['tailwindcss'] = '^3.3.0';
      devDeps['postcss'] = '^8.4.0';
      devDeps['autoprefixer'] = '^10.4.0';
    } else if (spec.styling === 'styled-components') {
      deps['styled-components'] = '^6.1.0';
    } else if (spec.styling === 'scss') {
      devDeps['sass'] = '^1.69.0';
    }
  }

  private addTestingDeps(devDeps: Record<string, string>, spec: ProjectSpec): void {
    if (spec.testing === 'jest') {
      devDeps['jest'] = '^29.0.0';
      devDeps['@types/jest'] = '^29.0.0';
    } else if (spec.testing === 'vitest') {
      devDeps['vitest'] = '^1.0.0';
    } else if (spec.testing === 'cypress') {
      devDeps['cypress'] = '^13.0.0';
    }
  }

  private getTestScript(spec: ProjectSpec): string {
    switch (spec.testing) {
      case 'vitest': return 'vitest';
      case 'cypress': return 'cypress run';
      case 'jest':
      default: return 'jest';
    }
  }

  // ============================================
  // File Content Generators
  // ============================================

  private generateIndexHtml(spec: ProjectSpec): string {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${spec.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${spec.language === 'typescript' ? 'tsx' : 'jsx'}"></script>
  </body>
</html>
`;
  }

  private generateReactMain(spec: ProjectSpec): string {
    const ext = spec.language === 'typescript' ? 'tsx' : 'jsx';
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.${ext.slice(0, -1)}';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')${spec.language === 'typescript' ? '!' : ''}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  }

  private generateReactAppComponent(spec: ProjectSpec): string {
    return `${spec.language === 'typescript' ? "import React from 'react';\n\n" : ''}function App()${spec.language === 'typescript' ? ': React.ReactElement' : ''} {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Welcome to ${spec.name}</h1>
        <p>Built with React${spec.language === 'typescript' ? ' + TypeScript' : ''}</p>
      </header>
      <main>
        <p>Edit <code>src/App.${spec.language === 'typescript' ? 'tsx' : 'jsx'}</code> to get started.</p>
      </main>
    </div>
  );
}

export default App;
`;
  }

  private generateViteConfig(spec: ProjectSpec): string {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
});
`;
  }

  private generateNextLayout(spec: ProjectSpec): string {
    const ts = spec.language === 'typescript';
    return `${ts ? "import type { Metadata } from 'next';\n" : ''}import '../styles/globals.css';

${ts ? 'export const metadata: Metadata = {\n' : 'export const metadata = {\n'}  title: '${spec.name}',
  description: 'Created with The Joker scaffolder',
};

export default function RootLayout({
  children,
}${ts ? ': { children: React.ReactNode }' : ''}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
  }

  private generateNextPage(spec: ProjectSpec): string {
    return `export default function Home() {
  return (
    <main className="main">
      <h1>Welcome to ${spec.name}</h1>
      <p>Built with Next.js${spec.language === 'typescript' ? ' + TypeScript' : ''}</p>
      <p>Edit <code>app/page.${spec.language === 'typescript' ? 'tsx' : 'jsx'}</code> to get started.</p>
    </main>
  );
}
`;
  }

  private generateNextApiRoute(): string {
    return `import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Hello from the API!' });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ received: body });
}
`;
  }

  private generateNextConfig(spec: ProjectSpec): string {
    return `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
`;
  }

  private generateVueIndexHtml(spec: ProjectSpec): string {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${spec.name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.${spec.language === 'typescript' ? 'ts' : 'js'}"></script>
  </body>
</html>
`;
  }

  private generateVueMain(spec: ProjectSpec): string {
    return `import { createApp } from 'vue';
import App from './App.vue';
import './assets/main.css';

createApp(App).mount('#app');
`;
  }

  private generateVueAppComponent(spec: ProjectSpec): string {
    const lang = spec.language === 'typescript' ? ' lang="ts"' : '';
    return `<script setup${lang}>
import HelloWorld from './components/HelloWorld.vue';
</script>

<template>
  <div class="app">
    <header>
      <h1>Welcome to ${spec.name}</h1>
    </header>
    <main>
      <HelloWorld msg="Built with Vue 3${spec.language === 'typescript' ? ' + TypeScript' : ''}" />
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
</style>
`;
  }

  private generateVueHelloWorld(spec: ProjectSpec): string {
    const lang = spec.language === 'typescript' ? ' lang="ts"' : '';
    return `<script setup${lang}>
defineProps<{
  msg: string;
}>();
</script>

<template>
  <div class="hello-world">
    <p>{{ msg }}</p>
    <p>Edit <code>src/components/HelloWorld.vue</code> to get started.</p>
  </div>
</template>

<style scoped>
.hello-world {
  padding: 1rem;
}
</style>
`;
  }

  private generateVueViteConfig(spec: ProjectSpec): string {
    return `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true
  }
});
`;
  }

  private generateVueEnvDts(): string {
    return `/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
`;
  }

  private generateExpressMain(spec: ProjectSpec): string {
    const ts = spec.language === 'typescript';
    return `import app from './app${ts ? '' : '.js'}';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`;
  }

  private generateExpressAppSetup(spec: ProjectSpec): string {
    const ts = spec.language === 'typescript';
    return `import express${ts ? ', { Application }' : ''} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index${ts ? '' : '.js'}';
import { errorHandler } from './middleware/errorHandler${ts ? '' : '.js'}';

const app${ts ? ': Application' : ''} = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

export default app;
`;
  }

  private generateExpressRoutes(spec: ProjectSpec): string {
    const ts = spec.language === 'typescript';
    return `import { Router${ts ? ', Request, Response' : ''} } from 'express';

const router = Router();

router.get('/health', (req${ts ? ': Request' : ''}, res${ts ? ': Response' : ''}) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/hello', (req${ts ? ': Request' : ''}, res${ts ? ': Response' : ''}) => {
  const name = req.query.name || 'World';
  res.json({ message: \`Hello, \${name}!\` });
});

export default router;
`;
  }

  private generateExpressErrorHandler(spec: ProjectSpec): string {
    const ts = spec.language === 'typescript';
    return `import { Request, Response, NextFunction } from 'express';

${ts ? `interface AppError extends Error {
  statusCode?: number;
}

` : ''}export function errorHandler(
  err${ts ? ': AppError' : ''},
  req${ts ? ': Request' : ''},
  res${ts ? ': Response' : ''},
  next${ts ? ': NextFunction' : ''}
) {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}
`;
  }

  private generateNestMain(): string {
    return `import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(\`Application running on http://localhost:\${port}\`);
}

bootstrap();
`;
  }

  private generateNestAppModule(): string {
    return `import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`;
  }

  private generateNestAppController(): string {
    return `import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('greet')
  greet(@Query('name') name: string): { message: string } {
    return { message: this.appService.greet(name) };
  }
}
`;
  }

  private generateNestAppService(): string {
    return `import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  greet(name?: string): string {
    return \`Hello, \${name || 'World'}!\`;
  }
}
`;
  }

  private generateNestCliConfig(): object {
    return {
      "$schema": "https://json.schemastore.org/nest-cli",
      "collection": "@nestjs/schematics",
      "sourceRoot": "src",
      "compilerOptions": {
        "deleteOutDir": true
      }
    };
  }

  private generateNodeMain(spec: ProjectSpec): string {
    return `#!/usr/bin/env node

console.log('Hello from ${spec.name}!');

async function main()${spec.language === 'typescript' ? ': Promise<void>' : ''} {
  // Your application logic here
  console.log('Application started');
}

main().catch(console.error);
`;
  }

  private generateNodeCli(spec: ProjectSpec): string {
    return `#!/usr/bin/env node

import '../src/index${spec.language === 'typescript' ? '' : '.js'}';
`;
  }

  private generateBaseStyles(): string {
    return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  line-height: 1.6;
  color: #333;
}

.app, .main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  margin-bottom: 1rem;
}

code {
  background-color: #f4f4f4;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.9em;
}
`;
  }

  private generateTsConfig(framework: string): object {
    const baseConfig = {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        module: 'ESNext',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ['src'],
      exclude: ['node_modules']
    };

    switch (framework) {
      case 'react':
        return {
          ...baseConfig,
          compilerOptions: {
            ...baseConfig.compilerOptions,
            jsx: 'react-jsx'
          }
        };

      case 'nextjs':
        return {
          compilerOptions: {
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./*'] }
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules']
        };

      case 'vue':
        return {
          ...baseConfig,
          compilerOptions: {
            ...baseConfig.compilerOptions,
            jsx: 'preserve'
          },
          include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue']
        };

      case 'express':
      case 'node':
        return {
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            lib: ['ES2020'],
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true
          },
          include: ['src'],
          exclude: ['node_modules', 'dist']
        };

      case 'nestjs':
        return {
          compilerOptions: {
            module: 'commonjs',
            declaration: true,
            removeComments: true,
            emitDecoratorMetadata: true,
            experimentalDecorators: true,
            allowSyntheticDefaultImports: true,
            target: 'ES2021',
            sourceMap: true,
            outDir: './dist',
            baseUrl: './',
            incremental: true,
            skipLibCheck: true,
            strictNullChecks: false,
            noImplicitAny: false,
            strictBindCallApply: false,
            forceConsistentCasingInFileNames: false,
            noFallthroughCasesInSwitch: false
          }
        };

      default:
        return baseConfig;
    }
  }

  private generateTailwindConfig(): string {
    return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,vue}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
  }

  private generatePostCSSConfig(): string {
    return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  }

  private generateGitignore(framework: string = 'node'): string {
    let content = `# Dependencies
node_modules/
.pnp/
.pnp.js

# Build outputs
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/
`;

    if (framework === 'nextjs') {
      content += `
# Next.js
.next/
out/
next-env.d.ts
`;
    }

    return content;
  }

  private generateEnvExample(): string {
    return `# Server Configuration
PORT=3000
NODE_ENV=development

# Database (if needed)
# DATABASE_URL=

# API Keys (if needed)
# API_KEY=
`;
  }

  // ============================================
  // Utility Methods
  // ============================================

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath);
      return true;
    } catch {
      return false;
    }
  }

  private async createDirectories(basePath: string, dirs: string[]): Promise<void> {
    for (const dir of dirs) {
      await fs.mkdir(path.join(basePath, dir), { recursive: true });
    }
  }

  private async writeFile(basePath: string, filePath: string, content: string): Promise<void> {
    const fullPath = path.join(basePath, filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    this.emit('file-created', fullPath);
  }
}

// ============================================
// Singleton Instance
// ============================================

export const projectScaffolder = new ProjectScaffolder();

export default ProjectScaffolder;

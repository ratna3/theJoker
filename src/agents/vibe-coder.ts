/**
 * Vibe Coding Pipeline — Natural Language → Running App
 * Part of The Joker's autonomous coding capabilities
 * 
 * Flow: Prompt → Analyze → Scaffold → Generate Code → Install Deps → Dev Server → Browser
 * 
 * Usage:
 *   🃏 Joker > vibe Build me a portfolio website with dark mode and a contact form
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { ProjectScaffolder } from '../project/scaffolder';
import { CodeGenerator, ProjectGenerationSpec } from '../coding/generator';
import { DevServerManager, DevServerInfo } from '../project/dev-server';
import { LMStudioClient, lmStudioClient } from '../llm/client';
import { createVibeCodingPrompt } from '../llm/prompts';
import { Framework, ProjectSpec, ScaffoldResult, GeneratedCode, ChatMessage } from '../types';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export interface VibeCodingResult {
    success: boolean;
    projectPath: string;
    projectName: string;
    framework: Framework;
    filesGenerated: string[];
    devServerUrl: string;
    totalTimeMs: number;
    errors: string[];
}

export interface VibeProjectSpec {
    name: string;
    framework: Framework;
    language: 'typescript' | 'javascript';
    styling: 'css' | 'scss' | 'tailwind' | 'styled-components';
    features: string[];
    pages: VibePageSpec[];
    components: VibeComponentSpec[];
    globalStyles: string;
}

export interface VibePageSpec {
    name: string;
    path: string;
    description: string;
    components: string[];
}

export interface VibeComponentSpec {
    name: string;
    type: 'component' | 'page' | 'layout' | 'utility';
    description: string;
    props?: Array<{ name: string; type: string }>;
}

// ============================================
// Vibe Coding Pipeline
// ============================================

export class VibeCodingPipeline extends EventEmitter {
    private scaffolder: ProjectScaffolder;
    private generator: CodeGenerator;
    private devServer: DevServerManager;
    private llm: LMStudioClient;
    private projectPath: string | null = null;
    private liveSession: boolean = false;
    private generatedFiles: string[] = [];

    constructor(llmClient?: LMStudioClient) {
        super();
        this.llm = llmClient || lmStudioClient;
        this.scaffolder = new ProjectScaffolder(this.llm);
        this.generator = new CodeGenerator(this.llm);
        this.devServer = new DevServerManager();

        // Forward dev server events
        this.devServer.on('ready', (info: DevServerInfo) => {
            this.emit('server:ready', info);
        });
        this.devServer.on('output', (output: string) => {
            this.emit('server:output', output);
        });
        this.devServer.on('exit', (code: number) => {
            this.emit('server:exit', code);
            this.liveSession = false;
        });
    }

    // ============================================
    // Main Entry Point
    // ============================================

    /**
     * Run the full vibe coding pipeline:
     * Prompt → Analyze → Scaffold → Generate → Install → Serve → Open
     */
    async run(prompt: string, outputDir?: string): Promise<VibeCodingResult> {
        const startTime = Date.now();
        const errors: string[] = [];
        let filesGenerated: string[] = [];
        let devServerUrl = '';

        try {
            // Step 1: Analyze the prompt with LLM
            this.emit('step:start', 'analyze');
            this.emit('step:detail', { step: 'analyze', message: '🧠 Analyzing your idea...' });
            const spec = await this.analyzePrompt(prompt);
            this.emit('step:complete', 'analyze');

            // Resolve project path
            const basePath = outputDir || path.resolve(process.cwd(), 'projects');
            this.projectPath = path.join(basePath, spec.name);

            // Emit project path early so the renderer can start loading files
            this.emit('project:path', this.projectPath);

            // Step 2: Scaffold the project
            this.emit('step:start', 'scaffold');
            this.emit('step:detail', { step: 'scaffold', message: `📁 Scaffolding ${spec.framework} project: ${spec.name}` });
            const projectSpec: ProjectSpec = {
                name: spec.name,
                framework: spec.framework,
                language: spec.language,
                features: spec.features,
                styling: spec.styling,
                path: basePath,
            };
            const scaffoldResult = await this.scaffolder.create(projectSpec, { skipInstall: true });
            this.emit('step:complete', 'scaffold');

            // Step 3: Generate custom code
            this.emit('step:start', 'generate');
            this.emit('step:detail', { step: 'generate', message: `🧬 Generating ${spec.components.length} components, ${spec.pages.length} pages` });
            const generatedCode = await this.generateCode(prompt, spec, scaffoldResult);
            filesGenerated = generatedCode.map(f => f.fileName);
            this.generatedFiles = filesGenerated;
            this.emit('step:complete', 'generate');

            // Step 4: Write generated files
            this.emit('step:start', 'write');
            this.emit('step:detail', { step: 'write', message: `📝 Writing ${generatedCode.length} files` });
            await this.writeFiles(this.projectPath, generatedCode);
            this.emit('step:complete', 'write');

            // Step 5: Install dependencies (non-fatal — project still usable if this fails)
            this.emit('step:start', 'install');
            this.emit('step:detail', { step: 'install', message: '📦 Installing dependencies...' });
            try {
                await this.installDeps(this.projectPath);
                this.emit('step:complete', 'install');
            } catch (installErr: any) {
                errors.push(`Install: ${installErr.message}`);
                this.emit('pipeline:error', { error: `Install failed: ${installErr.message}. You can install manually via the terminal.`, step: 'install' });
                this.emit('install:output', `\n⚠ ${installErr.message}\nYou can install dependencies manually in the terminal below.\n`);
                this.emit('step:complete', 'install');
            }

            // Step 6: Start dev server (non-fatal — project files exist regardless)
            this.emit('step:start', 'serve');
            this.emit('step:detail', { step: 'serve', message: '🚀 Starting dev server...' });
            try {
                const serverInfo = await this.devServer.start(this.projectPath, {
                    framework: spec.framework,
                    openBrowser: true,
                });
                devServerUrl = serverInfo.url;
                this.liveSession = true;
                this.emit('step:complete', 'serve');
            } catch (serveErr: any) {
                errors.push(`Serve: ${serveErr.message}`);
                this.emit('pipeline:error', { error: `Dev server failed to start: ${serveErr.message}. You can start it manually.`, step: 'serve' });
                this.emit('step:detail', { step: 'serve', message: `⚠ Dev server failed — try "npm start" or "npm run dev" in the terminal` });
                this.emit('step:complete', 'serve');
            }

            const totalTime = Date.now() - startTime;
            const result: VibeCodingResult = {
                success: true, // Files were generated — install/serve errors are non-fatal
                projectPath: this.projectPath,
                projectName: spec.name,
                framework: spec.framework,
                filesGenerated,
                devServerUrl,
                totalTimeMs: totalTime,
                errors,
            };

            this.emit('pipeline:complete', result);
            logger.info(`[VibeCoder] Complete in ${(totalTime / 1000).toFixed(1)}s — ${devServerUrl}`);

            return result;

        } catch (error: any) {
            const totalTime = Date.now() - startTime;
            errors.push(error.message);
            this.emit('pipeline:error', { error: error.message, step: 'unknown' });
            logger.error(`[VibeCoder] Pipeline failed: ${error.message}`);

            return {
                success: false,
                projectPath: this.projectPath || '',
                projectName: '',
                framework: 'react' as Framework,
                filesGenerated,
                devServerUrl,
                totalTimeMs: totalTime,
                errors,
            };
        }
    }

    // ============================================
    // Step 1: Analyze Prompt with LLM
    // ============================================

    /**
     * Use LLM to decompose a natural language prompt into a structured project spec
     */
    async analyzePrompt(prompt: string): Promise<VibeProjectSpec> {
        try {
            const messages = createVibeCodingPrompt(prompt);
            const response = await this.llm.chat(messages);

            // Parse the LLM response as JSON
            const jsonStr = this.extractJSON(response.content);
            const parsed = JSON.parse(jsonStr);

            return {
                name: parsed.name || this.slugify(prompt.slice(0, 40)),
                framework: this.validateFramework(parsed.framework),
                language: parsed.language === 'javascript' ? 'javascript' : 'typescript',
                styling: this.validateStyling(parsed.styling),
                features: Array.isArray(parsed.features) ? parsed.features : [],
                pages: Array.isArray(parsed.pages) ? parsed.pages : [
                    { name: 'HomePage', path: '/', description: 'Main landing page', components: [] },
                ],
                components: Array.isArray(parsed.components) ? parsed.components : [],
                globalStyles: parsed.globalStyles || '',
            };
        } catch (error: any) {
            logger.warn(`[VibeCoder] LLM analysis failed, using fallback: ${error.message}`);
            return this.fallbackSpec(prompt);
        }
    }

    // ============================================
    // Step 3: Generate Custom Code
    // ============================================

    /**
     * Generate all components and pages based on the spec
     */
    async generateCode(
        prompt: string,
        spec: VibeProjectSpec,
        scaffoldResult: ScaffoldResult,
    ): Promise<GeneratedCode[]> {
        const allFiles: GeneratedCode[] = [];

        // Build a project generation spec for the code generator
        const projectGenSpec: ProjectGenerationSpec = {
            name: spec.name,
            description: prompt,
            framework: spec.framework,
            language: spec.language,
            features: spec.features,
            structure: [
                // Pages
                ...spec.pages.map(page => ({
                    path: this.getPagePath(spec.framework, page),
                    type: 'page' as const,
                    description: page.description,
                })),
                // Components
                ...spec.components.map(comp => ({
                    path: this.getComponentPath(spec.framework, comp),
                    type: comp.type as 'component',
                    description: comp.description,
                })),
            ],
        };

        try {
            const result = await this.generator.generateProject(projectGenSpec);
            if (result.success && result.files.length > 0) {
                allFiles.push(...result.files);
            }
        } catch (error: any) {
            logger.warn(`[VibeCoder] Multi-file generation failed, trying individual: ${error.message}`);

            // Fallback: generate components individually
            for (const comp of spec.components) {
                try {
                    const result = await this.generator.generate({
                        type: comp.type as any,
                        framework: spec.framework,
                        language: spec.language,
                        description: `${comp.description}. For the project: ${prompt}`,
                        name: comp.name,
                    });

                    if (result.success && result.code) {
                        allFiles.push(result.code);
                    }
                } catch (err: any) {
                    logger.warn(`[VibeCoder] Failed to generate ${comp.name}: ${err.message}`);
                }
            }
        }

        // Generate global styles if specified
        if (spec.globalStyles) {
            allFiles.push({
                fileName: 'globals.css',
                filePath: this.getStylesPath(spec.framework),
                content: this.generateGlobalCSS(spec),
                language: 'css',
                dependencies: [],
            });
        }

        return allFiles;
    }

    // ============================================
    // Step 4: Write Files
    // ============================================

    /**
     * Write generated files into the project directory
     */
    async writeFiles(projectPath: string, files: GeneratedCode[]): Promise<void> {
        for (const file of files) {
            const fullPath = path.join(projectPath, file.filePath || file.fileName);
            const dir = path.dirname(fullPath);

            // Ensure directory exists
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(fullPath, file.content, 'utf-8');

            logger.debug(`[VibeCoder] Wrote: ${fullPath}`);
            this.emit('file:written', fullPath);
        }
    }

    // ============================================
    // Step 5: Install Dependencies
    // ============================================

    /**
     * Try a single npm install strategy. Returns true on success.
     */
    private tryInstall(projectPath: string, args: string[], label: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            this.emit('install:output', `\n> ${label}: ${npmCmd} ${args.join(' ')}\n`);

            const child = spawn(npmCmd, args, {
                cwd: projectPath,
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, npm_config_loglevel: 'error' },
            });

            let stderr = '';

            child.stdout?.on('data', (data: Buffer) => {
                this.emit('install:output', data.toString().trim());
            });

            child.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
                this.emit('install:output', data.toString().trim());
            });

            child.on('close', (code) => {
                if (code === 0) {
                    logger.info(`[VibeCoder] ${label} succeeded`);
                    resolve(true);
                } else {
                    logger.warn(`[VibeCoder] ${label} failed (code ${code}): ${stderr.slice(0, 300)}`);
                    resolve(false);
                }
            });

            child.on('error', (err) => {
                logger.warn(`[VibeCoder] ${label} error: ${err.message}`);
                resolve(false);
            });

            // Timeout after 90 seconds per attempt
            setTimeout(() => {
                try { child.kill(); } catch { /* ignore */ }
                logger.warn(`[VibeCoder] ${label} timed out`);
                resolve(false);
            }, 90000);
        });
    }

    /**
     * Run npm install with multiple fallback strategies.
     * On each failure, emits "Let's try a different approach" and retries.
     * If all strategies fail, continues gracefully instead of aborting.
     */
    async installDeps(projectPath: string): Promise<void> {
        // First verify package.json exists
        const pkgPath = path.join(projectPath, 'package.json');
        try {
            await fs.access(pkgPath);
        } catch {
            this.emit('install:output', '⚠ No package.json found — skipping dependency install');
            this.emit('step:detail', { step: 'install', message: '⚠ No package.json — skipping install (project may still work)' });
            return;
        }

        const strategies: Array<{ args: string[]; label: string }> = [
            { args: ['install'], label: 'npm install' },
            { args: ['install', '--legacy-peer-deps'], label: 'npm install --legacy-peer-deps' },
            { args: ['install', '--force'], label: 'npm install --force' },
        ];

        for (let i = 0; i < strategies.length; i++) {
            const strategy = strategies[i];

            if (i > 0) {
                this.emit('install:output', `\n🔄 Let's try a different approach...\n`);
                this.emit('step:detail', { step: 'install', message: `🔄 Let's try a different approach: ${strategy.label}` });

                // Delete node_modules and package-lock before retry
                try {
                    const lockFile = path.join(projectPath, 'package-lock.json');
                    const nodeModules = path.join(projectPath, 'node_modules');
                    await fs.rm(lockFile, { force: true }).catch(() => {});
                    await fs.rm(nodeModules, { recursive: true, force: true }).catch(() => {});
                } catch { /* ignore cleanup errors */ }
            }

            const success = await this.tryInstall(projectPath, strategy.args, strategy.label);
            if (success) {
                this.emit('install:output', '\n✓ Dependencies installed successfully!\n');
                return;
            }
        }

        // All strategies failed — try npx as last resort
        this.emit('install:output', '\n🔄 Let\'s try one more approach...\n');
        this.emit('step:detail', { step: 'install', message: '🔄 Trying npx as a fallback...' });

        const npxSuccess = await new Promise<boolean>((resolve) => {
            const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
            const child = spawn(npxCmd, ['npm', 'install', '--yes'], {
                cwd: projectPath,
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            child.stdout?.on('data', (data: Buffer) => {
                this.emit('install:output', data.toString().trim());
            });
            child.stderr?.on('data', (data: Buffer) => {
                this.emit('install:output', data.toString().trim());
            });
            child.on('close', (code) => resolve(code === 0));
            child.on('error', () => resolve(false));

            setTimeout(() => {
                try { child.kill(); } catch { /* ignore */ }
                resolve(false);
            }, 90000);
        });

        if (npxSuccess) {
            this.emit('install:output', '\n✓ Dependencies installed via npx!\n');
            return;
        }

        // Everything failed — continue gracefully
        this.emit('install:output', '\n⚠ Could not install dependencies automatically.');
        this.emit('install:output', 'You can install them manually by running: npm install');
        this.emit('install:output', 'The project files have been created and are ready to use.\n');
        this.emit('step:detail', { step: 'install', message: '⚠ Auto-install failed — you can run "npm install" manually in the terminal below' });
        // Don't throw — let the pipeline continue
    }

    // ============================================
    // Iterative Refinement (Live Session)
    // ============================================

    /**
     * Refine an already-running project with a follow-up prompt
     * (No re-scaffold — generates new code and writes to existing project)
     */
    async refine(prompt: string): Promise<{ filesChanged: string[]; success: boolean }> {
        if (!this.projectPath) {
            throw new Error('No active vibe coding session. Run `vibe` first.');
        }

        this.emit('step:start', 'refine');
        this.emit('step:detail', { step: 'refine', message: `🔄 Refining: "${prompt.slice(0, 60)}..."` });

        try {
            const spec = await this.analyzePrompt(prompt);

            // Generate only the new/changed components
            const code = await this.generateCode(prompt, spec, {
                success: true,
                projectPath: this.projectPath,
                filesCreated: this.generatedFiles,
                commands: [],
                nextSteps: [],
            });

            if (code.length > 0) {
                await this.writeFiles(this.projectPath, code);
                const fileNames = code.map(f => f.filePath || f.fileName);
                this.generatedFiles.push(...fileNames);

                this.emit('step:complete', 'refine');
                this.emit('step:detail', {
                    step: 'refine',
                    message: `🔄 Updated ${code.length} files — HMR will pick up changes`,
                });

                return { filesChanged: fileNames, success: true };
            }

            this.emit('step:complete', 'refine');
            return { filesChanged: [], success: true };
        } catch (error: any) {
            this.emit('step:error', { step: 'refine', error: error.message });
            return { filesChanged: [], success: false };
        }
    }

    // ============================================
    // Session Management
    // ============================================

    /**
     * Check if there's an active live session
     */
    isLiveSession(): boolean {
        return this.liveSession && this.devServer.isRunning();
    }

    /**
     * Get the current project path
     */
    getProjectPath(): string | null {
        return this.projectPath;
    }

    /**
     * Get the dev server URL
     */
    getDevServerUrl(): string {
        const info = this.devServer.getInfo();
        return info ? info.url : '';
    }

    /**
     * Cleanup — stop dev server and release resources
     */
    async cleanup(): Promise<void> {
        logger.info('[VibeCoder] Cleaning up...');
        await this.devServer.stop();
        this.liveSession = false;
        this.projectPath = null;
        this.generatedFiles = [];
        this.emit('cleanup');
    }

    // ============================================
    // Helpers
    // ============================================

    private extractJSON(text: string): string {
        // Try to extract JSON block from markdown code fence
        const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlock) return codeBlock[1].trim();

        // Try raw JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return jsonMatch[0];

        throw new Error('No JSON found in LLM response');
    }

    private validateFramework(framework: string): Framework {
        const valid: Framework[] = ['react', 'nextjs', 'vue', 'express', 'nestjs', 'node'];
        return valid.includes(framework as Framework) ? (framework as Framework) : 'react';
    }

    private validateStyling(styling: string): 'css' | 'scss' | 'tailwind' | 'styled-components' {
        const valid = ['css', 'scss', 'tailwind', 'styled-components'];
        return valid.includes(styling) ? (styling as any) : 'css';
    }

    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    private getPagePath(framework: Framework, page: VibePageSpec): string {
        switch (framework) {
            case 'nextjs':
                return `src/app${page.path === '/' ? '' : page.path}/page.tsx`;
            case 'react':
            case 'vue':
                return `src/pages/${page.name}.tsx`;
            default:
                return `src/pages/${page.name}.ts`;
        }
    }

    private getComponentPath(framework: Framework, comp: VibeComponentSpec): string {
        const ext = framework === 'vue' ? '.vue' : '.tsx';
        return `src/components/${comp.name}${ext}`;
    }

    private getStylesPath(framework: Framework): string {
        switch (framework) {
            case 'nextjs':
                return 'src/app/globals.css';
            case 'react':
            case 'vue':
                return 'src/styles/globals.css';
            default:
                return 'src/styles/globals.css';
        }
    }

    private generateGlobalCSS(spec: VibeProjectSpec): string {
        const hasDarkMode = spec.features.includes('dark-mode') || spec.features.includes('darkmode');

        let css = `/* Global Styles — Generated by The Joker 🃏 */\n\n`;
        css += `:root {\n`;
        css += `  --primary: #6366f1;\n`;
        css += `  --primary-dark: #4f46e5;\n`;
        css += `  --bg: #ffffff;\n`;
        css += `  --bg-alt: #f8fafc;\n`;
        css += `  --text: #1e293b;\n`;
        css += `  --text-muted: #64748b;\n`;
        css += `  --border: #e2e8f0;\n`;
        css += `  --radius: 0.5rem;\n`;
        css += `  --shadow: 0 1px 3px rgba(0,0,0,0.1);\n`;
        css += `}\n\n`;

        if (hasDarkMode) {
            css += `[data-theme="dark"], .dark {\n`;
            css += `  --bg: #0f172a;\n`;
            css += `  --bg-alt: #1e293b;\n`;
            css += `  --text: #f1f5f9;\n`;
            css += `  --text-muted: #94a3b8;\n`;
            css += `  --border: #334155;\n`;
            css += `  --shadow: 0 1px 3px rgba(0,0,0,0.4);\n`;
            css += `}\n\n`;

            css += `@media (prefers-color-scheme: dark) {\n`;
            css += `  :root:not([data-theme="light"]) {\n`;
            css += `    --bg: #0f172a;\n`;
            css += `    --bg-alt: #1e293b;\n`;
            css += `    --text: #f1f5f9;\n`;
            css += `    --text-muted: #94a3b8;\n`;
            css += `    --border: #334155;\n`;
            css += `    --shadow: 0 1px 3px rgba(0,0,0,0.4);\n`;
            css += `  }\n`;
            css += `}\n\n`;
        }

        css += `* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\n`;
        css += `body {\n`;
        css += `  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;\n`;
        css += `  background-color: var(--bg);\n`;
        css += `  color: var(--text);\n`;
        css += `  line-height: 1.6;\n`;
        css += `  transition: background-color 0.3s, color 0.3s;\n`;
        css += `}\n\n`;
        css += `a {\n  color: var(--primary);\n  text-decoration: none;\n}\n`;
        css += `a:hover {\n  color: var(--primary-dark);\n}\n`;

        return css;
    }

    /**
     * Fallback project spec when LLM analysis fails
     */
    private fallbackSpec(prompt: string): VibeProjectSpec {
        return {
            name: this.slugify(prompt.slice(0, 30)) || 'my-app',
            framework: 'react',
            language: 'typescript',
            styling: 'css',
            features: ['responsive'],
            pages: [
                { name: 'HomePage', path: '/', description: prompt, components: ['App'] },
            ],
            components: [
                { name: 'App', type: 'component', description: prompt },
            ],
            globalStyles: 'Modern clean design',
        };
    }
}

// ============================================
// Export
// ============================================

export default VibeCodingPipeline;

/**
 * The Joker — Project Manager
 * Handles project creation and scaffolding
 */

import path from 'path';
import { exec } from 'child_process';
import type { FileSystemManager } from './fileSystem';
import type { DependencyInstaller } from './dependencyInstaller';

interface ProjectConfig {
    name: string;
    template: string;
    targetDir: string;
    userPrompt: string;
}

interface StepUpdate {
    step: string;
    status: 'running' | 'complete' | 'error';
    detail?: string;
    error?: string;
}

export class ProjectManager {
    constructor(
        private fileSystem: FileSystemManager,
        private depInstaller: DependencyInstaller
    ) { }

    async createProject(
        config: ProjectConfig,
        onStep: (update: StepUpdate) => void
    ): Promise<{ success: boolean; projectPath: string; error?: string }> {
        const safeName = config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const projectPath = path.join(config.targetDir, safeName);

        try {
            onStep({ step: 'scaffold', status: 'running', detail: `Creating folder: ${safeName}` });
            await this.fileSystem.writeFile(path.join(projectPath, '.gitkeep'), '');
            onStep({ step: 'scaffold', status: 'complete', detail: `Folder created: ${safeName}` });

            onStep({ step: 'scaffold', status: 'running', detail: `Scaffolding ${config.template} project...` });
            const scaffoldResult = await this.scaffoldFromTemplate(config.template, projectPath);
            if (!scaffoldResult.success) {
                onStep({ step: 'scaffold', status: 'error', error: scaffoldResult.error });
                return { success: false, projectPath, error: scaffoldResult.error };
            }
            onStep({ step: 'scaffold', status: 'complete', detail: `${config.template} scaffolded` });
            return { success: true, projectPath };
        } catch (err: any) {
            onStep({ step: 'scaffold', status: 'error', error: err.message });
            return { success: false, projectPath, error: err.message };
        }
    }

    private async scaffoldFromTemplate(template: string, projectPath: string): Promise<{ success: boolean; error?: string }> {
        const commands: Record<string, string> = {
            'nextjs': `npx -y create-next-app@latest "${projectPath}" --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes`,
            'react-vite': `npm create vite@latest "${projectPath}" -- --template react-ts`,
            'express': '',
            'fullstack': `npx -y create-next-app@latest "${projectPath}" --typescript --tailwind --app --yes`,
            'static': '',
        };
        const command = commands[template];
        if (!command) return this.manualScaffold(template, projectPath);
        return this.runShellCommand(command, 180000);
    }

    private async manualScaffold(template: string, projectPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            if (template === 'static') {
                await this.fileSystem.writeFile(path.join(projectPath, 'index.html'), '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>My Website</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <main><h1>Hello, World!</h1></main>\n  <script src="script.js"></script>\n</body>\n</html>');
                await this.fileSystem.writeFile(path.join(projectPath, 'style.css'), '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: sans-serif; }\n');
                await this.fileSystem.writeFile(path.join(projectPath, 'script.js'), 'console.log("Hello, World!");\n');
                await this.fileSystem.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({ name: path.basename(projectPath), version: '1.0.0', scripts: { dev: 'npx serve .' } }, null, 2));
            } else if (template === 'express') {
                await this.fileSystem.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({
                    name: path.basename(projectPath), version: '1.0.0', main: 'src/index.ts',
                    scripts: { dev: 'npx ts-node-dev --respawn src/index.ts', build: 'tsc', start: 'node dist/index.js' },
                    dependencies: { express: '^4.18.2', cors: '^2.8.5', dotenv: '^16.3.1' },
                    devDependencies: { '@types/express': '^4.17.21', '@types/cors': '^2.8.17', '@types/node': '^20.10.0', typescript: '^5.3.3', 'ts-node-dev': '^2.0.0' },
                }, null, 2));
                await this.fileSystem.writeFile(path.join(projectPath, 'src', 'index.ts'), 'import express from "express";\nimport cors from "cors";\n\nconst app = express();\napp.use(cors());\napp.use(express.json());\n\napp.get("/", (req, res) => res.json({ message: "Hello World" }));\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(`Server running on port ${PORT}`));\n');
                await this.fileSystem.writeFile(path.join(projectPath, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'commonjs', outDir: './dist', rootDir: './src', strict: true, esModuleInterop: true, skipLibCheck: true }, include: ['src'] }, null, 2));
            }
            return { success: true };
        } catch (err: any) { return { success: false, error: err.message }; }
    }

    private runShellCommand(command: string, timeout: number): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            exec(command, { timeout, maxBuffer: 1024 * 1024 * 10 }, (error, _stdout, stderr) => {
                resolve(error ? { success: false, error: stderr || error.message } : { success: true });
            });
        });
    }
}

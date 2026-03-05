/**
 * Vibe Coding IDE — Project Manager
 * Handles project creation, scaffolding, and file generation
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

    /**
     * Create a new project via terminal commands
     */
    async createProject(
        config: ProjectConfig,
        onStep: (update: StepUpdate) => void
    ): Promise<{ success: boolean; projectPath: string; error?: string }> {
        const safeName = config.name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const projectPath = path.join(config.targetDir, safeName);

        try {
            // Step 1: Create project folder
            onStep({ step: 'scaffold', status: 'running', detail: `Creating folder: ${safeName}` });

            await this.fileSystem.writeFile(
                path.join(projectPath, '.gitkeep'),
                ''
            );

            onStep({ step: 'scaffold', status: 'complete', detail: `Folder created: ${safeName}` });

            // Step 2: Scaffold based on template
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

    /**
     * Scaffold project from template
     */
    private async scaffoldFromTemplate(
        template: string,
        projectPath: string
    ): Promise<{ success: boolean; error?: string }> {
        const commands: Record<string, string> = {
            'nextjs': `npx -y create-next-app@latest "${projectPath}" --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --yes`,
            'react-vite': `npm create vite@latest "${projectPath}" -- --template react-ts`,
            'express': '', // Manual scaffold
            'fullstack': `npx -y create-next-app@latest "${projectPath}" --typescript --tailwind --app --yes`,
            'static': '', // Manual scaffold
        };

        const command = commands[template];

        if (!command) {
            // Manual scaffold for express and static
            return this.manualScaffold(template, projectPath);
        }

        return this.runShellCommand(command, 180000);
    }

    /**
     * Manual scaffolding for templates without CLI tools
     */
    private async manualScaffold(
        template: string,
        projectPath: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (template === 'static') {
                await this.fileSystem.writeFile(path.join(projectPath, 'index.html'), this.getStaticHTML());
                await this.fileSystem.writeFile(path.join(projectPath, 'style.css'), this.getStaticCSS());
                await this.fileSystem.writeFile(path.join(projectPath, 'script.js'), '// Your code here\nconsole.log("Hello, World!");\n');
                await this.fileSystem.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({
                    name: path.basename(projectPath),
                    version: '1.0.0',
                    description: '',
                    scripts: {
                        dev: 'npx serve .',
                    },
                }, null, 2));
            } else if (template === 'express') {
                await this.fileSystem.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({
                    name: path.basename(projectPath),
                    version: '1.0.0',
                    description: '',
                    main: 'src/index.ts',
                    scripts: {
                        dev: 'npx ts-node-dev --respawn src/index.ts',
                        build: 'tsc',
                        start: 'node dist/index.js',
                    },
                    dependencies: {
                        express: '^4.18.2',
                        cors: '^2.8.5',
                        dotenv: '^16.3.1',
                    },
                    devDependencies: {
                        '@types/express': '^4.17.21',
                        '@types/cors': '^2.8.17',
                        '@types/node': '^20.10.0',
                        typescript: '^5.3.3',
                        'ts-node-dev': '^2.0.0',
                    },
                }, null, 2));

                await this.fileSystem.writeFile(path.join(projectPath, 'src', 'index.ts'), this.getExpressBoilerplate());
                await this.fileSystem.writeFile(path.join(projectPath, 'tsconfig.json'), JSON.stringify({
                    compilerOptions: {
                        target: 'ES2020',
                        module: 'commonjs',
                        outDir: './dist',
                        rootDir: './src',
                        strict: true,
                        esModuleInterop: true,
                        skipLibCheck: true,
                    },
                    include: ['src'],
                }, null, 2));
            }

            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Run a shell command
     */
    private runShellCommand(command: string, timeout: number): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            exec(command, { timeout, maxBuffer: 1024 * 1024 * 10 }, (error, _stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: stderr || error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    private getStaticHTML(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Website</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Hello, World!</h1>
    <p>Edit this file to get started.</p>
  </main>
  <script src="script.js"></script>
</body>
</html>`;
    }

    private getStaticCSS(): string {
        return `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0e0c;
  color: #e2e8f0;
}
main { text-align: center; }
h1 { font-size: 3rem; margin-bottom: 1rem; }
p { color: #64748b; }`;
    }

    private getExpressBoilerplate(): string {
        return `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'API is running', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`;
    }
}

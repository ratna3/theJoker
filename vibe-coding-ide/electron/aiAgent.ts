/**
 * Vibe Coding IDE — AI Agent
 * LM Studio streaming API handler for chat and project generation
 */

import type { ProjectPlan } from '../src/types/index';

interface StreamConfig {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature: number;
    maxTokens: number;
    baseUrl?: string;
    systemPrompt?: string;
    currentFile?: { path: string; content: string };
    selectedCode?: string;
    terminalErrors?: string;
    projectFiles?: string[];
    onToken: (token: string) => void;
    onComplete: (fullResponse: string) => void;
    onError: (error: string) => void;
}

export class AIAgent {
    private abortController: AbortController | null = null;
    private lmStudioUrl = '';

    setUrl(url: string): void {
        this.lmStudioUrl = url;
    }

    /**
     * Stream a chat message from LM Studio
     */
    async streamMessage(config: StreamConfig): Promise<void> {
        this.abortController = new AbortController();

        // Use baseUrl from config if provided (sent from renderer settings)
        const apiUrl = config.baseUrl || this.lmStudioUrl;

        const systemPrompt = config.systemPrompt || this.buildSystemPrompt(config);

        const messages = [
            { role: 'system', content: systemPrompt },
            ...config.messages,
        ];

        try {
            const response = await fetch(`${apiUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: config.model || 'default',
                    messages,
                    stream: true,
                    temperature: config.temperature ?? 0.7,
                    max_tokens: config.maxTokens ?? 4096,
                }),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                config.onError(`LM Studio error (${response.status}): ${errorText}`);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                config.onError('Failed to get response stream');
                return;
            }

            const decoder = new TextDecoder();
            let fullResponse = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const content = json.choices?.[0]?.delta?.content;
                        if (content) {
                            fullResponse += content;
                            config.onToken(content);
                        }
                    } catch {
                        // Skip malformed JSON chunks
                    }
                }
            }

            config.onComplete(fullResponse);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                config.onComplete(config.messages.length > 0 ? 'Stream cancelled.' : '');
                return;
            }
            if (err.message?.includes('fetch') || err.code === 'ECONNREFUSED') {
                config.onError('LM Studio is not running. Start LM Studio and load a model.');
            } else {
                config.onError(err.message || 'Unknown error');
            }
        }
    }

    /**
     * Abort current stream
     */
    abortStream(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Plan a project based on user prompt
     */
    async planProject(
        userPrompt: string,
        template: string,
        onStep: (step: any) => void,
        baseUrl?: string,
        model?: string
    ): Promise<ProjectPlan> {
        onStep({ step: 'analyze', status: 'running', detail: 'Analyzing your idea...' });

        const planPrompt = `Analyze this app idea and respond with JSON only (no markdown, no code fences):
App idea: "${userPrompt}"
Template: ${template}

Respond with this exact JSON structure:
{
  "projectName": "kebab-case-name",
  "description": "Brief description",
  "components": ["ComponentName1", "ComponentName2"],
  "pages": ["PageName1", "PageName2"],
  "features": ["feature1", "feature2"],
  "dependencies": ["package1", "package2"],
  "fileStructure": [{"path": "src/components/Example.tsx", "purpose": "Description"}]
}`;

        return new Promise((resolve, reject) => {
            let fullResponse = '';

            this.streamMessage({
                messages: [{ role: 'user', content: planPrompt }],
                model: model || 'default',
                temperature: 0.3,
                maxTokens: 2048,
                baseUrl,
                onToken: (token) => { fullResponse += token; },
                onComplete: (response) => {
                    try {
                        // Try to extract JSON from response
                        const jsonMatch = response.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const plan = JSON.parse(jsonMatch[0]) as ProjectPlan;
                            onStep({ step: 'analyze', status: 'complete', detail: `Project: ${plan.projectName}` });
                            resolve(plan);
                        } else {
                            reject(new Error('Failed to parse AI response as JSON'));
                        }
                    } catch (err: any) {
                        reject(new Error(`Failed to parse project plan: ${err.message}`));
                    }
                },
                onError: (error) => {
                    onStep({ step: 'analyze', status: 'error', error });
                    reject(new Error(error));
                },
            });
        });
    }

    /**
     * Generate project files based on plan
     */
    async generateProjectFiles(
        plan: ProjectPlan,
        onProgress?: (progress: any) => void,
        baseUrl?: string,
        model?: string
    ): Promise<Map<string, string>> {
        const files = new Map<string, string>();
        const total = plan.components.length + plan.pages.length;
        let completed = 0;

        onProgress?.({
            step: 'generate',
            status: 'running',
            detail: `Generating ${plan.components.length} components, ${plan.pages.length} pages...`,
        });

        // Generate components
        for (const component of plan.components) {
            try {
                const content = await this.generateSingleFile(component, plan, 'component', baseUrl, model);
                const filePath = `src/components/${component}.tsx`;
                files.set(filePath, content);
                completed++;
                onProgress?.({
                    step: 'generate',
                    status: 'running',
                    detail: `Generated ${completed}/${total} files...`,
                });
            } catch {
                // Skip failed files, continue with others
            }
        }

        // Generate pages
        for (const page of plan.pages) {
            try {
                const content = await this.generateSingleFile(page, plan, 'page', baseUrl, model);
                const filePath = `src/app/${page.toLowerCase()}/page.tsx`;
                files.set(filePath, content);
                completed++;
                onProgress?.({
                    step: 'generate',
                    status: 'running',
                    detail: `Generated ${completed}/${total} files...`,
                });
            } catch {
                // Skip failed files
            }
        }

        onProgress?.({
            step: 'generate',
            status: 'complete',
            detail: `Generated ${files.size} files`,
        });

        return files;
    }

    /**
     * Generate a single file
     */
    private async generateSingleFile(
        name: string,
        plan: ProjectPlan,
        type: 'component' | 'page',
        baseUrl?: string,
        model?: string
    ): Promise<string> {
        const prompt = `Write the complete ${name}.tsx file for a ${plan.description} app.
This is a React/TypeScript ${type}. Make it fully functional with:
- Proper TypeScript types
- Tailwind CSS styling with a dark theme
- Clean, modern UI design
- Export as default

Return ONLY the file content, no explanations or code fences.`;

        return new Promise((resolve, reject) => {
            let response = '';

            this.streamMessage({
                messages: [{ role: 'user', content: prompt }],
                model: model || 'default',
                temperature: 0.5,
                maxTokens: 4096,
                baseUrl,
                onToken: (token) => { response += token; },
                onComplete: (fullResponse) => {
                    // Strip code fences if present
                    const cleaned = fullResponse
                        .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gm, '')
                        .replace(/```$/gm, '')
                        .trim();
                    resolve(cleaned);
                },
                onError: (error) => reject(new Error(error)),
            });
        });
    }

    /**
     * Get available LM Studio models
     */
    async getLMStudioModels(baseUrl: string): Promise<string[]> {
        try {
            const response = await fetch(`${baseUrl}/v1/models`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.data?.map((m: any) => m.id) || [];
        } catch {
            return [];
        }
    }

    /**
     * Test LM Studio connection
     */
    async testConnection(baseUrl: string): Promise<{ connected: boolean; error?: string }> {
        try {
            const response = await fetch(`${baseUrl}/v1/models`, {
                signal: AbortSignal.timeout(5000),
            });
            if (response.ok) {
                return { connected: true };
            }
            return { connected: false, error: `Status: ${response.status}` };
        } catch (err: any) {
            return { connected: false, error: err.message || 'Connection failed' };
        }
    }

    /**
     * Build system prompt with context
     */
    private buildSystemPrompt(config: StreamConfig): string {
        const isExecutionMode = config.messages?.some(m => m.content === '__PLAN_APPROVED__');

        let prompt: string;

        if (isExecutionMode) {
            prompt = `You are an expert full-stack developer integrated into "The Joker — Vibe Coding IDE". The user has APPROVED your plan. Now implement ALL the changes.

## EXECUTION MODE — IMPLEMENT ALL CHANGES NOW

You MUST output ALL file changes and terminal commands needed. The IDE will automatically apply every code block and run every terminal command — the user does NOT need to click anything.

## RULES FOR CODE OUTPUT:

1. **File Edits**: Include a filepath comment as the VERY FIRST LINE of each code block:
   - For JS/TS/C/Java files: \`// filepath: src/components/Example.tsx\`
   - For Python/Shell files: \`# filepath: src/main.py\`
   - For HTML/XML files: \`<!-- filepath: index.html -->\`
   The path must be relative to the project root.

2. **Terminal Commands**: Use a code block with language \`terminal\`:
   \`\`\`terminal
   npm install axios
   \`\`\`

3. **Always provide complete file content** when creating or modifying files. Never use partial snippets.

4. Output ALL code blocks for ALL files that need to change. Do not ask questions or wait for confirmation.

5. At the end, list all modified files.`;
        } else {
            prompt = `You are an expert full-stack developer and coding assistant integrated into a VS Code-like IDE called "The Joker — Vibe Coding IDE". You help users build, debug, and improve their code.

## CRITICAL: PLAN-FIRST WORKFLOW

When the user asks you to make code changes, redesign something, add features, fix bugs, or modify the codebase in any way, you MUST follow this workflow:

1. **FIRST**: Respond with a plan wrapped in [PLAN] tags. Briefly explain what you will do and list the steps:

[PLAN]
I'll redesign the navigation component with a modern sidebar layout.

1. Update src/components/Navbar.tsx — Replace horizontal nav with vertical sidebar
2. Create src/components/SidebarItem.tsx — New reusable menu item component
3. Modify src/styles/globals.css — Add sidebar animations
4. Run terminal: npm install framer-motion
[/PLAN]

2. **DO NOT** include any code blocks in your plan response. Just explain the approach.
3. The user will then Approve or Deny the plan.
4. If approved, you will receive a follow-up message and should then output ALL the code changes.

## For non-code questions:
If the user asks a question, wants an explanation, or anything that does NOT require changing code, respond normally without a plan.

## CODE OUTPUT RULES (for when you are told to implement):

1. **File Edits**: Include a filepath comment as the VERY FIRST LINE of each code block:
   - For JS/TS/C/Java files: \`// filepath: src/components/Example.tsx\`
   - For Python/Shell files: \`# filepath: src/main.py\`
   - For HTML/XML files: \`<!-- filepath: index.html -->\`

2. **Terminal Commands**: Use \`terminal\` code blocks:
   \`\`\`terminal
   npm install axios
   \`\`\`

3. **Always provide complete file content** when creating or modifying files.

4. **List modified files** at the end of your response.`;
        }

        if (config.currentFile) {
            const content = config.currentFile.content.length > 3000
                ? config.currentFile.content.substring(0, 3000) + '\n... (truncated)'
                : config.currentFile.content;
            prompt += `\n\n## Current Open File\nPath: ${config.currentFile.path}\n\`\`\`\n${content}\n\`\`\``;
        }

        if (config.selectedCode) {
            prompt += `\n\n## Selected Code\n\`\`\`\n${config.selectedCode}\n\`\`\``;
        }

        if (config.terminalErrors) {
            prompt += `\n\n## Recent Terminal Output/Errors\n\`\`\`\n${config.terminalErrors}\n\`\`\``;
        }

        if (config.projectFiles) {
            prompt += `\n\n## Project Files\n${config.projectFiles.join('\n')}`;
        }

        return prompt;
    }

    /**
     * Send a non-streaming request and return the full response.
     * Used for reading file contents during autonomous execution.
     */
    async readFileViaAI(filePath: string): Promise<string> {
        // This is handled by IPC directly, not via AI
        return '';
    }
}

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
    systemPrompt?: string;
    currentFile?: { path: string; content: string };
    selectedCode?: string;
    terminalErrors?: string;
    onToken: (token: string) => void;
    onComplete: (fullResponse: string) => void;
    onError: (error: string) => void;
}

export class AIAgent {
    private abortController: AbortController | null = null;
    private lmStudioUrl = 'http://localhost:1234';

    setUrl(url: string): void {
        this.lmStudioUrl = url;
    }

    /**
     * Stream a chat message from LM Studio
     */
    async streamMessage(config: StreamConfig): Promise<void> {
        this.abortController = new AbortController();

        const systemPrompt = config.systemPrompt || this.buildSystemPrompt(config);

        const messages = [
            { role: 'system', content: systemPrompt },
            ...config.messages,
        ];

        try {
            const response = await fetch(`${this.lmStudioUrl}/v1/chat/completions`, {
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
        onStep: (step: any) => void
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
                model: 'default',
                temperature: 0.3,
                maxTokens: 2048,
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
        onProgress?: (progress: any) => void
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
                const content = await this.generateSingleFile(component, plan, 'component');
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
                const content = await this.generateSingleFile(page, plan, 'page');
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
        type: 'component' | 'page'
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
                model: 'default',
                temperature: 0.5,
                maxTokens: 4096,
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
        let prompt = `You are an expert full-stack developer and coding assistant integrated into a VS Code-like IDE called Vibe Coding IDE. You help users build, debug, and improve their code.

When suggesting code changes, always specify the exact file path at the top of each code block as a comment: // filepath: src/components/Example.tsx

When you make changes, list the files modified at the end of your response.`;

        if (config.currentFile) {
            const content = config.currentFile.content.length > 3000
                ? config.currentFile.content.substring(0, 3000) + '\n... (truncated)'
                : config.currentFile.content;
            prompt += `\n\nCurrent open file: ${config.currentFile.path}\nFile content:\n${content}`;
        }

        if (config.selectedCode) {
            prompt += `\n\nSelected code:\n${config.selectedCode}`;
        }

        if (config.terminalErrors) {
            prompt += `\n\nTerminal errors:\n${config.terminalErrors}`;
        }

        return prompt;
    }
}

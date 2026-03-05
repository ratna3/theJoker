/**
 * The Joker — AI Agent
 * LM Studio streaming API handler for chat and project generation
 */

interface StreamConfig {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
    currentFile?: { path: string; content: string };
    selectedCode?: string;
    terminalErrors?: string;
    baseUrl?: string;
    onToken: (token: string) => void;
    onComplete: (fullResponse: string) => void;
    onError: (error: string) => void;
}

interface ProjectPlan {
    projectName: string;
    description: string;
    components: string[];
    pages: string[];
    features: string[];
    dependencies: string[];
    fileStructure: Array<{ path: string; purpose: string }>;
}

export class AIAgent {
    private abortController: AbortController | null = null;
    private lmStudioUrl = 'http://localhost:1234';

    setUrl(url: string): void { this.lmStudioUrl = url; }

    async streamMessage(config: StreamConfig): Promise<void> {
        this.abortController = new AbortController();
        const systemPrompt = config.systemPrompt || this.buildSystemPrompt(config);
        const messages = [{ role: 'system', content: systemPrompt }, ...config.messages];
        const baseUrl = config.baseUrl || this.lmStudioUrl;

        try {
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: config.model || 'default',
                    messages, stream: true,
                    temperature: config.temperature ?? 0.7,
                    max_tokens: config.maxTokens ?? 4096,
                }),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                config.onError(`LM Studio error (${response.status}): ${await response.text()}`);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) { config.onError('Failed to get response stream'); return; }

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
                        if (content) { fullResponse += content; config.onToken(content); }
                    } catch { }
                }
            }
            config.onComplete(fullResponse);
        } catch (err: any) {
            if (err.name === 'AbortError') { config.onComplete(''); return; }
            if (err.message?.includes('ECONNREFUSED') || err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
                config.onError(`Cannot connect to LM Studio at ${baseUrl}. Make sure LM Studio is running and the server is started.`);
            } else { config.onError(err.message || 'Unknown error'); }
        }
    }

    abortStream(): void {
        this.abortController?.abort();
        this.abortController = null;
    }

    async planProject(userPrompt: string, template: string, onStep: (step: any) => void, baseUrl?: string): Promise<ProjectPlan> {
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
            this.streamMessage({
                messages: [{ role: 'user', content: planPrompt }],
                model: 'default', temperature: 0.3, maxTokens: 2048,
                baseUrl,
                onToken: () => {},
                onComplete: (response) => {
                    try {
                        const jsonMatch = response.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const plan = JSON.parse(jsonMatch[0]) as ProjectPlan;
                            onStep({ step: 'analyze', status: 'complete', detail: `Project: ${plan.projectName}` });
                            resolve(plan);
                        } else { reject(new Error('Failed to parse AI response as JSON')); }
                    } catch (err: any) { reject(new Error(`Failed to parse project plan: ${err.message}`)); }
                },
                onError: (error) => { onStep({ step: 'analyze', status: 'error', error }); reject(new Error(error)); },
            });
        });
    }

    async generateProjectFiles(plan: ProjectPlan, onProgress?: (progress: any) => void, baseUrl?: string): Promise<Map<string, string>> {
        const files = new Map<string, string>();
        const total = plan.components.length + plan.pages.length;
        let completed = 0;
        onProgress?.({ step: 'generate', status: 'running', detail: `Generating ${total} files...` });

        for (const component of plan.components) {
            try {
                const content = await this.generateSingleFile(component, plan, 'component', baseUrl);
                files.set(`src/components/${component}.tsx`, content);
                completed++;
                onProgress?.({ step: 'generate', status: 'running', detail: `Generated ${completed}/${total} files...` });
            } catch { }
        }
        for (const page of plan.pages) {
            try {
                const content = await this.generateSingleFile(page, plan, 'page', baseUrl);
                files.set(`src/app/${page.toLowerCase()}/page.tsx`, content);
                completed++;
                onProgress?.({ step: 'generate', status: 'running', detail: `Generated ${completed}/${total} files...` });
            } catch { }
        }
        onProgress?.({ step: 'generate', status: 'complete', detail: `Generated ${files.size} files` });
        return files;
    }

    private async generateSingleFile(name: string, plan: ProjectPlan, type: 'component' | 'page', baseUrl?: string): Promise<string> {
        const prompt = `Write the complete ${name}.tsx file for a ${plan.description} app.
This is a React/TypeScript ${type}. Make it fully functional with proper TypeScript types, Tailwind CSS styling with a dark theme, clean modern UI design, and export as default.
Return ONLY the file content, no explanations or code fences.`;

        return new Promise((resolve, reject) => {
            this.streamMessage({
                messages: [{ role: 'user', content: prompt }],
                model: 'default', temperature: 0.5, maxTokens: 4096,
                baseUrl,
                onToken: () => {},
                onComplete: (fullResponse) => {
                    resolve(fullResponse.replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gm, '').replace(/```$/gm, '').trim());
                },
                onError: (error) => reject(new Error(error)),
            });
        });
    }

    async getLMStudioModels(baseUrl: string): Promise<string[]> {
        try {
            const response = await fetch(`${baseUrl}/v1/models`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.data?.map((m: any) => m.id) || [];
        } catch { return []; }
    }

    async testConnection(baseUrl: string): Promise<{ connected: boolean; error?: string }> {
        try {
            const response = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(5000) });
            return response.ok ? { connected: true } : { connected: false, error: `Status: ${response.status}` };
        } catch (err: any) { return { connected: false, error: err.message || 'Connection failed' }; }
    }

    private buildSystemPrompt(config: StreamConfig): string {
        let prompt = `You are an expert full-stack developer and coding assistant integrated into a VS Code-like IDE called The Joker. You help users build, debug, and improve their code.

When suggesting code changes, always specify the exact file path at the top of each code block as a comment.
When you make changes, list the files modified at the end of your response.`;

        if (config.currentFile) {
            const content = config.currentFile.content.length > 3000
                ? config.currentFile.content.substring(0, 3000) + '\n... (truncated)'
                : config.currentFile.content;
            prompt += `\n\nCurrent open file: ${config.currentFile.path}\nFile content:\n${content}`;
        }
        if (config.selectedCode) prompt += `\n\nSelected code:\n${config.selectedCode}`;
        if (config.terminalErrors) prompt += `\n\nTerminal errors:\n${config.terminalErrors}`;
        return prompt;
    }
}

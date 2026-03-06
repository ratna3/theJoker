/**
 * AI Response Parser (renderer-side copy)
 * Extracts structured actions from AI responses for autonomous execution
 */

export interface FileAction {
    type: 'file-write';
    filePath: string;
    content: string;
    language: string;
}

export interface TerminalAction {
    type: 'terminal-command';
    command: string;
}

export type AIAction = FileAction | TerminalAction;

/**
 * Parse an AI response string and extract all structured actions
 */
export function parseAIResponse(response: string): AIAction[] {
    const actions: AIAction[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();

        // Check for terminal blocks
        if (language === 'terminal' || language === 'cmd' || language === 'powershell') {
            if (!code.includes('// filepath:')) {
                const lines = code.split('\n').filter(l => l.trim());
                for (const line of lines) {
                    const cmd = line.replace(/^[$>]\s*/, '').trim();
                    if (cmd && !cmd.startsWith('#')) {
                        actions.push({ type: 'terminal-command', command: cmd });
                    }
                }
                continue;
            }
        }

        // Check for filepath comment at top of code block
        const filepathMatch = code.match(/^(?:\/\/|#|<!--)\s*filepath:\s*(.+?)(?:\s*-->)?$/m);
        if (filepathMatch) {
            const filePath = filepathMatch[1].trim();
            const content = code.replace(/^(?:\/\/|#|<!--)\s*filepath:\s*.+?(?:\s*-->)?[\r\n]*/m, '').trim();
            actions.push({ type: 'file-write', filePath, content, language });
        }
    }

    return actions;
}

/**
 * Vibe Coding IDE — AI Response Parser
 * Extracts structured actions (file writes, terminal commands) from AI responses
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

    // Extract code blocks with filepath comments
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();

        // Check for terminal blocks
        if (language === 'terminal' || language === 'bash' || language === 'sh' || language === 'shell' || language === 'cmd' || language === 'powershell') {
            // Check if it looks like a command (not a code file)
            const lines = code.split('\n').filter(l => l.trim());
            const isCommand = lines.every(l =>
                l.startsWith('$') || l.startsWith('>') || l.startsWith('#') ||
                l.startsWith('npm ') || l.startsWith('npx ') || l.startsWith('yarn ') ||
                l.startsWith('pnpm ') || l.startsWith('cd ') || l.startsWith('mkdir ') ||
                l.startsWith('pip ') || l.startsWith('python ') || l.startsWith('node ') ||
                l.startsWith('git ') || l.startsWith('echo ') ||
                !code.includes('// filepath:')
            );

            // Only treat as terminal if there's no filepath AND the language hints at terminal
            if ((language === 'terminal' || language === 'cmd' || language === 'powershell') && !code.includes('// filepath:')) {
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
            // Remove the filepath comment line from the content
            const content = code.replace(/^(?:\/\/|#|<!--)\s*filepath:\s*.+?(?:\s*-->)?[\r\n]*/m, '').trim();
            actions.push({
                type: 'file-write',
                filePath,
                content,
                language,
            });
        }
    }

    return actions;
}

/**
 * Extract filepath from a code string (if present)
 */
export function extractFilePath(code: string): string | null {
    const match = code.match(/^(?:\/\/|#|<!--)\s*filepath:\s*(.+?)(?:\s*-->)?$/m);
    return match ? match[1].trim() : null;
}

/**
 * Sanitize a file path to prevent directory traversal
 * Returns null if the path is unsafe
 */
export function sanitizeFilePath(projectRoot: string, relativePath: string): string | null {
    const path = require('path');

    // Normalize and resolve the path
    const normalized = path.normalize(relativePath);

    // Block absolute paths and traversal
    if (path.isAbsolute(normalized)) return null;
    if (normalized.startsWith('..')) return null;
    if (normalized.includes('..\\') || normalized.includes('../')) return null;

    const resolved = path.resolve(projectRoot, normalized);

    // Ensure the resolved path is still within the project root
    if (!resolved.startsWith(path.resolve(projectRoot))) return null;

    return resolved;
}

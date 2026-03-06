/**
 * Vibe Coding IDE — Terminal Manager
 * Manages multiple pty processes using node-pty
 */

import os from 'os';

// node-pty is a native module, imported dynamically
let pty: any;
try {
    pty = require('node-pty');
} catch {
    console.warn('node-pty not available — terminal features will be disabled');
}

const MAX_OUTPUT_BUFFER_SIZE = 50000; // 50KB ring buffer per terminal

interface PtySession {
    process: any;
    dataCallback?: (data: string) => void;
    exitCallback?: (exitCode: number) => void;
    outputBuffer: string;
}

export class TerminalManager {
    private sessions = new Map<string, PtySession>();

    /**
     * Create a new terminal session
     */
    create(id: string, cwd: string): void {
        if (!pty) {
            throw new Error('node-pty is not available. Install with: npm install node-pty');
        }

        if (this.sessions.has(id)) {
            this.destroy(id);
        }

        const shell = this.getDefaultShell();
        const shellArgs = this.getShellArgs(shell);

        const ptyProcess = pty.spawn(shell, shellArgs, {
            name: 'xterm-256color',
            cols: 120,
            rows: 30,
            cwd,
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
            },
        });

        const session: PtySession = { process: ptyProcess, outputBuffer: '' };
        this.sessions.set(id, session);

        // Forward pty data and buffer output
        ptyProcess.onData((data: string) => {
            // Append to output buffer (ring buffer behavior)
            session.outputBuffer += data;
            if (session.outputBuffer.length > MAX_OUTPUT_BUFFER_SIZE) {
                session.outputBuffer = session.outputBuffer.slice(-MAX_OUTPUT_BUFFER_SIZE);
            }
            session.dataCallback?.(data);
        });

        ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
            session.exitCallback?.(exitCode);
            this.sessions.delete(id);
        });
    }

    /**
     * Write data to a terminal session
     */
    write(id: string, data: string): void {
        const session = this.sessions.get(id);
        if (session) {
            session.process.write(data);
        }
    }

    /**
     * Resize a terminal session
     */
    resize(id: string, cols: number, rows: number): void {
        const session = this.sessions.get(id);
        if (session) {
            try {
                session.process.resize(cols, rows);
            } catch { }
        }
    }

    /**
     * Destroy a terminal session
     */
    destroy(id: string): void {
        const session = this.sessions.get(id);
        if (session) {
            try {
                session.process.kill();
            } catch { }
            this.sessions.delete(id);
        }
    }

    /**
     * Destroy all terminal sessions
     */
    destroyAll(): void {
        for (const id of this.sessions.keys()) {
            this.destroy(id);
        }
    }

    /**
     * Register data callback for a terminal
     */
    onData(id: string, callback: (data: string) => void): void {
        const session = this.sessions.get(id);
        if (session) {
            session.dataCallback = callback;
        }
    }

    /**
     * Register exit callback for a terminal
     */
    onExit(id: string, callback: (exitCode: number) => void): void {
        const session = this.sessions.get(id);
        if (session) {
            session.exitCallback = callback;
        }
    }

    /**
     * Get the default shell for the current platform
     */
    private getDefaultShell(): string {
        if (process.platform === 'win32') {
            return process.env.COMSPEC || 'powershell.exe';
        }
        return process.env.SHELL || '/bin/bash';
    }

    /**
     * Get shell arguments based on shell type
     */
    private getShellArgs(shell: string): string[] {
        if (process.platform === 'win32') {
            if (shell.toLowerCase().includes('powershell')) {
                return ['-NoLogo'];
            }
            return [];
        }
        return ['--login'];
    }

    /**
     * Get recent output from a terminal session
     */
    getRecentOutput(id: string, maxLines = 100): string {
        const session = this.sessions.get(id);
        if (!session) return '';

        const lines = session.outputBuffer.split('\n');
        return lines.slice(-maxLines).join('\n');
    }

    /**
     * Clear the output buffer for a terminal session
     */
    clearOutputBuffer(id: string): void {
        const session = this.sessions.get(id);
        if (session) {
            session.outputBuffer = '';
        }
    }

    /**
     * Write a command to a terminal and return (non-blocking)
     */
    executeCommand(id: string, command: string): boolean {
        const session = this.sessions.get(id);
        if (!session) return false;
        // Send the command followed by a newline to execute it
        session.process.write(command + '\r');
        return true;
    }

    /**
     * Check if node-pty is available
     */
    isAvailable(): boolean {
        return pty !== undefined;
    }
}

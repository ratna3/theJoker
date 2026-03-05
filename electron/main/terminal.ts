/**
 * The Joker — Terminal Manager
 * Manages multiple pty processes using node-pty
 */

import os from 'os';

let pty: any;
try {
    pty = require('node-pty');
} catch {
    console.warn('node-pty not available — terminal features will be disabled');
}

interface PtySession {
    process: any;
    dataCallback?: (data: string) => void;
    exitCallback?: (exitCode: number) => void;
}

export class TerminalManager {
    private sessions = new Map<string, PtySession>();

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
            env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
        });
        const session: PtySession = { process: ptyProcess };
        this.sessions.set(id, session);
        ptyProcess.onData((data: string) => { session.dataCallback?.(data); });
        ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
            session.exitCallback?.(exitCode);
            this.sessions.delete(id);
        });
    }

    write(id: string, data: string): void {
        this.sessions.get(id)?.process.write(data);
    }

    resize(id: string, cols: number, rows: number): void {
        try { this.sessions.get(id)?.process.resize(cols, rows); } catch { }
    }

    destroy(id: string): void {
        const session = this.sessions.get(id);
        if (session) {
            try { session.process.kill(); } catch { }
            this.sessions.delete(id);
        }
    }

    destroyAll(): void {
        for (const id of this.sessions.keys()) this.destroy(id);
    }

    onData(id: string, callback: (data: string) => void): void {
        const session = this.sessions.get(id);
        if (session) session.dataCallback = callback;
    }

    onExit(id: string, callback: (exitCode: number) => void): void {
        const session = this.sessions.get(id);
        if (session) session.exitCallback = callback;
    }

    private getDefaultShell(): string {
        if (process.platform === 'win32') return process.env.COMSPEC || 'powershell.exe';
        return process.env.SHELL || '/bin/bash';
    }

    private getShellArgs(shell: string): string[] {
        if (process.platform === 'win32') {
            return shell.toLowerCase().includes('powershell') ? ['-NoLogo'] : [];
        }
        return ['--login'];
    }

    isAvailable(): boolean { return pty !== undefined; }
}

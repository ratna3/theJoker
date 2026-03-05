/**
 * The Joker — Dependency Installer
 * Smart npm/yarn/pnpm fallback chain
 */

import { exec } from 'child_process';
import type { TerminalManager } from './terminal';

interface InstallResult {
    success: boolean;
    packageManager?: string;
    error?: string;
    attemptsLog: string[];
}

export class DependencyInstaller {
    async install(
        projectPath: string,
        terminalId: string,
        onProgress: (progress: any) => void,
        terminalManager: TerminalManager
    ): Promise<InstallResult> {
        const attemptsLog: string[] = [];

        // Attempt 1: npm install
        onProgress({ status: 'running', attempt: 1, detail: 'Running npm install...' });
        terminalManager.write(terminalId, '\r\n\x1b[36m--- npm install ---\x1b[0m\r\n');
        const npm1 = await this.runCommand(`cd "${projectPath}" && npm install`, 120000);
        attemptsLog.push(`npm install: ${npm1.success ? 'SUCCESS' : npm1.error || 'FAILED'}`);
        if (npm1.success) {
            onProgress({ status: 'success', packageManager: 'npm' });
            return { success: true, packageManager: 'npm', attemptsLog };
        }

        // Attempt 2: --legacy-peer-deps
        onProgress({ status: 'running', attempt: 2, detail: 'Retrying with --legacy-peer-deps...' });
        const npm2 = await this.runCommand(`cd "${projectPath}" && npm install --legacy-peer-deps`, 120000);
        attemptsLog.push(`npm install --legacy-peer-deps: ${npm2.success ? 'SUCCESS' : npm2.error || 'FAILED'}`);
        if (npm2.success) {
            onProgress({ status: 'success', packageManager: 'npm' });
            return { success: true, packageManager: 'npm', attemptsLog };
        }

        // Attempt 3: yarn
        if (await this.commandExists('yarn')) {
            const yarn = await this.runCommand(`cd "${projectPath}" && yarn install`, 120000);
            attemptsLog.push(`yarn: ${yarn.success ? 'SUCCESS' : yarn.error || 'FAILED'}`);
            if (yarn.success) {
                onProgress({ status: 'success', packageManager: 'yarn' });
                return { success: true, packageManager: 'yarn', attemptsLog };
            }
        }

        onProgress({ status: 'failed', error: 'All attempts failed' });
        return { success: false, error: 'All installation attempts failed', attemptsLog };
    }

    private runCommand(command: string, timeout: number): Promise<{ success: boolean; output: string; error?: string }> {
        return new Promise((resolve) => {
            const child = exec(command, { timeout, maxBuffer: 1024 * 1024 * 10, env: { ...process.env, FORCE_COLOR: '1' } });
            let stdout = '', stderr = '';
            child.stdout?.on('data', (d) => { stdout += d; });
            child.stderr?.on('data', (d) => { stderr += d; });
            child.on('close', (code) => {
                resolve(code === 0 ? { success: true, output: stdout } : { success: false, output: stdout, error: stderr || `Exit code ${code}` });
            });
            child.on('error', (err) => resolve({ success: false, output: stdout, error: err.message }));
        });
    }

    private commandExists(command: string): Promise<boolean> {
        const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
        return new Promise((resolve) => { exec(checkCmd, (error) => resolve(!error)); });
    }
}

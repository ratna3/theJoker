/**
 * Vibe Coding IDE — Dependency Installer
 * Smart npm/yarn/pnpm fallback chain for installing dependencies
 */

import { exec } from 'child_process';
import type { TerminalManager } from './terminal';

interface InstallProgress {
    status: 'running' | 'success' | 'failed';
    attempt?: number;
    packageManager?: string;
    detail?: string;
    error?: string;
}

interface InstallResult {
    success: boolean;
    packageManager?: string;
    error?: string;
    attemptsLog: string[];
}

export class DependencyInstaller {
    /**
     * Install dependencies with automatic fallback chain:
     * 1. npm install
     * 2. npm install --legacy-peer-deps
     * 3. yarn install
     * 4. pnpm install
     */
    async install(
        projectPath: string,
        terminalId: string,
        onProgress: (progress: InstallProgress) => void,
        terminalManager: TerminalManager
    ): Promise<InstallResult> {
        const attemptsLog: string[] = [];

        // Attempt 1: npm install
        onProgress({ status: 'running', attempt: 1, detail: 'Running npm install...' });
        terminalManager.write(terminalId, '\r\n\x1b[36m━━━ Attempt 1: npm install ━━━\x1b[0m\r\n');
        const npm1 = await this.runCommand(`cd "${projectPath}" && npm install`, 120000);
        attemptsLog.push(`npm install: ${npm1.success ? 'SUCCESS' : npm1.error || 'FAILED'}`);

        if (npm1.success) {
            terminalManager.write(terminalId, '\r\n\x1b[32m✓ npm install succeeded!\x1b[0m\r\n');
            onProgress({ status: 'success', packageManager: 'npm' });
            return { success: true, packageManager: 'npm', attemptsLog };
        }

        // Attempt 2: npm install --legacy-peer-deps
        onProgress({ status: 'running', attempt: 2, detail: 'Retrying with --legacy-peer-deps...' });
        terminalManager.write(terminalId, '\r\n\x1b[33m━━━ Attempt 2: npm install --legacy-peer-deps ━━━\x1b[0m\r\n');
        const npm2 = await this.runCommand(`cd "${projectPath}" && npm install --legacy-peer-deps`, 120000);
        attemptsLog.push(`npm install --legacy-peer-deps: ${npm2.success ? 'SUCCESS' : npm2.error || 'FAILED'}`);

        if (npm2.success) {
            terminalManager.write(terminalId, '\r\n\x1b[32m✓ npm install --legacy-peer-deps succeeded!\x1b[0m\r\n');
            onProgress({ status: 'success', packageManager: 'npm' });
            return { success: true, packageManager: 'npm', attemptsLog };
        }

        // Attempt 3: yarn install
        const hasYarn = await this.commandExists('yarn');
        if (hasYarn) {
            onProgress({ status: 'running', attempt: 3, detail: 'Trying yarn install...' });
            terminalManager.write(terminalId, '\r\n\x1b[35m━━━ Attempt 3: yarn install ━━━\x1b[0m\r\n');
            const yarn = await this.runCommand(`cd "${projectPath}" && yarn install`, 120000);
            attemptsLog.push(`yarn install: ${yarn.success ? 'SUCCESS' : yarn.error || 'FAILED'}`);

            if (yarn.success) {
                terminalManager.write(terminalId, '\r\n\x1b[32m✓ yarn install succeeded!\x1b[0m\r\n');
                onProgress({ status: 'success', packageManager: 'yarn' });
                return { success: true, packageManager: 'yarn', attemptsLog };
            }
        } else {
            attemptsLog.push('yarn: not installed, skipped');
            terminalManager.write(terminalId, '\r\n\x1b[90myarn not found, skipping...\x1b[0m\r\n');
        }

        // Attempt 4: pnpm install
        const hasPnpm = await this.commandExists('pnpm');
        if (hasPnpm) {
            onProgress({ status: 'running', attempt: 4, detail: 'Trying pnpm install...' });
            terminalManager.write(terminalId, '\r\n\x1b[35m━━━ Attempt 4: pnpm install ━━━\x1b[0m\r\n');
            const pnpm = await this.runCommand(`cd "${projectPath}" && pnpm install`, 120000);
            attemptsLog.push(`pnpm install: ${pnpm.success ? 'SUCCESS' : pnpm.error || 'FAILED'}`);

            if (pnpm.success) {
                terminalManager.write(terminalId, '\r\n\x1b[32m✓ pnpm install succeeded!\x1b[0m\r\n');
                onProgress({ status: 'success', packageManager: 'pnpm' });
                return { success: true, packageManager: 'pnpm', attemptsLog };
            }
        } else {
            attemptsLog.push('pnpm: not installed, skipped');
            terminalManager.write(terminalId, '\r\n\x1b[90mpnpm not found, skipping...\x1b[0m\r\n');
        }

        // All attempts failed
        const errorSummary = attemptsLog.join('\n');
        terminalManager.write(terminalId,
            '\r\n\x1b[31m━━━ All installation attempts failed ━━━\x1b[0m\r\n' +
            '\x1b[31m' + errorSummary + '\x1b[0m\r\n' +
            '\x1b[33mSuggestion: Try manually running "npm install" in the project directory.\x1b[0m\r\n'
        );
        onProgress({
            status: 'failed',
            error: 'All package manager attempts failed',
            detail: errorSummary,
        });

        return {
            success: false,
            error: 'All installation attempts failed',
            attemptsLog,
        };
    }

    /**
     * Run a shell command and detect success/failure
     */
    private runCommand(command: string, timeout: number): Promise<{ success: boolean; output: string; error?: string }> {
        return new Promise((resolve) => {
            const child = exec(command, {
                timeout,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                env: { ...process.env, FORCE_COLOR: '1' },
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => { stdout += data; });
            child.stderr?.on('data', (data) => { stderr += data; });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, output: stdout });
                } else {
                    resolve({
                        success: false,
                        output: stdout,
                        error: stderr || `Process exited with code ${code}`,
                    });
                }
            });

            child.on('error', (err) => {
                resolve({ success: false, output: stdout, error: err.message });
            });
        });
    }

    /**
     * Check if a command exists on the system
     */
    private commandExists(command: string): Promise<boolean> {
        const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
        return new Promise((resolve) => {
            exec(checkCmd, (error) => {
                resolve(!error);
            });
        });
    }
}

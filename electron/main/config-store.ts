/**
 * The Joker - Electron Desktop App
 * Config Store — Configuration management + first-run detection
 *
 * In dev:       .env lives at project root (e:\theJoker\.env)
 * In packaged:  config is stored in app userData directory
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * Determine if we are running in a packaged (production) build or dev.
 */
function isPackaged(): boolean {
    return app.isPackaged;
}

/**
 * Get the directory where we read/write the .env config.
 * - Dev: project root  (e:\theJoker\)
 * - Packaged: Electron userData folder (AppData\Roaming\The Joker\)
 */
function getConfigDir(): string {
    if (isPackaged()) {
        return app.getPath('userData');
    }
    // Dev mode: go from electron/dist/main/ → project root
    return path.resolve(__dirname, '..', '..', '..');
}

const ENV_FILENAME = '.env';

function getEnvPath(): string {
    return path.join(getConfigDir(), ENV_FILENAME);
}

function getEnvExamplePath(): string {
    // .env.example only exists in dev (project root)
    return path.resolve(__dirname, '..', '..', '..', '.env.example');
}

export interface JokerConfig {
    LM_STUDIO_BASE_URL: string;
    LM_STUDIO_MODEL: string;
    LM_STUDIO_API_KEY: string;
    [key: string]: string;
}

const DEFAULTS: JokerConfig = {
    LM_STUDIO_BASE_URL: 'http://localhost:1234',
    LM_STUDIO_MODEL: 'qwen2.5-coder-14b-instruct-uncensored',
    LM_STUDIO_API_KEY: 'not-needed',
};

/**
 * Parse a .env file into key-value pairs
 */
function parseEnvFile(filePath: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!fs.existsSync(filePath)) return result;

    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        result[key] = value;
    }
    return result;
}

/**
 * Check if this is the first run (no .env or missing LM_STUDIO keys)
 */
export function isFirstRun(): boolean {
    const envPath = getEnvPath();
    if (!fs.existsSync(envPath)) return true;
    const env = parseEnvFile(envPath);
    return !env['LM_STUDIO_BASE_URL'] || !env['LM_STUDIO_MODEL'];
}

/**
 * Get current config from .env
 */
export function getConfig(): JokerConfig {
    const env = parseEnvFile(getEnvPath());
    return {
        ...DEFAULTS,
        ...env,
    };
}

/**
 * Save config values to .env file
 */
export function saveConfig(config: Partial<JokerConfig>): void {
    const envPath = getEnvPath();
    const envExamplePath = getEnvExamplePath();

    // If .env doesn't exist, create from example or from scratch
    if (!fs.existsSync(envPath)) {
        if (!isPackaged() && fs.existsSync(envExamplePath)) {
            const exampleContent = fs.readFileSync(envExamplePath, 'utf-8');
            fs.writeFileSync(envPath, exampleContent, 'utf-8');
        } else {
            fs.writeFileSync(envPath, '', 'utf-8');
        }
    }

    // Read current .env content
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const updatedKeys = new Set<string>();

    // Update existing lines
    const newLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return line;
        const key = trimmed.slice(0, eqIdx).trim();
        if (key in config) {
            updatedKeys.add(key);
            return `${key}=${config[key]}`;
        }
        return line;
    });

    // Append any new keys not already in file
    for (const [key, value] of Object.entries(config)) {
        if (!updatedKeys.has(key)) {
            newLines.push(`${key}=${value}`);
        }
    }

    fs.writeFileSync(envPath, newLines.join('\n'), 'utf-8');

    // Also set process.env so the backend picks up changes immediately
    for (const [key, value] of Object.entries(config)) {
        process.env[key] = value;
    }
}

/**
 * Inject current .env values into process.env
 */
export function loadEnvIntoProcess(): void {
    const env = parseEnvFile(getEnvPath());
    for (const [key, value] of Object.entries(env)) {
        process.env[key] = value;
    }
}

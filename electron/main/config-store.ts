/**
 * The Joker - Electron Desktop App
 * Config Store — .env management + first-run detection
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');

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
    if (!fs.existsSync(ENV_PATH)) return true;
    const env = parseEnvFile(ENV_PATH);
    return !env['LM_STUDIO_BASE_URL'] || !env['LM_STUDIO_MODEL'];
}

/**
 * Get current config from .env
 */
export function getConfig(): JokerConfig {
    const env = parseEnvFile(ENV_PATH);
    return {
        ...DEFAULTS,
        ...env,
    };
}

/**
 * Save config values to .env file
 */
export function saveConfig(config: Partial<JokerConfig>): void {
    let existing: Record<string, string> = {};

    // If .env.example exists but .env doesn't, start from example
    if (!fs.existsSync(ENV_PATH) && fs.existsSync(ENV_EXAMPLE_PATH)) {
        const exampleContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
        // Write a copy and then modify
        fs.writeFileSync(ENV_PATH, exampleContent, 'utf-8');
    } else if (!fs.existsSync(ENV_PATH)) {
        fs.writeFileSync(ENV_PATH, '', 'utf-8');
    }

    // Read current .env content
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
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

    fs.writeFileSync(ENV_PATH, newLines.join('\n'), 'utf-8');

    // Also set process.env so the backend picks up changes immediately
    for (const [key, value] of Object.entries(config)) {
        process.env[key] = value;
    }
}

/**
 * Inject current .env values into process.env
 */
export function loadEnvIntoProcess(): void {
    const env = parseEnvFile(ENV_PATH);
    for (const [key, value] of Object.entries(env)) {
        process.env[key] = value;
    }
}

/**
 * The Joker - Agentic Terminal
 * Configuration Loader
 */

import dotenv from 'dotenv';
import path from 'path';
import { AppConfig, LLMConfig, AgentConfig, ScraperConfig, TerminalConfig, LogConfig } from '../types';

// Load environment variables
dotenv.config();

/**
 * Get environment variable with fallback
 */
function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

/**
 * Get environment variable as number
 */
function getEnvNumber(key: string, fallback: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : fallback;
}

/**
 * Get environment variable as boolean
 */
function getEnvBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

/**
 * LLM Configuration
 */
export const llmConfig: LLMConfig = {
  baseUrl: getEnv('LM_STUDIO_BASE_URL', 'http://192.168.56.1:1234'),
  model: getEnv('LM_STUDIO_MODEL', 'qwen2.5-coder-14b-instruct-uncensored'),
  apiKey: getEnv('LM_STUDIO_API_KEY', 'not-needed'),
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 60000,
};

/**
 * Agent Configuration
 */
export const agentConfig: AgentConfig = {
  maxIterations: getEnvNumber('AGENT_MAX_ITERATIONS', 10),
  timeoutMs: getEnvNumber('AGENT_TIMEOUT_MS', 60000),
  verbose: getEnvBool('AGENT_VERBOSE', true),
};

/**
 * Scraper Configuration
 */
export const scraperConfig: ScraperConfig = {
  headless: getEnvBool('SCRAPER_HEADLESS', true),
  timeout: getEnvNumber('SCRAPER_TIMEOUT_MS', 30000),
  userAgent: getEnv(
    'SCRAPER_USER_AGENT',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ),
  maxConcurrent: getEnvNumber('SCRAPER_MAX_CONCURRENT', 3),
};

/**
 * Terminal Configuration
 */
export const terminalConfig: TerminalConfig = {
  colors: getEnvBool('TERMINAL_COLORS', true),
  spinner: getEnvBool('TERMINAL_SPINNER', true),
};

/**
 * Log Configuration
 */
export const logConfig: LogConfig = {
  level: getEnv('LOG_LEVEL', 'info') as LogConfig['level'],
  file: getEnv('LOG_FILE', 'logs/joker.log'),
  maxSize: getEnv('LOG_MAX_SIZE', '10m'),
  maxFiles: getEnvNumber('LOG_MAX_FILES', 5),
};

/**
 * Complete Application Configuration
 */
export const config: AppConfig = {
  llm: llmConfig,
  agent: agentConfig,
  scraper: scraperConfig,
  terminal: terminalConfig,
  log: logConfig,
};

/**
 * Project paths
 */
export const paths = {
  root: path.resolve(__dirname, '../..'),
  src: path.resolve(__dirname, '..'),
  logs: path.resolve(__dirname, '../../logs'),
  projects: path.resolve(__dirname, '../../projects'),
};

export default config;

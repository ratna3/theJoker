/**
 * The Joker - Agentic Terminal
 * MCP Configuration
 *
 * Loads MCP server configurations from .joker-mcp.json
 * and provides default settings.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { MCPServerConfig } from './client';

// ============================================
// Types
// ============================================

export interface MCPConfigFile {
  /** MCP server configurations. */
  servers: MCPServerConfig[];
}

// ============================================
// Config Loading
// ============================================

const DEFAULT_CONFIG: MCPConfigFile = {
  servers: [],
};

/**
 * Resolve the path to the MCP config file.
 * Looks in:
 *  1. Current working directory: .joker-mcp.json
 *  2. Home directory: ~/.joker-mcp.json
 */
function resolveConfigPath(): string | null {
  const cwd = process.cwd();
  const home = process.env.HOME || process.env.USERPROFILE || '';

  const candidates = [
    path.join(cwd, '.joker-mcp.json'),
    home ? path.join(home, '.joker-mcp.json') : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Load and validate the MCP config file.
 */
export function loadMCPConfig(): MCPConfigFile {
  const configPath = resolveConfigPath();

  if (!configPath) {
    logger.debug('No .joker-mcp.json found, using empty config');
    return DEFAULT_CONFIG;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<MCPConfigFile>;

    if (!parsed.servers || !Array.isArray(parsed.servers)) {
      logger.warn('MCP config missing "servers" array', { path: configPath });
      return DEFAULT_CONFIG;
    }

    // Validate each server config
    const validServers: MCPServerConfig[] = [];
    for (const server of parsed.servers) {
      if (!server.name || typeof server.name !== 'string') {
        logger.warn('MCP server config missing "name", skipping');
        continue;
      }
      if (!server.transport || !['stdio', 'http'].includes(server.transport)) {
        logger.warn(`MCP server "${server.name}": invalid transport "${server.transport}", skipping`);
        continue;
      }
      if (server.transport === 'stdio' && !server.command) {
        logger.warn(`MCP server "${server.name}": stdio transport requires "command", skipping`);
        continue;
      }
      if (server.transport === 'http' && !server.url) {
        logger.warn(`MCP server "${server.name}": http transport requires "url", skipping`);
        continue;
      }

      validServers.push({
        autoConnect: true,
        timeout: 30000,
        ...server,
      });
    }

    logger.info('MCP config loaded', {
      path: configPath,
      servers: validServers.length,
    });

    return { servers: validServers };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load MCP config', { path: configPath, error: message });
    return DEFAULT_CONFIG;
  }
}

/**
 * Save MCP config to the CWD .joker-mcp.json.
 */
export function saveMCPConfig(config: MCPConfigFile): void {
  const configPath = path.join(process.cwd(), '.joker-mcp.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  logger.info('MCP config saved', { path: configPath, servers: config.servers.length });
}

/**
 * Add a server to the MCP config.
 */
export function addMCPServer(server: MCPServerConfig): MCPConfigFile {
  const config = loadMCPConfig();

  // Remove existing server with the same name
  config.servers = config.servers.filter(s => s.name !== server.name);
  config.servers.push(server);

  saveMCPConfig(config);
  return config;
}

/**
 * Remove a server from the MCP config.
 */
export function removeMCPServer(serverName: string): MCPConfigFile {
  const config = loadMCPConfig();
  config.servers = config.servers.filter(s => s.name !== serverName);
  saveMCPConfig(config);
  return config;
}

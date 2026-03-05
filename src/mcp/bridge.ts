/**
 * The Joker - Agentic Terminal
 * MCP Tool Bridge
 *
 * Wraps MCP tools discovered from external servers
 * into The Joker's native Tool interface so they can
 * be registered in the ToolRegistry and called by the agent.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { MCPClient, MCPTool, MCPServerConfig, MCPToolProperty } from './client';
import { loadMCPConfig } from './config';
import { Tool, ParameterSchema, ExecutionContext } from '../agents/executor';

// ============================================
// MCP Manager
// ============================================

/**
 * Manages multiple MCP server connections and provides
 * a unified interface for discovering and calling MCP tools.
 */
export class MCPManager extends EventEmitter {
  private clients: Map<string, MCPClient> = new Map();

  /**
   * Initialize from config, connecting to all auto-connect servers.
   */
  async initialize(): Promise<void> {
    const config = loadMCPConfig();

    if (config.servers.length === 0) {
      logger.debug('No MCP servers configured');
      return;
    }

    logger.info('Initializing MCP connections', { count: config.servers.length });

    for (const serverConfig of config.servers) {
      if (serverConfig.autoConnect !== false) {
        try {
          await this.connectServer(serverConfig);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error('Failed to connect MCP server', {
            name: serverConfig.name,
            error: message,
          });
        }
      }
    }
  }

  /**
   * Connect to a single MCP server.
   */
  async connectServer(config: MCPServerConfig): Promise<void> {
    // Disconnect existing connection with same name
    if (this.clients.has(config.name)) {
      await this.disconnectServer(config.name);
    }

    const client = new MCPClient(config);

    client.on('error', (err) => {
      logger.error('MCP server error', { name: config.name, error: err.message });
      this.emit('server:error', { name: config.name, error: err });
    });

    client.on('disconnected', () => {
      this.clients.delete(config.name);
      this.emit('server:disconnected', { name: config.name });
    });

    await client.connect();
    this.clients.set(config.name, client);

    this.emit('server:connected', {
      name: config.name,
      tools: client.tools.length,
      resources: client.resources.length,
    });
  }

  /**
   * Disconnect from a server.
   */
  async disconnectServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  /**
   * Disconnect all servers.
   */
  async disconnectAll(): Promise<void> {
    const names = Array.from(this.clients.keys());
    for (const name of names) {
      await this.disconnectServer(name);
    }
  }

  /**
   * Get all connected server names.
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get a specific client.
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * Get all MCP tools from all connected servers.
   */
  getAllTools(): Array<{ server: string; tool: MCPTool }> {
    const tools: Array<{ server: string; tool: MCPTool }> = [];
    for (const [serverName, client] of this.clients) {
      for (const tool of client.tools) {
        tools.push({ server: serverName, tool });
      }
    }
    return tools;
  }

  /**
   * Convert all discovered MCP tools into Joker Tool objects
   * that can be registered in the ToolRegistry.
   */
  getJokerTools(): Tool[] {
    const tools: Tool[] = [];

    for (const [serverName, client] of this.clients) {
      for (const mcpTool of client.tools) {
        tools.push(this.wrapMCPTool(serverName, client, mcpTool));
      }
    }

    return tools;
  }

  /**
   * Wrap a single MCP tool as a Joker Tool.
   */
  private wrapMCPTool(serverName: string, client: MCPClient, mcpTool: MCPTool): Tool {
    const toolName = `mcp_${serverName}_${mcpTool.name}`;

    // Convert MCP inputSchema to Joker ParameterSchema
    const parameters: ParameterSchema[] = [];
    if (mcpTool.inputSchema?.properties) {
      const required = mcpTool.inputSchema.required || [];
      for (const [propName, prop] of Object.entries(mcpTool.inputSchema.properties)) {
        parameters.push(this.convertProperty(propName, prop, required.includes(propName)));
      }
    }

    return {
      name: toolName,
      description: `[MCP:${serverName}] ${mcpTool.description || mcpTool.name}`,
      parameters,
      execute: async (params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> => {
        logger.debug('Executing MCP tool', { server: serverName, tool: mcpTool.name, params });

        const result = await client.callTool(mcpTool.name, params);

        if (result.isError) {
          const errorText = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');
          throw new Error(`MCP tool error: ${errorText}`);
        }

        // Extract text content for simple results
        const textContent = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');

        return textContent || result.content;
      },
    };
  }

  /**
   * Convert an MCP property schema to a Joker ParameterSchema.
   */
  private convertProperty(name: string, prop: MCPToolProperty, required: boolean): ParameterSchema {
    let type: ParameterSchema['type'] = 'string';
    switch (prop.type) {
      case 'string': type = 'string'; break;
      case 'number':
      case 'integer': type = 'number'; break;
      case 'boolean': type = 'boolean'; break;
      case 'object': type = 'object'; break;
      case 'array': type = 'array'; break;
      default: type = 'string';
    }

    return {
      name,
      type,
      required,
      description: prop.description,
      default: prop.default,
    };
  }

  /**
   * Summary of all connected servers for display.
   */
  getStatus(): Array<{ name: string; connected: boolean; tools: number; resources: number }> {
    const status: Array<{ name: string; connected: boolean; tools: number; resources: number }> = [];
    for (const [name, client] of this.clients) {
      status.push({
        name,
        connected: client.connected,
        tools: client.tools.length,
        resources: client.resources.length,
      });
    }
    return status;
  }
}

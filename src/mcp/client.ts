/**
 * The Joker - Agentic Terminal
 * MCP Client
 *
 * Connects to MCP servers, discovers tools and resources,
 * and executes tool calls via JSON-RPC 2.0.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { IMCPTransport, StdioTransport, HttpTransport, JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from './transport';

// ============================================
// Types
// ============================================

export interface MCPServerConfig {
  /** Unique name for this server. */
  name: string;
  /** Transport type. */
  transport: 'stdio' | 'http';
  /** Command to start the server (stdio). */
  command?: string;
  /** Arguments for the command (stdio). */
  args?: string[];
  /** Environment variables (stdio). */
  env?: Record<string, string>;
  /** URL for HTTP transport. */
  url?: string;
  /** Whether to auto-connect on startup. */
  autoConnect?: boolean;
  /** Connection timeout in ms. */
  timeout?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, MCPToolProperty>;
    required?: string[];
  };
}

export interface MCPToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPToolCallResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

// ============================================
// MCP Client
// ============================================

/**
 * Client for a single MCP server connection.
 */
export class MCPClient extends EventEmitter {
  private transport: IMCPTransport | null = null;
  private config: MCPServerConfig;
  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();
  private serverInfo: MCPServerInfo | null = null;
  private _tools: MCPTool[] = [];
  private _resources: MCPResource[] = [];
  private _connected: boolean = false;

  constructor(config: MCPServerConfig) {
    super();
    this.config = {
      autoConnect: true,
      timeout: 30000,
      ...config,
    };
  }

  // ── Connection Lifecycle ──────────────────────────────

  /**
   * Connect to the MCP server and perform initialization handshake.
   */
  async connect(): Promise<void> {
    if (this._connected) {
      logger.debug('MCP client already connected', { name: this.config.name });
      return;
    }

    // Create transport
    if (this.config.transport === 'stdio') {
      if (!this.config.command) {
        throw new Error(`MCP server "${this.config.name}": command is required for stdio transport`);
      }
      this.transport = new StdioTransport(
        this.config.command,
        this.config.args || [],
        this.config.env || {},
      );
    } else if (this.config.transport === 'http') {
      if (!this.config.url) {
        throw new Error(`MCP server "${this.config.name}": url is required for http transport`);
      }
      this.transport = new HttpTransport(this.config.url);
    } else {
      throw new Error(`MCP server "${this.config.name}": unsupported transport "${this.config.transport}"`);
    }

    // Wire up message handling
    this.transport.on('message', (msg: JsonRpcResponse | JsonRpcNotification) => this.handleMessage(msg));
    this.transport.on('error', (err) => {
      logger.error('MCP transport error', { server: this.config.name, error: err.message });
      this.emit('error', err);
    });
    this.transport.on('close', () => {
      this._connected = false;
      this.emit('disconnected', { name: this.config.name });
      logger.info('MCP server disconnected', { name: this.config.name });
    });

    // Start transport
    await this.transport.start();

    // MCP Initialize handshake
    const initResult = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'TheJoker', version: '1.1.1' },
    }) as { serverInfo?: MCPServerInfo; capabilities?: Record<string, unknown> };

    this.serverInfo = initResult?.serverInfo || { name: this.config.name, version: 'unknown', capabilities: {} };

    // Send initialized notification
    await this.sendNotification('notifications/initialized', {});

    this._connected = true;
    logger.info('MCP server connected', {
      name: this.config.name,
      serverInfo: this.serverInfo,
    });

    // Discover tools and resources
    await this.discoverTools();
    await this.discoverResources();

    this.emit('connected', {
      name: this.config.name,
      tools: this._tools.length,
      resources: this._resources.length,
    });
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      // Cancel pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Connection closed'));
      }
      this.pendingRequests.clear();

      await this.transport.close();
      this.transport = null;
    }

    this._connected = false;
    this._tools = [];
    this._resources = [];
    this.serverInfo = null;

    logger.info('MCP client disconnected', { name: this.config.name });
  }

  // ── Tool Discovery & Execution ────────────────────────

  /**
   * Discover available tools from the server.
   */
  async discoverTools(): Promise<MCPTool[]> {
    try {
      const result = await this.sendRequest('tools/list', {}) as { tools?: MCPTool[] };
      this._tools = result?.tools || [];
      logger.info('MCP tools discovered', {
        server: this.config.name,
        count: this._tools.length,
        names: this._tools.map(t => t.name),
      });
      return this._tools;
    } catch (error) {
      logger.debug('MCP tools/list not supported', { server: this.config.name });
      return [];
    }
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    if (!this._connected) {
      throw new Error(`MCP server "${this.config.name}" not connected`);
    }

    logger.debug('MCP tool call', { server: this.config.name, tool: toolName, args });

    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    }) as MCPToolCallResult;

    return result;
  }

  /**
   * Discover available resources from the server.
   */
  async discoverResources(): Promise<MCPResource[]> {
    try {
      const result = await this.sendRequest('resources/list', {}) as { resources?: MCPResource[] };
      this._resources = result?.resources || [];
      logger.debug('MCP resources discovered', {
        server: this.config.name,
        count: this._resources.length,
      });
      return this._resources;
    } catch {
      logger.debug('MCP resources/list not supported', { server: this.config.name });
      return [];
    }
  }

  /**
   * Read a resource from the server.
   */
  async readResource(uri: string): Promise<unknown> {
    const result = await this.sendRequest('resources/read', { uri });
    return result;
  }

  // ── Getters ───────────────────────────────────────────

  get name(): string { return this.config.name; }
  get connected(): boolean { return this._connected; }
  get tools(): MCPTool[] { return this._tools; }
  get resources(): MCPResource[] { return this._resources; }
  get info(): MCPServerInfo | null { return this.serverInfo; }

  // ── JSON-RPC Communication ────────────────────────────

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.transport) {
        reject(new Error('Transport not initialized'));
        return;
      }

      const id = ++this.requestId;
      const timeout = this.config.timeout || 30000;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout: ${method} (${timeout}ms)`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout: timer });

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.transport.send(request).catch((err) => {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      });
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  private async sendNotification(method: string, params: Record<string, unknown>): Promise<void> {
    if (!this.transport) return;

    // Notifications use the same structure but don't get responses
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    await this.transport.send(request);
  }

  /**
   * Handle incoming JSON-RPC message from the transport.
   */
  private handleMessage(msg: JsonRpcResponse | JsonRpcNotification): void {
    // Response to a pending request (has id)
    if ('id' in msg && msg.id !== null && msg.id !== undefined) {
      const response = msg as JsonRpcResponse;
      const pending = this.pendingRequests.get(response.id as number);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id as number);

        if (response.error) {
          pending.reject(new Error(`MCP error ${response.error.code}: ${response.error.message}`));
        } else {
          pending.resolve(response.result);
        }
        return;
      }
    }

    // Notification from server (has method, no id)
    if ('method' in msg) {
      this.emit('notification', msg);
    }
  }
}

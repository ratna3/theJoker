/**
 * The Joker - Agentic Terminal
 * MCP Transport Layer
 *
 * Implements JSON-RPC 2.0 transports for MCP communication:
 * - StdioTransport: communicates via child process stdin/stdout
 * - HttpTransport: communicates via HTTP POST
 *
 * Zero external dependencies — uses Node.js child_process and axios (already in project).
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface TransportEvents {
  message: JsonRpcResponse | JsonRpcNotification;
  error: Error;
  close: void;
}

/**
 * Abstract transport interface.
 */
export interface IMCPTransport {
  send(message: JsonRpcRequest): Promise<void>;
  start(): Promise<void>;
  close(): Promise<void>;
  on(event: 'message', handler: (msg: JsonRpcResponse | JsonRpcNotification) => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  on(event: 'close', handler: () => void): void;
}

// ============================================
// Stdio Transport
// ============================================

/**
 * Communicates with an MCP server over stdio (child process).
 * Messages use Content-Length header framing per the MCP spec.
 */
export class StdioTransport extends EventEmitter implements IMCPTransport {
  private process: ChildProcess | null = null;
  private command: string;
  private args: string[];
  private env: Record<string, string>;
  private buffer: string = '';
  private contentLength: number = -1;

  constructor(command: string, args: string[] = [], env: Record<string, string> = {}) {
    super();
    this.command = command;
    this.args = args;
    this.env = env;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.env },
          windowsHide: true,
        });

        this.process.stdout!.on('data', (data: Buffer) => {
          this.handleData(data.toString('utf-8'));
        });

        this.process.stderr!.on('data', (data: Buffer) => {
          const msg = data.toString('utf-8').trim();
          if (msg) {
            logger.debug('MCP server stderr', { message: msg });
          }
        });

        this.process.on('error', (err) => {
          this.emit('error', err);
        });

        this.process.on('close', (code) => {
          logger.debug('MCP server process exited', { code });
          this.emit('close');
        });

        // Give the process a moment to start
        setTimeout(resolve, 200);
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(message: JsonRpcRequest): Promise<void> {
    if (!this.process?.stdin?.writable) {
      throw new Error('Transport not connected');
    }

    const body = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n`;

    this.process.stdin.write(header + body);
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * Handle incoming data from stdout using Content-Length framing.
   */
  private handleData(data: string): void {
    this.buffer += data;

    while (true) {
      if (this.contentLength === -1) {
        // Look for Content-Length header
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break;

        const header = this.buffer.slice(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          // Skip malformed header
          this.buffer = this.buffer.slice(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(match[1], 10);
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      if (this.buffer.length < this.contentLength) break;

      // Extract the message body
      const body = this.buffer.slice(0, this.contentLength);
      this.buffer = this.buffer.slice(this.contentLength);
      this.contentLength = -1;

      try {
        const message = JSON.parse(body);
        this.emit('message', message);
      } catch (err) {
        logger.error('Failed to parse MCP message', { body: body.slice(0, 200) });
      }
    }
  }
}

// ============================================
// HTTP Transport
// ============================================

/**
 * Communicates with an MCP server over HTTP POST.
 */
export class HttpTransport extends EventEmitter implements IMCPTransport {
  private client: AxiosInstance;
  private url: string;

  constructor(url: string) {
    super();
    this.url = url;
    this.client = axios.create({
      baseURL: url,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async start(): Promise<void> {
    // Test connectivity
    try {
      await this.client.get('/');
    } catch {
      // Server might not support GET on root, that's OK
    }
    logger.debug('HTTP transport started', { url: this.url });
  }

  async send(message: JsonRpcRequest): Promise<void> {
    try {
      const response = await this.client.post('/', message);
      if (response.data) {
        this.emit('message', response.data);
      }
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  async close(): Promise<void> {
    // Nothing to clean up for HTTP
  }
}

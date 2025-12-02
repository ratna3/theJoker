/**
 * Tool Registry - Central management for all available tools
 * Part of The Joker's agentic capabilities
 */

import { log } from '../utils/logger';

// Simple logger wrapper for module-specific logging
class ModuleLogger {
  constructor(private module: string) {}
  
  info(message: string) { log.info(`[${this.module}] ${message}`); }
  warn(message: string) { log.warn(`[${this.module}] ${message}`); }
  error(message: string) { log.error(`[${this.module}] ${message}`); }
  debug(message: string) { log.debug(`[${this.module}] ${message}`); }
}

// Tool parameter definition
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];
}

// Tool definition interface
export interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>) => Promise<ToolResult>;
  validate?: (params: Record<string, any>) => ValidationResult;
}

// Tool categories
export enum ToolCategory {
  SEARCH = 'search',
  SCRAPE = 'scrape',
  PROCESS = 'process',
  FILE = 'file',
  CODE = 'code',
  SYSTEM = 'system',
  BROWSER = 'browser'
}

// Tool execution result
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    toolName: string;
    timestamp: Date;
  };
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Tool execution context
export interface ExecutionContext {
  sessionId: string;
  userId?: string;
  timeout: number;
  retryCount: number;
  dryRun: boolean;
}

/**
 * Tool Registry - Manages all available tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private categories: Map<ToolCategory, string[]> = new Map();
  private logger: ModuleLogger;
  private executionHistory: Array<{
    toolName: string;
    params: Record<string, any>;
    result: ToolResult;
    timestamp: Date;
  }> = [];

  constructor() {
    this.logger = new ModuleLogger('ToolRegistry');
    this.initializeCategories();
  }

  /**
   * Initialize category tracking
   */
  private initializeCategories(): void {
    Object.values(ToolCategory).forEach(category => {
      this.categories.set(category, []);
    });
  }

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} already registered, overwriting`);
    }

    this.tools.set(tool.name, tool);
    
    // Track by category
    const categoryTools = this.categories.get(tool.category) || [];
    if (!categoryTools.includes(tool.name)) {
      categoryTools.push(tool.name);
      this.categories.set(tool.category, categoryTools);
    }

    this.logger.info(`Registered tool: ${tool.name} [${tool.category}]`);
  }

  /**
   * Unregister a tool
   */
  unregister(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return false;
    }

    this.tools.delete(toolName);
    
    // Remove from category
    const categoryTools = this.categories.get(tool.category) || [];
    const index = categoryTools.indexOf(toolName);
    if (index > -1) {
      categoryTools.splice(index, 1);
      this.categories.set(tool.category, categoryTools);
    }

    this.logger.info(`Unregistered tool: ${toolName}`);
    return true;
  }

  /**
   * Get a tool by name
   */
  get(toolName: string): Tool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Check if a tool exists
   */
  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): Tool[] {
    const toolNames = this.categories.get(category) || [];
    return toolNames.map(name => this.tools.get(name)!).filter(Boolean);
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Validate tool parameters
   */
  validateParams(toolName: string, params: Record<string, any>): ValidationResult {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool ${toolName} not found`] };
    }

    const errors: string[] = [];

    // Check required parameters
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      const value = params[param.name];
      if (value === undefined) continue;

      // Type validation
      if (!this.validateType(value, param.type)) {
        errors.push(`Parameter ${param.name} should be of type ${param.type}`);
      }

      // Enum validation
      if (param.enum && !param.enum.includes(value)) {
        errors.push(`Parameter ${param.name} must be one of: ${param.enum.join(', ')}`);
      }
    }

    // Custom validation if provided
    if (tool.validate) {
      const customResult = tool.validate(params);
      errors.push(...customResult.errors);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate a value against a type
   */
  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default:
        return true;
    }
  }

  /**
   * Execute a tool
   */
  async execute(
    toolName: string,
    params: Record<string, any>,
    context?: Partial<ExecutionContext>
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found`
      };
    }

    // Validate parameters
    const validation = this.validateParams(toolName, params);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Apply defaults
    const finalParams = this.applyDefaults(tool, params);

    // Execute with timing
    const startTime = Date.now();
    this.logger.info(`Executing tool: ${toolName}`);
    this.logger.debug(`Parameters: ${JSON.stringify(finalParams)}`);

    try {
      const result = await tool.execute(finalParams);
      const executionTime = Date.now() - startTime;

      // Add metadata
      result.metadata = {
        executionTime,
        toolName,
        timestamp: new Date()
      };

      // Record in history
      this.executionHistory.push({
        toolName,
        params: finalParams,
        result,
        timestamp: new Date()
      });

      this.logger.info(`Tool ${toolName} completed in ${executionTime}ms`);
      return result;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Tool ${toolName} failed: ${error.message}`);

      const result: ToolResult = {
        success: false,
        error: error.message,
        metadata: {
          executionTime,
          toolName,
          timestamp: new Date()
        }
      };

      this.executionHistory.push({
        toolName,
        params: finalParams,
        result,
        timestamp: new Date()
      });

      return result;
    }
  }

  /**
   * Apply default values to parameters
   */
  private applyDefaults(tool: Tool, params: Record<string, any>): Record<string, any> {
    const result = { ...params };

    for (const param of tool.parameters) {
      if (!(param.name in result) && param.default !== undefined) {
        result[param.name] = param.default;
      }
    }

    return result;
  }

  /**
   * Get execution history
   */
  getHistory(limit?: number): typeof this.executionHistory {
    if (limit) {
      return this.executionHistory.slice(-limit);
    }
    return [...this.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
    this.logger.info('Execution history cleared');
  }

  /**
   * Generate tool documentation for LLM
   */
  generateToolDocs(): string {
    const docs: string[] = ['# Available Tools\n'];

    for (const category of Object.values(ToolCategory)) {
      const tools = this.getByCategory(category);
      if (tools.length === 0) continue;

      docs.push(`## ${category.toUpperCase()}\n`);

      for (const tool of tools) {
        docs.push(`### ${tool.name}`);
        docs.push(`${tool.description}\n`);
        docs.push('**Parameters:**');

        for (const param of tool.parameters) {
          const required = param.required ? '(required)' : '(optional)';
          const defaultVal = param.default !== undefined ? ` [default: ${param.default}]` : '';
          docs.push(`- \`${param.name}\` (${param.type}) ${required}${defaultVal}: ${param.description}`);
        }

        docs.push('');
      }
    }

    return docs.join('\n');
  }

  /**
   * Generate JSON schema for all tools (for LLM function calling)
   */
  generateSchema(): object[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            ...(param.enum && { enum: param.enum }),
            ...(param.default !== undefined && { default: param.default })
          };
          return acc;
        }, {} as Record<string, any>),
        required: tool.parameters
          .filter(p => p.required)
          .map(p => p.name)
      }
    }));
  }

  /**
   * Get registry statistics
   */
  getStats(): object {
    return {
      totalTools: this.tools.size,
      byCategory: Object.fromEntries(
        Array.from(this.categories.entries()).map(([cat, tools]) => [cat, tools.length])
      ),
      executionCount: this.executionHistory.length,
      lastExecution: this.executionHistory.length > 0 
        ? this.executionHistory[this.executionHistory.length - 1].timestamp 
        : null
    };
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();

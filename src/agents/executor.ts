/**
 * The Joker - Agentic Terminal
 * Tool Executor
 * 
 * Executes action plans by running tools in sequence,
 * handling dependencies and managing results
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { ActionPlan, ActionStep } from './planner';

/**
 * Result from a tool execution
 */
export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  metadata: {
    executionTime: number;
    tool: string;
    stepId: string;
    timestamp: Date;
    retries?: number;
  };
}

/**
 * Overall execution result
 */
export interface ExecutionResult {
  success: boolean;
  planId: string;
  results: Map<string, ToolResult>;
  finalOutput: unknown;
  totalTime: number;
  stepsCompleted: number;
  stepsFailed: number;
  errors: string[];
}

/**
 * Tool function signature
 */
export type ToolFunction = (params: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>;

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  parameters: ParameterSchema[];
  execute: ToolFunction;
}

/**
 * Parameter schema for tools
 */
export interface ParameterSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  default?: unknown;
}

/**
 * Execution context passed to tools
 */
export interface ExecutionContext {
  planId: string;
  stepId: string;
  previousResults: Map<string, ToolResult>;
  resolveParam: (value: unknown) => unknown;
  emit: (event: string, data: unknown) => void;
}

/**
 * Executor configuration
 */
export interface ExecutorConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  parallel?: boolean;
}

/**
 * Executor events
 */
export interface ExecutorEvents {
  'step:start': { step: ActionStep; planId: string };
  'step:complete': { step: ActionStep; result: ToolResult };
  'step:error': { step: ActionStep; error: Error };
  'step:retry': { step: ActionStep; attempt: number };
  'plan:start': { plan: ActionPlan };
  'plan:complete': { result: ExecutionResult };
  'plan:error': { plan: ActionPlan; error: Error };
}

/**
 * Tool Registry - stores and manages available tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool>;

  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    logger.debug('Tool registered', { name: tool.name });
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all registered tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool descriptions for LLM
   */
  getDescriptions(): string {
    return this.list()
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');
  }

  /**
   * Remove a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }
}

/**
 * Tool Executor - executes action plans
 */
export class Executor extends EventEmitter {
  private registry: ToolRegistry;
  private config: ExecutorConfig;
  private currentExecution: ExecutionResult | null;

  constructor(registry: ToolRegistry, config: ExecutorConfig = {}) {
    super();
    this.registry = registry;
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 60000,
      parallel: config.parallel ?? false,
    };
    this.currentExecution = null;
  }

  /**
   * Execute an action plan
   */
  async executePlan(plan: ActionPlan): Promise<ExecutionResult> {
    logger.info('Executing plan', { planId: plan.id, steps: plan.steps.length });
    
    const startTime = Date.now();
    const results = new Map<string, ToolResult>();
    const errors: string[] = [];
    let stepsCompleted = 0;
    let stepsFailed = 0;

    this.emit('plan:start', { plan });

    this.currentExecution = {
      success: false,
      planId: plan.id,
      results,
      finalOutput: null,
      totalTime: 0,
      stepsCompleted: 0,
      stepsFailed: 0,
      errors: [],
    };

    try {
      // Sort steps by order
      const sortedSteps = [...plan.steps].sort((a, b) => a.order - b.order);

      // Execute steps
      for (const step of sortedSteps) {
        // Check dependencies
        if (step.dependsOn && step.dependsOn.length > 0) {
          const dependenciesMet = step.dependsOn.every(depId => {
            const depResult = results.get(depId);
            return depResult && depResult.success;
          });

          if (!dependenciesMet) {
            const failedDeps = step.dependsOn.filter(depId => {
              const depResult = results.get(depId);
              return !depResult || !depResult.success;
            });
            
            logger.warn('Step dependencies not met', { stepId: step.id, failedDeps });
            
            const result: ToolResult = {
              success: false,
              data: null,
              error: `Dependencies not met: ${failedDeps.join(', ')}`,
              metadata: {
                executionTime: 0,
                tool: step.tool,
                stepId: step.id,
                timestamp: new Date(),
              },
            };
            
            results.set(step.id, result);
            stepsFailed++;
            errors.push(`Step ${step.id}: Dependencies not met`);
            continue;
          }
        }

        // Execute step with retries
        const result = await this.executeStep(step, plan.id, results);
        results.set(step.id, result);

        if (result.success) {
          stepsCompleted++;
        } else {
          stepsFailed++;
          if (result.error) {
            errors.push(`Step ${step.id}: ${result.error}`);
          }
        }
      }

      // Get final output from last successful step
      const lastStep = sortedSteps[sortedSteps.length - 1];
      const lastResult = results.get(lastStep.id);

      const executionResult: ExecutionResult = {
        success: stepsFailed === 0,
        planId: plan.id,
        results,
        finalOutput: lastResult?.data || null,
        totalTime: Date.now() - startTime,
        stepsCompleted,
        stepsFailed,
        errors,
      };

      this.currentExecution = executionResult;
      this.emit('plan:complete', { result: executionResult });

      logger.info('Plan execution complete', {
        planId: plan.id,
        success: executionResult.success,
        totalTime: executionResult.totalTime,
      });

      return executionResult;

    } catch (error) {
      logger.error('Plan execution failed', { planId: plan.id, error });
      
      this.emit('plan:error', { plan, error: error as Error });

      const executionResult: ExecutionResult = {
        success: false,
        planId: plan.id,
        results,
        finalOutput: null,
        totalTime: Date.now() - startTime,
        stepsCompleted,
        stepsFailed,
        errors: [...errors, (error as Error).message],
      };

      this.currentExecution = executionResult;
      return executionResult;
    }
  }

  /**
   * Execute a single step with retry logic
   */
  private async executeStep(
    step: ActionStep,
    planId: string,
    previousResults: Map<string, ToolResult>
  ): Promise<ToolResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let attempt = 0;
    const maxRetries = step.retryable ? this.config.maxRetries! : 1;

    this.emit('step:start', { step, planId });

    while (attempt < maxRetries) {
      attempt++;

      try {
        // Get the tool
        const tool = this.registry.get(step.tool);
        if (!tool) {
          throw new Error(`Unknown tool: ${step.tool}`);
        }

        // Create execution context
        const context: ExecutionContext = {
          planId,
          stepId: step.id,
          previousResults,
          resolveParam: (value: unknown) => this.resolveParam(value, previousResults),
          emit: (event: string, data: unknown) => this.emit(event, data),
        };

        // Resolve parameters (replace placeholders)
        const resolvedParams = this.resolveParams(step.params, previousResults);

        // Execute with timeout
        const timeout = step.timeout || this.config.timeout!;
        const data = await this.withTimeout(
          tool.execute(resolvedParams, context),
          timeout
        );

        const result: ToolResult = {
          success: true,
          data,
          metadata: {
            executionTime: Date.now() - startTime,
            tool: step.tool,
            stepId: step.id,
            timestamp: new Date(),
            retries: attempt > 1 ? attempt - 1 : undefined,
          },
        };

        this.emit('step:complete', { step, result });
        logger.debug('Step completed', { stepId: step.id, executionTime: result.metadata.executionTime });

        return result;

      } catch (error) {
        lastError = error as Error;
        logger.warn('Step execution failed', { stepId: step.id, attempt, error: lastError.message });

        if (attempt < maxRetries) {
          this.emit('step:retry', { step, attempt });
          await this.delay(this.config.retryDelay! * attempt);
        }
      }
    }

    const result: ToolResult = {
      success: false,
      data: null,
      error: lastError?.message || 'Unknown error',
      metadata: {
        executionTime: Date.now() - startTime,
        tool: step.tool,
        stepId: step.id,
        timestamp: new Date(),
        retries: attempt - 1,
      },
    };

    this.emit('step:error', { step, error: lastError! });
    return result;
  }

  /**
   * Resolve parameter placeholders
   */
  private resolveParams(
    params: Record<string, unknown>,
    previousResults: Map<string, ToolResult>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      resolved[key] = this.resolveParam(value, previousResults);
    }

    return resolved;
  }

  /**
   * Resolve a single parameter value
   */
  private resolveParam(
    value: unknown,
    previousResults: Map<string, ToolResult>
  ): unknown {
    if (typeof value === 'string') {
      // Check for placeholder pattern: {{step_id.field}}
      const placeholderMatch = value.match(/\{\{(\w+)\.(\w+)\}\}/);
      if (placeholderMatch) {
        const [, stepId, field] = placeholderMatch;
        const stepResult = previousResults.get(stepId);
        
        if (stepResult && stepResult.success && stepResult.data) {
          const data = stepResult.data as Record<string, unknown>;
          return data[field] !== undefined ? data[field] : value;
        }
      }

      // Check for simple step reference: {{step_id}}
      const simpleMatch = value.match(/\{\{(\w+)\}\}/);
      if (simpleMatch) {
        const stepId = simpleMatch[1];
        const stepResult = previousResults.get(stepId);
        
        if (stepResult && stepResult.success) {
          return stepResult.data;
        }
      }
    }

    if (Array.isArray(value)) {
      return value.map(v => this.resolveParam(v, previousResults));
    }

    if (typeof value === 'object' && value !== null) {
      return this.resolveParams(value as Record<string, unknown>, previousResults);
    }

    return value;
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current execution status
   */
  getStatus(): ExecutionResult | null {
    return this.currentExecution;
  }

  /**
   * Cancel current execution (best effort)
   */
  cancel(): void {
    if (this.currentExecution) {
      logger.info('Execution cancelled', { planId: this.currentExecution.planId });
      this.currentExecution = null;
      this.emit('execution:cancelled', {});
    }
  }
}

/**
 * Create default tool registry with built-in tools
 */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Placeholder tool - web_search
  registry.register({
    name: 'web_search',
    description: 'Search the web for information',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search query' },
      { name: 'numResults', type: 'number', required: false, default: 10 },
      { name: 'engine', type: 'string', required: false, default: 'google' },
    ],
    execute: async (params) => {
      logger.debug('web_search called', { params });
      // Placeholder - will be implemented with scraper
      return {
        query: params.query,
        results: [],
        message: 'Web search placeholder - implement with scraper tools',
      };
    },
  });

  // Placeholder tool - scrape_page
  registry.register({
    name: 'scrape_page',
    description: 'Scrape content from a web page',
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'URL to scrape' },
      { name: 'selectors', type: 'object', required: false },
      { name: 'waitFor', type: 'string', required: false },
      { name: 'scroll', type: 'boolean', required: false, default: true },
    ],
    execute: async (params) => {
      logger.debug('scrape_page called', { params });
      // Placeholder - will be implemented with scraper
      return {
        url: params.url,
        content: '',
        message: 'Scrape page placeholder - implement with scraper tools',
      };
    },
  });

  // Placeholder tool - extract_links
  registry.register({
    name: 'extract_links',
    description: 'Extract all links from a page',
    parameters: [
      { name: 'url', type: 'string', required: true },
      { name: 'filter', type: 'string', required: false },
    ],
    execute: async (params) => {
      logger.debug('extract_links called', { params });
      return {
        url: params.url,
        links: [],
        message: 'Extract links placeholder',
      };
    },
  });

  // Placeholder tool - process_data
  registry.register({
    name: 'process_data',
    description: 'Process and clean data',
    parameters: [
      { name: 'data', type: 'object', required: false },
      { name: 'operation', type: 'string', required: true },
      { name: 'source', type: 'string', required: false },
    ],
    execute: async (params, context) => {
      logger.debug('process_data called', { params });
      
      // Get data from source step if specified
      let data = params.data;
      if (params.source && typeof params.source === 'string') {
        const sourceResult = context.previousResults.get(params.source);
        if (sourceResult && sourceResult.success) {
          data = sourceResult.data;
        }
      }

      return {
        operation: params.operation,
        processed: data,
        message: 'Process data placeholder',
      };
    },
  });

  // Placeholder tool - generate_code
  registry.register({
    name: 'generate_code',
    description: 'Generate code using LLM',
    parameters: [
      { name: 'description', type: 'string', required: true },
      { name: 'language', type: 'string', required: false, default: 'typescript' },
      { name: 'framework', type: 'string', required: false },
    ],
    execute: async (params) => {
      logger.debug('generate_code called', { params });
      return {
        description: params.description,
        code: '// Generated code placeholder',
        language: params.language,
        message: 'Generate code placeholder - implement with code generator',
      };
    },
  });

  // Placeholder tool - create_project
  registry.register({
    name: 'create_project',
    description: 'Create a new project',
    parameters: [
      { name: 'name', type: 'string', required: false },
      { name: 'framework', type: 'string', required: true },
      { name: 'language', type: 'string', required: false, default: 'typescript' },
      { name: 'features', type: 'array', required: false },
    ],
    execute: async (params) => {
      logger.debug('create_project called', { params });
      return {
        framework: params.framework,
        message: 'Create project placeholder - implement with scaffolder',
      };
    },
  });

  // Help tool
  registry.register({
    name: 'show_help',
    description: 'Display help information',
    parameters: [],
    execute: async () => {
      return {
        message: 'The Joker Help',
        commands: [
          { command: 'help', description: 'Show this help message' },
          { command: 'status', description: 'Check LM Studio connection' },
          { command: 'clear', description: 'Clear the terminal' },
          { command: 'exit', description: 'Exit The Joker' },
        ],
        examples: [
          'Find best restaurants in Seattle',
          'Search for TypeScript tutorials',
          'Create a React component for a todo list',
          'Scrape https://example.com',
        ],
      };
    },
  });

  // Summarize tool
  registry.register({
    name: 'summarize',
    description: 'Summarize content using LLM',
    parameters: [
      { name: 'content', type: 'string', required: true },
      { name: 'maxLength', type: 'number', required: false, default: 500 },
    ],
    execute: async (params) => {
      logger.debug('summarize called', { contentLength: String(params.content).length });
      return {
        summary: 'Summary placeholder - implement with LLM',
        originalLength: String(params.content).length,
      };
    },
  });

  return registry;
}

export default Executor;

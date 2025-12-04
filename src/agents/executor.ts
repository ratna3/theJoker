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
import { generateCode, scaffoldProject, generateCodeTool, modifyCodeTool, scaffoldProjectTool, analyzeCodeTool } from '../tools/code';
import { readFileToolDef, writeFileToolDef, appendFileToolDef, deleteFileToolDef, listDirToolDef, copyFileToolDef, moveFileToolDef, fileExistsToolDef, createDirToolDef } from '../tools/file';
import { transformDataTool, cleanTextTool, extractPatternsTool, convertFormatTool, summarizeDataTool } from '../tools/process';
import { ProjectScaffolder } from '../project/scaffolder';
import { paths } from '../utils/config';
import * as path from 'path';
import { webSearchTool, quickSearchTool, imageSearchTool } from '../tools/search';
import { scrapePageTool, extractContentToolDef, screenshotToolDef, extractTableToolDef, parseHtmlToolDef } from '../tools/scrape';

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
 * Generate a complete Todo List component
 */
function generateTodoComponent(name: string, typescript: boolean): string {
  const ext = typescript ? 'tsx' : 'jsx';
  
  if (typescript) {
    return `'use client';

import { useState } from 'react';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface ${name}Props {
  initialItems?: TodoItem[];
}

export default function ${name}({ initialItems = [] }: ${name}Props) {
  const [items, setItems] = useState<TodoItem[]>(initialItems);
  const [inputValue, setInputValue] = useState('');

  const addItem = () => {
    if (inputValue.trim()) {
      const newItem: TodoItem = {
        id: Date.now().toString(),
        text: inputValue.trim(),
        completed: false,
      };
      setItems([...items, newItem]);
      setInputValue('');
    }
  };

  const toggleItem = (id: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addItem();
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Todo List</h1>
      
      {/* Input Section */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addItem}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Todo Items */}
      <ul className="space-y-2">
        {items.map(item => (
          <li
            key={item.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggleItem(item.id)}
              className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
            />
            <span
              className={\`flex-1 \${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}\`}
            >
              {item.text}
            </span>
            <button
              onClick={() => deleteItem(item.id)}
              className="px-2 py-1 text-red-500 hover:bg-red-100 rounded transition-colors"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {/* Stats */}
      {items.length > 0 && (
        <div className="mt-4 text-sm text-gray-500">
          {items.filter(i => i.completed).length} of {items.length} completed
        </div>
      )}

      {items.length === 0 && (
        <p className="text-gray-400 text-center py-4">
          No tasks yet. Add one above!
        </p>
      )}
    </div>
  );
}
`;
  } else {
    return `'use client';

import { useState } from 'react';

export default function ${name}({ initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [inputValue, setInputValue] = useState('');

  const addItem = () => {
    if (inputValue.trim()) {
      const newItem = {
        id: Date.now().toString(),
        text: inputValue.trim(),
        completed: false,
      };
      setItems([...items, newItem]);
      setInputValue('');
    }
  };

  const toggleItem = (id) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addItem();
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Todo List</h1>
      
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addItem}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {items.map(item => (
          <li
            key={item.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggleItem(item.id)}
              className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
            />
            <span
              className={\`flex-1 \${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}\`}
            >
              {item.text}
            </span>
            <button
              onClick={() => deleteItem(item.id)}
              className="px-2 py-1 text-red-500 hover:bg-red-100 rounded transition-colors"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {items.length > 0 && (
        <div className="mt-4 text-sm text-gray-500">
          {items.filter(i => i.completed).length} of {items.length} completed
        </div>
      )}

      {items.length === 0 && (
        <p className="text-gray-400 text-center py-4">
          No tasks yet. Add one above!
        </p>
      )}
    </div>
  );
}
`;
  }
}

/**
 * Generate a summary of project structure
 */
function generateProjectStructure(filesCreated: string[], projectPath: string): string {
  const tree = filesCreated.map(f => `  📄 ${f}`).join('\n');
  return `📁 ${path.basename(projectPath)}/\n${tree}`;
}

/**
 * Generate inline project code when scaffolder fails
 */
function generateInlineProject(name: string, framework: string, description: string): string {
  const isLawyer = description.includes('lawyer') || description.includes('law');
  const isBlog = description.includes('blog');
  
  const componentName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  
  if (framework === 'react' || framework === 'nextjs') {
    return `// ============================================
// ${componentName} - ${framework.toUpperCase()} Project
// ============================================

// === package.json ===
{
  "name": "${name}",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "${framework === 'nextjs' ? 'next dev' : 'vite'}",
    "build": "${framework === 'nextjs' ? 'next build' : 'vite build'}",
    "start": "${framework === 'nextjs' ? 'next start' : 'vite preview'}"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"${framework === 'nextjs' ? ',\n    "next": "^14.0.0"' : ''}
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"${framework !== 'nextjs' ? ',\n    "vite": "^5.0.0",\n    "@vitejs/plugin-react": "^4.0.0"' : ''}
  }
}

// === ${framework === 'nextjs' ? 'app/page.tsx' : 'src/App.tsx'} ===
'use client';

import { useState } from 'react';

${isBlog ? generateBlogComponent(componentName, isLawyer) : generateDefaultComponent(componentName)}

// === ${framework === 'nextjs' ? 'app/layout.tsx' : 'src/main.tsx'} ===
${framework === 'nextjs' ? generateNextLayout(componentName) : generateReactMain()}

// === tailwind.config.js ===
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    ${framework === 'nextjs' ? '"./app/**/*.{js,ts,jsx,tsx}"' : '"./src/**/*.{js,ts,jsx,tsx}"'},
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

// === To create this project: ===
// 1. Create a new folder: mkdir ${name} && cd ${name}
// 2. Initialize: npm init -y
// 3. Copy the package.json content above
// 4. Run: npm install
// 5. Create the file structure and copy the code
// 6. Run: npm run dev
`;
  }
  
  return `// Project: ${name}\n// Framework: ${framework}\n// See documentation for setup instructions.`;
}

function generateBlogComponent(name: string, isLawyer: boolean): string {
  const title = isLawyer ? 'Law Office Blog' : 'My Blog';
  const subtitle = isLawyer ? 'Expert Legal Insights & Updates' : 'Thoughts and Ideas';
  
  return `interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  date: string;
  category: string;
}

const samplePosts: BlogPost[] = [
  {
    id: 1,
    title: "${isLawyer ? 'Understanding Your Legal Rights' : 'Getting Started'}",
    excerpt: "${isLawyer ? 'A comprehensive guide to understanding your fundamental legal rights and how to protect them.' : 'Welcome to our blog. Here we share insights and ideas.'}",
    date: "2024-12-01",
    category: "${isLawyer ? 'Legal Rights' : 'General'}"
  },
  {
    id: 2,
    title: "${isLawyer ? 'Corporate Law Essentials' : 'Best Practices'}",
    excerpt: "${isLawyer ? 'Key aspects of corporate law that every business owner should know.' : 'Tips and tricks for success in your endeavors.'}",
    date: "2024-11-28",
    category: "${isLawyer ? 'Corporate' : 'Tips'}"
  },
  {
    id: 3,
    title: "${isLawyer ? 'Family Law: What You Need to Know' : 'Industry Insights'}",
    excerpt: "${isLawyer ? 'Navigating family law matters with expert guidance and compassion.' : 'Deep dive into current industry trends.'}",
    date: "2024-11-25",
    category: "${isLawyer ? 'Family Law' : 'Industry'}"
  }
];

export default function ${name}() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const categories = ['all', ...new Set(samplePosts.map(p => p.category))];
  const filteredPosts = selectedCategory === 'all' 
    ? samplePosts 
    : samplePosts.filter(p => p.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-${isLawyer ? 'slate-900' : 'blue-600'} text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold mb-4">${title}</h1>
          <p className="text-xl opacity-90">${subtitle}</p>
        </div>
      </header>

      {/* Category Filter */}
      <nav className="bg-white shadow-sm py-4">
        <div className="max-w-4xl mx-auto px-6 flex gap-4 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={\`px-4 py-2 rounded-full transition-colors \${
                selectedCategory === cat
                  ? 'bg-${isLawyer ? 'slate-900' : 'blue-600'} text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }\`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {/* Blog Posts */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid gap-8">
          {filteredPosts.map(post => (
            <article 
              key={post.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-sm text-${isLawyer ? 'slate-600' : 'blue-600'} font-medium">
                    {post.category}
                  </span>
                  <span className="text-sm text-gray-400">{post.date}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  {post.title}
                </h2>
                <p className="text-gray-600 mb-4">{post.excerpt}</p>
                <button className="text-${isLawyer ? 'slate-900' : 'blue-600'} font-medium hover:underline">
                  Read More →
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-${isLawyer ? 'slate-900' : 'gray-800'} text-white py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p>&copy; 2024 ${title}. All rights reserved.</p>
          ${isLawyer ? '<p className="mt-2 text-sm opacity-70">Disclaimer: This blog is for informational purposes only and does not constitute legal advice.</p>' : ''}
        </div>
      </footer>
    </div>
  );
}`;
}

function generateDefaultComponent(name: string): string {
  return `export default function ${name}() {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
          Welcome to ${name}
        </h1>
        <p className="text-center text-gray-600">
          Your new React application is ready!
        </p>
      </div>
    </div>
  );
}`;
}

function generateNextLayout(name: string): string {
  return `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${name}',
  description: 'Created with The Joker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`;
}

function generateReactMain(): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
}

/**
 * Create default tool registry with built-in tools
 */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Search Tools
  registry.register(webSearchTool as any);
  registry.register(quickSearchTool as any);
  registry.register(imageSearchTool as any);

  // Scrape Tools
  registry.register(scrapePageTool as any);
  registry.register(extractContentToolDef as any);
  registry.register(screenshotToolDef as any);
  registry.register(extractTableToolDef as any);
  registry.register(parseHtmlToolDef as any);

  // Process Tools
  registry.register(transformDataTool as any);
  registry.register(cleanTextTool as any);
  registry.register(extractPatternsTool as any);
  registry.register(convertFormatTool as any);
  registry.register(summarizeDataTool as any);

  // File Tools
  registry.register(readFileToolDef as any);
  registry.register(writeFileToolDef as any);
  registry.register(appendFileToolDef as any);
  registry.register(deleteFileToolDef as any);
  registry.register(listDirToolDef as any);
  registry.register(copyFileToolDef as any);
  registry.register(moveFileToolDef as any);
  registry.register(fileExistsToolDef as any);
  registry.register(createDirToolDef as any);

  // Code Tools
  registry.register(generateCodeTool as any);
  registry.register(modifyCodeTool as any);
  registry.register(scaffoldProjectTool as any);
  registry.register(analyzeCodeTool as any);

  // Project Tool - create_project - uses ProjectScaffolder to generate complete projects
  registry.register({
    name: 'create_project',
    description: 'Create a complete new React/Next.js project with all files',
    parameters: [
      { name: 'name', type: 'string', required: false },
      { name: 'description', type: 'string', required: false },
      { name: 'framework', type: 'string', required: true },
      { name: 'language', type: 'string', required: false, default: 'typescript' },
      { name: 'features', type: 'array', required: false },
    ],
    execute: async (params) => {
      logger.debug('create_project called', { params });
      
      const description = String(params.description || params.name || '').toLowerCase();
      const framework = String(params.framework || 'react').toLowerCase();
      
      // Extract project name from description
      let projectName: string = String(params.name || 'my-app');
      const namePatterns = [
        /(?:for|called|named)\s+(?:a\s+)?(\w+[-\w]*)/i,
        /(\w+)\s+(?:app|website|site|blog|portal)/i,
        /create\s+(?:a\s+)?(\w+)/i,
      ];
      
      if (!params.name) {
        for (const pattern of namePatterns) {
          const match = description.match(pattern);
          if (match && match[1] && match[1].length > 2) {
            projectName = match[1].toLowerCase().replace(/\s+/g, '-');
            break;
          }
        }
        // Fallback to descriptive name
        if (projectName === 'my-app') {
          if (description.includes('blog')) projectName = 'blog-app';
          else if (description.includes('lawyer') || description.includes('law')) projectName = 'lawyer-blog';
          else if (description.includes('store') || description.includes('shop')) projectName = 'store-app';
          else if (description.includes('portfolio')) projectName = 'portfolio-app';
        }
      }
      
      // Detect styling preference
      let styling: 'tailwind' | 'css' | 'scss' = 'tailwind';
      if (description.includes('scss') || description.includes('sass')) styling = 'scss';
      else if (description.includes('plain css') || description.includes('vanilla css')) styling = 'css';
      
      // Create project using scaffolder
      const scaffolder = new ProjectScaffolder();
      const projectPath = paths.projects || process.cwd();
      
      try {
        const features: string[] = Array.isArray(params.features) ? params.features as string[] : [];
        const result = await scaffolder.create({
          name: String(projectName),
          path: projectPath,
          framework: framework === 'nextjs' || framework === 'next' ? 'nextjs' : 'react',
          language: String(params.language || 'typescript') === 'javascript' ? 'javascript' : 'typescript',
          styling,
          features,
        }, {
          skipInstall: true, // Don't run npm install automatically
          gitInit: false,
        });
        
        if (result.success) {
          // Generate the project files content summary
          const projectStructure = generateProjectStructure(result.filesCreated, result.projectPath);
          
          return {
            success: true,
            projectName,
            projectPath: result.projectPath,
            framework,
            filesCreated: result.filesCreated,
            projectStructure,
            nextSteps: result.nextSteps,
            message: `Successfully created ${framework} project: ${projectName}`,
          };
        } else {
          return {
            success: false,
            error: 'Failed to scaffold project',
            message: 'Project creation failed',
          };
        }
      } catch (error) {
        logger.error('Project creation failed', { error });
        
        // Fallback: Generate inline project code
        const inlineProject = generateInlineProject(projectName, framework, description);
        
        return {
          success: true,
          projectName,
          framework,
          code: inlineProject,
          message: `Generated ${framework} project code for: ${projectName}`,
          note: 'Project files generated inline. Copy these to create your project.',
        };
      }
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

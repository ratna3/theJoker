/**
 * The Joker - Agentic Terminal
 * Main type definitions
 */

// ============================================
// LLM Types
// ============================================

export interface LLMConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
}

export interface LLMResponse {
  content: string;
  role: 'assistant';
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  latencyMs?: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

// ============================================
// Health Check Types
// ============================================

export interface HealthCheckResult {
  connected: boolean;
  modelLoaded: boolean;
  modelName: string | null;
  responseTime: number;
  error: string | null;
  timestamp: Date;
}

export interface ModelInfo {
  id: string;
  object: string;
  owned_by: string;
}

// ============================================
// Parser Types
// ============================================

export interface ParsedIntent {
  intent: Intent;
  confidence: number;
  entities: Record<string, unknown>;
  clarificationNeeded: string | null;
  raw: string;
}

export interface ParsedPlan {
  steps: PlanStep[];
  totalEstimatedMs: number;
  notes: string;
  valid: boolean;
  errors: string[];
}

export interface ParsedCodeGen {
  code: string;
  language: string;
  dependencies: string[];
  filename: string;
  explanation: string;
  valid: boolean;
  errors: string[];
}

export interface ParseResult<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  raw: string;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
  id?: string;
}

export interface ValidationSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, ValidationSchema>;
  items?: ValidationSchema;
  required?: string[];
  enum?: unknown[];
}

// ============================================
// Agent Types
// ============================================

export interface AgentConfig {
  maxIterations: number;
  timeoutMs: number;
  verbose: boolean;
}

export interface AgentContext {
  query: string;
  history: ChatMessage[];
  toolResults: ToolResult[];
  iteration: number;
  startTime: number;
}

export interface AgentPlan {
  intent: Intent;
  steps: PlanStep[];
  estimatedTime: number;
}

export interface PlanStep {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  description: string;
  dependsOn?: string[];
}

export type Intent = 
  | 'web_search'
  | 'web_scrape'
  | 'data_extract'
  | 'code_generate'
  | 'project_create'
  | 'file_operation'
  | 'general_query'
  | 'unknown';

// ============================================
// Tool Types
// ============================================

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

// ============================================
// Scraper Types
// ============================================

export interface ScraperConfig {
  headless: boolean;
  timeout: number;
  userAgent: string;
  maxConcurrent: number;
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  links: ExtractedLink[];
  images: ExtractedImage[];
  metadata: Record<string, string>;
  timestamp: Date;
}

export interface ExtractedLink {
  text: string;
  href: string;
  isExternal: boolean;
}

export interface ExtractedImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

// ============================================
// Code Generation Types
// ============================================

export interface CodeSpec {
  type: 'component' | 'page' | 'api' | 'utility' | 'config' | 'test';
  framework?: Framework;
  language: 'typescript' | 'javascript' | 'python';
  description: string;
  dependencies?: string[];
  imports?: string[];
  exports?: string[];
}

export type Framework = 'react' | 'nextjs' | 'vue' | 'express' | 'nestjs' | 'node';

export interface GeneratedCode {
  fileName: string;
  filePath: string;
  content: string;
  language: string;
  dependencies: string[];
  tests?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  message: string;
  line?: number;
  column?: number;
  code?: string;
}

// ============================================
// Project Types
// ============================================

export interface ProjectSpec {
  name: string;
  framework: Framework;
  language: 'typescript' | 'javascript';
  features: string[];
  styling?: 'css' | 'scss' | 'tailwind' | 'styled-components';
  testing?: 'jest' | 'vitest' | 'cypress';
  path: string;
}

export interface ScaffoldResult {
  success: boolean;
  projectPath: string;
  filesCreated: string[];
  commands: string[];
  nextSteps: string[];
}

export type PackageManagerType = 'npm' | 'yarn' | 'pnpm' | 'bun';

export interface InstallResult {
  success: boolean;
  output: string;
  duration: number;
  packagesInstalled: string[];
  errors?: string[];
}

// ============================================
// File System Types
// ============================================

export interface FileInfo {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  language: string;
  imports: string[];
  exports: string[];
  lastModified: Date;
}

export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  filePath: string;
  timestamp: number;
}

export interface ProjectIndex {
  rootPath: string;
  files: Map<string, FileInfo>;
  indexedAt: Date;
}

// ============================================
// Terminal/CLI Types
// ============================================

export interface TerminalConfig {
  colors: boolean;
  spinner: boolean;
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

// ============================================
// Logging Types
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogConfig {
  level: LogLevel;
  file?: string;
  maxSize?: string;
  maxFiles?: number;
}

// ============================================
// Configuration Types
// ============================================

export interface AppConfig {
  llm: LLMConfig;
  agent: AgentConfig;
  scraper: ScraperConfig;
  terminal: TerminalConfig;
  log: LogConfig;
}

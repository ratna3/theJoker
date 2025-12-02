/**
 * The Joker - Agentic Terminal
 * Response Parser for LLM Outputs
 */

import { Intent, PlanStep, Tool } from '../types';
import { logger } from '../utils/logger';

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

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
  id?: string;
}

export interface ParseResult<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  raw: string;
}

// ============================================
// JSON Parsing Utilities
// ============================================

/**
 * Extract JSON from a string that may contain markdown code blocks
 */
export function extractJSON(text: string): string | null {
  // Try to parse as-is first
  try {
    JSON.parse(text.trim());
    return text.trim();
  } catch {
    // Continue with extraction
  }

  // Try to extract from code blocks
  const codeBlockPatterns = [
    /```json\s*([\s\S]*?)```/,
    /```\s*([\s\S]*?)```/,
    /`([\s\S]*?)`/
  ];

  for (const pattern of codeBlockPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        continue;
      }
    }
  }

  // Try to find JSON object/array directly
  const jsonPatterns = [
    /(\{[\s\S]*\})/,
    /(\[[\s\S]*\])/
  ];

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      try {
        JSON.parse(match[1]);
        return match[1];
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Safely parse JSON with error handling
 */
export function safeParseJSON<T>(text: string): ParseResult<T> {
  const extracted = extractJSON(text);
  
  if (!extracted) {
    return {
      success: false,
      data: null,
      errors: ['Could not extract valid JSON from response'],
      raw: text
    };
  }

  try {
    const parsed = JSON.parse(extracted) as T;
    return {
      success: true,
      data: parsed,
      errors: [],
      raw: text
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: [`JSON parse error: ${(error as Error).message}`],
      raw: text
    };
  }
}

// ============================================
// Intent Response Parser
// ============================================

const VALID_INTENTS: Intent[] = [
  'web_search',
  'web_scrape',
  'data_extract',
  'code_generate',
  'project_create',
  'file_operation',
  'general_query',
  'unknown'
];

/**
 * Parse intent recognition response from LLM
 */
export function parseIntentResponse(response: string): ParseResult<ParsedIntent> {
  const parseResult = safeParseJSON<{
    intent: string;
    confidence: number;
    entities: Record<string, unknown>;
    clarification_needed?: string | null;
  }>(response);

  if (!parseResult.success || !parseResult.data) {
    return {
      success: false,
      data: null,
      errors: parseResult.errors,
      raw: response
    };
  }

  const data = parseResult.data;
  const errors: string[] = [];

  // Validate intent
  if (!data.intent) {
    errors.push('Missing intent field');
  } else if (!VALID_INTENTS.includes(data.intent as Intent)) {
    logger.warn('Unknown intent received', { intent: data.intent });
    data.intent = 'unknown';
  }

  // Validate confidence
  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
    data.confidence = 0.5;
  }

  // Ensure entities is an object
  if (!data.entities || typeof data.entities !== 'object') {
    data.entities = {};
  }

  const parsedIntent: ParsedIntent = {
    intent: data.intent as Intent,
    confidence: data.confidence,
    entities: data.entities,
    clarificationNeeded: data.clarification_needed || null,
    raw: response
  };

  return {
    success: errors.length === 0,
    data: parsedIntent,
    errors,
    raw: response
  };
}

// ============================================
// Action Plan Parser
// ============================================

/**
 * Parse action plan response from LLM
 */
export function parseActionPlan(
  response: string,
  availableTools: Tool[]
): ParseResult<ParsedPlan> {
  const parseResult = safeParseJSON<{
    plan: Array<{
      step: number;
      tool: string;
      params: Record<string, unknown>;
      description: string;
      depends_on?: number[];
      estimated_ms?: number;
    }>;
    total_estimated_ms?: number;
    notes?: string;
  }>(response);

  if (!parseResult.success || !parseResult.data) {
    return {
      success: false,
      data: null,
      errors: parseResult.errors,
      raw: response
    };
  }

  const data = parseResult.data;
  const errors: string[] = [];
  const availableToolNames = availableTools.map(t => t.name);

  // Validate plan array
  if (!Array.isArray(data.plan)) {
    return {
      success: false,
      data: null,
      errors: ['Plan must be an array'],
      raw: response
    };
  }

  const steps: PlanStep[] = [];

  for (const step of data.plan) {
    // Validate tool exists
    if (!availableToolNames.includes(step.tool)) {
      errors.push(`Unknown tool: ${step.tool}`);
      continue;
    }

    // Validate required params
    const tool = availableTools.find(t => t.name === step.tool)!;
    const requiredParams = tool.parameters.filter(p => p.required);
    
    for (const param of requiredParams) {
      if (!(param.name in (step.params || {}))) {
        errors.push(`Missing required parameter '${param.name}' for tool '${step.tool}'`);
      }
    }

    steps.push({
      id: `step-${step.step}`,
      tool: step.tool,
      params: step.params || {},
      description: step.description || `Execute ${step.tool}`,
      dependsOn: step.depends_on?.map(d => `step-${d}`)
    });
  }

  const parsedPlan: ParsedPlan = {
    steps,
    totalEstimatedMs: data.total_estimated_ms || steps.length * 2000,
    notes: data.notes || '',
    valid: errors.length === 0,
    errors
  };

  return {
    success: errors.length === 0,
    data: parsedPlan,
    errors,
    raw: response
  };
}

// ============================================
// Code Generation Parser
// ============================================

/**
 * Parse code generation response from LLM
 */
export function parseCodeGenResponse(response: string): ParseResult<ParsedCodeGen> {
  const parseResult = safeParseJSON<{
    code: string;
    language?: string;
    dependencies?: string[];
    filename?: string;
    explanation?: string;
  }>(response);

  if (!parseResult.success || !parseResult.data) {
    // Try to extract code from markdown code block as fallback
    const codeMatch = response.match(/```(?:typescript|javascript|ts|js)?\s*([\s\S]*?)```/);
    if (codeMatch) {
      return {
        success: true,
        data: {
          code: codeMatch[1].trim(),
          language: 'typescript',
          dependencies: [],
          filename: 'generated.ts',
          explanation: 'Code extracted from response',
          valid: true,
          errors: []
        },
        errors: [],
        raw: response
      };
    }

    return {
      success: false,
      data: null,
      errors: parseResult.errors,
      raw: response
    };
  }

  const data = parseResult.data;
  const errors: string[] = [];

  if (!data.code || typeof data.code !== 'string') {
    errors.push('Missing or invalid code field');
  }

  const parsedCodeGen: ParsedCodeGen = {
    code: data.code || '',
    language: data.language || 'typescript',
    dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
    filename: data.filename || 'generated.ts',
    explanation: data.explanation || '',
    valid: errors.length === 0,
    errors
  };

  return {
    success: errors.length === 0,
    data: parsedCodeGen,
    errors,
    raw: response
  };
}

// ============================================
// Tool Call Extractor
// ============================================

/**
 * Extract tool calls from LLM response
 */
export function extractToolCalls(response: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  // Try JSON format first
  const jsonResult = safeParseJSON<{ tool_calls?: ToolCall[] }>(response);
  if (jsonResult.success && jsonResult.data?.tool_calls) {
    return jsonResult.data.tool_calls;
  }

  // Look for tool call patterns in text
  // Pattern: @tool_name(param1: value1, param2: value2)
  const toolCallPattern = /@(\w+)\(([\s\S]*?)\)/g;
  let match;

  while ((match = toolCallPattern.exec(response)) !== null) {
    const toolName = match[1];
    const paramsStr = match[2];

    try {
      // Try to parse params as JSON
      const params = JSON.parse(`{${paramsStr.replace(/(\w+):/g, '"$1":')}}`);
      toolCalls.push({ tool: toolName, params });
    } catch {
      // Try to parse key: value format
      const params: Record<string, unknown> = {};
      const paramPairs = paramsStr.split(',');
      
      for (const pair of paramPairs) {
        const [key, value] = pair.split(':').map(s => s.trim());
        if (key && value) {
          // Remove quotes from value if present
          params[key] = value.replace(/^["']|["']$/g, '');
        }
      }
      
      if (Object.keys(params).length > 0) {
        toolCalls.push({ tool: toolName, params });
      }
    }
  }

  // Also look for function call syntax
  // Pattern: call tool_name with { params }
  const functionPattern = /call\s+(\w+)\s+with\s+(\{[\s\S]*?\})/gi;
  
  while ((match = functionPattern.exec(response)) !== null) {
    const toolName = match[1];
    try {
      const params = JSON.parse(match[2]);
      toolCalls.push({ tool: toolName, params });
    } catch {
      // Skip malformed function calls
    }
  }

  return toolCalls;
}

// ============================================
// Response Validation
// ============================================

export interface ValidationSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, ValidationSchema>;
  items?: ValidationSchema;
  required?: string[];
  enum?: unknown[];
}

/**
 * Validate a response against a schema
 */
export function validateResponse(
  response: unknown,
  schema: ValidationSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  function validate(value: unknown, schema: ValidationSchema, path: string): void {
    // Type check
    if (schema.type === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${typeof value}`);
        return;
      }

      const obj = value as Record<string, unknown>;

      // Check required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in obj)) {
            errors.push(`${path}: missing required field '${field}'`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in obj) {
            validate(obj[key], propSchema, `${path}.${key}`);
          }
        }
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${typeof value}`);
        return;
      }

      if (schema.items) {
        value.forEach((item, index) => {
          validate(item, schema.items!, `${path}[${index}]`);
        });
      }
    } else if (schema.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${path}: expected string, got ${typeof value}`);
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: value must be one of ${schema.enum.join(', ')}`);
      }
    } else if (schema.type === 'number') {
      if (typeof value !== 'number') {
        errors.push(`${path}: expected number, got ${typeof value}`);
      }
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${path}: expected boolean, got ${typeof value}`);
      }
    }
  }

  validate(response, schema, 'root');

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// Extraction Utilities
// ============================================

/**
 * Extract URLs from text
 */
export function extractURLs(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  return [...new Set(text.match(urlPattern) || [])];
}

/**
 * Extract email addresses from text
 */
export function extractEmails(text: string): string[] {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(emailPattern) || [])];
}

/**
 * Extract phone numbers from text
 */
export function extractPhoneNumbers(text: string): string[] {
  const phonePattern = /(?:\+?1[-.\s]?)?(?:\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
  return [...new Set(text.match(phonePattern) || [])];
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================
// Parser Export
// ============================================

export const parser = {
  json: {
    extract: extractJSON,
    safeParse: safeParseJSON
  },
  intent: parseIntentResponse,
  plan: parseActionPlan,
  codeGen: parseCodeGenResponse,
  toolCalls: extractToolCalls,
  validate: validateResponse,
  extract: {
    urls: extractURLs,
    emails: extractEmails,
    phones: extractPhoneNumbers
  },
  clean: cleanText
};

export default parser;

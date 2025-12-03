/**
 * LLM Parser Unit Tests
 * Phase 10: Testing & Optimization
 */

import {
  extractJSON,
  safeParseJSON,
  parseIntentResponse,
  parseActionPlan,
  parseCodeGenResponse,
  extractToolCalls,
  validateResponse,
  extractURLs,
  extractEmails,
  extractPhoneNumbers,
  cleanText,
  parser,
  ValidationSchema,
  ToolCall,
} from '../../../src/llm/parser';
import { Tool } from '../../../src/types';

// Mock tools for testing parseActionPlan
const mockTools: Tool[] = [
  {
    name: 'search',
    description: 'Search the web',
    parameters: [{ name: 'query', type: 'string', description: 'Search query', required: true }],
    execute: async () => ({ success: true, data: {}, duration: 0 }),
  },
  {
    name: 'code',
    description: 'Generate code',
    parameters: [{ name: 'language', type: 'string', description: 'Language', required: false }],
    execute: async () => ({ success: true, data: {}, duration: 0 }),
  },
  {
    name: 'scrape',
    description: 'Scrape a webpage',
    parameters: [{ name: 'url', type: 'string', description: 'URL to scrape', required: true }],
    execute: async () => ({ success: true, data: {}, duration: 0 }),
  },
];

describe('LLM Parser', () => {
  describe('extractJSON', () => {
    it('should extract JSON from plain JSON string', () => {
      const input = '{"key": "value", "number": 42}';
      const result = extractJSON(input);
      expect(result).toBe('{"key": "value", "number": 42}');
    });

    it('should extract JSON from markdown code block', () => {
      const input = `
        Here is the result:
        \`\`\`json
        {"name": "test"}
        \`\`\`
        Hope this helps!
      `;
      const result = extractJSON(input);
      expect(result).toContain('"name"');
      expect(result).toContain('"test"');
    });

    it('should extract JSON from code block without language', () => {
      const input = `
        \`\`\`
        {"data": "value"}
        \`\`\`
      `;
      const result = extractJSON(input);
      expect(result).toContain('"data"');
    });

    it('should handle nested JSON objects', () => {
      const input = '{"level1": {"level2": {"level3": "deep"}}}';
      const result = extractJSON(input);
      expect(result).not.toBeNull();
      expect(result).toContain('level3');
    });

    it('should return null for invalid JSON', () => {
      const input = 'This is not JSON at all';
      const result = extractJSON(input);
      expect(result).toBeNull();
    });

    it('should handle empty input', () => {
      const result = extractJSON('');
      expect(result).toBeNull();
    });

    it('should extract JSON embedded in text', () => {
      const input = 'The response is {"status": "ok"} and it worked';
      const result = extractJSON(input);
      expect(result).not.toBeNull();
    });
  });

  describe('safeParseJSON', () => {
    it('should parse valid JSON successfully', () => {
      const input = '{"key": "value"}';
      const result = safeParseJSON<{ key: string }>(input);
      expect(result.success).toBe(true);
      expect(result.data?.key).toBe('value');
    });

    it('should handle JSON in markdown code block', () => {
      const input = `\`\`\`json
      {"name": "test"}
      \`\`\``;
      const result = safeParseJSON<{ name: string }>(input);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('test');
    });

    it('should return errors for invalid JSON', () => {
      const input = 'not valid json';
      const result = safeParseJSON(input);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle array JSON', () => {
      const input = '[1, 2, 3]';
      const result = safeParseJSON<number[]>(input);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should parse nested objects', () => {
      const input = '{"outer": {"inner": "value"}}';
      const result = safeParseJSON<{ outer: { inner: string } }>(input);
      expect(result.success).toBe(true);
      expect(result.data?.outer.inner).toBe('value');
    });
  });

  describe('parseIntentResponse', () => {
    it('should parse complete intent response', () => {
      const input = `\`\`\`json
      {
        "intent": "web_search",
        "confidence": 0.9,
        "entities": {"keywords": ["TypeScript", "tutorials"]}
      }
      \`\`\``;
      const result = parseIntentResponse(input);
      expect(result.success).toBe(true);
      expect(result.data?.intent).toBe('web_search');
      expect(result.data?.confidence).toBe(0.9);
    });

    it('should handle missing optional fields', () => {
      const input = `{"intent": "general_query", "confidence": 0.8}`;
      const result = parseIntentResponse(input);
      // Data should exist even if not fully valid
      expect(result.data).not.toBeNull();
      expect(result.data?.intent).toBe('general_query');
    });

    it('should return error for missing intent field', () => {
      const input = `{"confidence": 0.5}`;
      const result = parseIntentResponse(input);
      expect(result.success).toBe(false);
    });

    it('should handle low confidence values', () => {
      const input = `{"intent": "unknown", "confidence": 0.3}`;
      const result = parseIntentResponse(input);
      expect(result.data?.confidence).toBe(0.3);
    });

    it('should set unknown intent for invalid intents', () => {
      const input = `{"intent": "invalid_intent", "confidence": 0.8, "entities": {}}`;
      const result = parseIntentResponse(input);
      expect(result.data?.intent).toBe('unknown');
    });
  });

  describe('parseActionPlan', () => {
    it('should parse action plan with steps', () => {
      const input = `\`\`\`json
      {
        "plan": [
          {"step": 1, "tool": "search", "params": {"query": "web scraping"}, "description": "Search for info"},
          {"step": 2, "tool": "code", "params": {"language": "TypeScript"}, "description": "Generate code"}
        ],
        "total_estimated_ms": 5000,
        "notes": "Two-step plan"
      }
      \`\`\``;
      const result = parseActionPlan(input, mockTools);
      expect(result.success).toBe(true);
      expect(result.data?.steps.length).toBe(2);
    });

    it('should validate step structure', () => {
      const input = `{
        "plan": [{"step": 1, "tool": "search", "params": {"query": "test"}, "description": "Search"}],
        "notes": "Simple plan"
      }`;
      const result = parseActionPlan(input, mockTools);
      expect(result.success).toBe(true);
    });

    it('should handle empty steps array', () => {
      const input = `{
        "plan": [],
        "notes": "Empty plan"
      }`;
      const result = parseActionPlan(input, mockTools);
      expect(result.success).toBe(true);
      expect(result.data?.steps).toEqual([]);
    });

    it('should report unknown tools as errors', () => {
      const input = `{
        "plan": [{"step": 1, "tool": "unknown_tool", "params": {}, "description": "Unknown"}]
      }`;
      const result = parseActionPlan(input, mockTools);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unknown tool');
    });

    it('should report missing required parameters', () => {
      const input = `{
        "plan": [{"step": 1, "tool": "search", "params": {}, "description": "Missing query"}]
      }`;
      const result = parseActionPlan(input, mockTools);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing required parameter');
    });
  });

  describe('parseCodeGenResponse', () => {
    it('should extract TypeScript code from JSON response', () => {
      const input = `{
        "code": "function hello(): string { return 'world'; }",
        "language": "typescript",
        "filename": "hello.ts"
      }`;
      const result = parseCodeGenResponse(input);
      expect(result.success).toBe(true);
      expect(result.data?.code).toContain('function hello()');
      expect(result.data?.language).toBe('typescript');
    });

    it('should extract code from markdown fallback', () => {
      const input = `\`\`\`typescript
      const x = 42;
      \`\`\``;
      const result = parseCodeGenResponse(input);
      expect(result.success).toBe(true);
      expect(result.data?.language).toBe('typescript');
    });

    it('should extract JavaScript code', () => {
      const input = `\`\`\`javascript
      const x = 42;
      \`\`\``;
      const result = parseCodeGenResponse(input);
      expect(result.success).toBe(true);
      expect(result.data?.language).toBe('typescript'); // Defaults to typescript on markdown fallback
    });

    it('should handle code without language tag', () => {
      const input = `\`\`\`
      some code here
      \`\`\``;
      const result = parseCodeGenResponse(input);
      expect(result.success).toBe(true);
      expect(result.data?.code).toContain('some code here');
    });

    it('should return error when no code found', () => {
      const input = 'No code block in this response';
      const result = parseCodeGenResponse(input);
      expect(result.success).toBe(false);
    });

    it('should use default explanation from markdown fallback', () => {
      const input = `\`\`\`typescript
      function add(a: number, b: number): number {
        return a + b;
      }
      \`\`\``;
      const result = parseCodeGenResponse(input);
      expect(result.success).toBe(true);
      expect(result.data?.explanation).toBe('Code extracted from response');
    });
  });

  describe('extractToolCalls', () => {
    it('should extract tool calls from JSON format', () => {
      const input = `{"tool_calls": [{"tool": "search", "params": {"query": "TypeScript tutorials"}}]}`;
      const result = extractToolCalls(input);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tool).toBe('search');
      expect(result[0].params.query).toBe('TypeScript tutorials');
    });

    it('should extract tool call from @ pattern', () => {
      const input = 'Let me @search(query: "test search")';
      const result = extractToolCalls(input);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tool).toBe('search');
    });

    it('should extract tool call from call pattern', () => {
      const input = 'call search with {"query": "test"}';
      const result = extractToolCalls(input);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].tool).toBe('search');
    });

    it('should handle multiple tool calls', () => {
      const input = `{"tool_calls": [
        {"tool": "search", "params": {"query": "q1"}},
        {"tool": "scrape", "params": {"url": "https://example.com"}}
      ]}`;
      const result = extractToolCalls(input);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no tool calls', () => {
      const input = 'Just regular text without any tool calls';
      const result = extractToolCalls(input);
      expect(result).toEqual([]);
    });
  });

  describe('validateResponse', () => {
    it('should validate complete response', () => {
      const schema: ValidationSchema = {
        type: 'object',
        required: ['intent', 'confidence'],
        properties: {
          intent: { type: 'string' },
          confidence: { type: 'number' },
        },
      };
      const data = { intent: 'search', confidence: 0.9 };
      const result = validateResponse(data, schema);
      expect(result.valid).toBe(true);
    });

    it('should reject missing required fields', () => {
      const schema: ValidationSchema = {
        type: 'object',
        required: ['intent', 'confidence'],
        properties: {
          intent: { type: 'string' },
          confidence: { type: 'number' },
        },
      };
      const data = { intent: 'search' };
      const result = validateResponse(data, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject wrong types', () => {
      const schema: ValidationSchema = {
        type: 'object',
        required: ['count'],
        properties: {
          count: { type: 'number' },
        },
      };
      const data = { count: 'not a number' };
      const result = validateResponse(data, schema);
      expect(result.valid).toBe(false);
    });

    it('should validate optional fields when present', () => {
      const schema: ValidationSchema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };
      const data = { name: 'test', age: 25 };
      const result = validateResponse(data, schema);
      expect(result.valid).toBe(true);
    });

    it('should validate array types', () => {
      const schema: ValidationSchema = {
        type: 'array',
        items: { type: 'string' },
      };
      const data = ['a', 'b', 'c'];
      const result = validateResponse(data, schema);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid array items', () => {
      const schema: ValidationSchema = {
        type: 'array',
        items: { type: 'number' },
      };
      const data = [1, 'not a number', 3];
      const result = validateResponse(data, schema);
      expect(result.valid).toBe(false);
    });
  });

  describe('extractURLs', () => {
    it('should extract HTTP URLs', () => {
      const input = 'Visit http://example.com for more info';
      const result = extractURLs(input);
      expect(result).toContain('http://example.com');
    });

    it('should extract HTTPS URLs', () => {
      const input = 'Check https://secure.example.com/page';
      const result = extractURLs(input);
      expect(result).toContain('https://secure.example.com/page');
    });

    it('should extract multiple URLs', () => {
      const input = 'Links: https://a.com and https://b.com';
      const result = extractURLs(input);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no URLs', () => {
      const input = 'No URLs here';
      const result = extractURLs(input);
      expect(result).toEqual([]);
    });
  });

  describe('extractEmails', () => {
    it('should extract email addresses', () => {
      const input = 'Contact us at support@example.com';
      const result = extractEmails(input);
      expect(result).toContain('support@example.com');
    });

    it('should extract multiple emails', () => {
      const input = 'Email: a@b.com or c@d.org';
      const result = extractEmails(input);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no emails', () => {
      const input = 'No emails here';
      const result = extractEmails(input);
      expect(result).toEqual([]);
    });
  });

  describe('extractPhoneNumbers', () => {
    it('should extract phone numbers', () => {
      const input = 'Call us at 123-456-7890';
      const result = extractPhoneNumbers(input);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should extract different formats', () => {
      const input = 'Numbers: (555) 123-4567 or 555.123.4567';
      const result = extractPhoneNumbers(input);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when no phone numbers', () => {
      const input = 'No phone numbers here';
      const result = extractPhoneNumbers(input);
      expect(result).toEqual([]);
    });
  });

  describe('cleanText', () => {
    it('should remove excess whitespace', () => {
      const input = '  too   much   space  ';
      const result = cleanText(input);
      expect(result).toBe('too much space');
    });

    it('should normalize newlines', () => {
      const input = 'line1\n\n\n\nline2';
      const result = cleanText(input);
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('should handle empty input', () => {
      const result = cleanText('');
      expect(result).toBe('');
    });

    it('should preserve meaningful spaces', () => {
      const input = 'hello world';
      const result = cleanText(input);
      expect(result).toBe('hello world');
    });
  });

  describe('parser object', () => {
    it('should expose json namespace', () => {
      expect(parser.json.extract).toBeDefined();
      expect(parser.json.safeParse).toBeDefined();
    });

    it('should expose intent parser', () => {
      expect(parser.intent).toBeDefined();
    });

    it('should expose plan parser', () => {
      expect(parser.plan).toBeDefined();
    });

    it('should expose codeGen parser', () => {
      expect(parser.codeGen).toBeDefined();
    });

    it('should expose toolCalls extractor', () => {
      expect(parser.toolCalls).toBeDefined();
    });

    it('should expose validate function', () => {
      expect(parser.validate).toBeDefined();
    });

    it('should expose extract namespace', () => {
      expect(parser.extract.urls).toBeDefined();
      expect(parser.extract.emails).toBeDefined();
      expect(parser.extract.phones).toBeDefined();
    });

    it('should expose clean function', () => {
      expect(parser.clean).toBeDefined();
    });
  });
});

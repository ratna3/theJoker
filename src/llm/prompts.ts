/**
 * The Joker - Agentic Terminal
 * Prompt Templates for LLM Interactions
 */

import { Tool, Intent, Framework, ChatMessage } from '../types';

// ============================================
// System Prompts
// ============================================

/**
 * Base system prompt for The Joker agent
 */
export const SYSTEM_PROMPT_AGENT = `You are "The Joker", an autonomous AI-powered terminal assistant. You have the ability to:

1. **Web Scraping**: Search the web, scrape websites, and extract data
2. **Code Generation**: Generate React, Next.js, Vue, Express, and Node.js applications
3. **Project Management**: Create and scaffold new projects, manage dependencies
4. **File Operations**: Read, write, and modify files

You are helpful, efficient, and focused on completing tasks accurately.

When responding:
- Be concise and direct
- Always think step by step
- If you need more information, ask clarifying questions
- If you're uncertain about something, say so
- Format your responses clearly

You have access to various tools that you can use to accomplish tasks. When you need to use a tool, output your intention in a structured format.`;

/**
 * System prompt for intent recognition
 */
export const SYSTEM_PROMPT_INTENT = `You are an intent classifier for an AI terminal assistant called "The Joker".

Your job is to analyze user queries and determine:
1. The primary intent (what the user wants to do)
2. Required parameters or entities
3. Any clarifying information needed

Available intents:
- web_search: User wants to search for information online
- web_scrape: User wants to extract data from a specific website
- data_extract: User wants to extract/parse specific data from content
- code_generate: User wants to generate code (component, function, etc.)
- project_create: User wants to create a new project
- file_operation: User wants to read, write, or modify files
- general_query: General question that doesn't require tools
- unknown: Unable to determine intent

Always respond with valid JSON in this format:
{
  "intent": "intent_name",
  "confidence": 0.0-1.0,
  "entities": {
    "key": "value"
  },
  "clarification_needed": null | "question to ask user"
}`;

/**
 * System prompt for action planning
 */
export const SYSTEM_PROMPT_PLANNER = `You are an action planner for "The Joker" AI terminal.

Given a user query and intent, create a detailed action plan with specific tool calls.

Available tools:
{{TOOLS}}

Rules:
1. Break complex tasks into smaller steps
2. Each step should be a single tool call
3. Steps can depend on previous step results
4. Estimate time for each step
5. Handle potential errors in your plan

Respond with valid JSON:
{
  "plan": [
    {
      "step": 1,
      "tool": "tool_name",
      "params": { "param": "value" },
      "description": "What this step does",
      "depends_on": [],
      "estimated_ms": 1000
    }
  ],
  "total_estimated_ms": 5000,
  "notes": "Any important notes"
}`;

/**
 * System prompt for code generation
 */
export const SYSTEM_PROMPT_CODE_GEN = `You are an expert code generator for "The Joker" AI terminal.

You specialize in generating high-quality, production-ready code for:
- React (with Vite)
- Next.js (App Router)
- Vue 3
- Express.js
- Node.js

Guidelines:
1. Use TypeScript by default unless specified otherwise
2. Follow modern best practices and conventions
3. Include proper error handling
4. Add helpful comments for complex logic
5. Use descriptive variable and function names
6. Structure code for maintainability

When generating code, include:
- All necessary imports
- Type definitions (for TypeScript)
- Export statements
- Any required configuration

Respond with valid JSON:
{
  "code": "// your generated code here",
  "language": "typescript",
  "dependencies": ["package1", "package2"],
  "filename": "suggested_filename.ts",
  "explanation": "Brief explanation of the code"
}`;

/**
 * System prompt for conversation context
 */
export const SYSTEM_PROMPT_CONVERSATION = `You are "The Joker", a helpful AI terminal assistant.

Current conversation context is maintained. You have access to:
- Previous messages in this conversation
- Results from tool executions
- User preferences and context

Be natural and conversational while remaining helpful and efficient.
If referring to previous context, be specific about what you're referencing.`;

// ============================================
// Prompt Templates
// ============================================

/**
 * Template for intent recognition
 */
export function createIntentPrompt(userQuery: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT_INTENT },
    { 
      role: 'user', 
      content: `Analyze this query and determine the intent:

"${userQuery}"

Respond with JSON only.`
    }
  ];
}

/**
 * Template for action planning
 */
export function createPlanPrompt(
  userQuery: string, 
  intent: Intent, 
  tools: Tool[]
): ChatMessage[] {
  const toolDescriptions = tools.map(t => 
    `- ${t.name}: ${t.description}\n  Parameters: ${t.parameters.map(p => `${p.name}(${p.type}${p.required ? ', required' : ''})`).join(', ')}`
  ).join('\n');

  const systemPrompt = SYSTEM_PROMPT_PLANNER.replace('{{TOOLS}}', toolDescriptions);

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Create an action plan for this task:

Query: "${userQuery}"
Detected Intent: ${intent}

Respond with JSON only.`
    }
  ];
}

/**
 * Template for code generation
 */
export function createCodeGenPrompt(
  description: string,
  framework: Framework,
  options: {
    language?: 'typescript' | 'javascript';
    styling?: 'css' | 'scss' | 'tailwind' | 'styled-components';
    includeTests?: boolean;
    existingCode?: string;
  } = {}
): ChatMessage[] {
  const {
    language = 'typescript',
    styling = 'tailwind',
    includeTests = false,
    existingCode
  } = options;

  let prompt = `Generate code for the following:

Description: ${description}
Framework: ${framework}
Language: ${language}
Styling: ${styling}
${includeTests ? 'Include unit tests.' : ''}`;

  if (existingCode) {
    prompt += `\n\nExisting code to integrate with or modify:\n\`\`\`\n${existingCode}\n\`\`\``;
  }

  prompt += '\n\nRespond with JSON only.';

  return [
    { role: 'system', content: SYSTEM_PROMPT_CODE_GEN },
    { role: 'user', content: prompt }
  ];
}

/**
 * Template for data extraction from scraped content
 */
export function createExtractionPrompt(
  content: string,
  extractionGoal: string,
  format: 'json' | 'markdown' | 'table' = 'json'
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a data extraction specialist. Extract structured data from content.
Always be accurate and only extract information that is explicitly present.
If information is not available, indicate with null.`
    },
    {
      role: 'user',
      content: `Extract the following from the content:

Goal: ${extractionGoal}
Output Format: ${format}

Content:
"""
${content.substring(0, 8000)}
${content.length > 8000 ? '\n... [content truncated]' : ''}
"""

${format === 'json' ? 'Respond with valid JSON only.' : `Respond in ${format} format.`}`
    }
  ];
}

/**
 * Template for project scaffolding decisions
 */
export function createScaffoldPrompt(
  projectDescription: string,
  availableFrameworks: Framework[]
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a project architect. Analyze project requirements and recommend the best structure.

Consider:
- Scalability
- Developer experience
- Performance
- Modern best practices

Respond with JSON:
{
  "framework": "recommended_framework",
  "language": "typescript" | "javascript",
  "styling": "css" | "scss" | "tailwind" | "styled-components",
  "testing": "jest" | "vitest" | "cypress",
  "features": ["feature1", "feature2"],
  "reasoning": "Why these choices"
}`
    },
    {
      role: 'user',
      content: `Analyze this project and recommend the best setup:

"${projectDescription}"

Available frameworks: ${availableFrameworks.join(', ')}

Respond with JSON only.`
    }
  ];
}

/**
 * Template for error explanation
 */
export function createErrorExplanationPrompt(
  error: string,
  context?: string
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a debugging assistant. Explain errors clearly and provide solutions.

For each error:
1. Explain what the error means
2. Identify the likely cause
3. Provide step-by-step solutions
4. Suggest how to prevent it in the future`
    },
    {
      role: 'user',
      content: `Explain this error and how to fix it:

Error:
\`\`\`
${error}
\`\`\`
${context ? `\nContext:\n${context}` : ''}

Provide a clear, actionable explanation.`
    }
  ];
}

/**
 * Template for summarization
 */
export function createSummaryPrompt(
  content: string,
  summaryType: 'brief' | 'detailed' | 'bullet-points' = 'brief'
): ChatMessage[] {
  const formatInstructions = {
    'brief': 'Provide a concise 2-3 sentence summary.',
    'detailed': 'Provide a comprehensive summary covering all main points.',
    'bullet-points': 'Provide a summary as bullet points highlighting key information.'
  };

  return [
    {
      role: 'system',
      content: 'You are a summarization expert. Create clear, accurate summaries.'
    },
    {
      role: 'user',
      content: `Summarize the following content:

"""
${content.substring(0, 10000)}
${content.length > 10000 ? '\n... [content truncated]' : ''}
"""

${formatInstructions[summaryType]}`
    }
  ];
}

// ============================================
// Prompt Utilities
// ============================================

/**
 * Build a conversation prompt from history
 */
export function buildConversationPrompt(
  history: ChatMessage[],
  newMessage: string,
  systemPrompt: string = SYSTEM_PROMPT_CONVERSATION
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: newMessage }
  ];
}

/**
 * Create a tool result message
 */
export function createToolResultMessage(
  toolName: string,
  result: unknown,
  success: boolean
): ChatMessage {
  return {
    role: 'function',
    name: toolName,
    content: JSON.stringify({
      success,
      result,
      timestamp: new Date().toISOString()
    })
  };
}

/**
 * Truncate content to fit within token limits
 */
export function truncateContent(content: string, maxChars: number = 10000): string {
  if (content.length <= maxChars) {
    return content;
  }
  return content.substring(0, maxChars) + '\n\n... [content truncated for length]';
}

/**
 * Format tool list for prompts
 */
export function formatToolsForPrompt(tools: Tool[]): string {
  return tools.map(tool => {
    const params = tool.parameters.map(p => 
      `  - ${p.name} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`
    ).join('\n');
    
    return `**${tool.name}**
${tool.description}
Parameters:
${params}`;
  }).join('\n\n');
}

/**
 * Create a JSON output instruction
 */
export function jsonOutputInstruction(schema?: Record<string, unknown>): string {
  if (schema) {
    return `Respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;
  }
  return 'Respond with valid JSON only. No markdown formatting, no code blocks, just raw JSON.';
}

// ============================================
// Exported Prompt Collection
// ============================================

export const prompts = {
  system: {
    agent: SYSTEM_PROMPT_AGENT,
    intent: SYSTEM_PROMPT_INTENT,
    planner: SYSTEM_PROMPT_PLANNER,
    codeGen: SYSTEM_PROMPT_CODE_GEN,
    conversation: SYSTEM_PROMPT_CONVERSATION
  },
  create: {
    intent: createIntentPrompt,
    plan: createPlanPrompt,
    codeGen: createCodeGenPrompt,
    extraction: createExtractionPrompt,
    scaffold: createScaffoldPrompt,
    errorExplanation: createErrorExplanationPrompt,
    summary: createSummaryPrompt
  },
  utils: {
    buildConversation: buildConversationPrompt,
    toolResult: createToolResultMessage,
    truncate: truncateContent,
    formatTools: formatToolsForPrompt,
    jsonInstruction: jsonOutputInstruction
  }
};

export default prompts;

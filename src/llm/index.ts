/**
 * LLM Module - LM Studio client and related utilities
 */

// LM Studio Client
export { 
    LMStudioClient,
} from './client.js';
export type {
    HealthCheckResult,
    ModelInfo,
} from './client.js';

// Response Parser
export {
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
} from './parser.js';
export type {
    ParsedIntent,
    ParsedPlan,
    ParsedCodeGen,
    ToolCall,
    ParseResult,
    ValidationSchema,
} from './parser.js';

// Prompts
export {
    SYSTEM_PROMPT_AGENT,
    SYSTEM_PROMPT_INTENT,
    SYSTEM_PROMPT_PLANNER,
    SYSTEM_PROMPT_CODE_GEN,
    SYSTEM_PROMPT_CONVERSATION,
    createIntentPrompt,
    createPlanPrompt,
    createCodeGenPrompt,
    createExtractionPrompt,
    createScaffoldPrompt,
    createErrorExplanationPrompt,
    createSummaryPrompt,
    buildConversationPrompt,
    createToolResultMessage,
    truncateContent,
    formatToolsForPrompt,
    jsonOutputInstruction,
    prompts,
} from './prompts.js';

// Summarizer (Phase 8)
export {
    LLMSummarizer,
    summarizeResults,
    quickSummary,
} from './summarizer.js';
export type {
    SummarizedResult,
    EnhancedItem,
    SummarizeOptions,
} from './summarizer.js';

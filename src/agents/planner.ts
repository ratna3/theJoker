/**
 * The Joker - Agentic Terminal
 * Query Analyzer & Action Planner
 * 
 * Parses natural language queries, extracts entities,
 * and generates execution plans
 */

import { logger } from '../utils/logger';
import { LMStudioClient } from '../llm/client';
import { extractJSON } from '../llm/parser';
import { INTENT_RECOGNITION_PROMPT, ACTION_PLANNING_PROMPT } from '../llm/prompts';

/**
 * Intent types for query classification
 */
export enum IntentType {
  SEARCH = 'search',           // Find information
  FIND_PLACES = 'find_places', // Location-based search
  COMPARE = 'compare',         // Compare items
  LIST = 'list',               // Get a list of items
  EXTRACT = 'extract',         // Extract from specific URL
  SUMMARIZE = 'summarize',     // Summarize content
  MONITOR = 'monitor',         // Track changes
  CODE = 'code',               // Generate code
  PROJECT = 'project',         // Create/manage project
  ANALYZE = 'analyze',         // Analyze code/content
  HELP = 'help',               // Help/assistance
  UNKNOWN = 'unknown',         // Couldn't determine intent
}

/**
 * Entities extracted from user query
 */
export interface QueryEntities {
  topic: string;               // Main subject
  location?: string;           // Geographic location
  category?: string;           // Type/category filter
  count?: number;              // Number of results wanted
  timeframe?: string;          // Date/time constraints
  source?: string;             // Preferred source
  url?: string;                // Specific URL if provided
  keywords?: string[];         // Additional keywords
  filters?: Record<string, string>; // Custom filters
  framework?: string;          // For code: react, nextjs, etc.
  language?: string;           // Programming language
}

/**
 * Parsed intent result
 */
export interface ParsedIntent {
  intent: IntentType;
  confidence: number;
  entities: QueryEntities;
  originalQuery: string;
  suggestedQueries?: string[];
}

/**
 * Action step in a plan
 */
export interface ActionStep {
  id: string;
  order: number;
  tool: string;
  params: Record<string, unknown>;
  description: string;
  dependsOn?: string[];
  timeout?: number;
  retryable?: boolean;
}

/**
 * Complete action plan
 */
export interface ActionPlan {
  id: string;
  query: string;
  intent: IntentType;
  entities: QueryEntities;
  steps: ActionStep[];
  estimatedTime: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Planner configuration
 */
export interface PlannerConfig {
  maxSteps?: number;
  timeout?: number;
  enableCache?: boolean;
  confidenceThreshold?: number;
}



/**
 * Query Analyzer and Action Planner
 */
export class Planner {
  private llm: LMStudioClient;
  private config: PlannerConfig;
  private planCache: Map<string, ActionPlan>;

  constructor(llm: LMStudioClient, config: PlannerConfig = {}) {
    this.llm = llm;
    this.config = {
      maxSteps: config.maxSteps || 10,
      timeout: config.timeout || 60000,
      enableCache: config.enableCache ?? true,
      confidenceThreshold: config.confidenceThreshold || 0.5,
    };
    this.planCache = new Map();
    logger.debug('Planner initialized', { config: this.config });
  }

  /**
   * Analyze a user query and extract intent + entities
   */
  async analyzeQuery(query: string): Promise<ParsedIntent> {
    logger.info('Analyzing query', { query });

    // Quick pattern matching for common intents
    const quickIntent = this.quickIntentMatch(query);
    if (quickIntent && quickIntent.confidence > 0.9) {
      logger.debug('Quick intent match', quickIntent);
      return quickIntent;
    }

    // Use LLM for complex analysis
    const prompt = INTENT_RECOGNITION_PROMPT.replace('{{query}}', query);
    
    try {
      const response = await this.llm.chat([
        { role: 'system', content: 'You are a query analysis assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.3 });

      const jsonStr = extractJSON(response.content);
      if (!jsonStr) {
        logger.warn('Failed to parse intent response, using fallback');
        return this.createFallbackIntent(query);
      }

      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

      const result: ParsedIntent = {
        intent: this.validateIntent(String(parsed.intent || 'unknown')),
        confidence: Math.min(Math.max(Number(parsed.confidence) || 0.5, 0), 1),
        entities: this.validateEntities((parsed.entities as Record<string, unknown>) || {}),
        originalQuery: query,
        suggestedQueries: (parsed.suggestedQueries as string[]) || [],
      };

      logger.info('Query analyzed', { intent: result.intent, confidence: result.confidence });
      return result;

    } catch (error) {
      logger.error('Query analysis failed', { error });
      return this.createFallbackIntent(query);
    }
  }

  /**
   * Create an action plan for a parsed intent
   */
  async createPlan(intent: ParsedIntent): Promise<ActionPlan> {
    logger.info('Creating action plan', { intent: intent.intent });

    // Check cache
    const cacheKey = this.getCacheKey(intent);
    if (this.config.enableCache && this.planCache.has(cacheKey)) {
      logger.debug('Returning cached plan');
      return this.planCache.get(cacheKey)!;
    }

    // Use quick planning for simple intents
    const quickPlan = this.quickPlan(intent);
    if (quickPlan) {
      if (this.config.enableCache) {
        this.planCache.set(cacheKey, quickPlan);
      }
      return quickPlan;
    }

    // Use LLM for complex planning
    const prompt = ACTION_PLANNING_PROMPT
      .replace('{{query}}', intent.originalQuery)
      .replace('{{intent}}', intent.intent)
      .replace('{{entities}}', JSON.stringify(intent.entities));

    try {
      const response = await this.llm.chat([
        { role: 'system', content: 'You are an action planning assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.2 });

      const jsonStr = extractJSON(response.content);
      if (!jsonStr) {
        logger.warn('Failed to parse plan response, using fallback');
        return this.createFallbackPlan(intent);
      }

      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      if (!parsed.steps) {
        logger.warn('Plan response missing steps, using fallback');
        return this.createFallbackPlan(intent);
      }

      const plan: ActionPlan = {
        id: this.generatePlanId(),
        query: intent.originalQuery,
        intent: intent.intent,
        entities: intent.entities,
        steps: this.validateSteps(parsed.steps as unknown[]),
        estimatedTime: Number(parsed.estimatedTime) || 30,
        createdAt: new Date(),
      };

      // Limit steps
      if (plan.steps.length > this.config.maxSteps!) {
        plan.steps = plan.steps.slice(0, this.config.maxSteps);
        logger.warn('Plan truncated to max steps', { maxSteps: this.config.maxSteps });
      }

      if (this.config.enableCache) {
        this.planCache.set(cacheKey, plan);
      }

      logger.info('Action plan created', { planId: plan.id, steps: plan.steps.length });
      return plan;

    } catch (error) {
      logger.error('Plan creation failed', { error });
      return this.createFallbackPlan(intent);
    }
  }

  /**
   * Analyze query and create plan in one step
   */
  async plan(query: string): Promise<ActionPlan> {
    const intent = await this.analyzeQuery(query);
    return this.createPlan(intent);
  }

  /**
   * Quick pattern matching for common intents
   */
  private quickIntentMatch(query: string): ParsedIntent | null {
    const lowerQuery = query.toLowerCase().trim();
    
    // URL extraction intent
    const urlMatch = query.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return {
        intent: IntentType.EXTRACT,
        confidence: 0.95,
        entities: {
          topic: 'web content',
          url: urlMatch[0],
        },
        originalQuery: query,
      };
    }

    // Help intent
    if (lowerQuery === 'help' || lowerQuery === '?' || lowerQuery.startsWith('help ')) {
      return {
        intent: IntentType.HELP,
        confidence: 1.0,
        entities: { topic: 'assistance' },
        originalQuery: query,
      };
    }

    // Code generation patterns
    const codePatterns = [
      /^(create|build|generate|write|make)\s+(a\s+)?(react|nextjs|vue|node|express|typescript)/i,
      /^(create|build|generate|write|make)\s+(a\s+)?component/i,
      /^(create|build|generate|write|make)\s+(a\s+)?function/i,
      /^(create|build|generate|write|make)\s+(a\s+)?api/i,
    ];

    for (const pattern of codePatterns) {
      if (pattern.test(lowerQuery)) {
        const frameworkMatch = lowerQuery.match(/react|nextjs|vue|node|express|typescript/i);
        return {
          intent: IntentType.CODE,
          confidence: 0.92,
          entities: {
            topic: query,
            framework: frameworkMatch ? frameworkMatch[0].toLowerCase() : undefined,
          },
          originalQuery: query,
        };
      }
    }

    // Project creation patterns
    const projectPatterns = [
      /^(create|init|initialize|setup|scaffold)\s+(a\s+)?(new\s+)?project/i,
      /^(create|init|initialize|setup|scaffold)\s+(a\s+)?(new\s+)?(react|nextjs|vue|node)/i,
    ];

    for (const pattern of projectPatterns) {
      if (pattern.test(lowerQuery)) {
        const frameworkMatch = lowerQuery.match(/react|nextjs|vue|node|express/i);
        return {
          intent: IntentType.PROJECT,
          confidence: 0.92,
          entities: {
            topic: 'project creation',
            framework: frameworkMatch ? frameworkMatch[0].toLowerCase() : undefined,
          },
          originalQuery: query,
        };
      }
    }

    // Location-based search patterns
    const locationPatterns = [
      /(?:find|search|get|show|list|where|locate)\s+(?:me\s+)?(?:the\s+)?(?:best\s+)?(.+?)\s+(?:in|near|around|at)\s+(.+)/i,
      /(?:best|top|popular)\s+(.+?)\s+(?:in|near|around)\s+(.+)/i,
    ];

    for (const pattern of locationPatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        return {
          intent: IntentType.FIND_PLACES,
          confidence: 0.88,
          entities: {
            topic: match[1].trim(),
            location: match[2].trim(),
          },
          originalQuery: query,
        };
      }
    }

    // List patterns
    if (/^(?:list|show|get|what are|give me)\s+(?:the\s+)?(?:top\s+)?(\d+)?\s*(.+)/i.test(lowerQuery)) {
      const countMatch = lowerQuery.match(/top\s+(\d+)/i);
      return {
        intent: IntentType.LIST,
        confidence: 0.85,
        entities: {
          topic: query,
          count: countMatch ? parseInt(countMatch[1]) : undefined,
        },
        originalQuery: query,
      };
    }

    // Compare patterns
    if (/(?:compare|difference|vs|versus|better|which is)/i.test(lowerQuery)) {
      return {
        intent: IntentType.COMPARE,
        confidence: 0.85,
        entities: { topic: query },
        originalQuery: query,
      };
    }

    // Summarize patterns
    if (/^(?:summarize|summary|tldr|explain|describe)/i.test(lowerQuery)) {
      return {
        intent: IntentType.SUMMARIZE,
        confidence: 0.90,
        entities: { topic: query },
        originalQuery: query,
      };
    }

    // Default to search for most queries
    if (lowerQuery.length > 3) {
      return {
        intent: IntentType.SEARCH,
        confidence: 0.7,
        entities: { topic: query },
        originalQuery: query,
      };
    }

    return null;
  }

  /**
   * Quick plan generation for common intents
   */
  private quickPlan(intent: ParsedIntent): ActionPlan | null {
    const baseId = this.generatePlanId();
    const baseStep = {
      timeout: 30000,
      retryable: true,
      dependsOn: [] as string[],
    };

    switch (intent.intent) {
      case IntentType.SEARCH:
        return {
          id: baseId,
          query: intent.originalQuery,
          intent: intent.intent,
          entities: intent.entities,
          steps: [
            {
              ...baseStep,
              id: 'step_1',
              order: 1,
              tool: 'web_search',
              params: {
                query: intent.entities.topic,
                numResults: intent.entities.count || 10,
              },
              description: `Search for: ${intent.entities.topic}`,
            },
            {
              ...baseStep,
              id: 'step_2',
              order: 2,
              tool: 'process_data',
              params: {
                operation: 'format',
                source: 'step_1',
              },
              description: 'Format and display results',
              dependsOn: ['step_1'],
            },
          ],
          estimatedTime: 15,
          createdAt: new Date(),
        };

      case IntentType.FIND_PLACES:
        return {
          id: baseId,
          query: intent.originalQuery,
          intent: intent.intent,
          entities: intent.entities,
          steps: [
            {
              ...baseStep,
              id: 'step_1',
              order: 1,
              tool: 'web_search',
              params: {
                query: `${intent.entities.topic} ${intent.entities.location || ''} reviews ratings`,
                numResults: 15,
              },
              description: `Search for ${intent.entities.topic} in ${intent.entities.location}`,
            },
            {
              ...baseStep,
              id: 'step_2',
              order: 2,
              tool: 'scrape_page',
              params: {
                urls: '{{step_1.results}}',
                selectors: {
                  name: 'h1, .name, .title',
                  rating: '.rating, .stars, [class*="rating"]',
                  address: '.address, [class*="address"]',
                  phone: '.phone, [class*="phone"]',
                },
              },
              description: 'Extract place details from search results',
              dependsOn: ['step_1'],
            },
            {
              ...baseStep,
              id: 'step_3',
              order: 3,
              tool: 'process_data',
              params: {
                operation: 'deduplicate',
                sortBy: 'rating',
                limit: intent.entities.count || 10,
                source: 'step_2',
              },
              description: 'Process and rank results',
              dependsOn: ['step_2'],
            },
          ],
          estimatedTime: 45,
          createdAt: new Date(),
        };

      case IntentType.EXTRACT:
        return {
          id: baseId,
          query: intent.originalQuery,
          intent: intent.intent,
          entities: intent.entities,
          steps: [
            {
              ...baseStep,
              id: 'step_1',
              order: 1,
              tool: 'scrape_page',
              params: {
                url: intent.entities.url,
                waitFor: 'networkidle2',
                scroll: true,
              },
              description: `Scrape content from ${intent.entities.url}`,
            },
            {
              ...baseStep,
              id: 'step_2',
              order: 2,
              tool: 'extract_links',
              params: {
                url: intent.entities.url,
              },
              description: 'Extract all links',
              dependsOn: ['step_1'],
            },
            {
              ...baseStep,
              id: 'step_3',
              order: 3,
              tool: 'process_data',
              params: {
                operation: 'format',
                includeLinks: true,
                source: 'step_1',
              },
              description: 'Format extracted content',
              dependsOn: ['step_1', 'step_2'],
            },
          ],
          estimatedTime: 30,
          createdAt: new Date(),
        };

      case IntentType.CODE:
        return {
          id: baseId,
          query: intent.originalQuery,
          intent: intent.intent,
          entities: intent.entities,
          steps: [
            {
              ...baseStep,
              id: 'step_1',
              order: 1,
              tool: 'generate_code',
              params: {
                description: intent.entities.topic,
                language: intent.entities.language || 'typescript',
                framework: intent.entities.framework || 'react',
              },
              description: `Generate code: ${intent.entities.topic}`,
            },
          ],
          estimatedTime: 20,
          createdAt: new Date(),
        };

      case IntentType.PROJECT:
        return {
          id: baseId,
          query: intent.originalQuery,
          intent: intent.intent,
          entities: intent.entities,
          steps: [
            {
              ...baseStep,
              id: 'step_1',
              order: 1,
              tool: 'create_project',
              params: {
                framework: intent.entities.framework || 'react',
                language: 'typescript',
                features: [],
              },
              description: 'Create new project',
            },
          ],
          estimatedTime: 60,
          createdAt: new Date(),
        };

      case IntentType.HELP:
        return {
          id: baseId,
          query: intent.originalQuery,
          intent: intent.intent,
          entities: intent.entities,
          steps: [
            {
              ...baseStep,
              id: 'step_1',
              order: 1,
              tool: 'show_help',
              params: {},
              description: 'Display help information',
            },
          ],
          estimatedTime: 1,
          createdAt: new Date(),
        };

      default:
        return null;
    }
  }

  /**
   * Create fallback intent when analysis fails
   */
  private createFallbackIntent(query: string): ParsedIntent {
    return {
      intent: IntentType.SEARCH,
      confidence: 0.5,
      entities: { topic: query },
      originalQuery: query,
      suggestedQueries: [],
    };
  }

  /**
   * Create fallback plan when planning fails
   */
  private createFallbackPlan(intent: ParsedIntent): ActionPlan {
    return {
      id: this.generatePlanId(),
      query: intent.originalQuery,
      intent: intent.intent,
      entities: intent.entities,
      steps: [
        {
          id: 'step_1',
          order: 1,
          tool: 'web_search',
          params: { query: intent.originalQuery, numResults: 10 },
          description: 'Search the web',
          timeout: 30000,
          retryable: true,
        },
      ],
      estimatedTime: 15,
      createdAt: new Date(),
    };
  }

  /**
   * Validate intent type
   */
  private validateIntent(intent: string): IntentType {
    const valid = Object.values(IntentType) as string[];
    return valid.includes(intent) ? (intent as IntentType) : IntentType.UNKNOWN;
  }

  /**
   * Validate and sanitize entities
   */
  private validateEntities(entities: Record<string, unknown>): QueryEntities {
    return {
      topic: String(entities.topic || ''),
      location: entities.location ? String(entities.location) : undefined,
      category: entities.category ? String(entities.category) : undefined,
      count: typeof entities.count === 'number' ? entities.count : undefined,
      timeframe: entities.timeframe ? String(entities.timeframe) : undefined,
      source: entities.source ? String(entities.source) : undefined,
      url: entities.url ? String(entities.url) : undefined,
      keywords: Array.isArray(entities.keywords) 
        ? entities.keywords.map(String) 
        : undefined,
      framework: entities.framework ? String(entities.framework) : undefined,
      language: entities.language ? String(entities.language) : undefined,
    };
  }

  /**
   * Validate and normalize steps
   */
  private validateSteps(steps: unknown[]): ActionStep[] {
    return steps.map((step: unknown, index: number) => {
      const s = step as Record<string, unknown>;
      return {
        id: String(s.id || `step_${index + 1}`),
        order: typeof s.order === 'number' ? s.order : index + 1,
        tool: String(s.tool || 'unknown'),
        params: (s.params as Record<string, unknown>) || {},
        description: String(s.description || ''),
        dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : [],
        timeout: typeof s.timeout === 'number' ? s.timeout : 30000,
        retryable: s.retryable !== false,
      };
    });
  }

  /**
   * Generate unique plan ID
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate cache key for intent
   */
  private getCacheKey(intent: ParsedIntent): string {
    return `${intent.intent}:${intent.originalQuery}`.toLowerCase();
  }

  /**
   * Clear the plan cache
   */
  clearCache(): void {
    this.planCache.clear();
    logger.debug('Plan cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.planCache.size,
      keys: Array.from(this.planCache.keys()),
    };
  }
}

export default Planner;

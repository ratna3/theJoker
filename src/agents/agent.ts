/**
 * The Joker - Agentic Terminal
 * Autonomous Agent Core
 * 
 * Implements the Think → Plan → Act → Observe loop
 * with self-correction, learning, and memory integration
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { LMStudioClient } from '../llm/client';
import { extractJSON } from '../llm/parser';
import { Planner, ActionPlan, ParsedIntent, IntentType } from './planner';
import { Executor, ToolRegistry, ExecutionResult, ToolResult, createDefaultRegistry } from './executor';
import { AgentMemory, getMemory, Thought, Observation } from './memory';

/**
 * Agent state in the Think→Plan→Act→Observe loop
 */
export enum AgentState {
  IDLE = 'idle',
  THINKING = 'thinking',
  PLANNING = 'planning',
  ACTING = 'acting',
  OBSERVING = 'observing',
  CORRECTING = 'correcting',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

/**
 * Recovery strategy for self-correction
 */
export enum RecoveryStrategy {
  RETRY = 'retry',           // Retry the same action
  ALTERNATIVE = 'alternative', // Try alternative approach
  SKIP = 'skip',             // Skip and continue
  ABORT = 'abort',           // Abort the entire operation
  BACKTRACK = 'backtrack',   // Go back to previous step
}

/**
 * Agent thought representation
 */
export interface AgentThought {
  id: string;
  content: string;
  reasoning: string;
  confidence: number;
  timestamp: Date;
  isRevision?: boolean;
  revisesThought?: string;
}

/**
 * Agent observation representation
 */
export interface AgentObservation {
  id: string;
  stepId: string;
  result: ToolResult;
  analysis: string;
  isExpected: boolean;
  nextAction: string;
  timestamp: Date;
}

/**
 * Self-correction context
 */
export interface CorrectionContext {
  error: string;
  failedStep: string;
  attempt: number;
  maxAttempts: number;
  strategy: RecoveryStrategy;
  alternativeApproach?: string;
}

/**
 * Agent run result
 */
export interface AgentRunResult {
  success: boolean;
  query: string;
  intent: ParsedIntent;
  plan: ActionPlan;
  executionResult: ExecutionResult;
  thoughts: AgentThought[];
  observations: AgentObservation[];
  corrections: CorrectionContext[];
  finalAnswer: string;
  totalTime: number;
  iterations: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  maxIterations?: number;
  maxCorrections?: number;
  thinkingTimeout?: number;
  observationTimeout?: number;
  enableLearning?: boolean;
  verboseMode?: boolean;
}

/**
 * Agent events
 */
export interface AgentEvents {
  'state:change': { from: AgentState; to: AgentState };
  'thought': AgentThought;
  'observation': AgentObservation;
  'correction': CorrectionContext;
  'plan:created': ActionPlan;
  'step:complete': { step: string; result: ToolResult };
  'goal:achieved': AgentRunResult;
  'goal:failed': { error: string; partialResult: Partial<AgentRunResult> };
}

/**
 * Reflection prompt for the agent
 */
const REFLECTION_PROMPT = `You are an intelligent agent reflecting on execution results.

Goal: {{goal}}
Step Executed: {{step}}
Result: {{result}}
Success: {{success}}

Analyze the result and determine:
1. Did this step achieve its purpose?
2. Is the result what was expected?
3. What should the next action be?
4. Should we continue, modify the plan, or stop?

Respond with JSON:
{
  "analysis": "Brief analysis of the result",
  "isExpected": true/false,
  "nextAction": "continue" | "modify_plan" | "retry" | "stop",
  "reason": "Why this next action",
  "shouldContinue": true/false
}`;

/**
 * Self-correction prompt
 */
const CORRECTION_PROMPT = `You are an intelligent agent that needs to recover from an error.

Original Goal: {{goal}}
Failed Step: {{step}}
Error: {{error}}
Attempt: {{attempt}} of {{maxAttempts}}
Previous Strategy: {{previousStrategy}}

Determine the best recovery strategy:
1. retry: Try the same action again (for transient errors)
2. alternative: Try a different approach to achieve the same goal
3. skip: Skip this step if non-critical and continue
4. abort: Stop execution if critical failure
5. backtrack: Go back and try from a previous step

Respond with JSON:
{
  "strategy": "retry" | "alternative" | "skip" | "abort" | "backtrack",
  "reason": "Why this strategy",
  "alternativeApproach": "If alternative, describe the new approach",
  "isCritical": true/false
}`;

/**
 * Final synthesis prompt
 */
const SYNTHESIS_PROMPT = `You are an intelligent agent summarizing results for the user.

Original Query: {{query}}
Intent: {{intent}}
Steps Completed: {{stepsCompleted}}
Steps Failed: {{stepsFailed}}
Final Data: {{data}}

Create a clear, helpful response for the user that:
1. Answers their original question
2. Presents the key findings
3. Notes any limitations or issues encountered
4. Suggests follow-up actions if relevant

Respond naturally in plain text, formatted nicely for terminal display.`;

/**
 * The Joker Agent - Autonomous agent with Think→Plan→Act→Observe loop
 */
export class JokerAgent extends EventEmitter {
  private llm: LMStudioClient;
  private planner: Planner;
  private executor: Executor;
  private memory: AgentMemory;
  private registry: ToolRegistry;
  private config: AgentConfig;
  
  private state: AgentState;
  private currentPlan: ActionPlan | null;
  private thoughts: AgentThought[];
  private observations: AgentObservation[];
  private corrections: CorrectionContext[];
  private iteration: number;

  constructor(
    llm: LMStudioClient,
    config: AgentConfig = {},
    registry?: ToolRegistry
  ) {
    super();
    this.llm = llm;
    this.registry = registry || createDefaultRegistry();
    this.planner = new Planner(llm);
    this.executor = new Executor(this.registry);
    this.memory = getMemory();
    
    this.config = {
      maxIterations: config.maxIterations || 10,
      maxCorrections: config.maxCorrections || 3,
      thinkingTimeout: config.thinkingTimeout || 30000,
      observationTimeout: config.observationTimeout || 15000,
      enableLearning: config.enableLearning ?? true,
      verboseMode: config.verboseMode ?? false,
    };

    this.state = AgentState.IDLE;
    this.currentPlan = null;
    this.thoughts = [];
    this.observations = [];
    this.corrections = [];
    this.iteration = 0;

    // Forward executor events
    this.executor.on('step:complete', (data) => this.emit('step:complete', data));
    
    logger.debug('JokerAgent initialized', { config: this.config });
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Change agent state
   */
  private setState(newState: AgentState): void {
    const from = this.state;
    this.state = newState;
    this.emit('state:change', { from, to: newState });
    logger.debug('Agent state changed', { from, to: newState });
  }

  /**
   * Run the agent on a query (main entry point)
   */
  async run(query: string): Promise<AgentRunResult> {
    const startTime = Date.now();
    this.iteration = 0;
    this.thoughts = [];
    this.observations = [];
    this.corrections = [];
    this.currentPlan = null;

    logger.info('Agent run started', { query });

    // Create or get session
    const session = this.memory.getCurrentSession() || (() => { this.memory.createSession(); return this.memory.getCurrentSession()!; })();
    this.memory.addMessage({ role: 'user', content: query });

    try {
      // Phase 1: THINK - Understand the query
      this.setState(AgentState.THINKING);
      const thought = await this.think(query);
      this.thoughts.push(thought);

      // Phase 2: PLAN - Create action plan
      this.setState(AgentState.PLANNING);
      const intent = await this.planner.analyzeQuery(query);
      const plan = await this.planner.createPlan(intent);
      this.currentPlan = plan;
      this.memory.setCurrentIntent(intent);
      this.memory.setCurrentPlan(plan);
      this.emit('plan:created', plan);

      // Phase 3: ACT & OBSERVE loop
      let executionResult: ExecutionResult | null = null;
      let goalAchieved = false;

      while (!goalAchieved && this.iteration < this.config.maxIterations!) {
        this.iteration++;
        logger.debug('Agent iteration', { iteration: this.iteration });

        // ACT - Execute the plan
        this.setState(AgentState.ACTING);
        executionResult = await this.executor.executePlan(plan);

        // OBSERVE - Analyze results
        this.setState(AgentState.OBSERVING);
        const observation = await this.observe(plan, executionResult);
        this.observations.push(observation);

        // Record step results in memory
        for (const [stepId, result] of executionResult.results) {
          this.memory.setStepResult(stepId, result);
        }

        // Check if goal achieved
        if (executionResult.success && observation.isExpected) {
          goalAchieved = true;
          break;
        }

        // Self-correction if needed
        if (!executionResult.success || !observation.isExpected) {
          this.setState(AgentState.CORRECTING);
          const shouldContinue = await this.correct(plan, executionResult, observation);
          
          if (!shouldContinue) {
            logger.info('Agent stopping after correction decision');
            break;
          }
        }
      }

      // Phase 4: SYNTHESIZE - Create final answer
      const finalAnswer = await this.synthesize(query, intent, executionResult!);
      
      // Record in memory
      this.memory.addMessage({ role: 'assistant', content: finalAnswer });
      
      // Learn from this interaction
      if (this.config.enableLearning && executionResult) {
        await this.learn(query, plan, executionResult);
      }

      const result: AgentRunResult = {
        success: goalAchieved || (executionResult?.success ?? false),
        query,
        intent,
        plan,
        executionResult: executionResult!,
        thoughts: this.thoughts,
        observations: this.observations,
        corrections: this.corrections,
        finalAnswer,
        totalTime: Date.now() - startTime,
        iterations: this.iteration,
      };

      this.setState(AgentState.COMPLETE);
      this.emit('goal:achieved', result);

      logger.info('Agent run complete', {
        success: result.success,
        totalTime: result.totalTime,
        iterations: result.iterations,
      });

      return result;

    } catch (error) {
      logger.error('Agent run failed', { error });
      this.setState(AgentState.FAILED);

      const partialResult: Partial<AgentRunResult> = {
        success: false,
        query,
        thoughts: this.thoughts,
        observations: this.observations,
        corrections: this.corrections,
        totalTime: Date.now() - startTime,
        iterations: this.iteration,
      };

      this.emit('goal:failed', { 
        error: (error as Error).message, 
        partialResult 
      });

      // Return a result even on failure
      return {
        ...partialResult,
        intent: { 
          intent: IntentType.UNKNOWN, 
          confidence: 0, 
          entities: { topic: query }, 
          originalQuery: query 
        },
        plan: { 
          id: 'failed', 
          query, 
          intent: IntentType.UNKNOWN, 
          entities: { topic: query }, 
          steps: [], 
          estimatedTime: 0, 
          createdAt: new Date() 
        },
        executionResult: { 
          success: false, 
          planId: 'failed', 
          results: new Map(), 
          finalOutput: null, 
          totalTime: Date.now() - startTime, 
          stepsCompleted: 0, 
          stepsFailed: 0, 
          errors: [(error as Error).message] 
        },
        finalAnswer: `I encountered an error while processing your request: ${(error as Error).message}`,
      } as AgentRunResult;
    }
  }

  /**
   * THINK phase - Understand and reason about the query
   */
  private async think(query: string): Promise<AgentThought> {
    logger.debug('Agent thinking', { query });

    const thoughtId = `thought_${Date.now()}`;
    
    // Check memory for similar past queries
    const patterns = this.memory.findSimilarPatterns(query);
    const hasPatterns = patterns.length > 0;

    let reasoning = '';
    let confidence = 0.8;

    if (hasPatterns) {
      const bestPattern = patterns[0];
      const patternSuccess = bestPattern.success ? 'successful' : 'unsuccessful';
      reasoning = `Found ${patterns.length} similar past queries. Best match was ${patternSuccess}. `;
      confidence = bestPattern.success ? 0.85 : 0.7;
    }

    // Use LLM for deeper reasoning if needed
    const thinkingPrompt = `Briefly analyze this user query and identify:
1. Main goal/intent
2. Key entities or parameters
3. Potential challenges
4. Best approach

Query: "${query}"
${hasPatterns ? `Note: Found similar past queries (${patterns[0].success ? 'successful' : 'unsuccessful'} pattern).` : ''}

Respond in 2-3 sentences.`;

    try {
      const response = await this.llm.chat([
        { role: 'system', content: 'You are a thoughtful assistant analyzing user queries.' },
        { role: 'user', content: thinkingPrompt }
      ], { temperature: 0.3, maxTokens: 200 });

      reasoning += response.content;

    } catch (error) {
      logger.warn('Thinking phase LLM call failed', { error });
      reasoning += `Basic analysis: Query appears to be about "${query}".`;
    }

    const thought: AgentThought = {
      id: thoughtId,
      content: query,
      reasoning,
      confidence,
      timestamp: new Date(),
    };

    // Store in memory
    this.memory.addThought(reasoning, 'analysis');

    this.emit('thought', thought);
    return thought;
  }

  /**
   * OBSERVE phase - Analyze execution results
   */
  private async observe(
    plan: ActionPlan,
    result: ExecutionResult
  ): Promise<AgentObservation> {
    logger.debug('Agent observing', { planId: plan.id, success: result.success });

    const observationId = `obs_${Date.now()}`;
    const lastStep = plan.steps[plan.steps.length - 1];
    const lastResult = result.results.get(lastStep?.id);

    let analysis = '';
    let isExpected = result.success;
    let nextAction = result.success ? 'complete' : 'retry';

    // Use LLM for result analysis
    try {
      const prompt = REFLECTION_PROMPT
        .replace('{{goal}}', plan.query)
        .replace('{{step}}', lastStep?.description || 'Unknown step')
        .replace('{{result}}', JSON.stringify(lastResult?.data || 'No data').slice(0, 1000))
        .replace('{{success}}', String(result.success));

      const response = await this.llm.chat([
        { role: 'system', content: 'You are an agent analyzing execution results. Respond with valid JSON.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.2, maxTokens: 300 });

      const jsonStr = extractJSON(response.content);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        analysis = parsed.analysis || '';
        isExpected = parsed.isExpected ?? result.success;
        nextAction = parsed.nextAction || 'continue';
      }

    } catch (error) {
      logger.warn('Observation phase LLM call failed', { error });
      analysis = result.success 
        ? 'Execution completed successfully.' 
        : `Execution failed: ${result.errors.join(', ')}`;
    }

    const observation: AgentObservation = {
      id: observationId,
      stepId: lastStep?.id || 'unknown',
      result: lastResult || { 
        success: false, 
        data: null, 
        metadata: { 
          executionTime: 0, 
          tool: 'unknown', 
          stepId: 'unknown', 
          timestamp: new Date() 
        } 
      },
      analysis,
      isExpected,
      nextAction,
      timestamp: new Date(),
    };

    // Store in memory
    this.memory.addObservation(
      observationId,
      result.success ? 'success' : 'failure',
      analysis,
      { success: result.success, errors: result.errors }
    );

    this.emit('observation', observation);
    return observation;
  }

  /**
   * CORRECT phase - Self-correction when things go wrong
   */
  private async correct(
    plan: ActionPlan,
    result: ExecutionResult,
    observation: AgentObservation
  ): Promise<boolean> {
    const correctionCount = this.corrections.length;
    
    if (correctionCount >= this.config.maxCorrections!) {
      logger.warn('Max corrections reached, stopping');
      return false;
    }

    logger.debug('Agent self-correcting', { 
      attempt: correctionCount + 1, 
      maxAttempts: this.config.maxCorrections 
    });

    const failedSteps = plan.steps.filter(s => {
      const stepResult = result.results.get(s.id);
      return !stepResult || !stepResult.success;
    });

    const failedStep = failedSteps[0];
    const error = result.errors[0] || 'Unknown error';
    const previousStrategy = this.corrections[correctionCount - 1]?.strategy;

    // Determine recovery strategy
    let strategy: RecoveryStrategy = RecoveryStrategy.RETRY;
    let alternativeApproach: string | undefined;

    try {
      const prompt = CORRECTION_PROMPT
        .replace('{{goal}}', plan.query)
        .replace('{{step}}', failedStep?.description || 'Unknown step')
        .replace('{{error}}', error)
        .replace('{{attempt}}', String(correctionCount + 1))
        .replace('{{maxAttempts}}', String(this.config.maxCorrections))
        .replace('{{previousStrategy}}', previousStrategy || 'none');

      const response = await this.llm.chat([
        { role: 'system', content: 'You are an agent determining recovery strategy. Respond with valid JSON.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.3, maxTokens: 300 });

      const jsonStr = extractJSON(response.content);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        strategy = this.validateStrategy(parsed.strategy);
        alternativeApproach = parsed.alternativeApproach;
        
        if (parsed.isCritical && strategy !== RecoveryStrategy.ABORT) {
          strategy = RecoveryStrategy.ABORT;
        }
      }

    } catch (error) {
      logger.warn('Correction phase LLM call failed', { error });
      // Default to retry for first attempt, abort after that
      strategy = correctionCount === 0 ? RecoveryStrategy.RETRY : RecoveryStrategy.ABORT;
    }

    const correction: CorrectionContext = {
      error,
      failedStep: failedStep?.id || 'unknown',
      attempt: correctionCount + 1,
      maxAttempts: this.config.maxCorrections!,
      strategy,
      alternativeApproach,
    };

    this.corrections.push(correction);
    this.emit('correction', correction);

    // Apply the strategy
    switch (strategy) {
      case RecoveryStrategy.RETRY:
        logger.info('Retrying failed step');
        return true;

      case RecoveryStrategy.ALTERNATIVE:
        logger.info('Trying alternative approach', { approach: alternativeApproach });
        // In a full implementation, we would modify the plan here
        return true;

      case RecoveryStrategy.SKIP:
        logger.info('Skipping failed step');
        return true;

      case RecoveryStrategy.BACKTRACK:
        logger.info('Backtracking to previous step');
        return true;

      case RecoveryStrategy.ABORT:
      default:
        logger.info('Aborting execution');
        return false;
    }
  }

  /**
   * SYNTHESIZE - Create final answer for the user
   */
  private async synthesize(
    query: string,
    intent: ParsedIntent,
    result: ExecutionResult
  ): Promise<string> {
    logger.debug('Agent synthesizing response');

    try {
      const prompt = SYNTHESIS_PROMPT
        .replace('{{query}}', query)
        .replace('{{intent}}', intent.intent)
        .replace('{{stepsCompleted}}', String(result.stepsCompleted))
        .replace('{{stepsFailed}}', String(result.stepsFailed))
        .replace('{{data}}', JSON.stringify(result.finalOutput || {}).slice(0, 2000));

      const response = await this.llm.chat([
        { role: 'system', content: 'You are a helpful assistant creating clear, informative responses.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.5, maxTokens: 500 });

      return response.content;

    } catch (error) {
      logger.warn('Synthesis phase LLM call failed', { error });
      
      if (result.success) {
        return `I completed your request: "${query}"\n\nResults have been processed successfully.`;
      } else {
        return `I attempted to process: "${query}"\n\nUnfortunately, I encountered some issues: ${result.errors.join(', ')}`;
      }
    }
  }

  /**
   * LEARN - Record patterns from this interaction
   */
  private async learn(
    query: string,
    plan: ActionPlan,
    result: ExecutionResult
  ): Promise<void> {
    logger.debug('Agent learning from interaction');

    const tools = plan.steps.map(s => s.tool);

    if (result.success) {
      this.memory.recordSuccess(query, plan.intent, tools);
    } else {
      this.memory.recordFailure(query, plan.intent, tools);
    }
  }

  /**
   * Validate recovery strategy
   */
  private validateStrategy(strategy: string): RecoveryStrategy {
    const valid = Object.values(RecoveryStrategy) as string[];
    return valid.includes(strategy) 
      ? (strategy as RecoveryStrategy) 
      : RecoveryStrategy.ABORT;
  }

  /**
   * Get the tool registry
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: Parameters<ToolRegistry['register']>[0]): void {
    this.registry.register(tool);
  }

  /**
   * Get agent statistics
   */
  getStats(): {
    state: AgentState;
    thoughtsCount: number;
    observationsCount: number;
    correctionsCount: number;
    currentIteration: number;
  } {
    return {
      state: this.state,
      thoughtsCount: this.thoughts.length,
      observationsCount: this.observations.length,
      correctionsCount: this.corrections.length,
      currentIteration: this.iteration,
    };
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.setState(AgentState.IDLE);
    this.currentPlan = null;
    this.thoughts = [];
    this.observations = [];
    this.corrections = [];
    this.iteration = 0;
    logger.debug('Agent reset');
  }

  /**
   * Cancel current execution
   */
  cancel(): void {
    this.executor.cancel();
    this.reset();
    logger.info('Agent execution cancelled');
  }
}

/**
 * Singleton instance
 */
let agentInstance: JokerAgent | null = null;

/**
 * Get or create the singleton agent instance
 */
export function getAgent(llm?: LMStudioClient, config?: AgentConfig): JokerAgent {
  if (!agentInstance) {
    if (!llm) {
      throw new Error('LLM client required to create agent');
    }
    agentInstance = new JokerAgent(llm, config);
  }
  return agentInstance;
}

/**
 * Create a new agent instance (not singleton)
 */
export function createAgent(llm: LMStudioClient, config?: AgentConfig): JokerAgent {
  return new JokerAgent(llm, config);
}

export default JokerAgent;

/**
 * The Joker - Agentic Terminal
 * Agent Memory System
 * 
 * Manages context, conversation history, and persistent memory
 * for the autonomous agent
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ActionPlan, ParsedIntent } from './planner';
import { ToolResult } from './executor';

/**
 * Message in conversation history
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Thought during agent reasoning
 */
export interface Thought {
  id: string;
  content: string;
  type: 'analysis' | 'plan' | 'observation' | 'conclusion';
  timestamp: Date;
}

/**
 * Observation from action execution
 */
export interface Observation {
  stepId: string;
  result: 'success' | 'failure' | 'partial';
  summary: string;
  details?: unknown;
  timestamp: Date;
}

/**
 * Session context
 */
export interface SessionContext {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  messages: Message[];
  currentPlan?: ActionPlan;
  currentIntent?: ParsedIntent;
  stepResults: Map<string, ToolResult>;
  thoughts: Thought[];
  observations: Observation[];
  metadata: Record<string, unknown>;
}

/**
 * Working memory during execution
 */
export interface WorkingMemory {
  currentQuery: string;
  currentPlan: ActionPlan | null;
  currentStep: number;
  results: unknown[];
  errors: string[];
}

/**
 * Long-term memory patterns
 */
export interface Pattern {
  id: string;
  query: string;
  intent: string;
  success: boolean;
  steps: string[];
  timestamp: Date;
}

/**
 * Site knowledge for scraping
 */
export interface SiteKnowledge {
  domain: string;
  selectors: Record<string, string>;
  blockedPaths: string[];
  rateLimit: number;
  lastAccess: Date;
  notes?: string;
}

/**
 * Long-term memory storage
 */
export interface LongTermMemory {
  successfulPatterns: Pattern[];
  failedPatterns: Pattern[];
  siteKnowledge: Map<string, SiteKnowledge>;
  preferences: Record<string, unknown>;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  maxMessages?: number;
  maxThoughts?: number;
  maxPatterns?: number;
  persistPath?: string;
  autoSave?: boolean;
  autoSaveInterval?: number;
}

/**
 * Agent Memory Manager
 */
export class AgentMemory {
  private sessions: Map<string, SessionContext>;
  private longTerm: LongTermMemory;
  private config: MemoryConfig;
  private currentSessionId: string | null;
  private autoSaveTimer?: NodeJS.Timeout;

  constructor(config: MemoryConfig = {}) {
    this.sessions = new Map();
    this.currentSessionId = null;
    this.config = {
      maxMessages: config.maxMessages || 100,
      maxThoughts: config.maxThoughts || 50,
      maxPatterns: config.maxPatterns || 100,
      persistPath: config.persistPath || '.joker_memory',
      autoSave: config.autoSave ?? true,
      autoSaveInterval: config.autoSaveInterval || 60000,
    };

    this.longTerm = {
      successfulPatterns: [],
      failedPatterns: [],
      siteKnowledge: new Map(),
      preferences: {},
    };

    // Start auto-save if enabled
    if (this.config.autoSave) {
      this.startAutoSave();
    }

    logger.debug('Memory system initialized', { config: this.config });
  }

  /**
   * Create a new session
   */
  createSession(): string {
    const sessionId = this.generateSessionId();
    const session: SessionContext = {
      sessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      messages: [],
      stepResults: new Map(),
      thoughts: [],
      observations: [],
      metadata: {},
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    logger.info('Session created', { sessionId });

    return sessionId;
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionContext | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionContext | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Set current session
   */
  setCurrentSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      this.currentSessionId = sessionId;
      return true;
    }
    return false;
  }

  /**
   * Add a message to current session
   */
  addMessage(message: Omit<Message, 'timestamp'>): void {
    const session = this.getCurrentSession();
    if (!session) {
      logger.warn('No active session for message');
      return;
    }

    const fullMessage: Message = {
      ...message,
      timestamp: new Date(),
    };

    session.messages.push(fullMessage);
    session.lastActivity = new Date();

    // Trim messages if exceeding limit
    if (session.messages.length > this.config.maxMessages!) {
      session.messages = session.messages.slice(-this.config.maxMessages!);
    }

    logger.debug('Message added', { role: message.role, sessionId: session.sessionId });
  }

  /**
   * Get conversation history for current session
   */
  getMessages(limit?: number): Message[] {
    const session = this.getCurrentSession();
    if (!session) return [];

    const messages = session.messages;
    if (limit && limit < messages.length) {
      return messages.slice(-limit);
    }
    return [...messages];
  }

  /**
   * Add a thought to current session
   */
  addThought(content: string, type: Thought['type']): Thought {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    const thought: Thought = {
      id: this.generateId('thought'),
      content,
      type,
      timestamp: new Date(),
    };

    session.thoughts.push(thought);

    // Trim thoughts if exceeding limit
    if (session.thoughts.length > this.config.maxThoughts!) {
      session.thoughts = session.thoughts.slice(-this.config.maxThoughts!);
    }

    logger.debug('Thought added', { type, id: thought.id });
    return thought;
  }

  /**
   * Add an observation to current session
   */
  addObservation(
    stepId: string,
    result: Observation['result'],
    summary: string,
    details?: unknown
  ): Observation {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    const observation: Observation = {
      stepId,
      result,
      summary,
      details,
      timestamp: new Date(),
    };

    session.observations.push(observation);
    logger.debug('Observation added', { stepId, result });

    return observation;
  }

  /**
   * Store current plan in session
   */
  setCurrentPlan(plan: ActionPlan): void {
    const session = this.getCurrentSession();
    if (!session) {
      logger.warn('No active session for plan');
      return;
    }

    session.currentPlan = plan;
    session.lastActivity = new Date();
    logger.debug('Plan stored in session', { planId: plan.id });
  }

  /**
   * Store current intent in session
   */
  setCurrentIntent(intent: ParsedIntent): void {
    const session = this.getCurrentSession();
    if (!session) {
      logger.warn('No active session for intent');
      return;
    }

    session.currentIntent = intent;
    session.lastActivity = new Date();
  }

  /**
   * Store step result
   */
  setStepResult(stepId: string, result: ToolResult): void {
    const session = this.getCurrentSession();
    if (!session) return;

    session.stepResults.set(stepId, result);
    session.lastActivity = new Date();
  }

  /**
   * Get step result
   */
  getStepResult(stepId: string): ToolResult | undefined {
    const session = this.getCurrentSession();
    if (!session) return undefined;

    return session.stepResults.get(stepId);
  }

  /**
   * Get all step results
   */
  getAllStepResults(): Map<string, ToolResult> {
    const session = this.getCurrentSession();
    if (!session) return new Map();

    return new Map(session.stepResults);
  }

  /**
   * Record a successful pattern
   */
  recordSuccess(query: string, intent: string, steps: string[]): void {
    const pattern: Pattern = {
      id: this.generateId('pattern'),
      query,
      intent,
      success: true,
      steps,
      timestamp: new Date(),
    };

    this.longTerm.successfulPatterns.push(pattern);

    // Trim patterns if exceeding limit
    if (this.longTerm.successfulPatterns.length > this.config.maxPatterns!) {
      this.longTerm.successfulPatterns = this.longTerm.successfulPatterns.slice(-this.config.maxPatterns!);
    }

    logger.debug('Success pattern recorded', { intent });
  }

  /**
   * Record a failed pattern
   */
  recordFailure(query: string, intent: string, steps: string[]): void {
    const pattern: Pattern = {
      id: this.generateId('pattern'),
      query,
      intent,
      success: false,
      steps,
      timestamp: new Date(),
    };

    this.longTerm.failedPatterns.push(pattern);

    // Trim patterns if exceeding limit
    if (this.longTerm.failedPatterns.length > this.config.maxPatterns!) {
      this.longTerm.failedPatterns = this.longTerm.failedPatterns.slice(-this.config.maxPatterns!);
    }

    logger.debug('Failure pattern recorded', { intent });
  }

  /**
   * Find similar successful patterns
   */
  findSimilarPatterns(query: string, limit: number = 5): Pattern[] {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/);

    return this.longTerm.successfulPatterns
      .filter(pattern => {
        const patternLower = pattern.query.toLowerCase();
        return words.some(word => patternLower.includes(word));
      })
      .slice(-limit);
  }

  /**
   * Store site knowledge
   */
  setSiteKnowledge(domain: string, knowledge: Partial<SiteKnowledge>): void {
    const existing = this.longTerm.siteKnowledge.get(domain);
    const updated: SiteKnowledge = {
      domain,
      selectors: knowledge.selectors || existing?.selectors || {},
      blockedPaths: knowledge.blockedPaths || existing?.blockedPaths || [],
      rateLimit: knowledge.rateLimit ?? existing?.rateLimit ?? 1000,
      lastAccess: new Date(),
      notes: knowledge.notes || existing?.notes,
    };

    this.longTerm.siteKnowledge.set(domain, updated);
    logger.debug('Site knowledge updated', { domain });
  }

  /**
   * Get site knowledge
   */
  getSiteKnowledge(domain: string): SiteKnowledge | undefined {
    return this.longTerm.siteKnowledge.get(domain);
  }

  /**
   * Set a preference
   */
  setPreference(key: string, value: unknown): void {
    this.longTerm.preferences[key] = value;
  }

  /**
   * Get a preference
   */
  getPreference<T>(key: string, defaultValue?: T): T | undefined {
    return (this.longTerm.preferences[key] as T) ?? defaultValue;
  }

  /**
   * Clear current session
   */
  clearSession(): void {
    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId);
      if (session) {
        session.messages = [];
        session.thoughts = [];
        session.observations = [];
        session.stepResults.clear();
        session.currentPlan = undefined;
        session.currentIntent = undefined;
        logger.info('Session cleared', { sessionId: this.currentSessionId });
      }
    }
  }

  /**
   * End current session
   */
  endSession(): void {
    if (this.currentSessionId) {
      this.sessions.delete(this.currentSessionId);
      logger.info('Session ended', { sessionId: this.currentSessionId });
      this.currentSessionId = null;
    }
  }

  /**
   * Get session summary
   */
  getSessionSummary(): Record<string, unknown> {
    const session = this.getCurrentSession();
    if (!session) {
      return { active: false };
    }

    return {
      active: true,
      sessionId: session.sessionId,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      messageCount: session.messages.length,
      thoughtCount: session.thoughts.length,
      observationCount: session.observations.length,
      hasActivePlan: !!session.currentPlan,
    };
  }

  /**
   * Persist memory to disk
   */
  async persist(): Promise<void> {
    try {
      const persistPath = this.config.persistPath!;
      
      // Ensure directory exists
      if (!fs.existsSync(persistPath)) {
        fs.mkdirSync(persistPath, { recursive: true });
      }

      // Save long-term memory
      const longTermData = {
        successfulPatterns: this.longTerm.successfulPatterns,
        failedPatterns: this.longTerm.failedPatterns,
        siteKnowledge: Array.from(this.longTerm.siteKnowledge.entries()),
        preferences: this.longTerm.preferences,
      };

      fs.writeFileSync(
        path.join(persistPath, 'long_term.json'),
        JSON.stringify(longTermData, null, 2)
      );

      logger.debug('Memory persisted to disk');
    } catch (error) {
      logger.error('Failed to persist memory', { error });
    }
  }

  /**
   * Restore memory from disk
   */
  async restore(): Promise<void> {
    try {
      const persistPath = this.config.persistPath!;
      const filePath = path.join(persistPath, 'long_term.json');

      if (!fs.existsSync(filePath)) {
        logger.debug('No persisted memory found');
        return;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      this.longTerm.successfulPatterns = data.successfulPatterns || [];
      this.longTerm.failedPatterns = data.failedPatterns || [];
      this.longTerm.preferences = data.preferences || {};

      if (data.siteKnowledge) {
        this.longTerm.siteKnowledge = new Map(data.siteKnowledge);
      }

      logger.info('Memory restored from disk', {
        patterns: this.longTerm.successfulPatterns.length,
        sites: this.longTerm.siteKnowledge.size,
      });
    } catch (error) {
      logger.error('Failed to restore memory', { error });
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.persist().catch(err => logger.error('Auto-save failed', { error: err }));
    }, this.config.autoSaveInterval!);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique ID with prefix
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Get memory statistics
   */
  getStats(): Record<string, number> {
    return {
      activeSessions: this.sessions.size,
      successfulPatterns: this.longTerm.successfulPatterns.length,
      failedPatterns: this.longTerm.failedPatterns.length,
      knownSites: this.longTerm.siteKnowledge.size,
      preferences: Object.keys(this.longTerm.preferences).length,
    };
  }

  /**
   * Cleanup old sessions and data
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity.getTime() < cutoff) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned old sessions', { count: cleaned });
    }
  }
}

// Singleton instance
let memoryInstance: AgentMemory | null = null;

/**
 * Get or create the global memory instance
 */
export function getMemory(config?: MemoryConfig): AgentMemory {
  if (!memoryInstance) {
    memoryInstance = new AgentMemory(config);
  }
  return memoryInstance;
}

export default AgentMemory;

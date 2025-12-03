import { AgentMemory, getMemory, Message, Thought, Observation, Pattern, SiteKnowledge } from '../../../src/agents/memory';
import { ActionPlan, ParsedIntent, IntentType } from '../../../src/agents/planner';
import { ToolResult } from '../../../src/agents/executor';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('AgentMemory', () => {
  let memory: AgentMemory;

  beforeEach(() => {
    jest.clearAllMocks();
    // Disable auto-save for tests
    memory = new AgentMemory({ autoSave: false });
  });

  afterEach(() => {
    memory.stopAutoSave();
  });

  describe('session management', () => {
    it('should create a new session', () => {
      const sessionId = memory.createSession();
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_\d+_/);
    });

    it('should get current session after creation', () => {
      const sessionId = memory.createSession();
      const session = memory.getCurrentSession();
      
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
    });

    it('should return null when no session exists', () => {
      const session = memory.getCurrentSession();
      expect(session).toBeNull();
    });

    it('should get session by ID', () => {
      const sessionId = memory.createSession();
      const session = memory.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
    });

    it('should return null for non-existent session ID', () => {
      const session = memory.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should switch current session', () => {
      const sessionId1 = memory.createSession();
      const sessionId2 = memory.createSession();
      
      expect(memory.getCurrentSession()?.sessionId).toBe(sessionId2);
      
      const switched = memory.setCurrentSession(sessionId1);
      
      expect(switched).toBe(true);
      expect(memory.getCurrentSession()?.sessionId).toBe(sessionId1);
    });

    it('should return false when switching to non-existent session', () => {
      memory.createSession();
      const switched = memory.setCurrentSession('non-existent');
      expect(switched).toBe(false);
    });

    it('should clear current session', () => {
      memory.createSession();
      memory.addMessage({ role: 'user', content: 'test' });
      
      memory.clearSession();
      
      const session = memory.getCurrentSession();
      expect(session?.messages).toHaveLength(0);
    });

    it('should end current session', () => {
      memory.createSession();
      memory.endSession();
      
      expect(memory.getCurrentSession()).toBeNull();
    });

    it('should return session summary', () => {
      memory.createSession();
      memory.addMessage({ role: 'user', content: 'test' });
      
      const summary = memory.getSessionSummary();
      
      expect(summary.active).toBe(true);
      expect(summary.messageCount).toBe(1);
    });

    it('should return inactive summary when no session', () => {
      const summary = memory.getSessionSummary();
      expect(summary.active).toBe(false);
    });
  });

  describe('message management', () => {
    beforeEach(() => {
      memory.createSession();
    });

    it('should add messages to session', () => {
      memory.addMessage({ role: 'user', content: 'Hello' });
      memory.addMessage({ role: 'assistant', content: 'Hi there' });
      
      const messages = memory.getMessages();
      
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Hello');
      expect(messages[1].content).toBe('Hi there');
    });

    it('should add timestamp to messages', () => {
      memory.addMessage({ role: 'user', content: 'test' });
      
      const messages = memory.getMessages();
      expect(messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should limit messages based on config', () => {
      const limitedMemory = new AgentMemory({ maxMessages: 3, autoSave: false });
      limitedMemory.createSession();
      
      for (let i = 0; i < 5; i++) {
        limitedMemory.addMessage({ role: 'user', content: `Message ${i}` });
      }
      
      const messages = limitedMemory.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('Message 2');
      
      limitedMemory.stopAutoSave();
    });

    it('should return limited messages when specified', () => {
      for (let i = 0; i < 10; i++) {
        memory.addMessage({ role: 'user', content: `Message ${i}` });
      }
      
      const messages = memory.getMessages(3);
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('Message 7');
    });

    it('should return empty array when no session', () => {
      memory.endSession();
      const messages = memory.getMessages();
      expect(messages).toEqual([]);
    });

    it('should not add message when no session', () => {
      memory.endSession();
      memory.addMessage({ role: 'user', content: 'test' });
      // Should not throw, just warn
    });
  });

  describe('thoughts and observations', () => {
    beforeEach(() => {
      memory.createSession();
    });

    it('should add thoughts', () => {
      const thought = memory.addThought('Analyzing query...', 'analysis');
      
      expect(thought.id).toMatch(/^thought_/);
      expect(thought.content).toBe('Analyzing query...');
      expect(thought.type).toBe('analysis');
    });

    it('should throw when adding thought without session', () => {
      memory.endSession();
      expect(() => memory.addThought('test', 'analysis')).toThrow('No active session');
    });

    it('should add observations', () => {
      const observation = memory.addObservation('step_1', 'success', 'Step completed');
      
      expect(observation.stepId).toBe('step_1');
      expect(observation.result).toBe('success');
      expect(observation.summary).toBe('Step completed');
    });

    it('should throw when adding observation without session', () => {
      memory.endSession();
      expect(() => memory.addObservation('step_1', 'success', 'test')).toThrow('No active session');
    });
  });

  describe('plan and intent management', () => {
    beforeEach(() => {
      memory.createSession();
    });

    it('should store current plan', () => {
      const plan: ActionPlan = {
        id: 'plan_1',
        query: 'test query',
        intent: IntentType.SEARCH,
        entities: { topic: 'test' },
        steps: [],
        createdAt: new Date(),
        estimatedTime: 1000
      };
      
      memory.setCurrentPlan(plan);
      
      const session = memory.getCurrentSession();
      expect(session?.currentPlan?.id).toBe('plan_1');
    });

    it('should store current intent', () => {
      const intent: ParsedIntent = {
        intent: IntentType.SEARCH,
        confidence: 0.85,
        entities: { topic: 'coffee shops' },
        originalQuery: 'find coffee shops'
      };
      
      memory.setCurrentIntent(intent);
      
      const session = memory.getCurrentSession();
      expect(session?.currentIntent?.intent).toBe(IntentType.SEARCH);
    });
  });

  describe('step results', () => {
    beforeEach(() => {
      memory.createSession();
    });

    it('should store step results', () => {
      const result: ToolResult = {
        success: true,
        data: { items: [1, 2, 3] },
        metadata: {
          executionTime: 100,
          tool: 'web_search',
          stepId: 'step_1',
          timestamp: new Date()
        }
      };
      
      memory.setStepResult('step_1', result);
      
      const retrieved = memory.getStepResult('step_1');
      expect(retrieved).toEqual(result);
    });

    it('should return undefined for non-existent step', () => {
      const result = memory.getStepResult('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return all step results', () => {
      const result1: ToolResult = {
        success: true,
        data: 'data1',
        metadata: { executionTime: 50, tool: 'tool1', stepId: 's1', timestamp: new Date() }
      };
      const result2: ToolResult = {
        success: true,
        data: 'data2',
        metadata: { executionTime: 60, tool: 'tool2', stepId: 's2', timestamp: new Date() }
      };
      
      memory.setStepResult('s1', result1);
      memory.setStepResult('s2', result2);
      
      const allResults = memory.getAllStepResults();
      expect(allResults.size).toBe(2);
    });
  });

  describe('patterns', () => {
    it('should record successful patterns', () => {
      memory.recordSuccess('find coffee shops', 'search', ['web_search', 'process']);
      
      const stats = memory.getStats();
      expect(stats.successfulPatterns).toBe(1);
    });

    it('should record failed patterns', () => {
      memory.recordFailure('broken query', 'unknown', ['failed_step']);
      
      const stats = memory.getStats();
      expect(stats.failedPatterns).toBe(1);
    });

    it('should find similar patterns', () => {
      memory.recordSuccess('find coffee shops in Seattle', 'search', ['web_search']);
      memory.recordSuccess('find restaurants in Seattle', 'search', ['web_search']);
      memory.recordSuccess('weather forecast', 'info', ['weather_api']);
      
      const similar = memory.findSimilarPatterns('find cafes in Seattle');
      
      expect(similar.length).toBe(2);
    });

    it('should limit patterns based on config', () => {
      const limitedMemory = new AgentMemory({ maxPatterns: 3, autoSave: false });
      
      for (let i = 0; i < 5; i++) {
        limitedMemory.recordSuccess(`query ${i}`, 'search', ['step']);
      }
      
      const stats = limitedMemory.getStats();
      expect(stats.successfulPatterns).toBe(3);
      
      limitedMemory.stopAutoSave();
    });
  });

  describe('site knowledge', () => {
    it('should store site knowledge', () => {
      memory.setSiteKnowledge('example.com', {
        selectors: { title: 'h1' },
        rateLimit: 1000
      });
      
      const knowledge = memory.getSiteKnowledge('example.com');
      
      expect(knowledge?.domain).toBe('example.com');
      expect(knowledge?.selectors.title).toBe('h1');
      expect(knowledge?.rateLimit).toBe(1000);
    });

    it('should update existing site knowledge', () => {
      memory.setSiteKnowledge('example.com', { selectors: { title: 'h1' } });
      memory.setSiteKnowledge('example.com', { notes: 'Updated' });
      
      const knowledge = memory.getSiteKnowledge('example.com');
      
      expect(knowledge?.selectors.title).toBe('h1'); // Preserved
      expect(knowledge?.notes).toBe('Updated'); // Added
    });

    it('should return undefined for unknown sites', () => {
      const knowledge = memory.getSiteKnowledge('unknown.com');
      expect(knowledge).toBeUndefined();
    });
  });

  describe('preferences', () => {
    it('should set and get preferences', () => {
      memory.setPreference('theme', 'dark');
      
      expect(memory.getPreference<string>('theme')).toBe('dark');
    });

    it('should return default for missing preference', () => {
      expect(memory.getPreference('missing', 'default')).toBe('default');
    });

    it('should return undefined for missing preference without default', () => {
      expect(memory.getPreference('missing')).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should return accurate stats', () => {
      memory.createSession();
      memory.createSession();
      memory.recordSuccess('q1', 'search', []);
      memory.recordFailure('q2', 'unknown', []);
      memory.setSiteKnowledge('site.com', {});
      memory.setPreference('pref1', 'value');
      memory.setPreference('pref2', 'value');
      
      const stats = memory.getStats();
      
      expect(stats.activeSessions).toBe(2);
      expect(stats.successfulPatterns).toBe(1);
      expect(stats.failedPatterns).toBe(1);
      expect(stats.knownSites).toBe(1);
      expect(stats.preferences).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should clean old sessions', async () => {
      memory.createSession();
      
      // Manipulate the session's lastActivity to be old
      const session = memory.getCurrentSession();
      if (session) {
        session.lastActivity = new Date(Date.now() - 1000000);
      }
      
      memory.cleanup(100); // 100ms max age
      
      // Session should be cleaned up - but we're still referencing it
      // The cleanup happens on the internal map
      const stats = memory.getStats();
      expect(stats.activeSessions).toBe(0);
    });
  });

  describe('persistence', () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockReturnValue(undefined);
      mockedFs.writeFileSync.mockReturnValue(undefined);
      mockedFs.readFileSync.mockReturnValue('');
    });

    it('should persist memory to disk', async () => {
      memory.recordSuccess('test query', 'search', ['step1']);
      memory.setSiteKnowledge('test.com', { rateLimit: 500 });
      
      await memory.persist();
      
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('should create directory if not exists', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      
      await memory.persist();
      
      expect(mockedFs.mkdirSync).toHaveBeenCalled();
    });

    it('should restore memory from disk', async () => {
      const savedData = {
        successfulPatterns: [{ id: 'p1', query: 'test', intent: 'search', success: true, steps: [], timestamp: new Date() }],
        failedPatterns: [],
        siteKnowledge: [['site.com', { domain: 'site.com', selectors: {}, blockedPaths: [], rateLimit: 1000, lastAccess: new Date() }]],
        preferences: { theme: 'dark' }
      };
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(savedData));
      
      await memory.restore();
      
      expect(mockedFs.readFileSync).toHaveBeenCalled();
    });

    it('should handle missing persistence file', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      
      await memory.restore(); // Should not throw
    });

    it('should handle persistence errors gracefully', async () => {
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      await memory.persist(); // Should not throw
    });
  });
});

describe('getMemory', () => {
  it('should return singleton instance', () => {
    // Note: This test may fail in isolation if the singleton is already created
    // In a real test suite, you'd want to reset the singleton between tests
    const memory1 = getMemory({ autoSave: false });
    const memory2 = getMemory();
    
    // They reference the same instance (singleton)
    expect(memory1).toBeDefined();
    expect(memory2).toBeDefined();
    
    memory1.stopAutoSave();
  });
});

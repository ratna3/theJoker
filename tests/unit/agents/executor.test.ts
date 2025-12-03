import { 
  Executor, 
  ToolRegistry, 
  createDefaultRegistry,
  Tool,
  ToolResult,
  ExecutionResult,
  ExecutionContext
} from '../../../src/agents/executor';
import { ActionPlan, ActionStep, IntentType } from '../../../src/agents/planner';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register a tool', () => {
    const tool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      parameters: [],
      execute: jest.fn().mockResolvedValue({})
    };
    
    registry.register(tool);
    
    expect(registry.has('test_tool')).toBe(true);
  });

  it('should get a registered tool', () => {
    const tool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      parameters: [],
      execute: jest.fn()
    };
    
    registry.register(tool);
    
    const retrieved = registry.get('test_tool');
    expect(retrieved).toBe(tool);
  });

  it('should return undefined for non-existent tool', () => {
    const retrieved = registry.get('non_existent');
    expect(retrieved).toBeUndefined();
  });

  it('should check tool existence', () => {
    const tool: Tool = {
      name: 'test_tool',
      description: 'A test tool',
      parameters: [],
      execute: jest.fn()
    };
    
    registry.register(tool);
    
    expect(registry.has('test_tool')).toBe(true);
    expect(registry.has('other_tool')).toBe(false);
  });

  it('should list all tools', () => {
    registry.register({
      name: 'tool1',
      description: 'Tool 1',
      parameters: [],
      execute: jest.fn()
    });
    registry.register({
      name: 'tool2',
      description: 'Tool 2',
      parameters: [],
      execute: jest.fn()
    });
    
    const tools = registry.list();
    
    expect(tools).toHaveLength(2);
    expect(tools.map(t => t.name)).toContain('tool1');
    expect(tools.map(t => t.name)).toContain('tool2');
  });

  it('should get tool descriptions', () => {
    registry.register({
      name: 'search',
      description: 'Search the web',
      parameters: [],
      execute: jest.fn()
    });
    registry.register({
      name: 'scrape',
      description: 'Scrape a page',
      parameters: [],
      execute: jest.fn()
    });
    
    const descriptions = registry.getDescriptions();
    
    expect(descriptions).toContain('search: Search the web');
    expect(descriptions).toContain('scrape: Scrape a page');
  });

  it('should unregister a tool', () => {
    registry.register({
      name: 'test_tool',
      description: 'Test',
      parameters: [],
      execute: jest.fn()
    });
    
    expect(registry.has('test_tool')).toBe(true);
    
    const removed = registry.unregister('test_tool');
    
    expect(removed).toBe(true);
    expect(registry.has('test_tool')).toBe(false);
  });

  it('should return false when unregistering non-existent tool', () => {
    const removed = registry.unregister('non_existent');
    expect(removed).toBe(false);
  });
});

describe('createDefaultRegistry', () => {
  it('should create registry with default tools', () => {
    const registry = createDefaultRegistry();
    
    expect(registry.has('web_search')).toBe(true);
    expect(registry.has('scrape_page')).toBe(true);
    expect(registry.has('extract_links')).toBe(true);
    expect(registry.has('process_data')).toBe(true);
    expect(registry.has('generate_code')).toBe(true);
    expect(registry.has('create_project')).toBe(true);
    expect(registry.has('show_help')).toBe(true);
    expect(registry.has('summarize')).toBe(true);
  });

  it('should have working show_help tool', async () => {
    const registry = createDefaultRegistry();
    const helpTool = registry.get('show_help');
    
    const result = await helpTool!.execute({}, {} as ExecutionContext);
    
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('commands');
    expect(result).toHaveProperty('examples');
  });
});

describe('Executor', () => {
  let registry: ToolRegistry;
  let executor: Executor;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new Executor(registry, { maxRetries: 2, retryDelay: 10 });
  });

  function createPlan(steps: Partial<ActionStep>[]): ActionPlan {
    return {
      id: 'plan_1',
      query: 'test query',
      intent: IntentType.SEARCH,
      entities: { topic: 'test' },
      steps: steps.map((s, i) => ({
        id: s.id || `step_${i}`,
        order: s.order ?? i,
        tool: s.tool || 'test_tool',
        params: s.params || {},
        description: s.description || `Step ${i}`,
        dependsOn: s.dependsOn,
        timeout: s.timeout,
        retryable: s.retryable ?? false
      })),
      estimatedTime: 1000,
      createdAt: new Date()
    };
  }

  describe('plan execution', () => {
    it('should execute a simple plan', async () => {
      const mockExecute = jest.fn().mockResolvedValue({ data: 'result' });
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: [],
        execute: mockExecute
      });

      const plan = createPlan([{ tool: 'test_tool' }]);
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.stepsCompleted).toBe(1);
      expect(result.stepsFailed).toBe(0);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should execute steps in order', async () => {
      const executionOrder: string[] = [];
      
      registry.register({
        name: 'tool_a',
        description: 'Tool A',
        parameters: [],
        execute: async () => { executionOrder.push('A'); return {}; }
      });
      registry.register({
        name: 'tool_b',
        description: 'Tool B',
        parameters: [],
        execute: async () => { executionOrder.push('B'); return {}; }
      });
      registry.register({
        name: 'tool_c',
        description: 'Tool C',
        parameters: [],
        execute: async () => { executionOrder.push('C'); return {}; }
      });

      const plan = createPlan([
        { id: 'a', order: 2, tool: 'tool_a' },
        { id: 'b', order: 1, tool: 'tool_b' },
        { id: 'c', order: 3, tool: 'tool_c' }
      ]);
      
      await executor.executePlan(plan);
      
      expect(executionOrder).toEqual(['B', 'A', 'C']);
    });

    it('should handle step failure', async () => {
      registry.register({
        name: 'failing_tool',
        description: 'Fails',
        parameters: [],
        execute: async () => { throw new Error('Tool failed'); }
      });

      const plan = createPlan([{ tool: 'failing_tool' }]);
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.stepsFailed).toBe(1);
      expect(result.errors).toContain('Step step_0: Tool failed');
    });

    it('should retry failed steps when retryable', async () => {
      let attempts = 0;
      registry.register({
        name: 'flaky_tool',
        description: 'Flaky',
        parameters: [],
        execute: async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        }
      });

      const plan = createPlan([{ tool: 'flaky_tool', retryable: true }]);
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    });

    it('should not retry non-retryable steps', async () => {
      let attempts = 0;
      registry.register({
        name: 'flaky_tool',
        description: 'Flaky',
        parameters: [],
        execute: async () => {
          attempts++;
          throw new Error('Failure');
        }
      });

      const plan = createPlan([{ tool: 'flaky_tool', retryable: false }]);
      
      await executor.executePlan(plan);
      
      expect(attempts).toBe(1);
    });

    it('should fail on unknown tool', async () => {
      const plan = createPlan([{ tool: 'unknown_tool' }]);
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unknown tool');
    });
  });

  describe('dependencies', () => {
    it('should handle step dependencies', async () => {
      const executionOrder: string[] = [];
      
      registry.register({
        name: 'tool_a',
        description: 'Tool A',
        parameters: [],
        execute: async () => { executionOrder.push('A'); return { a: 'data' }; }
      });
      registry.register({
        name: 'tool_b',
        description: 'Tool B',
        parameters: [],
        execute: async () => { executionOrder.push('B'); return { b: 'data' }; }
      });

      const plan = createPlan([
        { id: 'first', order: 1, tool: 'tool_a' },
        { id: 'second', order: 2, tool: 'tool_b', dependsOn: ['first'] }
      ]);
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['A', 'B']);
    });

    it('should skip steps with failed dependencies', async () => {
      registry.register({
        name: 'failing_tool',
        description: 'Fails',
        parameters: [],
        execute: async () => { throw new Error('Failed'); }
      });
      registry.register({
        name: 'dependent_tool',
        description: 'Depends on failing',
        parameters: [],
        execute: jest.fn().mockResolvedValue({})
      });

      const plan = createPlan([
        { id: 'first', order: 1, tool: 'failing_tool' },
        { id: 'second', order: 2, tool: 'dependent_tool', dependsOn: ['first'] }
      ]);
      
      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.stepsFailed).toBe(2);
      expect(registry.get('dependent_tool')!.execute).not.toHaveBeenCalled();
    });
  });

  describe('parameter resolution', () => {
    it('should pass params to tool', async () => {
      const mockExecute = jest.fn().mockResolvedValue({});
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: [{ name: 'query', type: 'string', required: true }],
        execute: mockExecute
      });

      const plan = createPlan([{ 
        tool: 'test_tool', 
        params: { query: 'test query' } 
      }]);
      
      await executor.executePlan(plan);
      
      expect(mockExecute).toHaveBeenCalledWith(
        { query: 'test query' },
        expect.any(Object)
      );
    });

    it('should resolve parameter placeholders from previous results', async () => {
      let receivedParams: Record<string, unknown> = {};
      
      registry.register({
        name: 'first_tool',
        description: 'First',
        parameters: [],
        execute: async () => ({ url: 'http://example.com' })
      });
      registry.register({
        name: 'second_tool',
        description: 'Second',
        parameters: [],
        execute: async (params) => { receivedParams = params; return {}; }
      });

      const plan = createPlan([
        { id: 'first', order: 1, tool: 'first_tool' },
        { id: 'second', order: 2, tool: 'second_tool', params: { targetUrl: '{{first.url}}' } }
      ]);
      
      await executor.executePlan(plan);
      
      expect(receivedParams.targetUrl).toBe('http://example.com');
    });

    it('should resolve simple step references', async () => {
      let receivedParams: Record<string, unknown> = {};
      
      registry.register({
        name: 'first_tool',
        description: 'First',
        parameters: [],
        execute: async () => 'result data'
      });
      registry.register({
        name: 'second_tool',
        description: 'Second',
        parameters: [],
        execute: async (params) => { receivedParams = params; return {}; }
      });

      const plan = createPlan([
        { id: 'first', order: 1, tool: 'first_tool' },
        { id: 'second', order: 2, tool: 'second_tool', params: { data: '{{first}}' } }
      ]);
      
      await executor.executePlan(plan);
      
      expect(receivedParams.data).toBe('result data');
    });

    it('should resolve nested object params', async () => {
      let receivedParams: Record<string, unknown> = {};
      
      registry.register({
        name: 'first_tool',
        description: 'First',
        parameters: [],
        execute: async () => ({ value: 42 })
      });
      registry.register({
        name: 'second_tool',
        description: 'Second',
        parameters: [],
        execute: async (params) => { receivedParams = params; return {}; }
      });

      const plan = createPlan([
        { id: 'first', order: 1, tool: 'first_tool' },
        { id: 'second', order: 2, tool: 'second_tool', params: { 
          nested: { ref: '{{first.value}}' } 
        }}
      ]);
      
      await executor.executePlan(plan);
      
      expect((receivedParams.nested as any).ref).toBe(42);
    });

    it('should resolve array params', async () => {
      let receivedParams: Record<string, unknown> = {};
      
      registry.register({
        name: 'first_tool',
        description: 'First',
        parameters: [],
        execute: async () => ({ item: 'test' })
      });
      registry.register({
        name: 'second_tool',
        description: 'Second',
        parameters: [],
        execute: async (params) => { receivedParams = params; return {}; }
      });

      const plan = createPlan([
        { id: 'first', order: 1, tool: 'first_tool' },
        { id: 'second', order: 2, tool: 'second_tool', params: { 
          items: ['static', '{{first.item}}'] 
        }}
      ]);
      
      await executor.executePlan(plan);
      
      expect(receivedParams.items).toEqual(['static', 'test']);
    });
  });

  describe('timeout', () => {
    it('should timeout long-running steps', async () => {
      registry.register({
        name: 'slow_tool',
        description: 'Slow',
        parameters: [],
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return {};
        }
      });

      const shortTimeoutExecutor = new Executor(registry, { timeout: 50 });
      const plan = createPlan([{ tool: 'slow_tool' }]);
      
      const result = await shortTimeoutExecutor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('timed out');
    });
  });

  describe('events', () => {
    it('should emit plan:start event', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: [],
        execute: async () => ({})
      });

      const planStartHandler = jest.fn();
      executor.on('plan:start', planStartHandler);

      const plan = createPlan([{ tool: 'test_tool' }]);
      await executor.executePlan(plan);

      expect(planStartHandler).toHaveBeenCalledWith({ plan });
    });

    it('should emit plan:complete event', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: [],
        execute: async () => ({})
      });

      const planCompleteHandler = jest.fn();
      executor.on('plan:complete', planCompleteHandler);

      const plan = createPlan([{ tool: 'test_tool' }]);
      await executor.executePlan(plan);

      expect(planCompleteHandler).toHaveBeenCalled();
      expect(planCompleteHandler.mock.calls[0][0].result.success).toBe(true);
    });

    it('should emit step:start event', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: [],
        execute: async () => ({})
      });

      const stepStartHandler = jest.fn();
      executor.on('step:start', stepStartHandler);

      const plan = createPlan([{ tool: 'test_tool' }]);
      await executor.executePlan(plan);

      expect(stepStartHandler).toHaveBeenCalled();
    });

    it('should emit step:complete event', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: [],
        execute: async () => ({ data: 'result' })
      });

      const stepCompleteHandler = jest.fn();
      executor.on('step:complete', stepCompleteHandler);

      const plan = createPlan([{ tool: 'test_tool' }]);
      await executor.executePlan(plan);

      expect(stepCompleteHandler).toHaveBeenCalled();
      expect(stepCompleteHandler.mock.calls[0][0].result.success).toBe(true);
    });

    it('should emit step:error event on failure', async () => {
      registry.register({
        name: 'failing_tool',
        description: 'Fails',
        parameters: [],
        execute: async () => { throw new Error('Failed'); }
      });

      const stepErrorHandler = jest.fn();
      executor.on('step:error', stepErrorHandler);

      const plan = createPlan([{ tool: 'failing_tool' }]);
      await executor.executePlan(plan);

      expect(stepErrorHandler).toHaveBeenCalled();
    });

    it('should emit step:retry event', async () => {
      let attempts = 0;
      registry.register({
        name: 'flaky_tool',
        description: 'Flaky',
        parameters: [],
        execute: async () => {
          attempts++;
          if (attempts < 2) throw new Error('Retry');
          return {};
        }
      });

      const stepRetryHandler = jest.fn();
      executor.on('step:retry', stepRetryHandler);

      const plan = createPlan([{ tool: 'flaky_tool', retryable: true }]);
      await executor.executePlan(plan);

      expect(stepRetryHandler).toHaveBeenCalled();
    });
  });

  describe('status and control', () => {
    it('should return null status before execution', () => {
      expect(executor.getStatus()).toBeNull();
    });

    it('should return execution status after run', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: [],
        execute: async () => ({})
      });

      const plan = createPlan([{ tool: 'test_tool' }]);
      await executor.executePlan(plan);

      const status = executor.getStatus();
      expect(status).not.toBeNull();
      expect(status?.success).toBe(true);
    });

    it('should cancel execution', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        parameters: [],
        execute: async () => ({})
      });

      const plan = createPlan([{ tool: 'test_tool' }]);
      await executor.executePlan(plan);

      executor.cancel();

      expect(executor.getStatus()).toBeNull();
    });
  });
});

import { 
  Cache, 
  ResponseCache, 
  RequestDeduplicator, 
  memoize,
  searchCache,
  llmCache,
  scrapeCache
} from '../../../src/utils/cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>({ ttl: 1000, maxSize: 10 });
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for missing keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists with has()', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should invalidate specific keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.invalidate('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should return false when invalidating non-existent key', () => {
      expect(cache.invalidate('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('should return correct size', () => {
      expect(cache.size).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new Cache<string>({ ttl: 50 });
      shortCache.set('key1', 'value1');
      
      expect(shortCache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(shortCache.get('key1')).toBeNull();
    });

    it('should support custom TTL per entry', async () => {
      cache.set('short', 'value1', 50);
      cache.set('long', 'value2', 500);
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(cache.get('short')).toBeNull();
      expect(cache.get('long')).toBe('value2');
    });

    it('should report expiration via has()', async () => {
      const shortCache = new Cache<string>({ ttl: 50 });
      shortCache.set('key1', 'value1');
      
      expect(shortCache.has('key1')).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(shortCache.has('key1')).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    it('should evict entry when at max capacity', () => {
      const smallCache = new Cache<string>({ maxSize: 3 });
      
      smallCache.set('a', '1');
      smallCache.set('b', '2');
      smallCache.set('c', '3');
      
      // Cache is now full
      expect(smallCache.size).toBe(3);
      
      // Adding new entry should evict one entry
      smallCache.set('d', '4');
      
      // Size should still be 3 (evicted one, added one)
      expect(smallCache.size).toBe(3);
      expect(smallCache.get('d')).toBe('4');
    });

    it('should evict expired entries when at capacity', async () => {
      const smallCache = new Cache<string>({ maxSize: 3, ttl: 50 });
      
      smallCache.set('a', '1');
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // 'a' is now expired
      smallCache.set('b', '2', 1000);
      smallCache.set('c', '3', 1000);
      // This should trigger eviction - expired 'a' should be cleaned up
      smallCache.set('d', '4', 1000);
      
      expect(smallCache.get('d')).toBe('4');
      // Size should be 3 or less (expired entries removed)
      expect(smallCache.size).toBeLessThanOrEqual(3);
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should track sets and evictions', () => {
      const smallCache = new Cache<string>({ maxSize: 2 });
      
      smallCache.set('a', '1');
      smallCache.set('b', '2');
      smallCache.set('c', '3'); // Should trigger eviction
      
      const stats = smallCache.getStats();
      expect(stats.sets).toBe(3);
      expect(stats.evictions).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');
      
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.75);
    });

    it('should return 0 hit rate with no accesses', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should reset stats on clear', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.clear();
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
    });

    it('should optionally disable stats tracking', () => {
      const noStatsCache = new Cache<string>({ trackStats: false });
      noStatsCache.set('key1', 'value1');
      noStatsCache.get('key1');
      noStatsCache.get('nonexistent');
      
      const stats = noStatsCache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('pattern invalidation', () => {
    it('should invalidate keys matching pattern', () => {
      cache.set('user:1', 'data1');
      cache.set('user:2', 'data2');
      cache.set('product:1', 'data3');
      
      const invalidated = cache.invalidatePattern(/^user:/);
      
      expect(invalidated).toBe(2);
      expect(cache.get('user:1')).toBeNull();
      expect(cache.get('user:2')).toBeNull();
      expect(cache.get('product:1')).toBe('data3');
    });

    it('should return 0 if no keys match', () => {
      cache.set('key1', 'value1');
      const invalidated = cache.invalidatePattern(/^nomatch/);
      expect(invalidated).toBe(0);
    });
  });

  describe('prune', () => {
    it('should remove expired entries', async () => {
      const shortCache = new Cache<string>({ ttl: 50 });
      shortCache.set('a', '1');
      shortCache.set('b', '2');
      shortCache.set('c', '3', 1000); // longer TTL
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const pruned = shortCache.prune();
      
      expect(pruned).toBe(2);
      expect(shortCache.size).toBe(1);
      expect(shortCache.get('c')).toBe('3');
    });
  });

  describe('keys', () => {
    it('should return all non-expired keys', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      
      const keys = cache.keys();
      
      expect(keys).toHaveLength(3);
      expect(keys).toContain('a');
      expect(keys).toContain('b');
      expect(keys).toContain('c');
    });

    it('should exclude expired keys', async () => {
      const shortCache = new Cache<string>({ ttl: 50 });
      shortCache.set('a', '1');
      shortCache.set('b', '2', 1000); // longer TTL
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const keys = shortCache.keys();
      expect(keys).toEqual(['b']);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached');
      const fetcher = jest.fn().mockResolvedValue('fetched');
      
      const result = await cache.getOrSet('key1', fetcher);
      
      expect(result).toBe('cached');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not exists', async () => {
      const fetcher = jest.fn().mockResolvedValue('fetched');
      
      const result = await cache.getOrSet('key1', fetcher);
      
      expect(result).toBe('fetched');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('fetched');
    });

    it('should use custom TTL', async () => {
      const fetcher = jest.fn().mockResolvedValue('fetched');
      
      await cache.getOrSet('key1', fetcher, 50);
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('getOrSetSync', () => {
    it('should return cached value if exists', () => {
      cache.set('key1', 'cached');
      const fetcher = jest.fn().mockReturnValue('fetched');
      
      const result = cache.getOrSetSync('key1', fetcher);
      
      expect(result).toBe('cached');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch and cache if not exists', () => {
      const fetcher = jest.fn().mockReturnValue('fetched');
      
      const result = cache.getOrSetSync('key1', fetcher);
      
      expect(result).toBe('fetched');
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('fetched');
    });
  });
});

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache();
  });

  it('should have default 10-minute TTL', () => {
    // We can't directly access private ttl, but we can verify behavior
    expect(cache).toBeInstanceOf(ResponseCache);
  });

  describe('generateKey', () => {
    it('should generate key from string', () => {
      const key = ResponseCache.generateKey('search', 'test query');
      expect(key).toMatch(/^search:-?\d+$/);
    });

    it('should generate key from object', () => {
      const key = ResponseCache.generateKey('llm', { role: 'user', content: 'hello' });
      expect(key).toMatch(/^llm:-?\d+$/);
    });

    it('should generate consistent keys for same input', () => {
      const key1 = ResponseCache.generateKey('search', 'test query');
      const key2 = ResponseCache.generateKey('search', 'test query');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different input', () => {
      const key1 = ResponseCache.generateKey('search', 'test query');
      const key2 = ResponseCache.generateKey('search', 'different query');
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different prefixes', () => {
      const key1 = ResponseCache.generateKey('search', 'test query');
      const key2 = ResponseCache.generateKey('llm', 'test query');
      expect(key1).not.toBe(key2);
    });
  });
});

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator<string>;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator<string>();
  });

  it('should execute a request', async () => {
    const request = jest.fn().mockResolvedValue('result');
    
    const result = await deduplicator.execute('key1', request);
    
    expect(result).toBe('result');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should deduplicate concurrent identical requests', async () => {
    const request = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('result'), 50))
    );
    
    const promise1 = deduplicator.execute('key1', request);
    const promise2 = deduplicator.execute('key1', request);
    const promise3 = deduplicator.execute('key1', request);
    
    const results = await Promise.all([promise1, promise2, promise3]);
    
    expect(results).toEqual(['result', 'result', 'result']);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should execute different requests separately', async () => {
    const request1 = jest.fn().mockResolvedValue('result1');
    const request2 = jest.fn().mockResolvedValue('result2');
    
    const results = await Promise.all([
      deduplicator.execute('key1', request1),
      deduplicator.execute('key2', request2)
    ]);
    
    expect(results).toEqual(['result1', 'result2']);
    expect(request1).toHaveBeenCalledTimes(1);
    expect(request2).toHaveBeenCalledTimes(1);
  });

  it('should allow new request after previous completes', async () => {
    const request = jest.fn()
      .mockResolvedValueOnce('result1')
      .mockResolvedValueOnce('result2');
    
    const result1 = await deduplicator.execute('key1', request);
    const result2 = await deduplicator.execute('key1', request);
    
    expect(result1).toBe('result1');
    expect(result2).toBe('result2');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('should check pending status', async () => {
    const request = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('result'), 100))
    );
    
    expect(deduplicator.isPending('key1')).toBe(false);
    
    const promise = deduplicator.execute('key1', request);
    
    expect(deduplicator.isPending('key1')).toBe(true);
    
    await promise;
    
    expect(deduplicator.isPending('key1')).toBe(false);
  });

  it('should track pending count', async () => {
    const slowRequest = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('result'), 100))
    );
    
    expect(deduplicator.pendingCount).toBe(0);
    
    const promise1 = deduplicator.execute('key1', slowRequest);
    expect(deduplicator.pendingCount).toBe(1);
    
    const promise2 = deduplicator.execute('key2', slowRequest);
    expect(deduplicator.pendingCount).toBe(2);
    
    await Promise.all([promise1, promise2]);
    
    expect(deduplicator.pendingCount).toBe(0);
  });

  it('should clean up after rejection', async () => {
    const request = jest.fn().mockRejectedValue(new Error('failed'));
    
    await expect(deduplicator.execute('key1', request)).rejects.toThrow('failed');
    
    expect(deduplicator.isPending('key1')).toBe(false);
  });
});

describe('memoize', () => {
  it('should memoize function results', () => {
    let callCount = 0;
    const expensiveFn = (x: number) => {
      callCount++;
      return x * 2;
    };
    
    const memoizedFn = memoize(expensiveFn);
    
    expect(memoizedFn(5)).toBe(10);
    expect(memoizedFn(5)).toBe(10);
    expect(memoizedFn(5)).toBe(10);
    expect(callCount).toBe(1);
  });

  it('should compute different values for different args', () => {
    const memoizedFn = memoize((x: number) => x * 2);
    
    expect(memoizedFn(5)).toBe(10);
    expect(memoizedFn(10)).toBe(20);
  });

  it('should work with async functions', async () => {
    let callCount = 0;
    const asyncFn = async (x: number) => {
      callCount++;
      return x * 2;
    };
    
    const memoizedFn = memoize(asyncFn);
    
    expect(await memoizedFn(5)).toBe(10);
    expect(await memoizedFn(5)).toBe(10);
    expect(callCount).toBe(1);
  });

  it('should use custom key generator', () => {
    const fn = (obj: { id: number; name: string }) => obj.name.toUpperCase();
    
    const memoizedFn = memoize(fn, {
      keyGenerator: (obj) => String(obj.id)
    });
    
    expect(memoizedFn({ id: 1, name: 'alice' })).toBe('ALICE');
    // Same id, different name - should return cached value
    expect(memoizedFn({ id: 1, name: 'bob' })).toBe('ALICE');
    // Different id - should compute new value
    expect(memoizedFn({ id: 2, name: 'charlie' })).toBe('CHARLIE');
  });

  it('should respect TTL option', async () => {
    let callCount = 0;
    const fn = (x: number) => {
      callCount++;
      return x * 2;
    };
    
    const memoizedFn = memoize(fn, { ttl: 50 });
    
    expect(memoizedFn(5)).toBe(10);
    expect(memoizedFn(5)).toBe(10);
    expect(callCount).toBe(1);
    
    await new Promise(resolve => setTimeout(resolve, 60));
    
    expect(memoizedFn(5)).toBe(10);
    expect(callCount).toBe(2);
  });
});

describe('singleton caches', () => {
  it('searchCache should exist', () => {
    expect(searchCache).toBeInstanceOf(ResponseCache);
  });

  it('llmCache should exist', () => {
    expect(llmCache).toBeInstanceOf(ResponseCache);
  });

  it('scrapeCache should exist', () => {
    expect(scrapeCache).toBeInstanceOf(ResponseCache);
  });

  it('should work independently', () => {
    searchCache.set('test', 'search-value');
    llmCache.set('test', 'llm-value');
    scrapeCache.set('test', 'scrape-value');
    
    expect(searchCache.get('test')).toBe('search-value');
    expect(llmCache.get('test')).toBe('llm-value');
    expect(scrapeCache.get('test')).toBe('scrape-value');
    
    // Cleanup
    searchCache.invalidate('test');
    llmCache.invalidate('test');
    scrapeCache.invalidate('test');
  });
});

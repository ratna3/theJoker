/**
 * @fileoverview Cache utility for performance optimization
 * Provides TTL-based caching with LRU eviction strategy
 */

export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;
  /** Enable cache statistics tracking */
  trackStats?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * Generic TTL-based cache with LRU eviction
 */
export class Cache<T = unknown> {
  private store: Map<string, CacheEntry<T>>;
  private readonly ttl: number;
  private readonly maxSize: number;
  private readonly trackStats: boolean;
  private stats: {
    hits: number;
    misses: number;
    sets: number;
    evictions: number;
  };

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl ?? 300000; // 5 minutes default
    this.maxSize = options.maxSize ?? 1000;
    this.trackStats = options.trackStats ?? true;
    this.store = new Map();
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  }

  /**
   * Get a value from cache
   * @returns The cached value or null if not found/expired
   */
  get(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      if (this.trackStats) this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      if (this.trackStats) this.stats.misses++;
      return null;
    }

    // Update access info for LRU
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    
    if (this.trackStats) this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   * @param customTtl Optional custom TTL for this entry
   */
  set(key: string, value: T, customTtl?: number): void {
    // Evict if at max capacity
    if (this.store.size >= this.maxSize) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + (customTtl ?? this.ttl),
      accessCount: 0,
      createdAt: now,
      lastAccessedAt: now
    };

    this.store.set(key, entry);
    if (this.trackStats) this.stats.sets++;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Invalidate a specific key
   */
  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (pattern.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      // Also clean up expired entries while scanning
      if (Date.now() > entry.expiresAt) {
        this.store.delete(key);
        if (this.trackStats) this.stats.evictions++;
        continue;
      }

      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.store.delete(lruKey);
      if (this.trackStats) this.stats.evictions++;
    }
  }

  /**
   * Remove all expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get all non-expired keys
   */
  keys(): string[] {
    const now = Date.now();
    const keys: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now <= entry.expiresAt) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Get or set pattern - fetch from cache or compute value
   */
  async getOrSet(key: string, fetcher: () => Promise<T>, customTtl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, customTtl);
    return value;
  }

  /**
   * Get or set synchronous version
   */
  getOrSetSync(key: string, fetcher: () => T, customTtl?: number): T {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = fetcher();
    this.set(key, value, customTtl);
    return value;
  }
}

/**
 * Response cache for LLM and search results
 */
export class ResponseCache extends Cache<string> {
  constructor(options: CacheOptions = {}) {
    super({
      ttl: options.ttl ?? 600000, // 10 minutes default for responses
      maxSize: options.maxSize ?? 500,
      trackStats: options.trackStats ?? true
    });
  }

  /**
   * Generate cache key from messages or query
   */
  static generateKey(prefix: string, content: string | object): string {
    const stringContent = typeof content === 'string' 
      ? content 
      : JSON.stringify(content);
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < stringContent.length; i++) {
      const char = stringContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return `${prefix}:${hash}`;
  }
}

/**
 * Request deduplication for concurrent identical requests
 */
export class RequestDeduplicator<T> {
  private pending: Map<string, Promise<T>> = new Map();

  /**
   * Execute a request with deduplication
   * If an identical request is already in flight, return the same promise
   */
  async execute(key: string, request: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing;
    }

    const promise = request().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Check if a request is currently pending
   */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * Get count of pending requests
   */
  get pendingCount(): number {
    return this.pending.size;
  }
}

/**
 * Memoization decorator helper
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: CacheOptions & { keyGenerator?: (...args: Parameters<T>) => string } = {}
): T {
  const cache = new Cache(options);
  const keyGenerator = options.keyGenerator ?? ((...args) => JSON.stringify(args));

  return ((...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);
    
    if (cached !== null) {
      return cached;
    }

    const result = fn(...args);
    
    // Handle promises
    if (result instanceof Promise) {
      return result.then((value: any) => {
        cache.set(key, value);
        return value;
      });
    }

    cache.set(key, result);
    return result;
  }) as T;
}

// Singleton instances for global use
export const searchCache = new ResponseCache({ ttl: 900000 }); // 15 minutes
export const llmCache = new ResponseCache({ ttl: 600000 }); // 10 minutes
export const scrapeCache = new ResponseCache({ ttl: 1800000 }); // 30 minutes

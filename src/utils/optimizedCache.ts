import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { structuredLogger } from './pinoLogger.js';
import { getConfig } from '../config/index.js';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  size: number;
}

interface CacheOptions {
  maxSize?: number;
  ttlMinutes?: number;
  compressionThreshold?: number;
  enabled?: boolean;
}

/**
 * Optimized cache with memory-efficient storage and compression
 */
export class OptimizedCache {
  private cache: LRUCache<string, CacheEntry>;
  private readonly logger = structuredLogger.child({ component: 'OptimizedCache' });
  private enabled: boolean;
  private compressionThreshold: number;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressions: 0
  };

  constructor(options: CacheOptions = {}) {
    const config = getConfig();
    const maxSize = options.maxSize ?? config.cache.maxSize;
    const ttlMinutes = options.ttlMinutes ?? config.cache.ttlMinutes;
    this.enabled = options.enabled ?? config.cache.enabled;
    this.compressionThreshold = options.compressionThreshold ?? 1024; // 1KB default

    this.cache = new LRUCache<string, CacheEntry>({
      max: maxSize,
      // maxSize bounds total entry bytes; sizeCalculation requires this to be set
      maxSize: maxSize * 65536,
      ttl: ttlMinutes * 60 * 1000,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      sizeCalculation: (entry) => entry.size,
      dispose: () => this.stats.evictions++,
      noDeleteOnStaleGet: false,
      // Use Date.now() + ttlResolution:0 so Jest fake timers control TTL expiry in tests.
      // ttlResolution defaults to 1ms debounce via setTimeout; with fake timers that timeout
      // never fires, causing stale TTL reads. ttlResolution:0 disables the debounce.
      perf: { now: () => Date.now() },
      ttlResolution: 0,
    });

    this.logger.info({
      maxSize,
      ttlMinutes,
      enabled: this.enabled,
      compressionThreshold: this.compressionThreshold
    }, 'Optimized cache initialized');
  }

  /**
   * Generate cache key with efficient hashing
   */
  private generateKey(input: string | object): string {
    const data = typeof input === 'string' ? input : JSON.stringify(input);
    return createHash('sha256').update(data).digest('base64');
  }

  /**
   * Calculate approximate size of data
   */
  private calculateSize(data: any): number {
    if (data === null || data === undefined) return 4;
    if (typeof data === 'string') return data.length || 1; // min 1 for empty string
    const json = JSON.stringify(data);
    return json === undefined ? 4 : json.length;
  }

  /**
   * Compress data if above threshold (placeholder for actual compression)
   */
  private compress(data: any): any {
    const size = this.calculateSize(data);
    if (size > this.compressionThreshold) {
      this.stats.compressions++;
      // In production, implement actual compression (e.g., using zlib)
      return data;
    }
    return data;
  }

  /**
   * Check if a key exists in cache (respects TTL)
   */
  has(key: string | object): boolean {
    if (!this.enabled) return false;
    const cacheKey = this.generateKey(key);
    return this.cache.has(cacheKey);
  }

  /**
   * Get item from cache with optimized retrieval
   */
  get<T = any>(key: string | object): T | undefined {
    if (!this.enabled) return undefined;

    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (entry !== undefined) {
      this.stats.hits++;
      this.logger.debug({ key: cacheKey }, 'Cache hit');
      return entry.data as T;
    }

    this.stats.misses++;
    this.logger.debug({ key: cacheKey }, 'Cache miss');
    return undefined;
  }

  /**
   * Set item in cache with size tracking
   * @param ttlMs optional TTL override in milliseconds
   */
  set<T = any>(key: string | object, value: T, ttlMs?: number): void {
    if (!this.enabled) return;

    const cacheKey = this.generateKey(key);
    const compressedData = this.compress(value);
    const size = this.calculateSize(compressedData);

    const entry: CacheEntry<T> = {
      data: compressedData,
      timestamp: Date.now(),
      size
    };

    this.cache.set(cacheKey, entry, ttlMs ? { ttl: ttlMs } : undefined);
    this.logger.debug({
      key: cacheKey,
      size,
      compressed: size !== this.calculateSize(value)
    }, 'Cache set');
  }

  /**
   * Get multiple values by keys
   */
  getMany<T = any>(keys: string[]): Record<string, T | undefined> {
    const result: Record<string, T | undefined> = {};
    for (const key of keys) {
      result[key] = this.get<T>(key);
    }
    return result;
  }

  /**
   * Set multiple key-value pairs
   */
  setMany<T = any>(entries: Record<string, T>): void {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value);
    }
  }

  /**
   * Delete multiple keys, returning success per key
   */
  deleteMany(keys: string[]): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const key of keys) {
      result[key] = this.delete(key);
    }
    return result;
  }

  /**
   * Generate a cache key from a prefix and data object
   */
  static generateKey(prefix: string, data: object | string): string {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = createHash('sha256').update(dataStr).digest('base64');
    return `${prefix}:${hash}`;
  }

  /**
   * Delete specific entry
   */
  delete(key: string | object): boolean {
    if (!this.enabled) return false;
    const cacheKey = this.generateKey(key);
    return this.cache.delete(cacheKey);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;

    return {
      ...this.stats,
      hitRate,
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize
    };
  }

  /**
   * Prune stale entries
   */
  prune(): number {
    const before = this.cache.size;
    this.cache.purgeStale();
    const pruned = before - this.cache.size;
    if (pruned > 0) {
      this.logger.info({ pruned }, 'Pruned stale cache entries');
    }
    return pruned;
  }

  /**
   * Enable/disable cache
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Global optimized cache instance
let _globalOptimizedCache: OptimizedCache | null = null;

export function getOptimizedCache(): OptimizedCache {
  if (!_globalOptimizedCache) {
    _globalOptimizedCache = new OptimizedCache();
  }
  return _globalOptimizedCache;
}

export function resetOptimizedCache(): void {
  if (_globalOptimizedCache) {
    _globalOptimizedCache.clear();
  }
  _globalOptimizedCache = null;
}
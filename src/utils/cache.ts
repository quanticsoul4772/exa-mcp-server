import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';
import { getConfig } from '../config/index.js';
import { structuredLogger } from './pinoLogger.js';

/**
 * Cache configuration interface
 */
interface CacheConfig {
  maxSize: number;
  ttlMinutes: number;
  enabled: boolean;
}

/**
 * Cached response data structure
 */
interface CachedResponse<T = any> {
  data: T;
  timestamp: number;
  hitCount: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

/**
 * LRU Cache with TTL for API request optimization
 * Reduces repeated API calls and improves performance
 */
export class RequestCache {
  private cache: LRUCache<string, CachedResponse>;
  private stats = {
    hits: 0,
    misses: 0
  };
  private config: CacheConfig;
  private logger = structuredLogger.child({ component: 'RequestCache' });

  constructor(config?: Partial<CacheConfig>) {
    // Get default cache configuration from app config
    const appConfig = getConfig();
    
    this.config = {
      maxSize: config?.maxSize ?? appConfig.cache.maxSize,
      ttlMinutes: config?.ttlMinutes ?? appConfig.cache.ttlMinutes,
      enabled: config?.enabled ?? (appConfig.cache.enabled && appConfig.environment.nodeEnv !== 'test')
    };

    this.cache = new LRUCache<string, CachedResponse>({
      max: this.config.maxSize,
      ttl: this.config.ttlMinutes * 60 * 1000, // Convert to milliseconds
      allowStale: false,
      dispose: (value, key) => {
        this.logger.debug({ cacheKey: key, hitCount: value.hitCount }, 'Cache entry evicted');
      }
    });

    this.logger.info({
      maxSize: this.config.maxSize,
      ttlMinutes: this.config.ttlMinutes,
      enabled: this.config.enabled
    }, 'Request cache initialized');
  }

  /**
   * Generate a cache key from request parameters
   */
  private generateKey(endpoint: string, requestData: any): string {
    const payload = JSON.stringify({ endpoint, ...requestData });
    return createHash('sha256').update(payload).digest('hex').substring(0, 16);
  }

  /**
   * Get cached response if available and not expired
   */
  get<T>(endpoint: string, requestData: any): T | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.generateKey(endpoint, requestData);
    const cached = this.cache.get(key);

    if (cached) {
      // Update hit count and track stats
      cached.hitCount++;
      this.stats.hits++;
      
      this.logger.debug({
        cacheKey: key,
        hitCount: cached.hitCount,
        age: Date.now() - cached.timestamp
      }, 'Cache hit');
      
      return cached.data as T;
    }

    this.stats.misses++;
    this.logger.debug({ cacheKey: key }, 'Cache miss');
    return null;
  }

  /**
   * Store response in cache
   */
  set<T>(endpoint: string, requestData: any, responseData: T): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(endpoint, requestData);
    const cachedResponse: CachedResponse<T> = {
      data: responseData,
      timestamp: Date.now(),
      hitCount: 0
    };

    this.cache.set(key, cachedResponse);
    
    this.logger.debug({ 
      cacheKey: key, 
      cacheSize: this.cache.size 
    }, 'Response cached');
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    
    this.logger.info({ clearedEntries: previousSize }, 'Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Manually enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    const wasEnabled = this.config.enabled;
    this.config.enabled = enabled;
    
    if (wasEnabled && !enabled) {
      this.clear();
    }
    
    this.logger.info({ enabled }, 'Cache enabled status changed');
  }
}

/**
 * Global cache instance with lazy initialization
 * This prevents issues during testing where config validation might fail
 */
let _globalCache: RequestCache | null = null;

/**
 * Get the global cache instance (lazy initialization)
 * Creates the cache on first access to avoid initialization issues during testing
 */
export function getGlobalCache(): RequestCache {
  if (!_globalCache) {
    try {
      _globalCache = new RequestCache();
    } catch (error) {
      // If config validation fails (e.g., in tests), create a disabled cache
      _globalCache = new RequestCache({ enabled: false });
    }
  }
  return _globalCache;
}

/**
 * Reset the global cache instance (useful for testing)
 */
export function resetGlobalCache(): void {
  if (_globalCache) {
    _globalCache.clear();
  }
  _globalCache = null;
}

/**
 * Export for backward compatibility
 * @deprecated Use getGlobalCache() instead for better error handling
 */
export const globalCache = {
  get: <T>(endpoint: string, requestData: any): T | null => getGlobalCache().get(endpoint, requestData),
  set: <T>(endpoint: string, requestData: any, responseData: T): void => getGlobalCache().set(endpoint, requestData, responseData),
  clear: (): void => getGlobalCache().clear(),
  getStats: (): CacheStats => getGlobalCache().getStats(),
  isEnabled: (): boolean => getGlobalCache().isEnabled(),
  setEnabled: (enabled: boolean): void => getGlobalCache().setEnabled(enabled)
};

/**
 * Utility function to create a cache-aware request wrapper
 */
export function createCachedRequest<TRequest, TResponse>(
  requestFunction: (data: TRequest) => Promise<TResponse>,
  endpoint: string,
  cache?: RequestCache
) {
  return async (requestData: TRequest): Promise<TResponse> => {
    const cacheInstance = cache || getGlobalCache();
    
    // Try to get from cache first
    const cached = cacheInstance.get<TResponse>(endpoint, requestData);
    if (cached) {
      return cached;
    }

    // Execute the actual request
    const response = await requestFunction(requestData);
    
    // Cache the response
    cacheInstance.set(endpoint, requestData, response);
    
    return response;
  };
}

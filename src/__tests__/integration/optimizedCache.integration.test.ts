import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import '../../__tests__/setup.js';

describe('OptimizedCache Integration', () => {
  let OptimizedCache: any;
  let getOptimizedCache: any;
  let cache: any;

  beforeEach(async () => {
    jest.resetModules();
    
    // Mock memoryOptimizer
    jest.doMock('../../utils/memoryOptimizer.js', () => ({
      MemoryOptimizer: jest.fn().mockImplementation(() => ({
        calculateObjectSize: jest.fn((obj) => JSON.stringify(obj).length),
        checkMemoryUsage: jest.fn(() => true),
        isUnderMemoryPressure: jest.fn(() => false),
        optimize: jest.fn()
      }))
    }));

    // Import after mocks
    const cacheModule = await import('../../utils/optimizedCache.js');
    OptimizedCache = cacheModule.OptimizedCache;
    getOptimizedCache = cacheModule.getOptimizedCache;
    
    cache = new OptimizedCache({ maxSize: 10, ttlMinutes: 5 });
  });

  afterEach(() => {
    if (cache) {
      cache.clear();
    }
    jest.clearAllMocks();
  });

  it('should create OptimizedCache instance', () => {
    expect(cache).toBeDefined();
    expect(cache.set).toBeDefined();
    expect(cache.get).toBeDefined();
    expect(cache.has).toBeDefined();
    expect(cache.delete).toBeDefined();
    expect(cache.clear).toBeDefined();
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should check if key exists', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('should delete values', () => {
    cache.set('key1', 'value1');
    const deleted = cache.delete('key1');
    expect(deleted).toBe(true);
    expect(cache.has('key1')).toBe(false);
  });

  it('should clear all values', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key2')).toBe(false);
  });

  it('should respect max size limit', () => {
    const smallCache = new OptimizedCache({ maxSize: 3, ttlMinutes: 5 });
    
    smallCache.set('key1', 'value1');
    smallCache.set('key2', 'value2');
    smallCache.set('key3', 'value3');
    smallCache.set('key4', 'value4'); // Should evict oldest
    
    expect(smallCache.has('key1')).toBe(false);
    expect(smallCache.has('key4')).toBe(true);
  });

  it('should get cache statistics', () => {
    cache.set('key1', 'value1');
    cache.get('key1'); // hit
    cache.get('missing'); // miss
    
    const stats = cache.getStats();
    expect(stats.size).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(50);
  });

  it('should handle global instance', () => {
    const instance = getOptimizedCache();
    expect(instance).toBeDefined();
    expect(instance.set).toBeDefined();
    expect(instance.get).toBeDefined();
  });

  it('should prune expired entries', () => {
    const pruned = cache.prune();
    expect(typeof pruned).toBe('number');
    expect(pruned).toBeGreaterThanOrEqual(0);
  });
});
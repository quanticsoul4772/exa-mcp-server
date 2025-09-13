import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock logger before imports
jest.mock('../../utils/pinoLogger.js', () => ({
  structuredLogger: {
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  }
}));

// Mock memoryOptimizer
jest.mock('../../utils/memoryOptimizer.js', () => ({
  MemoryOptimizer: jest.fn().mockImplementation(() => ({
    calculateObjectSize: jest.fn((obj) => JSON.stringify(obj).length),
    checkMemoryUsage: jest.fn(() => true),
    isUnderMemoryPressure: jest.fn(() => false),
    optimize: jest.fn()
  }))
}));

import { OptimizedCache } from '../../utils/optimizedCache.js';

describe('OptimizedCache', () => {
  let cache: OptimizedCache;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new OptimizedCache({ maxSize: 100, ttlMinutes: 5 });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.has('key1')).toBe(false);
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('TTL Management', () => {
    it('should expire entries after TTL', () => {
      jest.useFakeTimers();
      
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
      
      // Advance time past TTL (5 minutes = 300000ms)
      jest.advanceTimersByTime(300001);
      
      expect(cache.get('key1')).toBeUndefined();
      
      jest.useRealTimers();
    });

    it('should not expire entries before TTL', () => {
      jest.useFakeTimers();
      
      cache.set('key1', 'value1');
      
      // Advance time but not past TTL
      jest.advanceTimersByTime(299999);
      
      expect(cache.get('key1')).toBe('value1');
      
      jest.useRealTimers();
    });

    it('should use custom TTL', () => {
      jest.useFakeTimers();
      
      cache.set('key1', 'value1', 1000); // 1 second TTL
      expect(cache.get('key1')).toBe('value1');
      
      jest.advanceTimersByTime(1001);
      
      expect(cache.get('key1')).toBeUndefined();
      
      jest.useRealTimers();
    });
  });

  describe('Size Management', () => {
    it('should track cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', { data: 'value2' });
      
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.memoryUsed).toBeGreaterThan(0);
    });

    it('should evict oldest entries when max size reached', () => {
      const smallCache = new OptimizedCache({ maxSize: 3, ttlMinutes: 5 });
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      smallCache.set('key4', 'value4'); // Should evict key1
      
      expect(smallCache.has('key1')).toBe(false);
      expect(smallCache.has('key2')).toBe(true);
      expect(smallCache.has('key3')).toBe(true);
      expect(smallCache.has('key4')).toBe(true);
    });

    it('should handle memory pressure', () => {
      const memoryOptimizer = (cache as any).memoryOptimizer;
      memoryOptimizer.isUnderMemoryPressure.mockReturnValue(true);
      
      // Add items
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      // Check that optimization is triggered
      expect(memoryOptimizer.optimize).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      
      // Hit
      cache.get('key1');
      // Miss
      cache.get('nonexistent');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');
      
      // 3 hits
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');
      
      // 1 miss
      cache.get('nonexistent');
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(75);
    });

    it('should handle zero requests', () => {
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys', () => {
      const key1 = OptimizedCache.generateKey('prefix', { a: 1, b: 2 });
      const key2 = OptimizedCache.generateKey('prefix', { a: 1, b: 2 });
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = OptimizedCache.generateKey('prefix', { a: 1 });
      const key2 = OptimizedCache.generateKey('prefix', { a: 2 });
      expect(key1).not.toBe(key2);
    });

    it('should handle complex objects', () => {
      const complexObj = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        bool: true
      };
      
      const key = OptimizedCache.generateKey('test', complexObj);
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const values = cache.getMany(['key1', 'key2', 'nonexistent']);
      expect(values).toEqual({
        key1: 'value1',
        key2: 'value2',
        nonexistent: undefined
      });
    });

    it('should set multiple values', () => {
      cache.setMany({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should delete multiple values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const deleted = cache.deleteMany(['key1', 'key3', 'nonexistent']);
      expect(deleted).toEqual({
        key1: true,
        key3: true,
        nonexistent: false
      });
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', () => {
      cache.set('null', null);
      cache.set('undefined', undefined);
      
      expect(cache.get('null')).toBeNull();
      expect(cache.get('undefined')).toBeUndefined();
      expect(cache.has('null')).toBe(true);
      expect(cache.has('undefined')).toBe(true);
    });

    it('should handle empty strings', () => {
      cache.set('', 'empty key');
      cache.set('key', '');
      
      expect(cache.get('')).toBe('empty key');
      expect(cache.get('key')).toBe('');
    });

    it('should handle large objects', () => {
      const largeObject = {
        data: new Array(1000).fill('x').join('')
      };
      
      cache.set('large', largeObject);
      expect(cache.get('large')).toEqual(largeObject);
    });
  });
});
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import '../../__tests__/setup.js';

describe('MemoryOptimizer Integration', () => {
  let MemoryOptimizer: any;
  let getMemoryOptimizer: any;
  let resetMemoryOptimizer: any;
  let optimizer: any;

  beforeEach(async () => {
    // Clear module cache to get fresh imports
    jest.resetModules();
    
    // Mock the optimizedCache module
    jest.doMock('../../utils/optimizedCache.js', () => ({
      getOptimizedCache: jest.fn(() => ({
        clear: jest.fn(),
        prune: jest.fn(() => 5)
      }))
    }));

    // Import after mocks are set up
    const memoryOptimizerModule = await import('../../utils/memoryOptimizer.js');
    MemoryOptimizer = memoryOptimizerModule.MemoryOptimizer;
    getMemoryOptimizer = memoryOptimizerModule.getMemoryOptimizer;
    resetMemoryOptimizer = memoryOptimizerModule.resetMemoryOptimizer;
    
    // Create instance with no auto-pruning
    optimizer = new MemoryOptimizer({ pruneIntervalMs: 0 });
  });

  afterEach(() => {
    if (optimizer && optimizer.stop) {
      optimizer.stop();
    }
    if (resetMemoryOptimizer) {
      resetMemoryOptimizer();
    }
    jest.clearAllMocks();
  });

  it('should create MemoryOptimizer instance', () => {
    expect(optimizer).toBeDefined();
    expect(optimizer.getMemoryStats).toBeDefined();
    expect(optimizer.checkMemoryUsage).toBeDefined();
    expect(optimizer.getStats).toBeDefined();
    expect(optimizer.stop).toBeDefined();
  });

  it('should get memory statistics', () => {
    const stats = optimizer.getMemoryStats();
    
    expect(stats).toBeDefined();
    expect(stats.heapUsed).toBeGreaterThan(0);
    expect(stats.heapTotal).toBeGreaterThan(0);
    expect(stats.rss).toBeGreaterThan(0);
    expect(typeof stats.heapUsed).toBe('number');
  });

  it('should get formatted stats', () => {
    const stats = optimizer.getStats();
    
    expect(stats).toBeDefined();
    expect(stats.heapUsed).toMatch(/\d+\.\d+ MB/);
    expect(stats.heapTotal).toMatch(/\d+\.\d+ MB/);
    expect(stats.rss).toMatch(/\d+\.\d+ MB/);
    expect(stats.status).toMatch(/healthy|warning|critical/);
  });

  it('should check memory usage', () => {
    const result = optimizer.checkMemoryUsage();
    expect(typeof result).toBe('boolean');
  });

  it('should handle global instance', () => {
    resetMemoryOptimizer();
    const instance1 = getMemoryOptimizer();
    const instance2 = getMemoryOptimizer();
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBeDefined();
    
    resetMemoryOptimizer();
  });

  it('should stop optimizer cleanly', () => {
    const newOptimizer = new MemoryOptimizer({ pruneIntervalMs: 1000 });
    expect(() => newOptimizer.stop()).not.toThrow();
    expect(() => newOptimizer.stop()).not.toThrow(); // Double stop should be safe
  });
});
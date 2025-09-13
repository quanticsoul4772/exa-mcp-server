import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../config/index.js', () => ({
  getConfig: jest.fn(() => ({
    exa: { apiKey: 'test-key', baseUrl: 'https://api.exa.ai', timeout: 25000, retries: 3 },
    server: { name: 'test-server', version: '1.0.0' },
    logging: { level: 'ERROR', redactLogs: true },
    environment: { nodeEnv: 'test' },
    cache: { enabled: true, maxSize: 100, ttlMinutes: 5 },
    tools: { defaultNumResults: 5, defaultMaxCharacters: 3000 }
  }))
}));
jest.mock('../../utils/pinoLogger.js');
jest.mock('../../utils/optimizedCache.js', () => ({
  getOptimizedCache: jest.fn(() => ({
    clear: jest.fn(),
    prune: jest.fn(() => 5)
  }))
}));

import { MemoryOptimizer, getMemoryOptimizer, resetMemoryOptimizer } from '../../utils/memoryOptimizer.js';

describe('MemoryOptimizer', () => {
  let optimizer: MemoryOptimizer;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Create optimizer with no auto-pruning for controlled tests
    optimizer = new MemoryOptimizer({ pruneIntervalMs: 0 });
  });

  afterEach(() => {
    optimizer.stop();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Memory Stats', () => {
    it('should get memory stats', () => {
      const stats = optimizer.getMemoryStats();
      
      expect(stats).toBeDefined();
      expect(stats.heapUsed).toBeDefined();
      expect(stats.heapTotal).toBeDefined();
      expect(stats.external).toBeDefined();
      expect(stats.rss).toBeDefined();
      expect(typeof stats.heapUsed).toBe('number');
    });

    it('should get formatted stats', () => {
      const stats = optimizer.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.heapUsed).toContain('MB');
      expect(stats.heapTotal).toContain('MB');
      expect(stats.rss).toContain('MB');
      expect(stats.heapUsagePercent).toBeDefined();
      expect(stats.gcCount).toBe(0);
      expect(stats.status).toBeDefined();
    });

    it('should determine health status based on usage', () => {
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 95 * 1024 * 1024, // 95% usage
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024
      });

      const stats = optimizer.getStats();
      expect(stats.status).toBe('critical');

      jest.restoreAllMocks();
    });
  });

  describe('Memory Usage Check', () => {
    it('should check memory usage within threshold', () => {
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 50 * 1024 * 1024, // 50MB = 50% of 100MB threshold
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024
      });

      const result = optimizer.checkMemoryUsage();
      expect(result).toBe(false); // Below threshold

      jest.restoreAllMocks();
    });

    it('should detect high memory usage', () => {
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        heapUsed: 150 * 1024 * 1024, // 150MB > 100MB threshold
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024
      });

      const result = optimizer.checkMemoryUsage();
      expect(result).toBe(true); // Above threshold

      jest.restoreAllMocks();
    });

    it('should handle critical memory usage', () => {
      const criticalOptimizer = new MemoryOptimizer({ 
        maxHeapUsageMB: 100,
        pruneIntervalMs: 0 
      });

      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        heapUsed: 95 * 1024 * 1024, // 95MB > 90% of 100MB max
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024
      });

      const result = criticalOptimizer.checkMemoryUsage();
      expect(result).toBe(true);

      criticalOptimizer.stop();
      jest.restoreAllMocks();
    });
  });

  describe('Memory Optimization with GC', () => {
    it('should trigger garbage collection if available', () => {
      const gcSpy = jest.fn();
      (global as any).gc = gcSpy;

      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        heapUsed: 150 * 1024 * 1024, // Above threshold
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024
      });

      optimizer.checkMemoryUsage();

      expect(gcSpy).toHaveBeenCalled();

      delete (global as any).gc;
      jest.restoreAllMocks();
    });

    it('should handle missing garbage collection', () => {
      delete (global as any).gc;

      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        heapUsed: 150 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024
      });

      expect(() => optimizer.checkMemoryUsage()).not.toThrow();

      jest.restoreAllMocks();
    });
  });

  describe('Global Instance', () => {
    it('should get global memory optimizer', () => {
      resetMemoryOptimizer();
      
      const optimizer1 = getMemoryOptimizer();
      const optimizer2 = getMemoryOptimizer();
      
      expect(optimizer1).toBe(optimizer2);
      
      resetMemoryOptimizer();
    });

    it('should reset global optimizer', () => {
      const optimizer1 = getMemoryOptimizer();
      resetMemoryOptimizer();
      const optimizer2 = getMemoryOptimizer();
      
      expect(optimizer1).not.toBe(optimizer2);
      
      resetMemoryOptimizer();
    });
  });

  describe('Stop', () => {
    it('should stop optimizer and clear timers', () => {
      const optimizerWithTimer = new MemoryOptimizer({ pruneIntervalMs: 1000 });
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      optimizerWithTimer.stop();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      jest.restoreAllMocks();
    });

    it('should handle multiple stop calls', () => {
      const optimizerWithTimer = new MemoryOptimizer({ pruneIntervalMs: 1000 });
      
      expect(() => {
        optimizerWithTimer.stop();
        optimizerWithTimer.stop();
      }).not.toThrow();
    });
  });
});
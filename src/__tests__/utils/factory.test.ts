import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import '../setup.js';

// Mock dependencies
jest.mock('../../utils/memoryOptimizer.js', () => ({
  MemoryOptimizer: jest.fn().mockImplementation(() => ({
    stop: jest.fn(),
    getMemoryStats: jest.fn(),
    checkMemoryUsage: jest.fn()
  }))
}));

jest.mock('../../utils/optimizedCache.js', () => ({
  OptimizedCache: jest.fn().mockImplementation(() => ({
    clear: jest.fn(),
    set: jest.fn(),
    get: jest.fn()
  }))
}));

jest.mock('../../utils/requestBatcher.js', () => ({
  RequestBatcher: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    flush: jest.fn()
  }))
}));

jest.mock('../../utils/rateLimiter.js', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    stop: jest.fn(),
    acquire: jest.fn()
  }))
}));

jest.mock('../../utils/urlValidator.js', () => ({
  URLValidator: jest.fn().mockImplementation(() => ({
    validate: jest.fn()
  }))
}));

import { 
  ServiceFactory,
  getMemoryOptimizer,
  getOptimizedCache,
  getRateLimiter,
  getURLValidator,
  createRequestBatcher,
  resetServices
} from '../../utils/factory.js';

describe('ServiceFactory', () => {
  beforeEach(() => {
    ServiceFactory.reset();
  });

  afterEach(() => {
    ServiceFactory.reset();
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should configure services', () => {
      ServiceFactory.configure({
        memoryOptimizer: { gcThresholdMB: 200 },
        cache: { maxSize: 500 }
      });
      
      const optimizer = ServiceFactory.getMemoryOptimizer();
      expect(optimizer).toBeDefined();
    });
  });

  describe('Service Creation', () => {
    it('should create and cache MemoryOptimizer', () => {
      const optimizer1 = ServiceFactory.getMemoryOptimizer();
      const optimizer2 = ServiceFactory.getMemoryOptimizer();
      
      expect(optimizer1).toBe(optimizer2);
      expect(ServiceFactory.hasInstance('memoryOptimizer')).toBe(true);
    });

    it('should create and cache OptimizedCache', () => {
      const cache1 = ServiceFactory.getOptimizedCache();
      const cache2 = ServiceFactory.getOptimizedCache();
      
      expect(cache1).toBe(cache2);
      expect(ServiceFactory.hasInstance('optimizedCache')).toBe(true);
    });

    it('should create RequestBatcher instances', () => {
      const processor = jest.fn();
      const batcher = ServiceFactory.createRequestBatcher(processor);
      
      expect(batcher).toBeDefined();
      expect(batcher.add).toBeDefined();
    });

    it('should create and cache RateLimiter', () => {
      const limiter1 = ServiceFactory.getRateLimiter();
      const limiter2 = ServiceFactory.getRateLimiter();
      
      expect(limiter1).toBe(limiter2);
      expect(ServiceFactory.hasInstance('rateLimiter')).toBe(true);
    });

    it('should create and cache URLValidator', () => {
      const validator1 = ServiceFactory.getURLValidator();
      const validator2 = ServiceFactory.getURLValidator();
      
      expect(validator1).toBe(validator2);
      expect(ServiceFactory.hasInstance('urlValidator')).toBe(true);
    });
  });

  describe('Instance Management', () => {
    it('should get instance by key', () => {
      const optimizer = ServiceFactory.getMemoryOptimizer();
      const retrieved = ServiceFactory.getInstance('memoryOptimizer');
      
      expect(retrieved).toBe(optimizer);
    });

    it('should check if instance exists', () => {
      expect(ServiceFactory.hasInstance('memoryOptimizer')).toBe(false);
      
      ServiceFactory.getMemoryOptimizer();
      
      expect(ServiceFactory.hasInstance('memoryOptimizer')).toBe(true);
    });

    it('should reset all instances', () => {
      ServiceFactory.getMemoryOptimizer();
      ServiceFactory.getOptimizedCache();
      ServiceFactory.getRateLimiter();
      
      expect(ServiceFactory.hasInstance('memoryOptimizer')).toBe(true);
      
      ServiceFactory.reset();
      
      expect(ServiceFactory.hasInstance('memoryOptimizer')).toBe(false);
      expect(ServiceFactory.hasInstance('optimizedCache')).toBe(false);
      expect(ServiceFactory.hasInstance('rateLimiter')).toBe(false);
    });

    it('should stop services on reset', () => {
      const optimizer = ServiceFactory.getMemoryOptimizer();
      const limiter = ServiceFactory.getRateLimiter();
      
      ServiceFactory.reset();
      
      expect(optimizer.stop).toHaveBeenCalled();
      expect(limiter.stop).toHaveBeenCalled();
    });
  });

  describe('Convenience Functions', () => {
    it('should provide getMemoryOptimizer helper', () => {
      const optimizer = getMemoryOptimizer();
      expect(optimizer).toBeDefined();
      expect(optimizer).toBe(ServiceFactory.getMemoryOptimizer());
    });

    it('should provide getOptimizedCache helper', () => {
      const cache = getOptimizedCache();
      expect(cache).toBeDefined();
      expect(cache).toBe(ServiceFactory.getOptimizedCache());
    });

    it('should provide getRateLimiter helper', () => {
      const limiter = getRateLimiter();
      expect(limiter).toBeDefined();
      expect(limiter).toBe(ServiceFactory.getRateLimiter());
    });

    it('should provide getURLValidator helper', () => {
      const validator = getURLValidator();
      expect(validator).toBeDefined();
      expect(validator).toBe(ServiceFactory.getURLValidator());
    });

    it('should provide createRequestBatcher helper', () => {
      const processor = jest.fn();
      const batcher = createRequestBatcher(processor);
      expect(batcher).toBeDefined();
    });

    it('should provide resetServices helper', () => {
      ServiceFactory.getMemoryOptimizer();
      expect(ServiceFactory.hasInstance('memoryOptimizer')).toBe(true);
      
      resetServices();
      
      expect(ServiceFactory.hasInstance('memoryOptimizer')).toBe(false);
    });
  });

  describe('Logger', () => {
    it('should get default logger', () => {
      const logger = ServiceFactory.getLogger();
      expect(logger).toBeDefined();
    });

    it('should use configured logger', () => {
      const customLogger = { log: jest.fn() };
      ServiceFactory.configure({ logger: customLogger });
      
      const logger = ServiceFactory.getLogger();
      expect(logger).toBe(customLogger);
    });
  });
});
/**
 * Factory module for dependency injection
 * Provides centralized creation of service instances with proper dependency management
 */

import { MemoryOptimizer } from './memoryOptimizer.js';
import { OptimizedCache } from './optimizedCache.js';
import { RequestBatcher } from './requestBatcher.js';
import { URLValidator } from './urlValidator.js';
import { RateLimiter } from './rateLimiter.js';
import { structuredLogger } from './pinoLogger.js';

/**
 * Configuration for service creation
 */
export interface ServiceConfig {
  memoryOptimizer?: {
    gcThresholdMB?: number;
    maxHeapUsageMB?: number;
    pruneIntervalMs?: number;
    enableAutoGC?: boolean;
  };
  cache?: {
    maxSize?: number;
    ttlMinutes?: number;
  };
  rateLimiter?: {
    maxRequests?: number;
    windowMs?: number;
    maxBurst?: number;
    retryAfterMs?: number;
  };
  urlValidator?: {
    allowedProtocols?: string[];
    allowLocalhost?: boolean;
    maxLength?: number;
  };
  logger?: any;
}

/**
 * Service factory for creating instances with dependency injection
 */
export class ServiceFactory {
  private static instances = new Map<string, any>();
  private static config: ServiceConfig = {};

  /**
   * Configure the factory with custom settings
   */
  static configure(config: ServiceConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Create or get a MemoryOptimizer instance
   */
  static getMemoryOptimizer(): MemoryOptimizer {
    const key = 'memoryOptimizer';
    if (!this.instances.has(key)) {
      const optimizer = new MemoryOptimizer(this.config.memoryOptimizer);
      this.instances.set(key, optimizer);
    }
    return this.instances.get(key);
  }

  /**
   * Create or get an OptimizedCache instance
   */
  static getOptimizedCache(): OptimizedCache {
    const key = 'optimizedCache';
    if (!this.instances.has(key)) {
      const cache = new OptimizedCache(this.config.cache);
      this.instances.set(key, cache);
    }
    return this.instances.get(key);
  }

  /**
   * Create a new RequestBatcher instance
   */
  static createRequestBatcher<T>(
    processor: (items: any[]) => Promise<T[]>,
    options?: { maxBatchSize?: number; batchDelayMs?: number; maxWaitMs?: number }
  ): RequestBatcher<T> {
    return new RequestBatcher(processor, options);
  }

  /**
   * Create or get a RateLimiter instance
   */
  static getRateLimiter(): RateLimiter {
    const key = 'rateLimiter';
    if (!this.instances.has(key)) {
      const defaultConfig = {
        maxRequests: 10,
        windowMs: 1000,
        maxBurst: 5,
        retryAfterMs: 1000
      };
      const config = this.config.rateLimiter ? {
        maxRequests: this.config.rateLimiter.maxRequests ?? defaultConfig.maxRequests,
        windowMs: this.config.rateLimiter.windowMs ?? defaultConfig.windowMs,
        maxBurst: this.config.rateLimiter.maxBurst ?? defaultConfig.maxBurst,
        retryAfterMs: this.config.rateLimiter.retryAfterMs ?? defaultConfig.retryAfterMs
      } : defaultConfig;
      const limiter = new RateLimiter(config);
      this.instances.set(key, limiter);
    }
    return this.instances.get(key);
  }

  /**
   * Create or get a URLValidator instance
   */
  static getURLValidator(): URLValidator {
    const key = 'urlValidator';
    if (!this.instances.has(key)) {
      const validator = new URLValidator(this.config.urlValidator);
      this.instances.set(key, validator);
    }
    return this.instances.get(key);
  }

  /**
   * Get the configured logger or default
   */
  static getLogger(): any {
    return this.config.logger || structuredLogger;
  }

  /**
   * Clear all instances (useful for testing)
   */
  static reset(): void {
    // Stop services that need cleanup
    const memoryOptimizer = this.instances.get('memoryOptimizer');
    if (memoryOptimizer && memoryOptimizer.stop) {
      memoryOptimizer.stop();
    }

    const rateLimiter = this.instances.get('rateLimiter');
    if (rateLimiter && rateLimiter.stop) {
      rateLimiter.stop();
    }

    this.instances.clear();
    this.config = {};
  }

  /**
   * Get a specific instance by key
   */
  static getInstance(key: string): any {
    return this.instances.get(key);
  }

  /**
   * Check if an instance exists
   */
  static hasInstance(key: string): boolean {
    return this.instances.has(key);
  }
}

// Export convenience functions that use the factory
export const getMemoryOptimizer = () => ServiceFactory.getMemoryOptimizer();
export const getOptimizedCache = () => ServiceFactory.getOptimizedCache();
export const getRateLimiter = () => ServiceFactory.getRateLimiter();
export const getURLValidator = () => ServiceFactory.getURLValidator();
export const createRequestBatcher = ServiceFactory.createRequestBatcher.bind(ServiceFactory);
export const resetServices = () => ServiceFactory.reset();
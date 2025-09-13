import { structuredLogger } from './pinoLogger.js';
import { getOptimizedCache } from './optimizedCache.js';

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface OptimizationOptions {
  gcThresholdMB?: number;
  pruneIntervalMs?: number;
  maxHeapUsageMB?: number;
  enableAutoGC?: boolean;
}

/**
 * Memory optimization service
 */
export class MemoryOptimizer {
  private readonly logger = structuredLogger.child({ component: 'MemoryOptimizer' });
  private readonly gcThresholdMB: number;
  private readonly maxHeapUsageMB: number;
  private readonly enableAutoGC: boolean;
  private pruneTimer: NodeJS.Timeout | null = null;
  private lastGCTime: number = Date.now();
  private gcCount: number = 0;

  constructor(options: OptimizationOptions = {}) {
    this.gcThresholdMB = options.gcThresholdMB ?? 100;
    this.maxHeapUsageMB = options.maxHeapUsageMB ?? 512;
    this.enableAutoGC = options.enableAutoGC ?? true;

    const pruneInterval = options.pruneIntervalMs ?? 60000; // 1 minute default
    if (pruneInterval > 0) {
      this.startPruning(pruneInterval);
    }

    this.logger.info({
      gcThresholdMB: this.gcThresholdMB,
      maxHeapUsageMB: this.maxHeapUsageMB,
      enableAutoGC: this.enableAutoGC
    }, 'Memory optimizer initialized');
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      arrayBuffers: mem.arrayBuffers
    };
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  /**
   * Check memory usage and trigger GC if needed
   */
  checkMemoryUsage(): boolean {
    const stats = this.getMemoryStats();
    const heapUsedMB = stats.heapUsed / 1024 / 1024;

    this.logger.debug({
      heapUsed: this.formatBytes(stats.heapUsed),
      heapTotal: this.formatBytes(stats.heapTotal),
      rss: this.formatBytes(stats.rss)
    }, 'Memory usage check');

    // Check if we're above threshold
    if (heapUsedMB > this.gcThresholdMB) {
      this.logger.warn({
        heapUsed: this.formatBytes(stats.heapUsed),
        threshold: `${this.gcThresholdMB} MB`
      }, 'Memory usage above threshold');

      if (this.enableAutoGC && global.gc) {
        this.triggerGC();
        return true;
      }
    }

    // Critical check - approaching max heap
    if (heapUsedMB > this.maxHeapUsageMB * 0.9) {
      this.logger.error({
        heapUsed: this.formatBytes(stats.heapUsed),
        maxHeap: `${this.maxHeapUsageMB} MB`
      }, 'Critical memory usage - approaching maximum');
      
      // Force aggressive cleanup
      this.performAggressiveCleanup();
      return true;
    }

    return false;
  }

  /**
   * Trigger garbage collection
   */
  private triggerGC(): void {
    if (!global.gc) {
      this.logger.warn('Garbage collection not available. Run with --expose-gc flag');
      return;
    }

    const before = process.memoryUsage().heapUsed;
    const timeSinceLastGC = Date.now() - this.lastGCTime;

    // Avoid too frequent GC
    if (timeSinceLastGC < 5000) {
      this.logger.debug('Skipping GC - too recent');
      return;
    }

    global.gc();
    this.lastGCTime = Date.now();
    this.gcCount++;

    const after = process.memoryUsage().heapUsed;
    const freed = before - after;

    this.logger.info({
      freed: this.formatBytes(Math.max(0, freed)),
      heapAfter: this.formatBytes(after),
      gcCount: this.gcCount
    }, 'Garbage collection completed');
  }

  /**
   * Perform aggressive memory cleanup
   */
  private performAggressiveCleanup(): void {
    this.logger.info('Performing aggressive memory cleanup');

    // Clear caches
    const cache = getOptimizedCache();
    cache.clear();

    // Force GC if available
    if (global.gc) {
      global.gc();
      global.gc(); // Double GC for thorough cleanup
    }

    // Clear any large buffers or arrays
    this.clearLargeObjects();

    const stats = this.getMemoryStats();
    this.logger.info({
      heapUsed: this.formatBytes(stats.heapUsed),
      heapTotal: this.formatBytes(stats.heapTotal)
    }, 'Aggressive cleanup completed');
  }

  /**
   * Clear large objects from memory
   */
  private clearLargeObjects(): void {
    // This is a placeholder for clearing application-specific large objects
    // In a real application, you would clear specific caches, buffers, etc.
    
    // Clear module cache for non-essential modules
    const essentialModules = new Set([
      'path', 'fs', 'crypto', 'url', 'util', 'stream', 'events'
    ]);

    for (const key of Object.keys(require.cache)) {
      if (!essentialModules.has(key) && !key.includes('node_modules')) {
        delete require.cache[key];
      }
    }
  }

  /**
   * Start periodic memory pruning
   */
  private startPruning(intervalMs: number): void {
    this.pruneTimer = setInterval(() => {
      this.pruneMemory();
    }, intervalMs);
  }

  /**
   * Prune memory by cleaning up unused resources
   */
  private pruneMemory(): void {
    const before = process.memoryUsage().heapUsed;

    // Prune cache
    const cache = getOptimizedCache();
    const pruned = cache.prune();

    // Check memory and potentially trigger GC
    this.checkMemoryUsage();

    const after = process.memoryUsage().heapUsed;
    const freed = before - after;

    if (freed > 0 || pruned > 0) {
      this.logger.debug({
        freed: this.formatBytes(Math.max(0, freed)),
        prunedEntries: pruned
      }, 'Memory pruning completed');
    }
  }

  /**
   * Get memory optimization statistics
   */
  getStats() {
    const stats = this.getMemoryStats();
    const heapUsedMB = stats.heapUsed / 1024 / 1024;
    const heapUsagePercent = (heapUsedMB / this.maxHeapUsageMB) * 100;

    return {
      heapUsed: this.formatBytes(stats.heapUsed),
      heapTotal: this.formatBytes(stats.heapTotal),
      rss: this.formatBytes(stats.rss),
      heapUsagePercent: heapUsagePercent.toFixed(2),
      gcCount: this.gcCount,
      lastGCTime: new Date(this.lastGCTime).toISOString(),
      status: heapUsagePercent > 90 ? 'critical' : 
              heapUsagePercent > 70 ? 'warning' : 'healthy'
    };
  }

  /**
   * Stop memory optimization
   */
  stop(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.logger.info('Memory optimizer stopped');
  }
}

// Global memory optimizer instance
let _globalOptimizer: MemoryOptimizer | null = null;

export function getMemoryOptimizer(): MemoryOptimizer {
  if (!_globalOptimizer) {
    _globalOptimizer = new MemoryOptimizer();
  }
  return _globalOptimizer;
}

export function resetMemoryOptimizer(): void {
  if (_globalOptimizer) {
    _globalOptimizer.stop();
  }
  _globalOptimizer = null;
}

// Extend existing global.gc declaration
declare global {
  namespace NodeJS {
    interface Global {
      gc?: () => void;
    }
  }
}
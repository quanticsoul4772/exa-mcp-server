import { structuredLogger } from './pinoLogger.js';

interface PoolOptions {
  minSize?: number;
  maxSize?: number;
  acquireTimeoutMs?: number;
  idleTimeoutMs?: number;
  evictionRunIntervalMs?: number;
}

interface PooledResource<T> {
  resource: T;
  inUse: boolean;
  lastUsed: number;
  created: number;
}

/**
 * Generic resource pool for connection/object reuse
 */
export class ResourcePool<T> {
  private readonly logger = structuredLogger.child({ component: 'ResourcePool' });
  private readonly resources: PooledResource<T>[] = [];
  private readonly waitingQueue: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  
  private readonly minSize: number;
  private readonly maxSize: number;
  private readonly acquireTimeoutMs: number;
  private readonly idleTimeoutMs: number;
  private evictionTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly factory: () => Promise<T>,
    private readonly destroyer: (resource: T) => Promise<void>,
    options: PoolOptions = {}
  ) {
    this.minSize = options.minSize ?? 1;
    this.maxSize = options.maxSize ?? 10;
    this.acquireTimeoutMs = options.acquireTimeoutMs ?? 5000;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 30000;
    
    const evictionInterval = options.evictionRunIntervalMs ?? 60000;
    if (evictionInterval > 0) {
      this.startEviction(evictionInterval);
    }

    // Initialize minimum resources
    this.initialize();
  }

  /**
   * Initialize minimum pool size
   */
  private async initialize(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.minSize; i++) {
      promises.push(this.createResource());
    }
    await Promise.all(promises);
    this.logger.info({ minSize: this.minSize }, 'Resource pool initialized');
  }

  /**
   * Create a new resource
   */
  private async createResource(): Promise<void> {
    if (this.resources.length >= this.maxSize) {
      return;
    }

    try {
      const resource = await this.factory();
      this.resources.push({
        resource,
        inUse: false,
        lastUsed: Date.now(),
        created: Date.now()
      });
      this.logger.debug('Resource created');
    } catch (error) {
      this.logger.error({ error }, 'Failed to create resource');
      throw error;
    }
  }

  /**
   * Acquire a resource from the pool
   */
  async acquire(): Promise<T> {
    // Try to get an available resource
    const available = this.resources.find(r => !r.inUse);
    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      return available.resource;
    }

    // Create new resource if below max size
    if (this.resources.length < this.maxSize) {
      await this.createResource();
      return this.acquire();
    }

    // Wait for a resource to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.timeout === timeout);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Resource acquisition timeout'));
      }, this.acquireTimeoutMs);

      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Release a resource back to the pool
   */
  release(resource: T): void {
    const pooled = this.resources.find(r => r.resource === resource);
    if (!pooled) {
      this.logger.warn('Attempted to release unknown resource');
      return;
    }

    pooled.inUse = false;
    pooled.lastUsed = Date.now();

    // Check if anyone is waiting
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        waiter.resolve(resource);
      }
    }
  }

  /**
   * Destroy a specific resource
   */
  private async destroyResource(pooled: PooledResource<T>): Promise<void> {
    const index = this.resources.indexOf(pooled);
    if (index >= 0) {
      this.resources.splice(index, 1);
      try {
        await this.destroyer(pooled.resource);
        this.logger.debug('Resource destroyed');
      } catch (error) {
        this.logger.error({ error }, 'Failed to destroy resource');
      }
    }
  }

  /**
   * Start eviction timer
   */
  private startEviction(intervalMs: number): void {
    this.evictionTimer = setInterval(() => {
      this.evictIdleResources();
    }, intervalMs);
  }

  /**
   * Evict idle resources
   */
  private async evictIdleResources(): Promise<void> {
    const now = Date.now();
    const toEvict: PooledResource<T>[] = [];

    for (const resource of this.resources) {
      if (!resource.inUse && 
          this.resources.length > this.minSize &&
          now - resource.lastUsed > this.idleTimeoutMs) {
        toEvict.push(resource);
      }
    }

    for (const resource of toEvict) {
      await this.destroyResource(resource);
    }

    if (toEvict.length > 0) {
      this.logger.info({ evicted: toEvict.length }, 'Evicted idle resources');
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const inUse = this.resources.filter(r => r.inUse).length;
    const available = this.resources.filter(r => !r.inUse).length;
    
    return {
      total: this.resources.length,
      inUse,
      available,
      waiting: this.waitingQueue.length,
      minSize: this.minSize,
      maxSize: this.maxSize
    };
  }

  /**
   * Drain and destroy all resources
   */
  async drain(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }

    // Reject all waiting
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Pool is draining'));
    }
    this.waitingQueue.length = 0;

    // Destroy all resources
    const destroyPromises = this.resources.map(r => this.destroyer(r.resource));
    await Promise.all(destroyPromises);
    this.resources.length = 0;

    this.logger.info('Resource pool drained');
  }
}
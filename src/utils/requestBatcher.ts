import { structuredLogger } from './pinoLogger.js';

interface BatchRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  params: any;
}

interface BatcherOptions {
  maxBatchSize?: number;
  batchDelayMs?: number;
  maxWaitMs?: number;
}

/**
 * Request batcher to optimize API calls by grouping multiple requests
 */
export class RequestBatcher<T> {
  private readonly logger = structuredLogger.child({ component: 'RequestBatcher' });
  private queue: BatchRequest<T>[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly maxBatchSize: number;
  private readonly batchDelayMs: number;
  private readonly maxWaitMs: number;
  private oldestRequestTime: number | null = null;

  constructor(
    private readonly batchProcessor: (requests: any[]) => Promise<T[]>,
    options: BatcherOptions = {}
  ) {
    this.maxBatchSize = options.maxBatchSize ?? 10;
    this.batchDelayMs = options.batchDelayMs ?? 50;
    this.maxWaitMs = options.maxWaitMs ?? 200;
  }

  /**
   * Add request to batch queue
   */
  async add(params: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, params });

      if (!this.oldestRequestTime) {
        this.oldestRequestTime = Date.now();
      }

      // Process immediately if batch is full
      if (this.queue.length >= this.maxBatchSize) {
        this.processBatch();
        return;
      }

      // Start or reset batch timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      // Calculate remaining wait time
      const elapsed = Date.now() - this.oldestRequestTime;
      const remainingWait = Math.max(0, Math.min(
        this.batchDelayMs,
        this.maxWaitMs - elapsed
      ));

      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, remainingWait);
    });
  }

  /**
   * Process the current batch
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.maxBatchSize);
    this.oldestRequestTime = this.queue.length > 0 ? Date.now() : null;

    this.logger.debug({ 
      batchSize: batch.length,
      remainingQueue: this.queue.length 
    }, 'Processing batch');

    try {
      const params = batch.map(req => req.params);
      const results = await this.batchProcessor(params);

      // Resolve individual promises
      batch.forEach((req, index) => {
        if (results[index] !== undefined) {
          req.resolve(results[index]);
        } else {
          req.reject(new Error('No result for batch request'));
        }
      });
    } catch (error) {
      // Reject all promises in batch
      const errorObj = error instanceof Error ? error : new Error(String(error));
      batch.forEach(req => req.reject(errorObj));
    }

    // Process remaining queue if any
    if (this.queue.length > 0) {
      setImmediate(() => this.processBatch());
    }
  }

  /**
   * Flush all pending requests immediately
   */
  async flush(): Promise<void> {
    while (this.queue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      hasPendingTimer: this.batchTimer !== null,
      oldestRequestAge: this.oldestRequestTime 
        ? Date.now() - this.oldestRequestTime 
        : 0
    };
  }
}
import { structuredLogger } from './pinoLogger.js';

/**
 * Rate limiter configuration
 */
interface RateLimiterConfig {
  maxRequests: number;      // Maximum number of requests
  windowMs: number;         // Time window in milliseconds
  maxBurst?: number;        // Maximum burst size (optional)
  retryAfterMs?: number;    // Time to wait before retry (optional)
}

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  public readonly retryAfter: number;
  
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Token bucket rate limiter implementation
 * Provides smooth rate limiting with burst capability
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly config: Required<RateLimiterConfig>;
  private readonly logger = structuredLogger.child({ component: 'RateLimiter' });
  private requestQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      maxBurst: config.maxBurst || config.maxRequests,
      retryAfterMs: config.retryAfterMs || config.windowMs
    };
    
    this.tokens = this.config.maxBurst;
    this.lastRefill = Date.now();
    
    this.logger.info({
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      maxBurst: this.config.maxBurst
    }, 'Rate limiter initialized');
  }

  /**
   * Check if a request can proceed
   * @returns true if request can proceed, false otherwise
   */
  public canProceed(): boolean {
    this.refillTokens();
    return this.tokens > 0;
  }

  /**
   * Consume a token for a request
   * @throws RateLimitError if no tokens available
   */
  public async consume(): Promise<void> {
    this.refillTokens();
    
    if (this.tokens > 0) {
      this.tokens--;
      this.logger.debug({
        tokensRemaining: this.tokens,
        maxBurst: this.config.maxBurst
      }, 'Token consumed');
      return;
    }

    // Calculate time until next token
    const timeUntilNextToken = this.getTimeUntilNextToken();
    
    this.logger.warn({
      timeUntilNextToken,
      retryAfterMs: this.config.retryAfterMs
    }, 'Rate limit reached');
    
    throw new RateLimitError(
      `Rate limit exceeded. Please retry after ${timeUntilNextToken}ms`,
      timeUntilNextToken
    );
  }

  /**
   * Consume a token with automatic retry
   * @param maxRetries Maximum number of retries
   * @returns Promise that resolves when token is consumed
   */
  public async consumeWithRetry(maxRetries: number = 3): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.consume();
        return;
      } catch (error) {
        if (error instanceof RateLimitError && attempt < maxRetries) {
          this.logger.debug({
            attempt,
            maxRetries,
            retryAfter: error.retryAfter
          }, 'Rate limited, waiting before retry');
          
          // Wait for the specified time before retrying
          await this.delay(error.retryAfter);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Queue a request to be executed when a token is available
   * @returns Promise that resolves when the request can proceed
   */
  public async queue(): Promise<void> {
    // Try to consume immediately
    if (this.canProceed()) {
      this.tokens--;
      return;
    }

    // Add to queue
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.logger.debug({
        queueLength: this.requestQueue.length
      }, 'Request queued');
      
      // Process queue
      this.processQueue();
    });
  }

  /**
   * Get current rate limit status
   */
  public getStatus(): {
    tokensAvailable: number;
    maxTokens: number;
    timeUntilRefill: number;
    queueLength: number;
  } {
    this.refillTokens();
    
    return {
      tokensAvailable: this.tokens,
      maxTokens: this.config.maxBurst,
      timeUntilRefill: this.getTimeUntilNextToken(),
      queueLength: this.requestQueue.length
    };
  }

  /**
   * Reset the rate limiter
   */
  public reset(): void {
    this.tokens = this.config.maxBurst;
    this.lastRefill = Date.now();
    
    // Clear queue
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        request.reject(new Error('Rate limiter reset'));
      }
    }
    
    this.logger.info('Rate limiter reset');
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    // Calculate how many tokens to add
    const tokensToAdd = Math.floor(
      (timePassed / this.config.windowMs) * this.config.maxRequests
    );
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(
        this.tokens + tokensToAdd,
        this.config.maxBurst
      );
      this.lastRefill = now;
      
      this.logger.debug({
        tokensAdded: tokensToAdd,
        totalTokens: this.tokens
      }, 'Tokens refilled');
      
      // Process any queued requests
      this.processQueue();
    }
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    while (this.requestQueue.length > 0 && this.canProceed()) {
      const request = this.requestQueue.shift();
      if (request) {
        this.tokens--;
        request.resolve();
        
        this.logger.debug({
          queueLength: this.requestQueue.length
        }, 'Queued request processed');
      }
    }
    
    // Schedule next queue processing if needed
    if (this.requestQueue.length > 0) {
      const timeUntilNextToken = this.getTimeUntilNextToken();
      setTimeout(() => this.processQueue(), timeUntilNextToken);
    }
  }

  /**
   * Calculate time until next token is available
   */
  private getTimeUntilNextToken(): number {
    const tokenRefillRate = this.config.windowMs / this.config.maxRequests;
    const timeSinceLastRefill = Date.now() - this.lastRefill;
    const timeUntilNextToken = Math.max(0, tokenRefillRate - timeSinceLastRefill);
    
    return Math.ceil(timeUntilNextToken);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Global rate limiter instance for Exa API
 * Configured based on Exa API limits
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get or create the global rate limiter
 * @param config Optional configuration (used on first call)
 */
export function getGlobalRateLimiter(config?: RateLimiterConfig): RateLimiter {
  if (!globalRateLimiter) {
    // Default Exa API limits: 100 requests per minute
    const defaultConfig: RateLimiterConfig = {
      maxRequests: config?.maxRequests || 100,
      windowMs: config?.windowMs || 60000, // 1 minute
      maxBurst: config?.maxBurst || 10,     // Allow burst of 10
      retryAfterMs: config?.retryAfterMs || 1000 // Retry after 1 second
    };
    
    globalRateLimiter = new RateLimiter(defaultConfig);
  }
  
  return globalRateLimiter;
}

/**
 * Reset the global rate limiter
 */
export function resetGlobalRateLimiter(): void {
  if (globalRateLimiter) {
    globalRateLimiter.reset();
  }
  globalRateLimiter = null;
}

/**
 * Rate limiting middleware for tools
 * Wraps a tool handler with rate limiting
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  rateLimiter?: RateLimiter
): T {
  const limiter = rateLimiter || getGlobalRateLimiter();
  
  return (async (...args: Parameters<T>) => {
    // Wait for rate limit
    await limiter.queue();
    
    // Execute the handler
    return handler(...args);
  }) as T;
}
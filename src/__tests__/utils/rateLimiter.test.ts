import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RateLimiter, RateLimitError, getGlobalRateLimiter, resetGlobalRateLimiter } from '../../utils/rateLimiter.js';

// Mock pinoLogger
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

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Create a rate limiter with 5 requests per 100ms for testing
    rateLimiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 100,
      maxBurst: 5
    });
  });

  afterEach(() => {
    rateLimiter.reset();
    resetGlobalRateLimiter();
  });

  describe('Basic functionality', () => {
    it('should allow requests within limit', async () => {
      for (let i = 0; i < 5; i++) {
        await expect(rateLimiter.consume()).resolves.toBeUndefined();
      }
    });

    it('should block requests over limit', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume();
      }

      // Next request should fail
      await expect(rateLimiter.consume()).rejects.toThrow(RateLimitError);
    });

    it('should check if request can proceed', () => {
      expect(rateLimiter.canProceed()).toBe(true);
      
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.canProceed();
        rateLimiter.consume().catch(() => {}); // Ignore errors
      }
      
      expect(rateLimiter.canProceed()).toBe(false);
    });
  });

  describe('Token refill', () => {
    it('should refill tokens over time', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume();
      }

      // Should be rate limited
      expect(rateLimiter.canProceed()).toBe(false);

      // Wait for tokens to refill
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have tokens again
      expect(rateLimiter.canProceed()).toBe(true);
    });
  });

  describe('Queue functionality', () => {
    it('should queue requests when rate limited', async () => {
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume();
      }

      // Queue a request
      const queuePromise = rateLimiter.queue();

      // Should not resolve immediately
      let resolved = false;
      queuePromise.then(() => { resolved = true; });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(resolved).toBe(false);

      // Wait for token refill
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should resolve now
      await expect(queuePromise).resolves.toBeUndefined();
    });
  });

  describe('Status reporting', () => {
    it('should report current status', () => {
      const status = rateLimiter.getStatus();
      
      expect(status.tokensAvailable).toBe(5);
      expect(status.maxTokens).toBe(5);
      expect(status.queueLength).toBe(0);
      expect(status.timeUntilRefill).toBeGreaterThanOrEqual(0);
    });

    it('should update status after consuming tokens', async () => {
      await rateLimiter.consume();
      await rateLimiter.consume();
      
      const status = rateLimiter.getStatus();
      expect(status.tokensAvailable).toBe(3);
    });
  });

  describe('Reset functionality', () => {
    it('should reset to initial state', async () => {
      // Consume some tokens
      await rateLimiter.consume();
      await rateLimiter.consume();
      
      expect(rateLimiter.getStatus().tokensAvailable).toBe(3);
      
      // Reset
      rateLimiter.reset();
      
      expect(rateLimiter.getStatus().tokensAvailable).toBe(5);
    });
  });

  describe('Global rate limiter', () => {
    it('should create and return singleton instance', () => {
      const limiter1 = getGlobalRateLimiter();
      const limiter2 = getGlobalRateLimiter();
      
      expect(limiter1).toBe(limiter2);
    });

    it('should reset global instance', () => {
      const limiter1 = getGlobalRateLimiter();
      resetGlobalRateLimiter();
      const limiter2 = getGlobalRateLimiter();
      
      expect(limiter1).not.toBe(limiter2);
    });
  });
});
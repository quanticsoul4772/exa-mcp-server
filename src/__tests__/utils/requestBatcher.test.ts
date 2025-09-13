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

import { RequestBatcher } from '../../utils/requestBatcher.js';

describe('RequestBatcher', () => {
  let batcher: RequestBatcher<string, string>;
  let processor: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = jest.fn();
    batcher = new RequestBatcher(processor, {
      maxBatchSize: 3,
      maxWaitTime: 100
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Batching', () => {
    it('should batch requests together', async () => {
      processor.mockResolvedValue(['result1', 'result2']);
      
      const p1 = batcher.add('req1');
      const p2 = batcher.add('req2');
      
      const [r1, r2] = await Promise.all([p1, p2]);
      
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor).toHaveBeenCalledWith(['req1', 'req2']);
      expect(r1).toBe('result1');
      expect(r2).toBe('result2');
    });

    it('should process immediately when batch is full', async () => {
      processor.mockResolvedValue(['r1', 'r2', 'r3']);
      
      const p1 = batcher.add('req1');
      const p2 = batcher.add('req2');
      const p3 = batcher.add('req3'); // Max batch size reached
      
      const results = await Promise.all([p1, p2, p3]);
      
      expect(processor).toHaveBeenCalledTimes(1);
      expect(results).toEqual(['r1', 'r2', 'r3']);
    });

    it('should process after max wait time', async () => {
      jest.useFakeTimers();
      processor.mockResolvedValue(['result1']);
      
      const promise = batcher.add('req1');
      
      // Fast-forward time
      jest.advanceTimersByTime(100);
      
      const result = await promise;
      
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor).toHaveBeenCalledWith(['req1']);
      expect(result).toBe('result1');
    });
  });

  describe('Multiple Batches', () => {
    it('should handle multiple batches sequentially', async () => {
      processor
        .mockResolvedValueOnce(['r1', 'r2', 'r3'])
        .mockResolvedValueOnce(['r4', 'r5']);
      
      // First batch
      const batch1 = Promise.all([
        batcher.add('req1'),
        batcher.add('req2'),
        batcher.add('req3')
      ]);
      
      await batch1;
      
      // Second batch
      const batch2 = Promise.all([
        batcher.add('req4'),
        batcher.add('req5')
      ]);
      
      await batch2;
      
      expect(processor).toHaveBeenCalledTimes(2);
      expect(processor).toHaveBeenNthCalledWith(1, ['req1', 'req2', 'req3']);
      expect(processor).toHaveBeenNthCalledWith(2, ['req4', 'req5']);
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors to all requests in batch', async () => {
      const error = new Error('Processing failed');
      processor.mockRejectedValue(error);
      
      const p1 = batcher.add('req1');
      const p2 = batcher.add('req2');
      
      await expect(p1).rejects.toThrow('Processing failed');
      await expect(p2).rejects.toThrow('Processing failed');
    });

    it('should handle mismatched result count', async () => {
      processor.mockResolvedValue(['only-one']);
      
      const p1 = batcher.add('req1');
      const p2 = batcher.add('req2');
      
      await expect(p1).rejects.toThrow();
      await expect(p2).rejects.toThrow();
    });

    it('should continue processing after error', async () => {
      processor
        .mockRejectedValueOnce(new Error('First batch failed'))
        .mockResolvedValueOnce(['success']);
      
      const p1 = batcher.add('req1');
      await expect(p1).rejects.toThrow('First batch failed');
      
      const p2 = batcher.add('req2');
      const r2 = await p2;
      
      expect(r2).toBe('success');
      expect(processor).toHaveBeenCalledTimes(2);
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate identical requests', async () => {
      const deduper = new RequestBatcher(processor, {
        maxBatchSize: 5,
        maxWaitTime: 100,
        deduplicate: true
      });
      
      processor.mockResolvedValue(['result']);
      
      const p1 = deduper.add('same');
      const p2 = deduper.add('same');
      const p3 = deduper.add('same');
      
      const results = await Promise.all([p1, p2, p3]);
      
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor).toHaveBeenCalledWith(['same']);
      expect(results).toEqual(['result', 'result', 'result']);
    });

    it('should not deduplicate when disabled', async () => {
      processor.mockResolvedValue(['r1', 'r2', 'r3']);
      
      const p1 = batcher.add('same');
      const p2 = batcher.add('same');
      const p3 = batcher.add('same');
      
      await Promise.all([p1, p2, p3]);
      
      expect(processor).toHaveBeenCalledWith(['same', 'same', 'same']);
    });
  });

  describe('Statistics', () => {
    it('should track batch statistics', async () => {
      processor.mockResolvedValue(['r1', 'r2']);
      
      await Promise.all([
        batcher.add('req1'),
        batcher.add('req2')
      ]);
      
      const stats = batcher.getStats();
      
      expect(stats.totalBatches).toBe(1);
      expect(stats.totalRequests).toBe(2);
      expect(stats.averageBatchSize).toBe(2);
      expect(stats.currentQueueSize).toBe(0);
    });

    it('should calculate average batch size', async () => {
      processor
        .mockResolvedValueOnce(['r1', 'r2', 'r3'])
        .mockResolvedValueOnce(['r4']);
      
      // First batch of 3
      await Promise.all([
        batcher.add('req1'),
        batcher.add('req2'),
        batcher.add('req3')
      ]);
      
      // Second batch of 1
      await batcher.add('req4');
      
      const stats = batcher.getStats();
      
      expect(stats.totalBatches).toBe(2);
      expect(stats.totalRequests).toBe(4);
      expect(stats.averageBatchSize).toBe(2); // (3 + 1) / 2
    });
  });

  describe('Flush', () => {
    it('should flush pending requests', async () => {
      jest.useFakeTimers();
      processor.mockResolvedValue(['r1', 'r2']);
      
      const p1 = batcher.add('req1');
      const p2 = batcher.add('req2');
      
      // Flush immediately without waiting
      await batcher.flush();
      
      const results = await Promise.all([p1, p2]);
      
      expect(processor).toHaveBeenCalledTimes(1);
      expect(results).toEqual(['r1', 'r2']);
      
      jest.useRealTimers();
    });

    it('should handle flush with no pending requests', async () => {
      await expect(batcher.flush()).resolves.toBeUndefined();
      expect(processor).not.toHaveBeenCalled();
    });
  });

  describe('Custom Processor', () => {
    it('should work with async processor', async () => {
      const asyncProcessor = jest.fn(async (items: string[]) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return items.map(item => `processed-${item}`);
      });
      
      const asyncBatcher = new RequestBatcher(asyncProcessor);
      
      const result = await asyncBatcher.add('test');
      
      expect(result).toBe('processed-test');
    });

    it('should handle processor that returns promises', async () => {
      processor.mockImplementation((items: string[]) => 
        Promise.resolve(items.map(i => i.toUpperCase()))
      );
      
      const r1 = await batcher.add('hello');
      const r2 = await batcher.add('world');
      
      expect(r1).toBe('HELLO');
      expect(r2).toBe('WORLD');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', async () => {
      const defaultBatcher = new RequestBatcher(processor);
      processor.mockResolvedValue(['result']);
      
      const result = await defaultBatcher.add('req');
      
      expect(result).toBe('result');
    });

    it('should respect custom batch size', async () => {
      const customBatcher = new RequestBatcher(processor, {
        maxBatchSize: 1,
        maxWaitTime: 1000
      });
      
      processor
        .mockResolvedValueOnce(['r1'])
        .mockResolvedValueOnce(['r2']);
      
      const p1 = customBatcher.add('req1');
      const p2 = customBatcher.add('req2');
      
      await Promise.all([p1, p2]);
      
      // Should be called twice since max batch size is 1
      expect(processor).toHaveBeenCalledTimes(2);
    });
  });
});
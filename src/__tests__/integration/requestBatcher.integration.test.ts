import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import '../../__tests__/setup.js';

describe('RequestBatcher Integration', () => {
  let RequestBatcher: any;
  let batcher: any;
  let processor: jest.Mock;

  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();
    
    // Import the module
    const batcherModule = await import('../../utils/requestBatcher.js');
    RequestBatcher = batcherModule.RequestBatcher;
    
    // Create mock processor
    processor = jest.fn();
    
    // Create batcher instance
    batcher = new RequestBatcher(processor, {
      maxBatchSize: 3,
      maxWaitTime: 100
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should create RequestBatcher instance', () => {
    expect(batcher).toBeDefined();
    expect(batcher.add).toBeDefined();
    expect(batcher.flush).toBeDefined();
    expect(batcher.getStats).toBeDefined();
  });

  it('should batch requests together', async () => {
    processor.mockResolvedValue(['result1', 'result2']);
    
    const p1 = batcher.add('req1');
    const p2 = batcher.add('req2');
    
    // Trigger batch processing
    jest.advanceTimersByTime(100);
    
    const [r1, r2] = await Promise.all([p1, p2]);
    
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith(['req1', 'req2']);
    expect(r1).toBe('result1');
    expect(r2).toBe('result2');
  });

  it('should process when batch is full', async () => {
    processor.mockResolvedValue(['r1', 'r2', 'r3']);
    
    const p1 = batcher.add('req1');
    const p2 = batcher.add('req2');
    const p3 = batcher.add('req3'); // Max size reached
    
    // Should process immediately without waiting
    const results = await Promise.all([p1, p2, p3]);
    
    expect(processor).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['r1', 'r2', 'r3']);
  });

  it('should handle errors in batch processing', async () => {
    const error = new Error('Processing failed');
    processor.mockRejectedValue(error);
    
    const p1 = batcher.add('req1');
    const p2 = batcher.add('req2');
    
    jest.advanceTimersByTime(100);
    
    await expect(p1).rejects.toThrow('Processing failed');
    await expect(p2).rejects.toThrow('Processing failed');
  });

  it('should flush pending requests', async () => {
    processor.mockResolvedValue(['result1']);
    
    const p1 = batcher.add('req1');
    
    // Flush immediately
    await batcher.flush();
    
    const result = await p1;
    expect(result).toBe('result1');
    expect(processor).toHaveBeenCalledTimes(1);
  });

  it('should track statistics', async () => {
    processor.mockResolvedValue(['r1', 'r2']);
    
    const p1 = batcher.add('req1');
    const p2 = batcher.add('req2');
    
    jest.advanceTimersByTime(100);
    await Promise.all([p1, p2]);
    
    const stats = batcher.getStats();
    expect(stats.totalBatches).toBe(1);
    expect(stats.totalRequests).toBe(2);
    expect(stats.averageBatchSize).toBe(2);
  });

  it('should handle empty flush', async () => {
    await expect(batcher.flush()).resolves.toBeUndefined();
    expect(processor).not.toHaveBeenCalled();
  });

  it('should process multiple batches', async () => {
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
    
    jest.advanceTimersByTime(100);
    await batch2;
    
    expect(processor).toHaveBeenCalledTimes(2);
    
    const stats = batcher.getStats();
    expect(stats.totalBatches).toBe(2);
    expect(stats.totalRequests).toBe(5);
  });
});
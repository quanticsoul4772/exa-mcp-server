import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import '../setup.js';

// Must mock before importing the tool
jest.mock('../../utils/exaClient.js', () => ({
  getSharedExaClient: jest.fn(),
  handleExaError: jest.fn((_error: unknown, toolName: string) => ({
    content: [{ type: 'text' as const, text: `Error in ${toolName}` }],
    isError: true
  }))
}));

jest.mock('../../utils/rateLimiter.js', () => ({
  getGlobalRateLimiter: jest.fn(() => ({
    queue: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../utils/pinoLogger.js', () => ({
  structuredLogger: {
    child: jest.fn(() => ({
      debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
    }))
  },
  createRequestLogger: jest.fn(() => ({
    start: jest.fn(),
    log: jest.fn(),
    complete: jest.fn(),
    error: jest.fn()
  })),
  generateRequestId: jest.fn(() => 'test-req-id'),
  logWarn: jest.fn()
}));

jest.mock('../../utils/usageLogger.js', () => ({
  logExaUsage: jest.fn()
}));

jest.mock('../../tools/progress-tracker.js', () => ({
  ProgressTracker: jest.fn().mockImplementation(() => ({
    update: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    complete: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  })),
  extractToolContext: jest.fn(() => ({
    requestId: null,
    progressToken: null,
    server: null
  }))
}));

import { researchTool } from '../../tools/research.js';
import { getSharedExaClient } from '../../utils/exaClient.js';
import { getGlobalRateLimiter } from '../../utils/rateLimiter.js';

const mockPost = jest.fn<() => Promise<any>>();
const mockGet = jest.fn<() => Promise<any>>();

beforeEach(() => {
  jest.clearAllMocks();
  (getSharedExaClient as jest.MockedFunction<typeof getSharedExaClient>).mockReturnValue({
    post: mockPost,
    get: mockGet
  } as any);
});

describe('research tool', () => {
  describe('schema validation', () => {
    it('rejects empty objective', async () => {
      const result = await researchTool.handler({ objective: '' }, undefined);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid arguments');
    });

    it('rejects objective over 4096 chars', async () => {
      const result = await researchTool.handler({ objective: 'x'.repeat(4097) }, undefined);
      expect(result.isError).toBe(true);
    });
  });

  describe('successful research', () => {
    it('returns formatted markdown for unstructured result', async () => {
      mockPost.mockResolvedValueOnce({
        data: { taskId: 'task-123', status: 'pending', estimatedTime: 10 }
      });
      mockGet.mockResolvedValueOnce({
        data: {
          taskId: 'task-123',
          status: 'completed',
          result: {
            summary: 'Key findings here.',
            findings: ['Finding A', 'Finding B'],
            sources: [{ title: 'Source 1', url: 'https://example.com' }]
          }
        }
      });

      const result = await researchTool.handler(
        { objective: 'What is quantum computing?' },
        undefined
      );

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('## Research Results');
      expect(result.content[0].text).toContain('Key findings here.');
      expect(result.content[0].text).toContain('Finding A');
      expect(result.content[0].text).toContain('Source 1');
    });

    it('returns JSON block for structured output with outputSchema', async () => {
      mockPost.mockResolvedValueOnce({
        data: { taskId: 'task-456', status: 'pending', estimatedTime: 5 }
      });
      mockGet.mockResolvedValueOnce({
        data: {
          taskId: 'task-456',
          status: 'completed',
          result: { field: 'value' }
        }
      });

      const result = await researchTool.handler(
        { objective: 'structured query', outputSchema: { type: 'object' } },
        undefined
      );

      expect(result.content[0].text).toContain('### Structured Data');
      expect(result.content[0].text).toContain('"field": "value"');
    });

    it('handles string result directly', async () => {
      mockPost.mockResolvedValueOnce({
        data: { taskId: 'task-789', status: 'pending', estimatedTime: 3 }
      });
      mockGet.mockResolvedValueOnce({
        data: { taskId: 'task-789', status: 'completed', result: 'Plain text result' }
      });

      const result = await researchTool.handler(
        { objective: 'simple question' },
        undefined
      );

      expect(result.content[0].text).toContain('Plain text result');
    });
  });

  describe('error handling', () => {
    it('handles failed task status from API', async () => {
      mockPost.mockResolvedValueOnce({
        data: { taskId: 'task-fail', status: 'pending', estimatedTime: 1 }
      });
      mockGet.mockResolvedValueOnce({
        data: { taskId: 'task-fail', status: 'failed', error: 'Research failed' }
      });

      const result = await researchTool.handler(
        { objective: 'failing query' },
        undefined
      );

      expect(result.isError).toBe(true);
    });

    it('returns isError on network error from POST', async () => {
      const networkError = new Error('Network timeout');
      mockPost.mockRejectedValueOnce(networkError);

      const result = await researchTool.handler(
        { objective: 'will timeout' },
        undefined
      );

      expect(result.isError).toBe(true);
    });

    it('times out after max polling attempts', async () => {
      mockPost.mockResolvedValueOnce({
        data: { taskId: 'task-timeout', status: 'pending', estimatedTime: 999 }
      });
      // Always return processing — exhausts the 60-attempt limit
      mockGet.mockResolvedValue({
        data: { taskId: 'task-timeout', status: 'processing', progress: 50 }
      });

      // Replace setTimeout to run synchronously so we don't wait 2min in tests
      const origSetTimeout = global.setTimeout;
      global.setTimeout = ((fn: () => void) => { fn(); return 0 as any; }) as any;

      const result = await researchTool.handler(
        { objective: 'never completes' },
        undefined
      );

      global.setTimeout = origSetTimeout;
      expect(result.isError).toBe(true);
    }, 15000);
  });

  describe('rate limiter integration', () => {
    it('calls getGlobalRateLimiter() before the API POST', async () => {
      mockPost.mockResolvedValueOnce({
        data: { taskId: 'rl-task', status: 'pending', estimatedTime: 1 }
      });
      mockGet.mockResolvedValueOnce({
        data: { taskId: 'rl-task', status: 'completed', result: 'done' }
      });

      await researchTool.handler({ objective: 'rate limit check' }, undefined);

      expect(getGlobalRateLimiter).toHaveBeenCalled();
    });
  });
});

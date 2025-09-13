import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { z } from 'zod';
import { createTool, createSearchTool } from '../../tools/tool-builder.js';
import { ToolHandlerExtra } from '../../tools/config.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Mock dependencies
jest.mock('../../utils/exaClient.js', () => ({
  createExaClient: jest.fn(() => ({
    post: jest.fn().mockResolvedValue({
      data: {
        results: [
          { title: 'Test Result', url: 'https://example.com' }
        ]
      }
    })
  })),
  handleExaError: jest.fn()
}));

jest.mock('../../utils/cache.js', () => ({
  getGlobalCache: jest.fn(() => ({
    get: jest.fn().mockReturnValue(null),
    set: jest.fn()
  }))
}));

jest.mock('../../config/index.js', () => ({
  getConfig: jest.fn(() => ({
    tools: {
      defaultNumResults: 5,
      defaultMaxCharacters: 1000
    }
  }))
}));

jest.mock('../../utils/pinoLogger.js', () => ({
  createRequestLogger: jest.fn(() => ({
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    start: jest.fn(),
    complete: jest.fn()
  })),
  generateRequestId: jest.fn(() => 'test-request-id')
}));

jest.mock('../../utils/formatter.js', () => ({
  ResponseFormatter: {
    formatSearchResponse: jest.fn(() => 'Formatted search response'),
    formatResearchPaperResponse: jest.fn(() => 'Formatted research response')
  }
}));

describe('Tool Builder Progress Integration', () => {
  let mockServer: jest.Mocked<Server>;

  beforeEach(() => {
    mockServer = {
      notification: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<Server>;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createTool with progress steps', () => {
    it('should send progress notifications when progressToken is provided', async () => {
      const testSchema = z.object({
        query: z.string()
      });

      const tool = createTool({
        name: 'test_tool',
        description: 'Test tool with progress',
        schema: testSchema,
        enabled: true,
        endpoint: '/search',
        createRequest: (args) => ({ query: args.query }),
        formatResponse: (data) => 'Test response',
        getStartContext: (args) => args.query,
        progressSteps: [
          'Preparing request...',
          'Sending API request...',
          'Processing response...',
          'Formatting results...'
        ]
      });

      const extra: ToolHandlerExtra = {
        _meta: {
          progressToken: 'progress-123',
          requestId: 'client-req-456'
        },
        server: mockServer
      };

      const result = await tool.handler({ query: 'test query' }, extra);

      // Verify progress notifications were sent
      const notificationCalls = mockServer.notification.mock.calls;

      // Initial progress
      expect(notificationCalls[0][0]).toEqual({
        method: 'notifications/progress',
        params: {
          progressToken: 'progress-123',
          progress: 0,
          total: 4,
          message: 'Starting request...'
        }
      });

      // Step 1: Preparing request
      expect(notificationCalls[1][0]).toEqual({
        method: 'notifications/progress',
        params: {
          progressToken: 'progress-123',
          progress: 1,
          total: 4,
          message: 'Preparing request...'
        }
      });

      // Verify result
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Test response'
        }]
      });
    });

    it('should work without progress tracking', async () => {
      const testSchema = z.object({
        query: z.string()
      });

      const tool = createTool({
        name: 'test_tool',
        description: 'Test tool without progress',
        schema: testSchema,
        enabled: true,
        endpoint: '/search',
        createRequest: (args) => ({ query: args.query }),
        formatResponse: (data) => 'Test response',
        getStartContext: (args) => args.query
        // No progressSteps defined
      });

      const result = await tool.handler({ query: 'test query' });

      expect(mockServer.notification).not.toHaveBeenCalled();
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: 'Test response'
        }]
      });
    });
  });

  describe('createSearchTool with progress', () => {
    it('should support progress steps in search tools', async () => {
      const schema = z.object({
        query: z.string(),
        numResults: z.number().optional()
      });

      const tool = createSearchTool(
        'test_search',
        'Test search tool',
        schema,
        true,
        ({ query, numResults }) => ({
          query,
          type: 'auto',
          numResults: numResults || 5
        }),
        undefined,
        [
          'Searching...',
          'Retrieving results...',
          'Processing data...',
          'Formatting output...'
        ]
      );

      const extra: ToolHandlerExtra = {
        _meta: {
          progressToken: 'search-progress-123'
        },
        server: mockServer
      };

      await tool.handler({ query: 'test search' }, extra);

      // Verify at least one progress notification was sent
      expect(mockServer.notification).toHaveBeenCalled();

      const firstCall = mockServer.notification.mock.calls[0][0];
      expect(firstCall.method).toBe('notifications/progress');
      expect(firstCall.params.progressToken).toBe('search-progress-123');
    });
  });

  describe('Request ID correlation', () => {
    it('should use client requestId when provided', async () => {
      const { createRequestLogger } = await import('../../utils/pinoLogger.js');

      const testSchema = z.object({
        query: z.string()
      });

      const tool = createTool({
        name: 'test_tool',
        description: 'Test tool',
        schema: testSchema,
        enabled: true,
        endpoint: '/search',
        createRequest: (args) => ({ query: args.query }),
        formatResponse: (data) => 'Test response',
        getStartContext: (args) => args.query
      });

      const extra: ToolHandlerExtra = {
        _meta: {
          requestId: 'client-request-789'
        }
      };

      await tool.handler({ query: 'test' }, extra);

      // Verify that createRequestLogger was called with the client's requestId
      expect(createRequestLogger).toHaveBeenCalledWith(
        'test-request-id',
        'test_tool',
        'client-request-789'
      );
    });
  });

  describe('Cache interaction with progress', () => {
    it('should complete progress immediately on cache hit', async () => {
      const { getGlobalCache } = await import('../../utils/cache.js');
      const mockCache = {
        get: jest.fn().mockReturnValue({ results: ['cached result'] }),
        set: jest.fn()
      };
      (getGlobalCache as jest.Mock).mockReturnValue(mockCache);

      const testSchema = z.object({
        query: z.string()
      });

      const tool = createTool({
        name: 'cached_tool',
        description: 'Test tool with cache',
        schema: testSchema,
        enabled: true,
        endpoint: '/search',
        createRequest: (args) => ({ query: args.query }),
        formatResponse: (data) => 'Cached response',
        getStartContext: (args) => args.query,
        progressSteps: ['Step 1', 'Step 2', 'Step 3']
      });

      const extra: ToolHandlerExtra = {
        _meta: {
          progressToken: 'cache-progress-123'
        },
        server: mockServer
      };

      await tool.handler({ query: 'cached query' }, extra);

      // Should have initial progress and completion for cache hit
      const notificationCalls = mockServer.notification.mock.calls;

      // Check for completion message on cache hit
      const completionCall = notificationCalls.find(call =>
        call[0].params?.message === 'Using cached response'
      );

      expect(completionCall).toBeDefined();
      expect(completionCall![0].params.progress).toBe(3); // Should be at total
    });
  });
});
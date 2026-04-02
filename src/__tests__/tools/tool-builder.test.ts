import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { z } from 'zod';
import '../setup.js';

// Mock dependencies
jest.mock('../../utils/exaClient.js', () => ({
  createExaClient: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn()
  })),
  getSharedExaClient: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn()
  })),
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

jest.mock('../../utils/cache.js', () => ({
  getGlobalCache: jest.fn(() => ({
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    has: jest.fn().mockReturnValue(false)
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
  generateRequestId: jest.fn(() => 'test-req-id')
}));

jest.mock('../../utils/usageLogger.js', () => ({
  logExaUsage: jest.fn()
}));

jest.mock('../../tools/progress-tracker.js', () => ({
  ProgressTracker: jest.fn().mockImplementation(() => ({
    update: jest.fn<() => Promise<void>>().mockResolvedValue(),
    increment: jest.fn<() => Promise<void>>().mockResolvedValue(),
    complete: jest.fn<() => Promise<void>>().mockResolvedValue()
  })),
  extractToolContext: jest.fn(() => ({
    requestId: null,
    progressToken: null,
    server: null
  }))
}));

import { createTool, createSearchTool, createCrawlTool } from '../../tools/tool-builder.js';
import { getSharedExaClient } from '../../utils/exaClient.js';
import { getGlobalCache } from '../../utils/cache.js';

describe('Tool Builder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset cache mock to return null by default
    (getGlobalCache as jest.MockedFunction<typeof getGlobalCache>).mockReturnValue({
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      has: jest.fn().mockReturnValue(false),
      delete: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
      prune: jest.fn(),
      setEnabled: jest.fn(),
      isEnabled: jest.fn()
    } as any);
  });

  describe('createTool', () => {
    it('should create a tool with required properties', () => {
      const schema = z.object({ query: z.string() });

      const tool = createTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        enabled: true,
        endpoint: '/test',
        createRequest: (args) => args,
        formatResponse: () => 'formatted',
        getStartContext: (args) => args.query
      });

      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('Test tool');
      expect(tool.schema).toBeDefined();
      expect(tool.handler).toBeDefined();
    });

    it('should handle tool execution', async () => {
      const mockPost = jest.fn<() => Promise<any>>().mockResolvedValue({
        data: { results: [{ url: 'https://example.com', title: 'Example', text: 'Content' }] }
      });
      (getSharedExaClient as jest.MockedFunction<typeof getSharedExaClient>).mockReturnValue({
        post: mockPost
      } as any);

      const schema = z.object({ query: z.string() });

      const tool = createTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        enabled: true,
        endpoint: '/search',
        createRequest: (args) => ({ query: args.query }),
        formatResponse: () => 'Result text',
        getStartContext: (args) => args.query
      });

      const result = await tool.handler({ query: 'test' }, {});

      expect(result.content[0].text).toBe('Result text');
    });

    it('should handle validation errors', async () => {
      const schema = z.object({ query: z.string().min(5) });

      const tool = createTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        enabled: true,
        endpoint: '/search',
        createRequest: (args) => args,
        formatResponse: () => 'ok',
        getStartContext: (args) => args.query
      });

      const result = await tool.handler({ query: 'hi' }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid arguments');
    });

    it('should return cached results when available', async () => {
      const cachedData = { results: [{ url: 'https://cached.com', title: 'Cached', text: 'Cached content' }] };
      const mockPost = jest.fn();
      (getSharedExaClient as jest.MockedFunction<typeof getSharedExaClient>).mockReturnValue({
        post: mockPost
      } as any);
      (getGlobalCache as jest.MockedFunction<typeof getGlobalCache>).mockReturnValue({
        get: jest.fn().mockReturnValue(cachedData),
        set: jest.fn(),
        has: jest.fn().mockReturnValue(true),
        delete: jest.fn(),
        clear: jest.fn(),
        getStats: jest.fn(),
        prune: jest.fn(),
        setEnabled: jest.fn(),
        isEnabled: jest.fn()
      } as any);

      const schema = z.object({ query: z.string() });

      const tool = createTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        enabled: true,
        endpoint: '/search',
        createRequest: (args) => args,
        formatResponse: (data: any) => data.results[0].title,
        getStartContext: (args) => args.query
      });

      const result = await tool.handler({ query: 'cached search' }, {});

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe('Cached');
    });

    it('should handle handler errors', async () => {
      const mockPost = jest.fn<() => Promise<any>>().mockRejectedValue(new Error('Handler failed'));
      (getSharedExaClient as jest.MockedFunction<typeof getSharedExaClient>).mockReturnValue({
        post: mockPost
      } as any);

      const schema = z.object({ query: z.string() });

      const tool = createTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        enabled: true,
        endpoint: '/search',
        createRequest: (args) => args,
        formatResponse: () => 'ok',
        getStartContext: (args) => args.query
      });

      const result = await tool.handler({ query: 'test' }, {});

      expect(result.isError).toBe(true);
    });
  });

  describe('createSearchTool', () => {
    it('should create a search tool with correct structure', () => {
      const schema = z.object({ query: z.string() });

      const tool = createSearchTool(
        'test_search',
        'Test search tool',
        schema,
        true,
        (args) => ({ query: args.query, type: 'auto' as const, numResults: 10, contents: { text: true } })
      );

      expect(tool.name).toBe('test_search');
      expect(tool.description).toBe('Test search tool');
      expect(tool.handler).toBeDefined();
    });

    it('should call /search endpoint', async () => {
      const mockPost = jest.fn<() => Promise<any>>().mockResolvedValue({
        data: { results: [{ url: 'https://example.com', title: 'Result', text: 'Text' }] }
      });
      (getSharedExaClient as jest.MockedFunction<typeof getSharedExaClient>).mockReturnValue({
        post: mockPost
      } as any);

      const schema = z.object({ query: z.string() });

      const tool = createSearchTool(
        'test_search',
        'Test search',
        schema,
        true,
        (args) => ({ query: args.query, type: 'auto' as const, numResults: 10, contents: { text: true } })
      );

      await tool.handler({ query: 'test query' }, {});

      expect(mockPost).toHaveBeenCalledWith('/search', expect.objectContaining({ query: 'test query' }));
    });
  });

  describe('createCrawlTool', () => {
    it('should create a crawl tool with correct structure', () => {
      const schema = z.object({ url: z.string().url() });

      const tool = createCrawlTool(
        'test_crawl',
        'Test crawl tool',
        schema,
        true,
        (args) => ({ urls: [args.url] })
      );

      expect(tool.name).toBe('test_crawl');
      expect(tool.description).toBe('Test crawl tool');
      expect(tool.handler).toBeDefined();
    });

    it('should call /contents endpoint', async () => {
      const mockPost = jest.fn<() => Promise<any>>().mockResolvedValue({
        data: { results: [{ url: 'https://example.com', text: 'Crawled content' }] }
      });
      (getSharedExaClient as jest.MockedFunction<typeof getSharedExaClient>).mockReturnValue({
        post: mockPost
      } as any);

      const schema = z.object({ url: z.string().url() });

      const tool = createCrawlTool(
        'test_crawl',
        'Test crawl',
        schema,
        true,
        (args) => ({ urls: [args.url] })
      );

      await tool.handler({ url: 'https://example.com' }, {});

      expect(mockPost).toHaveBeenCalledWith('/contents', expect.objectContaining({ urls: ['https://example.com'] }));
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      const mockPost = jest.fn<() => Promise<any>>().mockRejectedValue(new Error('Network error'));
      (getSharedExaClient as jest.MockedFunction<typeof getSharedExaClient>).mockReturnValue({
        post: mockPost
      } as any);

      const schema = z.object({ query: z.string() });

      const tool = createSearchTool(
        'test_search',
        'Test',
        schema,
        true,
        (args) => ({ query: args.query, type: 'auto' as const, numResults: 10, contents: { text: true } })
      );

      const result = await tool.handler({ query: 'test' }, {});

      expect(result.isError).toBe(true);
    });

    it('should handle empty results', async () => {
      const mockPost = jest.fn<() => Promise<any>>().mockResolvedValue({
        data: { results: [] }
      });
      (getSharedExaClient as jest.MockedFunction<typeof getSharedExaClient>).mockReturnValue({
        post: mockPost
      } as any);

      const schema = z.object({ query: z.string() });

      const tool = createSearchTool(
        'test_search',
        'Test',
        schema,
        true,
        (args) => ({ query: args.query, type: 'auto' as const, numResults: 10, contents: { text: true } })
      );

      const result = await tool.handler({ query: 'test' }, {});

      expect(result.content[0].text).toContain('No results found');
    });
  });
});

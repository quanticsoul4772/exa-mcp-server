import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { z } from 'zod';
import '../setup.js';

// Mock dependencies
jest.mock('../../utils/exaClient.js', () => ({
  createExaClient: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn()
  }))
}));

jest.mock('../../utils/cache.js', () => ({
  getGlobalCache: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn()
  }))
}));

jest.mock('../../utils/rateLimiter.js', () => ({
  getGlobalRateLimiter: jest.fn(() => ({
    acquire: jest.fn().mockResolvedValue(undefined)
  }))
}));

import { buildTool, createSearchHandler, createCrawlHandler } from '../../tools/tool-builder.js';

describe('Tool Builder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildTool', () => {
    it('should build a tool with required properties', () => {
      const schema = z.object({
        query: z.string()
      });
      
      const handler = jest.fn();
      
      const tool = buildTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        handler
      });
      
      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('Test tool');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeDefined();
    });

    it('should handle tool execution', async () => {
      const schema = z.object({
        query: z.string()
      });
      
      const handler = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Result' }]
      });
      
      const tool = buildTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        handler
      });
      
      const result = await tool.handler({ query: 'test' }, {});
      
      expect(handler).toHaveBeenCalledWith({ query: 'test' }, {});
      expect(result.content[0].text).toBe('Result');
    });

    it('should handle validation errors', async () => {
      const schema = z.object({
        query: z.string().min(5)
      });
      
      const handler = jest.fn();
      
      const tool = buildTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        handler
      });
      
      const result = await tool.handler({ query: 'hi' }, {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Validation error');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle handler errors', async () => {
      const schema = z.object({
        query: z.string()
      });
      
      const handler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      
      const tool = buildTool({
        name: 'test_tool',
        description: 'Test tool',
        schema,
        handler
      });
      
      const result = await tool.handler({ query: 'test' }, {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Handler failed');
    });
  });

  describe('createSearchHandler', () => {
    it('should create a search handler', () => {
      const handler = createSearchHandler();
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should handle search requests with cache', async () => {
      const mockCache = {
        get: jest.fn().mockReturnValue(null),
        set: jest.fn()
      };
      
      const mockClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            results: [
              { url: 'https://example.com', title: 'Example', text: 'Content' }
            ]
          }
        })
      };
      
      jest.doMock('../../utils/cache.js', () => ({
        getGlobalCache: jest.fn(() => mockCache)
      }));
      
      jest.doMock('../../utils/exaClient.js', () => ({
        createExaClient: jest.fn(() => mockClient)
      }));
      
      const handler = createSearchHandler();
      const result = await handler({ query: 'test search' }, {});
      
      expect(result.content[0].text).toContain('Example');
    });

    it('should use cached results when available', async () => {
      const cachedData = {
        results: [
          { url: 'https://cached.com', title: 'Cached', text: 'Cached content' }
        ]
      };
      
      const mockCache = {
        get: jest.fn().mockReturnValue(cachedData),
        set: jest.fn()
      };
      
      const mockClient = {
        post: jest.fn()
      };
      
      jest.doMock('../../utils/cache.js', () => ({
        getGlobalCache: jest.fn(() => mockCache)
      }));
      
      jest.doMock('../../utils/exaClient.js', () => ({
        createExaClient: jest.fn(() => mockClient)
      }));
      
      const handler = createSearchHandler();
      const result = await handler({ query: 'cached search' }, {});
      
      expect(mockClient.post).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Cached');
    });
  });

  describe('createCrawlHandler', () => {
    it('should create a crawl handler', () => {
      const handler = createCrawlHandler();
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('should handle crawl requests', async () => {
      const mockClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            results: [
              { url: 'https://example.com', text: 'Crawled content' }
            ]
          }
        })
      };
      
      jest.doMock('../../utils/exaClient.js', () => ({
        createExaClient: jest.fn(() => mockClient)
      }));
      
      const handler = createCrawlHandler();
      const result = await handler({ url: 'https://example.com' }, {});
      
      expect(result.content[0].text).toContain('Crawled content');
    });

    it('should handle invalid URLs', async () => {
      const handler = createCrawlHandler();
      const result = await handler({ url: 'not-a-url' }, {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid URL');
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      const mockClient = {
        post: jest.fn().mockRejectedValue(new Error('Network error'))
      };
      
      jest.doMock('../../utils/exaClient.js', () => ({
        createExaClient: jest.fn(() => mockClient)
      }));
      
      const handler = createSearchHandler();
      const result = await handler({ query: 'test' }, {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network error');
    });

    it('should handle API errors', async () => {
      const mockClient = {
        post: jest.fn().mockRejectedValue({
          response: {
            status: 400,
            data: { error: 'Bad request' }
          }
        })
      };
      
      jest.doMock('../../utils/exaClient.js', () => ({
        createExaClient: jest.fn(() => mockClient)
      }));
      
      const handler = createSearchHandler();
      const result = await handler({ query: 'test' }, {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('error');
    });
  });
});
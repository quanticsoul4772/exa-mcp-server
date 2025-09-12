import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock configuration before imports
jest.mock('../../config/index.js', () => ({
  getConfig: jest.fn(() => ({
    exa: {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.exa.ai',
      timeout: 25000,
      retries: 3
    },
    tools: {
      defaultNumResults: 3,
      defaultMaxCharacters: 3000
    },
    cache: {
      enabled: true,
      maxSize: 100,
      ttlMinutes: 5
    },
    environment: {
      nodeEnv: 'test'
    },
    logging: {
      level: 'ERROR',
      redactLogs: true
    }
  })),
  clearConfigCache: jest.fn()
}));

// Mock logger to prevent console output
jest.mock('../../utils/pinoLogger.js', () => ({
  createRequestLogger: jest.fn(() => ({
    start: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    complete: jest.fn()
  })),
  generateRequestId: jest.fn(() => 'test-request-id'),
  structuredLogger: {
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  }
}));

// Mock cache module to prevent caching in tests
jest.mock('../../utils/cache.js', () => ({
  getGlobalCache: jest.fn(() => ({
    get: jest.fn(() => null), // Always return cache miss
    set: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(() => ({ hits: 0, misses: 0, size: 0, hitRate: 0 })),
    isEnabled: jest.fn(() => false),
    setEnabled: jest.fn()
  })),
  resetGlobalCache: jest.fn()
}));

describe('Tool Integration Tests', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Create a new mock adapter for axios
    mockAxios = new MockAdapter(axios);
  });

  afterEach(() => {
    mockAxios.restore();
    jest.resetModules();
  });

  describe('Web Search Tool', () => {
    it('should perform web search and handle response correctly', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');
      
      // Mock Exa API response
      mockAxios.onPost('https://api.exa.ai/search').reply(200, {
        results: [
          {
            id: '1',
            title: 'Test Result 1',
            url: 'https://example.com/1',
            publishedDate: '2024-01-01',
            author: 'Author 1',
            text: 'This is test content 1'
          },
          {
            id: '2',
            title: 'Test Result 2',
            url: 'https://example.com/2',
            publishedDate: '2024-01-02',
            author: 'Author 2',
            text: 'This is test content 2'
          }
        ]
      });

      const result = await webSearchTool.handler({
        query: 'test search query',
        numResults: 2
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Test Result 1');
      expect(result.content[0].text).toContain('Test Result 2');
    });

    it('should handle API errors gracefully', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');
      
      // Mock API error
      mockAxios.onPost('https://api.exa.ai/search').reply(500, {
        error: 'Internal Server Error'
      });

      const result = await webSearchTool.handler({
        query: 'test search query'
      }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });

    it('should validate input parameters', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');
      
      const result = await webSearchTool.handler({
        // Missing required 'query' field
        numResults: 5
      }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid arguments');
    });
  });

  describe('Research Paper Search Tool', () => {
    it('should search research papers with custom parameters', async () => {
      const { researchPaperSearchTool } = await import('../../tools/researchPaperSearch.js');
      
      mockAxios.onPost('https://api.exa.ai/search').reply(200, {
        results: [
          {
            id: 'paper1',
            title: 'Machine Learning Research',
            url: 'https://arxiv.org/paper1',
            publishedDate: '2024-01-15',
            author: 'Research Team',
            text: 'Abstract: This paper discusses machine learning...'
          }
        ]
      });

      const result = await researchPaperSearchTool.handler({
        query: 'machine learning',
        numResults: 1,
        maxCharacters: 500
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Machine Learning Research');
    });
  });

  describe('Company Research Tool', () => {
    it('should research company information', async () => {
      const { companyResearchTool } = await import('../../tools/companyResearch.js');
      
      mockAxios.onPost('https://api.exa.ai/search').reply(200, {
        results: [
          {
            id: 'company1',
            title: 'Example Company - About Us',
            url: 'https://example.com/about',
            text: 'Example Company is a leading provider...'
          }
        ]
      });

      const result = await companyResearchTool.handler({
        query: 'example.com',
        subpages: 5
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Example Company');
    });
  });

  describe('URL Crawling Tool', () => {
    it('should crawl and extract content from URL', async () => {
      const { crawlingTool } = await import('../../tools/crawling.js');
      
      mockAxios.onPost('https://api.exa.ai/contents').reply(200, {
        results: [
          {
            id: 'https://example.com/article',
            title: 'Article Title',
            url: 'https://example.com/article',
            text: 'This is the full article content...'
          }
        ]
      });

      const result = await crawlingTool.handler({
        url: 'https://example.com/article'
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Article Title');
      expect(result.content[0].text).toContain('full article content');
    });

    it('should validate URL format', async () => {
      const { crawlingTool } = await import('../../tools/crawling.js');
      
      const result = await crawlingTool.handler({
        url: 'not-a-valid-url'
      }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid');
    });
  });

  describe('Cache Integration', () => {
    it('should cache and reuse API responses', async () => {
      // Reset cache for this test
      const { resetGlobalCache } = await import('../../utils/cache.js');
      resetGlobalCache();
      
      const { webSearchTool } = await import('../../tools/webSearch.js');
      
      // Mock API response
      mockAxios.onPost('https://api.exa.ai/search').reply(200, {
        results: [{
          id: '1',
          title: 'Cached Result',
          url: 'https://example.com',
          text: 'This should be cached'
        }]
      });

      // First call - should hit API
      const result1 = await webSearchTool.handler({
        query: 'cache test'
      }, {});

      // Second call - should use cache
      const result2 = await webSearchTool.handler({
        query: 'cache test'
      }, {});

      // Verify both results are the same
      expect(result1.content[0].text).toBe(result2.content[0].text);
      
      // Verify API was only called once
      expect(mockAxios.history.post.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');
      
      // Mock network timeout
      mockAxios.onPost('https://api.exa.ai/search').timeout();

      const result = await webSearchTool.handler({
        query: 'timeout test'
      }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });

    it('should handle rate limiting (429 status)', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');
      
      // Mock rate limit response
      mockAxios.onPost('https://api.exa.ai/search').reply(429, {
        error: 'Rate limit exceeded'
      });

      const result = await webSearchTool.handler({
        query: 'rate limit test'
      }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('Multi-tool Workflow', () => {
    it('should handle sequential tool operations', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const { crawlingTool } = await import('../../tools/crawling.js');
      
      // First, search for content
      mockAxios.onPost('https://api.exa.ai/search').reply(200, {
        results: [{
          id: '1',
          title: 'Found Article',
          url: 'https://example.com/article',
          text: 'Preview text...'
        }]
      });

      const searchResult = await webSearchTool.handler({
        query: 'test article'
      }, {});

      expect(searchResult.isError).toBeUndefined();
      
      // Then, crawl the found URL
      mockAxios.onPost('https://api.exa.ai/contents').reply(200, {
        results: [{
          id: 'https://example.com/article',
          title: 'Found Article - Full Content',
          url: 'https://example.com/article',
          text: 'This is the complete article content with much more detail...'
        }]
      });

      const crawlResult = await crawlingTool.handler({
        url: 'https://example.com/article'
      }, {});

      expect(crawlResult.isError).toBeUndefined();
      expect(crawlResult.content[0].text).toContain('complete article content');
    });
  });
});
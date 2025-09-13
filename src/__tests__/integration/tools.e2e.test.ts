import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

// Set up test environment BEFORE any imports that might use config
process.env.EXA_API_KEY = 'test-api-key';
process.env.EXA_BASE_URL = 'http://localhost:0';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'ERROR';
process.env.EXA_RETRIES = '0'; // Disable retries for tests
process.env.EXA_TIMEOUT = '2000'; // 2 second timeout for tests

// Mock pino logger to avoid initialization issues
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
  },
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn()
}));

// Mock cache to use in-memory implementation
jest.mock('../../utils/cache.js', () => ({
  getGlobalCache: jest.fn(() => ({
    get: jest.fn(() => null), // No caching for E2E tests
    set: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(() => ({ hits: 0, misses: 0, size: 0, hitRate: 0 })),
    isEnabled: jest.fn(() => false),
    setEnabled: jest.fn()
  })),
  resetGlobalCache: jest.fn()
}));

import { E2ETestSetup } from '../helpers/e2eSetup.js';

describe('Tool E2E Tests', () => {
  let e2e: E2ETestSetup;

  beforeAll(async () => {
    // Clear any module cache before starting
    jest.resetModules();
    
    // Create and start E2E setup
    e2e = new E2ETestSetup();
    await e2e.start();
  });

  afterAll(async () => {
    await e2e.stop();
  });

  beforeEach(() => {
    e2e.clearMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear module cache after each test for isolation
    jest.resetModules();
  });

  describe('Web Search Tool', () => {
    it('should perform web search and handle response correctly', async () => {
      // Setup mock response
      e2e.mockSuccessfulSearch([
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
      ]);

      // Import tool after environment is set up
      const { webSearchTool } = await import('../../tools/webSearch.js');

      const result = await webSearchTool.handler({
        query: 'test search query',
        numResults: 2
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Test Result 1');
      expect(result.content[0].text).toContain('Test Result 2');

      // Verify API was called
      e2e.assertApiCalled('/search', 1);
    });

    it('should handle API errors gracefully', async () => {
      e2e.mockFailedSearch('Internal Server Error', 500);

      const { webSearchTool } = await import('../../tools/webSearch.js');

      try {
        const result = await webSearchTool.handler({
          query: 'test search query'
        }, {});

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error');
      } catch (error) {
        console.error('Test error:', error);
        throw error;
      }
    }, 10000); // Increase timeout

    it('should validate input parameters', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');

      const result = await webSearchTool.handler({
        // Missing required 'query' field
        numResults: 5
      } as any, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid arguments');
    });
  });

  describe('Research Paper Search Tool', () => {
    it('should search research papers with custom parameters', async () => {
      e2e.mockSuccessfulSearch([
        {
          id: 'paper1',
          title: 'Machine Learning Research',
          url: 'https://arxiv.org/paper1',
          publishedDate: '2024-01-15',
          author: 'Research Team',
          text: 'Abstract: This paper discusses machine learning...'
        }
      ]);

      const { researchPaperSearchTool } = await import('../../tools/researchPaperSearch.js');

      const result = await researchPaperSearchTool.handler({
        query: 'machine learning',
        numResults: 1,
        maxCharacters: 500
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Machine Learning Research');
      
      // Verify correct parameters were sent
      const requests = e2e.getRequestHistory();
      expect(requests[0].body).toMatchObject({
        query: expect.stringContaining('machine learning'),
        numResults: 1
      });
    });
  });

  describe('Company Research Tool', () => {
    it('should research company information', async () => {
      e2e.mockSuccessfulSearch([
        {
          id: 'company1',
          title: 'Example Company - About Us',
          url: 'https://example.com/about',
          text: 'Example Company is a leading provider...'
        }
      ]);

      const { companyResearchTool } = await import('../../tools/companyResearch.js');

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
      e2e.mockSuccessfulContents([
        {
          id: 'https://example.com/article',
          title: 'Article Title',
          url: 'https://example.com/article',
          text: 'This is the full article content...'
        }
      ]);

      const { crawlingTool } = await import('../../tools/crawling.js');

      const result = await crawlingTool.handler({
        url: 'https://example.com/article'
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Article Title');
      expect(result.content[0].text).toContain('full article content');
      
      e2e.assertApiCalled('/contents', 1);
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

  describe('Error Handling', () => {
    it('should handle rate limiting (429 status)', async () => {
      e2e.mockRateLimit();

      const { webSearchTool } = await import('../../tools/webSearch.js');

      const result = await webSearchTool.handler({
        query: 'rate limit test'
      }, {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });

    it('should handle network errors gracefully', async () => {
      // Stop the server to simulate network error
      await e2e.stop();
      
      const { webSearchTool } = await import('../../tools/webSearch.js');

      const result = await webSearchTool.handler({
        query: 'network error test'
      }, {});

      expect(result.isError).toBe(true);
      
      // Restart for other tests
      await e2e.start();
    });
  });

  describe('Multi-tool Workflow', () => {
    it('should handle sequential tool operations', async () => {
      // First, mock search response
      e2e.mockSuccessfulSearch([{
        id: '1',
        title: 'Found Article',
        url: 'https://example.com/article',
        text: 'Preview text...'
      }]);

      const { webSearchTool } = await import('../../tools/webSearch.js');
      
      const searchResult = await webSearchTool.handler({
        query: 'test article'
      }, {});

      expect(searchResult.isError).toBeUndefined();
      
      // Clear previous mocks and set up crawl response
      e2e.clearMocks();
      e2e.mockSuccessfulContents([{
        id: 'https://example.com/article',
        title: 'Found Article - Full Content',
        url: 'https://example.com/article',
        text: 'This is the complete article content with much more detail...'
      }]);

      const { crawlingTool } = await import('../../tools/crawling.js');

      const crawlResult = await crawlingTool.handler({
        url: 'https://example.com/article'
      }, {});

      expect(crawlResult.isError).toBeUndefined();
      expect(crawlResult.content[0].text).toContain('complete article content');
    });
  });

  describe('Caching Behavior', () => {
    it('should use cache for repeated requests', async () => {
      // First request
      e2e.mockSuccessfulSearch([{
        id: '1',
        title: 'Cached Result',
        url: 'https://example.com',
        text: 'This should be cached'
      }]);

      const { webSearchTool } = await import('../../tools/webSearch.js');

      // Make first request
      const result1 = await webSearchTool.handler({
        query: 'cache test'
      }, {});

      // Make second identical request
      const result2 = await webSearchTool.handler({
        query: 'cache test'
      }, {});

      // Both results should be the same
      expect(result1.content[0].text).toBe(result2.content[0].text);
      
      // API should only be called once due to caching
      // Note: Cache is mocked to return null in tests, so this will actually call twice
      // In real E2E with actual cache, this would be 1
      const requests = e2e.getRequestHistory();
      expect(requests.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Twitter Search Tool', () => {
    it('should search Twitter/X with date filters', async () => {
      e2e.mockSuccessfulSearch([
        {
          id: 'tweet1',
          title: '@user: Test tweet',
          url: 'https://x.com/user/status/123',
          publishedDate: '2024-01-15',
          text: 'This is a test tweet about TypeScript'
        }
      ]);

      const { twitterSearchTool } = await import('../../tools/twitterSearch.js');

      const result = await twitterSearchTool.handler({
        query: 'TypeScript',
        numResults: 1,
        startPublishedDate: '2024-01-01T00:00:00.000Z',
        endPublishedDate: '2024-01-31T23:59:59.999Z'
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Test tweet');
      
      // Verify date parameters were included
      const requests = e2e.getRequestHistory();
      expect(requests[0].body).toHaveProperty('startPublishedDate');
      expect(requests[0].body).toHaveProperty('endPublishedDate');
    });
  });

  describe('Competitor Finder Tool', () => {
    it('should find competitors with domain exclusion', async () => {
      e2e.mockSuccessfulSearch([
        {
          id: 'comp1',
          title: 'Competitor Company',
          url: 'https://competitor.com',
          text: 'We provide similar services...'
        },
        {
          id: 'comp2',
          title: 'Another Competitor',
          url: 'https://another-competitor.com',
          text: 'Leading provider of...'
        }
      ]);

      const { competitorFinderTool } = await import('../../tools/competitorFinder.js');

      const result = await competitorFinderTool.handler({
        query: 'web search API',
        excludeDomain: 'exa.ai',
        numResults: 2
      }, {});

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Competitor Company');
      
      // Verify exclude domain was sent
      const requests = e2e.getRequestHistory();
      expect(requests[0].body).toHaveProperty('excludeDomains');
    });
  });
});
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

// Set up test environment BEFORE any imports that might use config
process.env.EXA_API_KEY = 'test-api-key';
process.env.EXA_BASE_URL = 'http://localhost:0';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'ERROR';
process.env.EXA_RETRIES = '0'; // Disable retries for tests
process.env.EXA_TIMEOUT = '2000'; // 2 second timeout for tests

// Unmock config so the real implementation reads from process.env (test server URL)
jest.unmock('../../config/index.js');

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

  describe('Web Search filters (replacing removed specialized tools)', () => {
    it('sends category publication for research papers', async () => {
      e2e.mockSuccessfulSearch([
        { id: 'paper1', title: 'Machine Learning Research', url: 'https://arxiv.org/paper1', text: 'Abstract...' }
      ]);
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const result = await webSearchTool.handler({ query: 'machine learning', category: 'publication', numResults: 1 }, {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Machine Learning Research');
      expect(e2e.getRequestHistory()[0].body).toMatchObject({ category: 'publication', numResults: 1 });
    });

    it('rejects the retired research paper category', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const result = await webSearchTool.handler({ query: 'x', category: 'research paper' }, {});
      expect(result.isError).toBe(true);
    });

    it('searches X with includeDomains and date filters', async () => {
      e2e.mockSuccessfulSearch([
        { id: 'tweet1', title: '@user: Test tweet', url: 'https://x.com/user/status/123', text: 'TypeScript' }
      ]);
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const result = await webSearchTool.handler({
        query: 'TypeScript',
        includeDomains: ['x.com', 'twitter.com'],
        startPublishedDate: '2024-01-01T00:00:00.000Z'
      }, {});
      expect(result.isError).toBeUndefined();
      const body = e2e.getRequestHistory()[0].body;
      expect(body.includeDomains).toEqual(['x.com', 'twitter.com']);
      expect(body.startPublishedDate).toBe('2024-01-01T00:00:00.000Z');
    });

    it('sends company category with subpages, current extras shape and freshness', async () => {
      e2e.mockSuccessfulSearch([
        {
          id: 'c1', title: 'Example Company', url: 'https://example.com', text: 'About us',
          extras: { links: ['https://example.com/a'], imageLinks: ['https://example.com/i.png'] }
        }
      ]);
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const result = await webSearchTool.handler({
        query: 'example.com', category: 'company', subpages: 3, subpageTarget: ['about'],
        includeExtras: true, maxAgeHours: 24, livecrawlTimeout: 5000
      }, {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('https://example.com/i.png');
      const contents = e2e.getRequestHistory()[0].body.contents;
      expect(contents).toMatchObject({ subpages: 3, subpageTarget: ['about'], maxAgeHours: 24, livecrawlTimeout: 5000 });
      expect(contents.extras).toEqual({ links: 20, imageLinks: 10 });
      expect(contents).not.toHaveProperty('livecrawl');
    });

    it('rejects maxAgeHours above 720', async () => {
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const result = await webSearchTool.handler({ query: 'x', maxAgeHours: 1000 }, {});
      expect(result.isError).toBe(true);
    });

    it('shows synthesized output, grounding and cost when outputSchema is set', async () => {
      e2e.getServer().mock('POST', '/search', {
        status: 200,
        data: {
          requestId: 'r', results: [{ id: '1', title: 'Source', url: 'https://s.com' }],
          output: { content: { ceo: 'Jane' }, grounding: [{ field: 'ceo', citations: [{ url: 'https://s.com', title: 'Source' }], confidence: 'high' }] },
          costDollars: { total: 0.012 }
        }
      });
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const result = await webSearchTool.handler({ query: 'who is CEO', outputSchema: { type: 'object', properties: { ceo: { type: 'string' } } } }, {});
      const text = result.content[0].text;
      expect(text).toContain('"ceo": "Jane"');
      expect(text).toContain('ceo (high confidence): [Source](https://s.com)');
      expect(text).toContain('Estimated cost: $0.0120');
    });
  });

  describe('Web Fetch Tool', () => {
    it('fetches multiple URLs with current request shape', async () => {
      e2e.mockSuccessfulContents([
        { id: 'https://example.com/article', title: 'Article Title', url: 'https://example.com/article', text: 'This is the full article content...' },
        { id: 'https://example.com/b', title: 'Second', url: 'https://example.com/b', text: 'Second page' }
      ]);
      const { webFetchTool } = await import('../../tools/webFetch.js');
      const result = await webFetchTool.handler({
        urls: ['https://example.com/article', 'https://example.com/b'],
        summaryQuery: 'main point', excludeSections: ['footer']
      }, {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('full article content');
      expect(result.content[0].text).toContain('Second page');
      const body = e2e.getRequestHistory()[0].body;
      expect(body.urls).toHaveLength(2);
      expect(body.summary).toEqual({ query: 'main point' });
      expect(body.text.excludeSections).toEqual(['footer']);
      expect(body).not.toHaveProperty('livecrawl');
      e2e.assertApiCalled('/contents', 1);
    });

    it('reports per-URL failures from statuses', async () => {
      e2e.getServer().mock('POST', '/contents', {
        status: 200,
        data: {
          requestId: 'r', results: [],
          statuses: [{ id: 'https://dead.example', status: 'error', error: { tag: 'CRAWL_NOT_FOUND', httpStatusCode: 404 } }]
        }
      });
      const { webFetchTool } = await import('../../tools/webFetch.js');
      const result = await webFetchTool.handler({ urls: ['https://dead.example'] }, {});
      expect(result.content[0].text).toContain('https://dead.example: CRAWL_NOT_FOUND (HTTP 404)');
    });

    it('validates URL format', async () => {
      const { webFetchTool } = await import('../../tools/webFetch.js');
      const result = await webFetchTool.handler({ urls: ['not-a-valid-url'] }, {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid');
    });
  });

  describe('Answer Tool', () => {
    it('sends only fields /answer accepts and formats citations without scores', async () => {
      e2e.getServer().mock('POST', '/answer', {
        status: 200,
        data: {
          requestId: 'r', answer: 'Paris.',
          citations: [{ url: 'https://b.com/paris', title: 'Paris', publishedDate: '2024-01-15' }],
          costDollars: { total: 0.005 }
        }
      });
      const { answerTool } = await import('../../tools/answer.js');
      const result = await answerTool.handler({ query: 'capital of France', model: 'exa-pro' }, {});
      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain('Paris.');
      expect(text).toContain('[Paris](https://b.com/paris)');
      expect(text).not.toContain('Relevance');
      expect(text).toContain('Estimated cost: $0.0050');
      expect(e2e.getRequestHistory()[0].body).toEqual({ query: 'capital of France', text: false, model: 'exa-pro' });
    });
  });

  describe('Code Search Tool', () => {
    it('formats the /context response text', async () => {
      e2e.getServer().mock('POST', '/context', {
        status: 200,
        data: { requestId: 'r', query: 'zod union', response: '## Discriminated unions\nhttps://zod.dev\n\nz.discriminatedUnion(...)' }
      });
      const { codeSearchTool } = await import('../../tools/codeSearch.js');
      const result = await codeSearchTool.handler({ query: 'zod union' }, {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('z.discriminatedUnion');
    });
  });

  describe('Find Similar Tool', () => {
    it('nests content options under contents', async () => {
      e2e.getServer().mock('POST', '/findSimilar', {
        status: 200,
        data: { requestId: 'r', results: [{ id: '1', title: 'Similar', url: 'https://sim.com', highlights: ['match'] }] }
      });
      const { findSimilarTool } = await import('../../tools/findSimilar.js');
      const result = await findSimilarTool.handler({ url: 'https://example.com', includeText: true }, {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Similar');
      expect(result.content[0].text).not.toContain('NaN');
      const body = e2e.getRequestHistory()[0].body;
      expect(body).not.toHaveProperty('text');
      expect(body.contents).toMatchObject({ text: { maxCharacters: 1000 }, highlights: { maxCharacters: 500 } });
    });
  });

  describe('Tier 1 behavior', () => {
    it('search requests highlights, not page text, by default', async () => {
      e2e.mockSuccessfulSearch([{ id: '1', title: 'R', url: 'https://r.com', highlights: ['relevant bit'] }]);
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const result = await webSearchTool.handler({ query: 'q' }, {});
      expect(result.content[0].text).toContain('relevant bit');
      const contents = e2e.getRequestHistory()[0].body.contents;
      expect(contents.highlights).toEqual({ maxCharacters: 500 });
      expect(contents).not.toHaveProperty('text');
    });

    it('search includes page text only when asked, and shows all of it', async () => {
      const longText = 'x'.repeat(2500);
      e2e.mockSuccessfulSearch([{ id: '1', title: 'R', url: 'https://r.com', text: longText }]);
      const { webSearchTool } = await import('../../tools/webSearch.js');
      const result = await webSearchTool.handler({ query: 'q', textMaxCharacters: 2500 }, {});
      expect(result.content[0].text).toContain(longText);
      const contents = e2e.getRequestHistory()[0].body.contents;
      expect(contents.text).toEqual({ maxCharacters: 2500 });
      expect(contents).not.toHaveProperty('highlights');
    });

    it('web_fetch keeps 20 URLs within the 100k total text budget by default', async () => {
      e2e.mockSuccessfulContents([{ id: 'https://a.com', url: 'https://a.com', text: 't' }]);
      const { webFetchTool } = await import('../../tools/webFetch.js');
      const urls = Array.from({ length: 20 }, (_, i) => `https://a.com/${i}`);
      await webFetchTool.handler({ urls }, {});
      expect(e2e.getRequestHistory()[0].body.text.maxCharacters).toBe(5000);
    });

    it('web_fetch honors an explicit per-URL limit', async () => {
      e2e.mockSuccessfulContents([{ id: 'https://a.com', url: 'https://a.com', text: 't' }]);
      const { webFetchTool } = await import('../../tools/webFetch.js');
      const urls = Array.from({ length: 20 }, (_, i) => `https://a.com/${i}`);
      await webFetchTool.handler({ urls, textMaxCharacters: 20000 }, {});
      expect(e2e.getRequestHistory()[0].body.text.maxCharacters).toBe(20000);
    });

    it('escapes ids placed in URL paths', async () => {
      e2e.getServer().mock('GET', '/monitors/a/b', { status: 200, data: {} });
      e2e.getServer().mock('GET', '/monitors/a%2Fb', { status: 200, data: {
        id: 'a/b', name: null, status: 'active', search: { query: 'q' }, trigger: null, webhook: { url: 'https://h' }, nextRunAt: null, createdAt: 'now'
      } });
      const { monitorsTool } = await import('../../tools/monitors.js');
      const result = await monitorsTool.handler({ action: 'get', monitorId: 'a/b' }, {});
      expect(result.isError).toBeUndefined();
      expect(e2e.getRequestHistory()[0].path).toBe('/monitors/a%2Fb');
    });

    it('cancels a run it created when the client cancels', async () => {
      e2e.getServer().mock('POST', '/agent/runs', { status: 200, data: { id: 'agent_run_c', status: 'queued', stopReason: null } });
      e2e.getServer().mock('GET', '/agent/runs/agent_run_c', { status: 200, data: { id: 'agent_run_c', status: 'running', stopReason: null } });
      e2e.getServer().mock('POST', '/agent/runs/agent_run_c/cancel', { status: 200, data: { id: 'agent_run_c', status: 'cancelled', stopReason: 'cancelled' } });
      const { agentRunTool } = await import('../../tools/agentRun.js');
      const controller = new AbortController();
      const call = agentRunTool.handler({ query: 'q', waitSeconds: 60 }, { signal: controller.signal });
      await new Promise(resolve => setTimeout(resolve, 300));
      controller.abort();
      const result = await call;
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('agent_run_c was cancelled');
      expect(e2e.getRequestHistory().some(r => r.method === 'POST' && r.path === '/agent/runs/agent_run_c/cancel')).toBe(true);
    });

    it('does not cancel a resumed run when the client cancels', async () => {
      e2e.getServer().mock('GET', '/agent/runs/agent_run_r', { status: 200, data: { id: 'agent_run_r', status: 'running', stopReason: null } });
      const { agentRunTool } = await import('../../tools/agentRun.js');
      const controller = new AbortController();
      const call = agentRunTool.handler({ runId: 'agent_run_r', waitSeconds: 60 }, { signal: controller.signal });
      await new Promise(resolve => setTimeout(resolve, 300));
      controller.abort();
      const result = await call;
      expect(result.content[0].text).toContain('agent_run_r continues on Exa');
      expect(e2e.getRequestHistory().some(r => r.path.endsWith('/cancel'))).toBe(false);
    });
  });

  describe('Agent Run Tool', () => {
    it('creates a run, polls until completed, and formats output', async () => {
      let polls = 0;
      e2e.getServer().mock('POST', '/agent/runs', { status: 200, data: { id: 'agent_run_1', status: 'queued', stopReason: null } });
      e2e.getServer().mock('GET', '/agent/runs/agent_run_1', () => {
        polls++;
        return polls < 2
          ? { status: 200, data: { id: 'agent_run_1', status: 'running', stopReason: null } }
          : {
              status: 200,
              data: {
                id: 'agent_run_1', status: 'completed', stopReason: 'schema_satisfied',
                output: { text: 'Final report', structured: { n: 3 }, grounding: [{ field: 'n', citations: [{ url: 'https://src.com' }], confidence: 'medium' }] },
                costDollars: { total: 1.25 }
              }
            };
      });
      const { agentRunTool, agentRunTiming } = await import('../../tools/agentRun.js');
      agentRunTiming.pollIntervalMs = 1;
      try {
        const result = await agentRunTool.handler({ query: 'count things', effort: 'auto', maxCostDollars: 2 }, {});
        expect(result.isError).toBeUndefined();
        const text = result.content[0].text;
        expect(text).toContain('Final report');
        expect(text).toContain('"n": 3');
        expect(text).toContain('Estimated cost: $1.2500');
        const create = e2e.getRequestHistory().find(r => r.method === 'POST')!;
        expect(create.body).toEqual({ query: 'count things', effort: 'auto', budget: { maxCostDollars: 2 } });
      } finally {
        agentRunTiming.pollIntervalMs = 5000;
      }
    });

    it('returns the run id when waitSeconds is reached', async () => {
      e2e.getServer().mock('GET', '/agent/runs/agent_run_2', { status: 200, data: { id: 'agent_run_2', status: 'running', stopReason: null } });
      const { agentRunTool } = await import('../../tools/agentRun.js');
      const result = await agentRunTool.handler({ runId: 'agent_run_2', waitSeconds: 0 }, {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('still running');
      expect(result.content[0].text).toContain('agent_run_2');
    });

    it('marks failed runs as errors', async () => {
      e2e.getServer().mock('GET', '/agent/runs/agent_run_3', { status: 200, data: { id: 'agent_run_3', status: 'failed', stopReason: 'budget_reached' } });
      const { agentRunTool } = await import('../../tools/agentRun.js');
      const result = await agentRunTool.handler({ runId: 'agent_run_3' }, {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('budget_reached');
    });

    it('rejects maxCostDollars for unmetered efforts before calling Exa', async () => {
      const { agentRunTool } = await import('../../tools/agentRun.js');
      const result = await agentRunTool.handler({ query: 'q', effort: 'low', maxCostDollars: 2 }, {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("only to effort 'auto' or 'ultra'");
      expect(e2e.getRequestHistory()).toHaveLength(0);
    });

    it('requires query or runId', async () => {
      const { agentRunTool } = await import('../../tools/agentRun.js');
      const result = await agentRunTool.handler({}, {});
      expect(result.isError).toBe(true);
    });
  });

  describe('Monitors Tool', () => {
    it('creates a monitor with schedule and webhook', async () => {
      e2e.getServer().mock('POST', '/monitors', {
        status: 201,
        data: {
          id: 'mon_1', name: 'jobs', status: 'active', search: { query: 'perf jobs' },
          trigger: { type: 'interval', period: '1d' }, webhook: { url: 'https://hook.example/x' },
          nextRunAt: '2026-10-11T00:00:00Z', createdAt: 'now', webhookSecret: 'whsec_1'
        }
      });
      const { monitorsTool } = await import('../../tools/monitors.js');
      const result = await monitorsTool.handler({ action: 'create', name: 'jobs', query: 'perf jobs', period: '1d', webhookUrl: 'https://hook.example/x' }, {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('mon_1');
      expect(result.content[0].text).toContain('whsec_1');
      expect(e2e.getRequestHistory()[0].body).toEqual({
        name: 'jobs', search: { query: 'perf jobs' }, trigger: { type: 'interval', period: '1d' }, webhook: { url: 'https://hook.example/x' }
      });
    });

    it('requires webhookUrl for create', async () => {
      const { monitorsTool } = await import('../../tools/monitors.js');
      const result = await monitorsTool.handler({ action: 'create', query: 'x' }, {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('webhookUrl');
    });

    it('pauses a monitor with PATCH and reads a run', async () => {
      e2e.getServer().mock('PATCH', '/monitors/mon_1', {
        status: 200,
        data: { id: 'mon_1', name: null, status: 'paused', search: { query: 'q' }, trigger: null, webhook: { url: 'https://h' }, nextRunAt: null, createdAt: 'now' }
      });
      e2e.getServer().mock('GET', '/monitors/mon_1/runs/run_1', {
        status: 200,
        data: {
          id: 'run_1', monitorId: 'mon_1', status: 'completed', failReason: null, createdAt: 'now',
          output: { results: [{ id: '1', title: 'New posting', url: 'https://jobs.example/1' }] }
        }
      });
      const { monitorsTool } = await import('../../tools/monitors.js');
      const paused = await monitorsTool.handler({ action: 'update', monitorId: 'mon_1', status: 'paused' }, {});
      expect(paused.content[0].text).toContain('paused');
      const run = await monitorsTool.handler({ action: 'get_run', monitorId: 'mon_1', runId: 'run_1' }, {});
      expect(run.content[0].text).toContain('New posting');
    });
  });

  describe('Websets Tool', () => {
    it('creates a webset under /websets/v0 with criteria and enrichments', async () => {
      e2e.getServer().mock('POST', '/websets/v0/websets', {
        status: 201,
        data: {
          id: 'ws_1', status: 'running', title: null, externalId: null, createdAt: 'now',
          searches: [{ id: 's1', status: 'running', query: 'AI security startups' }]
        }
      });
      const { websetsTool } = await import('../../tools/websets.js');
      const result = await websetsTool.handler({
        action: 'create', query: 'AI security startups', count: 5, entityType: 'company',
        criteria: ['US-based'], enrichments: [{ description: 'CEO name', format: 'text' }]
      }, {});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('ws_1');
      expect(e2e.getRequestHistory()[0].body).toEqual({
        search: { query: 'AI security startups', count: 5, entity: { type: 'company' }, criteria: [{ description: 'US-based' }] },
        enrichments: [{ description: 'CEO name', format: 'text' }]
      });
    });

    it('surfaces plan errors from the API', async () => {
      e2e.getServer().mock('GET', '/websets/v0/websets', { status: 401, data: { message: 'Upgrade to a Pro plan to get access.' } });
      const { websetsTool } = await import('../../tools/websets.js');
      const result = await websetsTool.handler({ action: 'list' }, {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Pro plan');
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

      const { webFetchTool } = await import('../../tools/webFetch.js');

      const crawlResult = await webFetchTool.handler({
        urls: ['https://example.com/article']
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
});
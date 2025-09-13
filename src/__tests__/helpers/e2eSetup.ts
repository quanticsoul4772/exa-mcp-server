import { TestServer } from './testServer.js';

/**
 * E2E test setup helper
 */
export class E2ETestSetup {
  private testServer: TestServer;
  private originalEnv: NodeJS.ProcessEnv;

  constructor() {
    this.testServer = new TestServer();
    this.originalEnv = { ...process.env };
  }

  /**
   * Start the test environment
   */
  async start(): Promise<void> {
    // Start test server
    const port = await this.testServer.start();
    
    // Override environment variables to point to test server
    process.env.EXA_API_KEY = 'test-api-key';
    process.env.EXA_BASE_URL = this.testServer.getUrl();
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'ERROR';
    process.env.EXA_RETRIES = '0'; // Disable retries
    process.env.EXA_TIMEOUT = '2000'; // Short timeout for tests
    
    // Clear module cache to ensure new env vars are used
    this.clearModuleCache();
  }

  /**
   * Stop the test environment
   */
  async stop(): Promise<void> {
    await this.testServer.stop();
    
    // Restore original environment
    process.env = { ...this.originalEnv };
    
    // Clear module cache
    this.clearModuleCache();
  }

  /**
   * Get the test server instance
   */
  getServer(): TestServer {
    return this.testServer;
  }

  /**
   * Clear module cache for fresh imports
   */
  private clearModuleCache(): void {
    // Clear config cache
    const configPath = require.resolve('../../config/index.js');
    delete require.cache[configPath];
    
    // Clear utils cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/utils/') || key.includes('/tools/')) {
        delete require.cache[key];
      }
    });
  }

  /**
   * Mock a successful search response
   */
  mockSuccessfulSearch(results: any[]): void {
    this.testServer.mockExaSearch({ results });
  }

  /**
   * Mock a failed search response
   */
  mockFailedSearch(error: string, status: number = 500): void {
    this.testServer.mockExaSearch({ error }, status);
  }

  /**
   * Mock a successful contents response
   */
  mockSuccessfulContents(results: any[]): void {
    this.testServer.mockExaContents({ results });
  }

  /**
   * Mock rate limiting
   */
  mockRateLimit(): void {
    this.testServer.mock('POST', '/search', {
      status: 429,
      data: { error: 'Rate limit exceeded' }
    });
  }

  /**
   * Mock timeout
   */
  mockTimeout(delay: number = 30000): void {
    this.testServer.mock('POST', '/search', {
      status: 200,
      data: { results: [] },
      delay
    });
  }

  /**
   * Get request history
   */
  getRequestHistory() {
    return this.testServer.getRequestLog();
  }

  /**
   * Assert API was called
   */
  assertApiCalled(path: string, times: number = 1): void {
    this.testServer.assertRequestMade('POST', path, times);
  }

  /**
   * Clear all mocks
   */
  clearMocks(): void {
    this.testServer.clear();
  }
}

// Global instance for test suite
let globalSetup: E2ETestSetup | null = null;

/**
 * Get or create global E2E setup
 */
export function getE2ESetup(): E2ETestSetup {
  if (!globalSetup) {
    globalSetup = new E2ETestSetup();
  }
  return globalSetup;
}

/**
 * Reset global E2E setup
 */
export function resetE2ESetup(): void {
  if (globalSetup) {
    globalSetup.stop().catch(console.error);
  }
  globalSetup = null;
}
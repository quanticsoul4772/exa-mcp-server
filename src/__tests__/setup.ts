/**
 * Global test setup and utilities for Jest tests
 * Ensures proper test isolation and prevents global state pollution
 */

import { beforeEach, afterEach } from '@jest/globals';

// Store original environment variables
const originalEnv = { ...process.env };

/**
 * Reset all module-level caches and singletons before each test
 * This prevents test interdependency issues
 */
export function setupTestIsolation() {
  beforeEach(() => {
    // Reset environment to a clean state
    process.env = { ...originalEnv };
    
    // Set default test environment variables
    process.env.NODE_ENV = 'test';
    process.env.EXA_API_KEY = 'test-api-key';
    process.env.LOG_LEVEL = 'ERROR';
    process.env.REDACT_LOGS = 'true';
    
    // Clear all module caches
    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clear any cached modules to prevent state leakage
    jest.clearAllMocks();
    jest.resetModules();
  });
}

/**
 * Setup function for config-related tests
 * Ensures config cache is cleared between tests
 */
export async function setupConfigTests() {
  beforeEach(async () => {
    // Dynamically import to get fresh module
    const { clearConfigCache } = await import('../config/index.js');
    clearConfigCache();
  });

  afterEach(async () => {
    // Clear config cache after each test
    const { clearConfigCache } = await import('../config/index.js');
    clearConfigCache();
  });
}

/**
 * Setup function for cache-related tests
 * Ensures global cache is reset between tests
 */
export async function setupCacheTests() {
  beforeEach(async () => {
    // Dynamically import to get fresh module
    const { resetGlobalCache } = await import('../utils/cache.js');
    resetGlobalCache();
  });

  afterEach(async () => {
    // Reset global cache after each test
    const { resetGlobalCache } = await import('../utils/cache.js');
    resetGlobalCache();
  });
}

/**
 * Common mock configuration for tools that need config
 */
export const mockConfig = {
  exa: {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.exa.ai',
    timeout: 25000,
    retries: 3
  },
  server: {
    name: 'test-server',
    version: '0.0.0'
  },
  logging: {
    level: 'ERROR' as const,
    redactLogs: true
  },
  environment: {
    nodeEnv: 'test' as const
  },
  tools: {
    defaultNumResults: 3,
    defaultMaxCharacters: 3000
  },
  cache: {
    enabled: false,
    maxSize: 100,
    ttlMinutes: 5
  }
};

/**
 * Mock the config module with test values
 */
export function mockConfigModule() {
  jest.mock('../config/index.js', () => ({
    getConfig: jest.fn(() => mockConfig),
    validateConfig: jest.fn((config) => config),
    clearConfigCache: jest.fn(),
    getSanitizedConfig: jest.fn(() => mockConfig)
  }));
}

/**
 * Mock the logger modules to prevent console output during tests
 */
export function mockLoggers() {
  jest.mock('../utils/pinoLogger.js', () => ({
    createRequestLogger: jest.fn(() => ({
      start: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      complete: jest.fn()
    })),
    generateRequestId: jest.fn(() => 'test-request-id'),
    logInfo: jest.fn(),
    logError: jest.fn(),
    logWarn: jest.fn(),
    logDebug: jest.fn(),
    structuredLogger: {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      child: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }))
    }
  }));

  jest.mock('../utils/logger.js', () => ({
    log: jest.fn(),
    LogEntry: class {
      start = jest.fn();
      complete = jest.fn();
      error = jest.fn();
      log = jest.fn();
    }
  }));
}
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Set up module isolation
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

// Mock pinoLogger before importing tools
jest.mock('../../utils/pinoLogger.js', () => ({
  createRequestLogger: jest.fn(() => ({
    start: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    complete: jest.fn()
  })),
  generateRequestId: jest.fn(() => 'test-request-id'),
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

// Mock the config module to provide test values
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
      enabled: false,
      maxSize: 100,
      ttlMinutes: 5
    },
    environment: {
      nodeEnv: 'test'
    }
  })),
  clearConfigCache: jest.fn()
}));

// Mock cache module to prevent global state issues
jest.mock('../../utils/cache.js', () => ({
  getGlobalCache: jest.fn(() => ({
    get: jest.fn(() => null),
    set: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(() => ({ hits: 0, misses: 0, size: 0, hitRate: 0 })),
    isEnabled: jest.fn(() => false),
    setEnabled: jest.fn()
  })),
  resetGlobalCache: jest.fn(),
  globalCache: {
    get: jest.fn(() => null),
    set: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(() => ({ hits: 0, misses: 0, size: 0, hitRate: 0 })),
    isEnabled: jest.fn(() => false),
    setEnabled: jest.fn()
  }
}));

import { toolRegistry } from '../../tools/index.js';
import { getConfig } from '../../config/index.js';

describe('Tool Configuration', () => {
  describe('Centralized Configuration', () => {
    it('should use centralized configuration values', () => {
      const config = getConfig();
      expect(config.exa.baseUrl).toBe('https://api.exa.ai');
      expect(config.tools.defaultNumResults).toBe(3);
      expect(config.tools.defaultMaxCharacters).toBe(3000);
    });
  });

  describe('toolRegistry', () => {
    it('should be an object', () => {
      expect(typeof toolRegistry).toBe('object');
      expect(toolRegistry).not.toBeNull();
    });

    it('should have tools registered', () => {
      expect(Object.keys(toolRegistry).length).toBeGreaterThan(0);
    });
  });

  describe('ToolRegistry interface', () => {
    it('should have proper structure for registered tools', () => {
      Object.values(toolRegistry).forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('schema');
        expect(tool).toHaveProperty('handler');
        expect(tool).toHaveProperty('enabled');
        
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.handler).toBe('function');
        expect(typeof tool.enabled).toBe('boolean');
      });
    });
  });
});

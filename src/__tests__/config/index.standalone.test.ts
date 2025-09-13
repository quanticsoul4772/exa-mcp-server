import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import the actual config module directly
import { validateConfig, getConfig, clearConfigCache } from '../../config/index.js';

describe('Configuration Standalone Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    
    // Clear config cache
    clearConfigCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearConfigCache();
  });

  describe('validateConfig', () => {
    it('should validate configuration with API key', () => {
      const config = validateConfig({
        exa: {
          apiKey: 'test-api-key-123'
        },
        server: {},
        logging: {},
        environment: {},
        tools: {},
        cache: {}
      });
      
      expect(config.exa.apiKey).toBe('test-api-key-123');
      expect(config.exa.baseUrl).toBe('https://api.exa.ai');
      expect(config.server.name).toBe('exa-search-server');
    });

    it('should throw when API key is missing', () => {
      expect(() => {
        validateConfig({
          exa: {},
          server: {},
          logging: {},
          environment: {},
          tools: {},
          cache: {}
        });
      }).toThrow();
    });

    it('should use default values', () => {
      const config = validateConfig({
        exa: { apiKey: 'key' },
        server: {},
        logging: {},
        environment: {},
        tools: {},
        cache: {}
      });
      
      expect(config.exa.timeout).toBe(25000);
      expect(config.exa.retries).toBe(3);
      expect(config.logging.level).toBe('INFO');
      expect(config.logging.redactLogs).toBe(true);
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.maxSize).toBe(100);
    });

    it('should handle overrides', () => {
      const config = validateConfig({
        exa: { 
          apiKey: 'key',
          timeout: 30000,
          retries: 5
        },
        server: {},
        logging: {
          level: 'DEBUG',
          redactLogs: false
        },
        environment: {},
        tools: {},
        cache: {
          enabled: false,
          maxSize: 200
        }
      });
      
      expect(config.exa.timeout).toBe(30000);
      expect(config.exa.retries).toBe(5);
      expect(config.logging.level).toBe('DEBUG');
      expect(config.logging.redactLogs).toBe(false);
      expect(config.cache.enabled).toBe(false);
      expect(config.cache.maxSize).toBe(200);
    });
  });

  describe('getConfig with environment', () => {
    it('should read API key from environment', () => {
      process.env.EXA_API_KEY = 'env-key-456';
      
      const config = getConfig();
      
      expect(config.exa.apiKey).toBe('env-key-456');
    });

    it('should throw when no API key provided', () => {
      delete process.env.EXA_API_KEY;
      
      expect(() => getConfig()).toThrow();
    });

    it('should cache configuration', () => {
      process.env.EXA_API_KEY = 'cached-key';
      
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2);
    });

    it('should clear cache', () => {
      process.env.EXA_API_KEY = 'first-key';
      const config1 = getConfig();
      
      clearConfigCache();
      
      process.env.EXA_API_KEY = 'second-key';
      const config2 = getConfig();
      
      expect(config1.exa.apiKey).toBe('first-key');
      expect(config2.exa.apiKey).toBe('second-key');
    });

    it('should read all environment variables', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.EXA_BASE_URL = 'https://custom.api.com';
      process.env.EXA_TIMEOUT = '30000';
      process.env.LOG_LEVEL = 'DEBUG';
      process.env.CACHE_ENABLED = 'false';
      
      const config = getConfig();
      
      expect(config.exa.baseUrl).toBe('https://custom.api.com');
      expect(config.exa.timeout).toBe(30000);
      expect(config.logging.level).toBe('DEBUG');
      expect(config.cache.enabled).toBe(false);
    });

    it('should handle invalid environment values', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.EXA_TIMEOUT = 'not-a-number';
      
      expect(() => getConfig()).toThrow();
    });

    it('should handle out of range values', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.EXA_TIMEOUT = '100'; // Too low
      
      expect(() => getConfig()).toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string API key', () => {
      process.env.EXA_API_KEY = '';
      
      expect(() => getConfig()).toThrow();
    });

    it('should handle whitespace API key', () => {
      // Whitespace is trimmed, resulting in empty string which should fail
      expect(() => {
        validateConfig({
          exa: { apiKey: '   ' },
          server: {},
          logging: {},
          environment: {},
          tools: {},
          cache: {}
        });
      }).toThrow();
    });

    it('should handle invalid log level', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.LOG_LEVEL = 'INVALID';
      
      expect(() => getConfig()).toThrow();
    });

    it('should handle invalid boolean values', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.CACHE_ENABLED = 'not-a-bool';
      
      // Should default to true since 'not-a-bool' !== 'false'
      const config = getConfig();
      expect(config.cache.enabled).toBe(true);
    });

    it('should handle negative cache size', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.CACHE_MAX_SIZE = '-10';
      
      expect(() => getConfig()).toThrow();
    });

    it('should handle negative TTL', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.CACHE_TTL_MINUTES = '-5';
      
      expect(() => getConfig()).toThrow();
    });
  });
});
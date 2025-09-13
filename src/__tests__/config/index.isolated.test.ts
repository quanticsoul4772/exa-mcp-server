import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Configuration Isolated Tests', () => {
  const originalEnv = process.env;
  let validateConfig: any;
  let getConfig: any;
  let clearConfigCache: any;

  beforeEach(async () => {
    // Clear all mocks first
    jest.clearAllMocks();
    jest.resetModules();
    jest.unmock('../../config/index.js');
    
    // Reset environment
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    
    // Import the real module
    const configModule = await import('../../config/index.js');
    validateConfig = configModule.validateConfig;
    getConfig = configModule.getConfig;
    clearConfigCache = configModule.clearConfigCache;
    
    // Clear config cache
    if (clearConfigCache) {
      clearConfigCache();
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    if (clearConfigCache) {
      clearConfigCache();
    }
    jest.clearAllMocks();
    jest.resetModules();
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
  });
});
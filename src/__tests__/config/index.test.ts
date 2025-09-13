import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// We need to isolate the config module for each test
describe('Configuration Management', () => {
  const originalEnv = process.env;
  let validateConfig: any;
  let clearConfigCache: any;
  let getConfig: any;
  
  beforeEach(async () => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    
    // Clear module cache to get fresh imports
    jest.resetModules();
    
    // Dynamically import to get fresh module instances
    const configModule = await import('../../config/index.js');
    validateConfig = configModule.validateConfig;
    clearConfigCache = configModule.clearConfigCache;
    getConfig = configModule.getConfig;
    
    // Clear config cache
    clearConfigCache();
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
    it('should validate with minimal required configuration', () => {
      const config = validateConfig({
        exa: {
          apiKey: 'test-api-key'
        },
        server: {},
        logging: {},
        environment: {},
        tools: {},
        cache: {}
      });
      
      expect(config.exa.apiKey).toBe('test-api-key');
      expect(config.exa.baseUrl).toBe('https://api.exa.ai');
      expect(config.exa.timeout).toBe(25000);
      expect(config.exa.retries).toBe(3);
      expect(config.server.name).toBe('exa-search-server');
      expect(config.server.version).toBe('0.3.6');
    });
    
    it('should fail validation when API key is missing', () => {
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
    
    it('should fail validation when API key is empty', () => {
      expect(() => {
        validateConfig({
          exa: {
            apiKey: ''
          },
          server: {},
          logging: {},
          environment: {},
          tools: {},
        cache: {}
        });
      }).toThrow();
    });
    
    it('should coerce string numbers to integers', () => {
      const config = validateConfig({
        exa: {
          apiKey: 'test-key',
          timeout: '30000',
          retries: '5'
        },
        server: {},
        logging: {},
        environment: {},
        tools: {
          defaultNumResults: '10',
          defaultMaxCharacters: '5000'
        },
        cache: {}
      });
      
      expect(config.exa.timeout).toBe(30000);
      expect(config.exa.retries).toBe(5);
      expect(config.tools.defaultNumResults).toBe(10);
      expect(config.tools.defaultMaxCharacters).toBe(5000);
    });
    
    it('should validate URL format for base URL', () => {
      expect(() => {
        validateConfig({
          exa: {
            apiKey: 'test-key',
            baseUrl: 'not-a-url'
          },
          server: {},
          logging: {},
          environment: {},
          tools: {},
        cache: {}
        });
      }).toThrow();
    });
    
    it('should validate timeout bounds', () => {
      expect(() => {
        validateConfig({
          exa: {
            apiKey: 'test-key',
            timeout: 500 // Below minimum
          },
          server: {},
          logging: {},
          environment: {},
          tools: {},
        cache: {}
        });
      }).toThrow();
      
      expect(() => {
        validateConfig({
          exa: {
            apiKey: 'test-key',
            timeout: 70000 // Above maximum
          },
          server: {},
          logging: {},
          environment: {},
          tools: {},
        cache: {}
        });
      }).toThrow();
    });
    
    it('should validate log level enum', () => {
      const config = validateConfig({
        exa: {
          apiKey: 'test-key'
        },
        server: {},
        logging: {
          level: 'INFO'
        },
        environment: {},
        tools: {},
        cache: {}
      });
      
      expect(config.logging.level).toBe('INFO');
      
      expect(() => {
        validateConfig({
          exa: {
            apiKey: 'test-key'
          },
          server: {},
          logging: {
            level: 'INVALID'
          },
          environment: {},
          tools: {},
        cache: {}
        });
      }).toThrow();
    });
    
    it('should handle boolean preprocessing for redactLogs', () => {
      const configTrue = validateConfig({
        exa: { apiKey: 'test-key' },
        server: {},
        logging: { redactLogs: 'true' },
        environment: {},
        tools: {},
        cache: {}
      });
      expect(configTrue.logging.redactLogs).toBe(true);
      
      const configFalse = validateConfig({
        exa: { apiKey: 'test-key' },
        server: {},
        logging: { redactLogs: 'false' },
        environment: {},
        tools: {},
        cache: {}
      });
      expect(configFalse.logging.redactLogs).toBe(false);
      
      const configDefault = validateConfig({
        exa: { apiKey: 'test-key' },
        server: {},
        logging: {},
        environment: {},
        tools: {},
        cache: {}
      });
      expect(configDefault.logging.redactLogs).toBe(true);
    });
    
    it('should validate environment enum', () => {
      const config = validateConfig({
        exa: { apiKey: 'test-key' },
        server: {},
        logging: {},
        environment: { nodeEnv: 'production' },
        tools: {},
        cache: {}
      });
      
      expect(config.environment.nodeEnv).toBe('production');
      
      expect(() => {
        validateConfig({
          exa: { apiKey: 'test-key' },
          server: {},
          logging: {},
          environment: { nodeEnv: 'invalid-env' },
          tools: {},
        cache: {}
        });
      }).toThrow();
    });        it('should validate tool default bounds', () => {
      expect(() => {
        validateConfig({
          exa: { apiKey: 'test-key' },
          server: {},
          logging: {},
          environment: {},
          tools: { defaultNumResults: 0 }, // Below minimum
          cache: {}
        });
      }).toThrow();
      
      expect(() => {
        validateConfig({
          exa: { apiKey: 'test-key' },
          server: {},
          logging: {},
          environment: {},
          tools: { defaultNumResults: 100 }, // Above maximum
          cache: {}
        });
      }).toThrow();
    });
    
    it('should reject unknown fields in strict mode', () => {
      expect(() => {
        validateConfig({
          exa: { apiKey: 'test-key' },
          server: {},
          logging: {},
          environment: {},
          tools: {},
        cache: {},
          unknownField: 'should-fail'
        });
      }).toThrow();
    });
  });
  
  describe('getConfig with environment variables', () => {
    it('should read from environment variables', () => {
      process.env.EXA_API_KEY = 'env-api-key';
      process.env.LOG_LEVEL = 'WARN';
      process.env.NODE_ENV = 'test';
      process.env.REDACT_LOGS = 'false';
      
      const config = getConfig();
      
      expect(config.exa.apiKey).toBe('env-api-key');
      expect(config.logging.level).toBe('WARN');
      expect(config.environment.nodeEnv).toBe('test');
      expect(config.logging.redactLogs).toBe(false);
    });
    
    it('should cache configuration', () => {
      process.env.EXA_API_KEY = 'cached-key';
      
      const config1 = getConfig();
      const config2 = getConfig();
      
      expect(config1).toBe(config2); // Same reference
    });
    
    it('should handle missing API key with helpful error', () => {
      delete process.env.EXA_API_KEY;
      
      expect(() => {
        getConfig();
      }).toThrow(/API key/i);
    });
    
    it('should use all environment variables', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.EXA_BASE_URL = 'https://custom.api.com';
      process.env.EXA_TIMEOUT = '35000';
      process.env.EXA_RETRIES = '4';
      process.env.LOG_LEVEL = 'DEBUG';
      process.env.REDACT_LOGS = 'true';
      process.env.NODE_ENV = 'development';
      process.env.DEFAULT_NUM_RESULTS = '15';
      process.env.DEFAULT_MAX_CHARACTERS = '6000';
      process.env.CACHE_ENABLED = 'true';
      process.env.CACHE_MAX_SIZE = '200';
      process.env.CACHE_TTL_MINUTES = '10';
      
      const config = getConfig();
      
      expect(config.exa.apiKey).toBe('test-key');
      expect(config.exa.baseUrl).toBe('https://custom.api.com');
      expect(config.exa.timeout).toBe(35000);
      expect(config.exa.retries).toBe(4);
      expect(config.logging.level).toBe('DEBUG');
      expect(config.logging.redactLogs).toBe(true);
      expect(config.environment.nodeEnv).toBe('development');
      expect(config.tools.defaultNumResults).toBe(15);
      expect(config.tools.defaultMaxCharacters).toBe(6000);
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.maxSize).toBe(200);
      expect(config.cache.ttlMinutes).toBe(10);
    });
    
    it('should handle invalid numeric environment variables', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.EXA_TIMEOUT = 'not-a-number';
      
      expect(() => {
        getConfig();
      }).toThrow();
    });
    
    it('should handle out of range values', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.DEFAULT_NUM_RESULTS = '200'; // Above max of 50
      
      expect(() => {
        getConfig();
      }).toThrow();
    });
    
    it('should handle cache configuration', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.CACHE_ENABLED = 'false';
      process.env.CACHE_MAX_SIZE = '50';
      process.env.CACHE_TTL_MINUTES = '30';
      
      const config = getConfig();
      
      expect(config.cache.enabled).toBe(false);
      expect(config.cache.maxSize).toBe(50);
      expect(config.cache.ttlMinutes).toBe(30);
    });
  });
  
  describe('Error handling', () => {
    it('should provide clear error for invalid URL', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.EXA_BASE_URL = 'invalid-url';
      
      expect(() => {
        getConfig();
      }).toThrow(/Invalid url/i);
    });
    
    it('should provide clear error for invalid enum value', () => {
      process.env.EXA_API_KEY = 'test-key';
      process.env.LOG_LEVEL = 'INVALID_LEVEL';
      
      expect(() => {
        getConfig();
      }).toThrow(/Invalid enum value/i);
    });
    
    it('should handle cache clear correctly', () => {
      process.env.EXA_API_KEY = 'first-key';
      
      const config1 = getConfig();
      expect(config1.exa.apiKey).toBe('first-key');
      
      clearConfigCache();
      process.env.EXA_API_KEY = 'second-key';
      
      const config2 = getConfig();
      expect(config2.exa.apiKey).toBe('second-key');
      expect(config1).not.toBe(config2);
    });
  });
});

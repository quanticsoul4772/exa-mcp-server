import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('PinoLogger Integration', () => {
  let createPinoLogger: any;
  let formatError: any;
  let formatRequest: any;
  let formatResponse: any;
  
  beforeEach(async () => {
    // Reset modules and environment
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.EXA_API_KEY = 'test-key';
    
    // Mock config
    jest.doMock('../../config/index.js', () => ({
      getConfig: jest.fn(() => ({
        exa: { apiKey: 'test-key', baseUrl: 'https://api.exa.ai' },
        server: { name: 'test-server', version: '1.0.0' },
        logging: { level: 'ERROR', redactLogs: true },
        environment: { nodeEnv: 'test' },
        cache: { enabled: true, maxSize: 100, ttlMinutes: 5 },
        tools: { defaultNumResults: 5, defaultMaxCharacters: 3000 }
      }))
    }));
    
    // Import after mocks
    const loggerModule = await import('../../utils/pinoLogger.js');
    createPinoLogger = loggerModule.createPinoLogger;
    formatError = loggerModule.formatError;
    formatRequest = loggerModule.formatRequest;
    formatResponse = loggerModule.formatResponse;
  });

  it('should create a logger instance', () => {
    const logger = createPinoLogger();
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.warn).toBeDefined();
  });

  it('should format errors', () => {
    const error = new Error('Test error');
    error.stack = 'Error stack trace';
    
    const formatted = formatError(error);
    expect(formatted).toBeDefined();
    expect(formatted.message).toBe('Test error');
    expect(formatted.stack).toBeDefined();
  });

  it('should format requests', () => {
    const request = {
      method: 'GET',
      url: '/api/test',
      headers: { 'x-api-key': 'secret' }
    };
    
    const formatted = formatRequest(request);
    expect(formatted).toBeDefined();
    expect(formatted.method).toBe('GET');
    expect(formatted.url).toBe('/api/test');
  });

  it('should format responses', () => {
    const response = {
      status: 200,
      data: { result: 'success' },
      headers: { 'content-type': 'application/json' }
    };
    
    const formatted = formatResponse(response);
    expect(formatted).toBeDefined();
    expect(formatted.status).toBe(200);
  });

  it('should handle null and undefined values', () => {
    expect(formatError(null)).toEqual({});
    expect(formatError(undefined)).toEqual({});
    expect(formatRequest(null)).toEqual({});
    expect(formatRequest(undefined)).toEqual({});
    expect(formatResponse(null)).toEqual({});
    expect(formatResponse(undefined)).toEqual({});
  });

  it('should handle complex objects', () => {
    const complexError = {
      message: 'Complex error',
      code: 'ERR_001',
      details: { field: 'value' }
    };
    
    const formatted = formatError(complexError);
    expect(formatted.message).toBe('Complex error');
    expect(formatted.code).toBe('ERR_001');
  });

  it('should create child logger', () => {
    const logger = createPinoLogger();
    const child = logger.child({ component: 'test' });
    
    expect(child).toBeDefined();
    expect(child.info).toBeDefined();
  });
});
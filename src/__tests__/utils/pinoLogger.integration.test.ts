import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('PinoLogger Integration', () => {
  let structuredLogger: any;
  let createRequestLogger: any;
  let generateRequestId: any;

  beforeEach(async () => {
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

    // Unmock pinoLogger so we get the real implementation
    jest.unmock('../../utils/pinoLogger.js');

    // Import after mocks
    const loggerModule = await import('../../utils/pinoLogger.js');
    structuredLogger = loggerModule.structuredLogger;
    createRequestLogger = loggerModule.createRequestLogger;
    generateRequestId = loggerModule.generateRequestId;
  });

  it('should have a structured logger instance', () => {
    expect(structuredLogger).toBeDefined();
    expect(structuredLogger.info).toBeDefined();
    expect(structuredLogger.error).toBeDefined();
    expect(structuredLogger.debug).toBeDefined();
    expect(structuredLogger.warn).toBeDefined();
  });

  it('should create child loggers', () => {
    const child = structuredLogger.child({ component: 'test' });
    expect(child).toBeDefined();
    expect(child.info).toBeDefined();
  });

  it('should generate unique request IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
  });

  it('should create a request logger', () => {
    const logger = createRequestLogger('req-123', 'exa_search');
    expect(logger).toBeDefined();
    expect(logger.start).toBeDefined();
    expect(logger.log).toBeDefined();
    expect(logger.complete).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it('should create request logger without tool name', () => {
    const logger = createRequestLogger('req-456');
    expect(logger).toBeDefined();
    expect(logger.start).toBeDefined();
  });
});

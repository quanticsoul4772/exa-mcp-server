import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import pino from 'pino';
import { 
  structuredLogger, 
  createStructuredRequestLogger, 
  createChildLogger,
  generateRequestId,
  log,
  logInfo,
  logWarn,
  logError,
  createRequestLogger
} from '../../utils/pinoLogger.js';

// Mock pino and pino-pretty
jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  };
  
  const pinoMock = jest.fn(() => mockLogger);
  (pinoMock as any).stdTimeFunctions = { isoTime: jest.fn() };
  
  Object.assign(pinoMock, { mockLogger });
  
  return pinoMock;
});

// Mock the config
jest.mock('../../config/index.js', () => ({
  getConfig: () => ({
    logging: {
      level: 'DEBUG',
      redactLogs: false
    },
    server: {
      name: 'test-server',
      version: '1.0.0'
    },
    environment: {
      nodeEnv: 'test'
    }
  })
}));

describe('Pino Structured Logger', () => {
  const originalEnv = process.env;
  let mockPinoLogger: any;

  beforeEach(() => {
    // Set test environment
    process.env = { 
      ...originalEnv, 
      NODE_ENV: 'test',
      EXA_API_KEY: 'test-api-key-for-pino-tests' 
    };
    
    // Get mock logger instance
    mockPinoLogger = (pino as any).mockLogger;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });
  });

  describe('structuredLogger', () => {
    it('should log info messages', () => {
      structuredLogger.info('Test info message');
      expect(mockPinoLogger.info).toHaveBeenCalledWith('Test info message');
    });

    it('should log info with object and message', () => {
      const obj = { userId: 'user-123', action: 'test' };
      structuredLogger.info(obj, 'Test message');
      expect(mockPinoLogger.info).toHaveBeenCalledWith(obj, 'Test message');
    });

    it('should log error messages', () => {
      structuredLogger.error('Test error message');
      expect(mockPinoLogger.error).toHaveBeenCalledWith('Test error message');
    });

    it('should log warnings', () => {
      structuredLogger.warn('Test warning message');
      expect(mockPinoLogger.warn).toHaveBeenCalledWith('Test warning message');
    });

    it('should log debug messages', () => {
      structuredLogger.debug('Test debug message');
      expect(mockPinoLogger.debug).toHaveBeenCalledWith('Test debug message');
    });

    it('should create child loggers', () => {
      const context = { module: 'TestModule' };
      structuredLogger.child(context);
      expect(mockPinoLogger.child).toHaveBeenCalledWith(context);
    });
  });

  describe('createStructuredRequestLogger', () => {
    it('should create request logger with context', () => {
      const requestId = 'req-123';
      const toolName = 'test_tool';
      
      const requestLogger = createStructuredRequestLogger(requestId, toolName);
      expect(mockPinoLogger.child).toHaveBeenCalledWith({
        requestId,
        toolName
      });
    });

    it('should create request logger without tool name', () => {
      const requestId = 'req-456';
      
      const requestLogger = createStructuredRequestLogger(requestId);
      expect(mockPinoLogger.child).toHaveBeenCalledWith({
        requestId
      });
    });

    it('should log request start with structured data', () => {
      const requestLogger = createStructuredRequestLogger('req-123', 'test_tool');
      const query = 'test query';
      const metadata = { userId: 'user-456' };
      
      requestLogger.start(query, metadata);
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        event: 'request_start',
        query,
        userId: 'user-456'
      }, 'Request started');
    });

    it('should log request completion with duration', () => {
      const requestLogger = createStructuredRequestLogger('req-123', 'test_tool');
      const duration = 1250;
      const metadata = { resultCount: 5 };
      
      requestLogger.complete(duration, metadata);
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        event: 'request_complete',
        duration,
        resultCount: 5
      }, 'Request completed');
    });

    it('should log API requests', () => {
      const requestLogger = createStructuredRequestLogger('req-123', 'test_tool');
      
      requestLogger.apiRequest('POST', '/api/search', { timeout: 5000 });
      
      expect(mockPinoLogger.debug).toHaveBeenCalledWith({
        event: 'api_request',
        http: { method: 'POST', url: '/api/search' },
        timeout: 5000
      }, 'API request sent');
    });

    it('should log API responses', () => {
      const requestLogger = createStructuredRequestLogger('req-123', 'test_tool');
      
      requestLogger.apiResponse(200, 850, { resultCount: 3 });
      
      expect(mockPinoLogger.debug).toHaveBeenCalledWith({
        event: 'api_response',
        http: { statusCode: 200 },
        duration: 850,
        resultCount: 3
      }, 'API response received');
    });
  });

  describe('createChildLogger', () => {
    it('should create child logger with context', () => {
      const context = { module: 'UserService', version: '2.0' };
      
      const childLogger = createChildLogger(context);
      expect(mockPinoLogger.child).toHaveBeenCalledWith(context);
    });
  });

  describe('legacy compatibility functions', () => {
    it('should support legacy log function', () => {
      log('Legacy debug message');
      expect(mockPinoLogger.debug).toHaveBeenCalledWith('Legacy debug message');
    });

    it('should support legacy logInfo function', () => {
      logInfo('Legacy info message');
      expect(mockPinoLogger.info).toHaveBeenCalledWith('Legacy info message');
    });

    it('should support legacy logWarn function', () => {
      logWarn('Legacy warning message');
      expect(mockPinoLogger.warn).toHaveBeenCalledWith('Legacy warning message');
    });

    it('should support legacy logError function', () => {
      logError('Legacy error message');
      expect(mockPinoLogger.error).toHaveBeenCalledWith('Legacy error message');
    });
  });

  describe('legacy createRequestLogger', () => {
    it('should create request logger with legacy interface', () => {
      const requestId = 'req-legacy-123';
      const toolName = 'legacy_tool';
      
      const legacyLogger = createRequestLogger(requestId, toolName);
      
      expect(mockPinoLogger.child).toHaveBeenCalledWith({
        requestId,
        toolName
      });
    });

    it('should support legacy log method', () => {
      const legacyLogger = createRequestLogger('req-123', 'test_tool');
      
      legacyLogger.log('Debug message');
      expect(mockPinoLogger.debug).toHaveBeenCalledWith('Debug message');
    });

    it('should support legacy start method', () => {
      const legacyLogger = createRequestLogger('req-123', 'test_tool');
      
      legacyLogger.start('search query');
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        event: 'request_start',
        query: 'search query'
      }, 'Request started');
    });

    it('should support legacy error method with Error object', () => {
      const legacyLogger = createRequestLogger('req-123', 'test_tool');
      const error = new Error('Test error');
      
      legacyLogger.error(error);
      
      expect(mockPinoLogger.error).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          stack: error.stack,
          name: 'Error'
        }
      }, 'Test error');
    });

    it('should support legacy error method with string', () => {
      const legacyLogger = createRequestLogger('req-123', 'test_tool');
      
      legacyLogger.error('String error');
      
      expect(mockPinoLogger.error).toHaveBeenCalledWith({
        error: 'String error'
      }, 'String error');
    });

    it('should support legacy complete method', () => {
      const legacyLogger = createRequestLogger('req-123', 'test_tool');
      
      legacyLogger.complete();
      
      expect(mockPinoLogger.info).toHaveBeenCalledWith({
        event: 'request_complete'
      }, 'Request completed');
    });
  });
});

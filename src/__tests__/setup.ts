// Test setup file to handle module initialization order
import { jest } from '@jest/globals';

// Set up environment variables before any modules load
process.env.NODE_ENV = 'test';
process.env.EXA_API_KEY = 'test-api-key';

// Mock config first - this must happen before any other imports
jest.mock('../config/index.js', () => ({
  getConfig: jest.fn(() => ({
    exa: {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.exa.ai',
      timeout: 25000,
      retries: 3
    },
    server: {
      name: 'test-server',
      version: '1.0.0'
    },
    logging: {
      level: 'ERROR',
      redactLogs: true
    },
    environment: {
      nodeEnv: 'test'
    },
    cache: {
      enabled: true,
      maxSize: 100,
      ttlMinutes: 5
    },
    tools: {
      defaultNumResults: 5,
      defaultMaxCharacters: 3000
    }
  })),
  clearConfigCache: jest.fn(),
  validateConfig: jest.fn((config: any) => config)
}));

// Mock logger - must happen before modules that use it
jest.mock('../utils/pinoLogger.js', () => {
  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn()
  };
  
  return {
    structuredLogger: {
      ...mockLogger,
      child: jest.fn(() => mockLogger)
    },
    createPinoLogger: jest.fn(() => mockLogger),
    formatError: jest.fn((err: any) => ({ error: err?.message || 'Error' })),
    formatRequest: jest.fn((req: any) => ({ request: req })),
    formatResponse: jest.fn((res: any) => ({ response: res }))
  };
});

// Global test utilities
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetModules();
};

export const mockConsole = () => {
  const originalConsole = { ...console };
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
  
  return () => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.debug = originalConsole.debug;
  };
};
const mockChildLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn()
};

export const structuredLogger = {
  ...mockChildLogger,
  child: jest.fn(() => mockChildLogger)
};

export const createPinoLogger = jest.fn(() => mockChildLogger);
export const formatError = jest.fn(err => ({ error: (err && err.message) || 'Error' }));
export const formatRequest = jest.fn(req => ({ request: req }));
export const formatResponse = jest.fn(res => ({ response: res }));

export const generateRequestId = jest.fn(() => `req-${Math.random().toString(36).slice(2)}`);
export const createStructuredRequestLogger = jest.fn((_requestId, _toolName) => ({
  start: jest.fn(),
  log: jest.fn(),
  complete: jest.fn(),
  error: jest.fn(),
  logApiRequest: jest.fn(),
  logApiResponse: jest.fn()
}));
export const createChildLogger = jest.fn(() => mockChildLogger);
export const log = jest.fn();
export const logInfo = jest.fn();
export const logWarn = jest.fn();
export const logError = jest.fn();
export const createRequestLogger = jest.fn((_requestId, _toolName) => ({
  start: jest.fn(),
  log: jest.fn(),
  complete: jest.fn(),
  error: jest.fn(),
  logApiRequest: jest.fn(),
  logApiResponse: jest.fn()
}));

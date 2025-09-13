export const structuredLogger = {
  child: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn()
  })),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn()
};

export const createPinoLogger = jest.fn(() => structuredLogger);
export const formatError = jest.fn(err => ({ error: err.message || 'Error' }));
export const formatRequest = jest.fn(req => ({ request: req }));
export const formatResponse = jest.fn(res => ({ response: res }));
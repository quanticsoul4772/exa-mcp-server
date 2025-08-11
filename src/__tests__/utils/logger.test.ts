import { log, createRequestLogger } from '../../utils/logger.js';

describe('Logger', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('log', () => {
    it('should log messages to console.error with prefix', () => {
      log('Test message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[EXA-MCP-DEBUG] Test message');
    });
  });

  describe('createRequestLogger', () => {
    it('should create a logger with request ID and tool name', () => {
      const logger = createRequestLogger('req-123', 'exa_search');
      
      logger.log('Processing request');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[EXA-MCP-DEBUG] [req-123] [exa_search] Processing request'
      );
    });

    it('should log start messages with query', () => {
      const logger = createRequestLogger('req-123', 'exa_search');
      
      logger.start('test query');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[EXA-MCP-DEBUG] [req-123] [exa_search] Starting search for query: "test query"'
      );
    });

    it('should log error messages', () => {
      const logger = createRequestLogger('req-123', 'exa_search');
      const error = new Error('Test error');
      
      logger.error(error);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[EXA-MCP-DEBUG] [req-123] [exa_search] Error: Test error'
      );
    });

    it('should handle non-Error objects in error method', () => {
      const logger = createRequestLogger('req-123', 'exa_search');
      
      logger.error('String error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[EXA-MCP-DEBUG] [req-123] [exa_search] Error: String error'
      );
    });

    it('should log completion messages', () => {
      const logger = createRequestLogger('req-123', 'exa_search');
      
      logger.complete();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[EXA-MCP-DEBUG] [req-123] [exa_search] Successfully completed request'
      );
    });
  });
});

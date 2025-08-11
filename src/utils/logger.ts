/**
 * Simple logging utility for MCP server.
 * Logs debug messages to stderr for debugging purposes.
 * 
 * @param {string} message - The message to log
 * @returns {void}
 * 
 * @example
 * ```typescript
 * log('Server started successfully');
 * ```
 */
export const log = (message: string): void => {
  console.error(`[EXA-MCP-DEBUG] ${message}`);
};

/**
 * Creates a request-specific logger with context.
 * Provides structured logging for individual tool requests.
 * 
 * @param {string} requestId - Unique identifier for the request
 * @param {string} toolName - Name of the tool making the request
 * @returns {Object} Logger object with log, start, error, and complete methods
 * 
 * @example
 * ```typescript
 * const logger = createRequestLogger('req-123', 'exa_search');
 * logger.start('search query');
 * logger.log('Processing...');
 * logger.complete();
 * ```
 */
export const createRequestLogger = (requestId: string, toolName: string) => {
  return {
    log: (message: string): void => {
      log(`[${requestId}] [${toolName}] ${message}`);
    },
    start: (query: string): void => {
      log(`[${requestId}] [${toolName}] Starting search for query: "${query}"`);
    },
    error: (error: unknown): void => {
      log(`[${requestId}] [${toolName}] Error: ${error instanceof Error ? error.message : String(error)}`);
    },
    complete: (): void => {
      log(`[${requestId}] [${toolName}] Successfully completed request`);
    }
  };
}; 
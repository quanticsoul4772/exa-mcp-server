/**
 * Log levels for the MCP server.
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Import config but handle potential circular dependency by deferring the import
let configInstance: any = null;

// Export for testing purposes
export { configInstance };

/**
 * Get the current log level from configuration.
 * Falls back to environment variables if config is not available (during bootstrap).
 */
function getCurrentLogLevel(): LogLevel {
  // Try to get config, but handle case where we're being called during config initialization
  try {
    if (!configInstance) {
      const { getConfig } = require('../config/index.js');
      configInstance = getConfig();
    }
    
    const level = configInstance.logging.level;
    switch (level) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default: return LogLevel.ERROR;
    }
  } catch {
    // Fallback to environment variables during config bootstrap
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    
    switch (envLevel) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default:
        return process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG;
    }
  }
}

/**
 * Redact sensitive information from log messages.
 */
function redactSensitiveData(message: string): string {
  // Check if redaction is enabled via config (with fallback to env var)
  let shouldRedact = true;
  try {
    if (configInstance?.logging?.redactLogs !== undefined) {
      shouldRedact = configInstance.logging.redactLogs;
    } else {
      shouldRedact = process.env.REDACT_LOGS !== 'false';
    }
  } catch {
    shouldRedact = process.env.REDACT_LOGS !== 'false';
  }
  
  if (!shouldRedact) {
    return message;
  }
  
  // Redact potential domains and URLs
  message = message.replace(/\b([a-zA-Z0-9.-]+\.(com|org|net|edu|gov|ai|io|co|xyz))/gi, '[DOMAIN_REDACTED]');
  
  // Redact URLs
  message = message.replace(/https?:\/\/[^\s"']+/gi, '[URL_REDACTED]');
  
  // Redact quoted search queries (but keep first few chars for debugging)
  message = message.replace(/"([^"]{3})[^"]*"/g, '"$1[QUERY_REDACTED]"');
  
  return message;
}

/**
 * Internal logging function with level support.
 */
function logWithLevel(level: LogLevel, message: string): void {
  const currentLevel = getCurrentLogLevel();
  
  if (level <= currentLevel) {
    const levelName = LogLevel[level];
    const timestamp = new Date().toISOString();
    const finalMessage = redactSensitiveData(message);
    
    console.error(`[${timestamp}] [${levelName}] [EXA-MCP] ${finalMessage}`);
  }
}

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
  logWithLevel(LogLevel.DEBUG, message);
};

/**
 * Log an info message.
 */
export const logInfo = (message: string): void => {
  logWithLevel(LogLevel.INFO, message);
};

/**
 * Log a warning message.
 */
export const logWarn = (message: string): void => {
  logWithLevel(LogLevel.WARN, message);
};

/**
 * Log an error message.
 */
export const logError = (message: string): void => {
  logWithLevel(LogLevel.ERROR, message);
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
  const baseContext = `[${requestId}] [${toolName}]`;
  
  return {
    log: (message: string): void => {
      logWithLevel(LogLevel.DEBUG, `${baseContext} ${message}`);
    },
    info: (message: string): void => {
      logWithLevel(LogLevel.INFO, `${baseContext} ${message}`);
    },
    warn: (message: string): void => {
      logWithLevel(LogLevel.WARN, `${baseContext} ${message}`);
    },
    start: (query: string): void => {
      logWithLevel(LogLevel.INFO, `${baseContext} Starting search for query: "${query}"`);
    },
    error: (error: unknown): void => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWithLevel(LogLevel.ERROR, `${baseContext} Error: ${errorMsg}`);
    },
    complete: (): void => {
      logWithLevel(LogLevel.INFO, `${baseContext} Successfully completed request`);
    }
  };
}; 
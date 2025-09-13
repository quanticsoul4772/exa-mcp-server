import pino, { Logger, LoggerOptions } from 'pino';
import { getConfig } from '../config/index.js';

/**
 * Base fields that should be included in all log entries
 */
interface BaseLogFields {
  service: string;
  version: string;
  environment: string;
}

/**
 * Request-specific fields that should be included in request logs
 */
interface RequestLogFields extends BaseLogFields {
  requestId: string;
  toolName?: string;
}

/**
 * Creates the main Pino logger instance with appropriate configuration
 */
function createPinoLogger(): Logger {
  let config;
  try {
    config = getConfig();
  } catch (error) {
    // Fallback configuration for testing environments where config might not be available
    config = {
      logging: { level: 'DEBUG', redactLogs: false },
      server: { name: 'exa-mcp-server', version: '0.3.6' },
      environment: { nodeEnv: process.env.NODE_ENV || 'development' }
    };
  }
  
  const loggerOptions: LoggerOptions = {
    level: config.logging.level.toLowerCase(),
    base: {
      service: config.server.name,
      version: config.server.version,
      environment: config.environment.nodeEnv,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown'
    },
    redact: {
      paths: [
        'password',
        'authorization',
        'token',
        'apiKey',
        'cookie',
        'secret',
        'headers.authorization',
        'headers.apiKey',
        'headers.cookie'
      ],
      remove: config.logging.redactLogs
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label })
    }
  };

  // Disable pino-pretty for MCP servers to avoid ANSI color codes breaking JSON parsing
  // MCP servers need clean JSON output without formatting
  // if (config.environment.nodeEnv === 'development') {
  //   loggerOptions.transport = {
  //     target: 'pino-pretty',
  //     options: {
  //       colorize: true,
  //       translateTime: 'HH:MM:ss',
  //       ignore: 'pid,hostname',
  //       singleLine: false
  //     }
  //   };
  // }

  return pino(loggerOptions, pino.destination({ dest: 2, sync: false })); // 2 = stderr
}

// Create singleton logger instance
const logger = createPinoLogger();

/**
 * Main structured logger interface
 */
export interface StructuredLogger {
  info(obj: object, msg?: string): void;
  info(msg: string): void;
  warn(obj: object, msg?: string): void;
  warn(msg: string): void;
  error(obj: object, msg?: string): void;
  error(msg: string): void;
  debug(obj: object, msg?: string): void;
  debug(msg: string): void;
  child(bindings: object): StructuredLogger;
}

/**
 * Request-specific logger with pre-bound context
 */
export interface RequestLogger {
  info(obj: object, msg?: string): void;
  info(msg: string): void;
  warn(obj: object, msg?: string): void;
  warn(msg: string): void;
  error(obj: object, msg?: string): void;
  error(msg: string): void;
  debug(obj: object, msg?: string): void;
  debug(msg: string): void;
  start(query: string, metadata?: object): void;
  complete(duration?: number, metadata?: object): void;
  apiRequest(method: string, url: string, metadata?: object): void;
  apiResponse(statusCode: number, duration: number, metadata?: object): void;
}

/**
 * Wraps a Pino logger to provide our structured interface
 */
function wrapPinoLogger(pinoLogger: Logger): StructuredLogger {
  return {
    info: (objOrMsg: object | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        pinoLogger.info(objOrMsg);
      } else {
        pinoLogger.info(objOrMsg, msg);
      }
    },
    warn: (objOrMsg: object | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        pinoLogger.warn(objOrMsg);
      } else {
        pinoLogger.warn(objOrMsg, msg);
      }
    },
    error: (objOrMsg: object | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        pinoLogger.error(objOrMsg);
      } else {
        pinoLogger.error(objOrMsg, msg);
      }
    },
    debug: (objOrMsg: object | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        pinoLogger.debug(objOrMsg);
      } else {
        pinoLogger.debug(objOrMsg, msg);
      }
    },
    child: (bindings: object) => wrapPinoLogger(pinoLogger.child(bindings))
  };
}

/**
 * Creates a request-specific logger with enhanced methods
 */
function createStructuredRequestLoggerInternal(baseLogger: Logger, requestId: string, toolName?: string, metaRequestId?: string): RequestLogger {
  const childLogger = baseLogger.child({
    requestId,
    ...(toolName && { toolName }),
    ...(metaRequestId && { metaRequestId, requestSource: 'client' })
  });

  return {
    info: (objOrMsg: object | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        childLogger.info(objOrMsg);
      } else {
        childLogger.info(objOrMsg, msg);
      }
    },
    warn: (objOrMsg: object | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        childLogger.warn(objOrMsg);
      } else {
        childLogger.warn(objOrMsg, msg);
      }
    },
    error: (objOrMsg: object | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        childLogger.error(objOrMsg);
      } else {
        childLogger.error(objOrMsg, msg);
      }
    },
    debug: (objOrMsg: object | string, msg?: string) => {
      if (typeof objOrMsg === 'string') {
        childLogger.debug(objOrMsg);
      } else {
        childLogger.debug(objOrMsg, msg);
      }
    },
    start: (query: string, metadata?: object) => {
      childLogger.info({
        event: 'request_start',
        query,
        ...metadata
      }, 'Request started');
    },
    complete: (duration?: number, metadata?: object) => {
      childLogger.info({
        event: 'request_complete',
        ...(duration !== undefined && { duration }),
        ...metadata
      }, 'Request completed');
    },
    apiRequest: (method: string, url: string, metadata?: object) => {
      childLogger.debug({
        event: 'api_request',
        http: { method, url },
        ...metadata
      }, 'API request sent');
    },
    apiResponse: (statusCode: number, duration: number, metadata?: object) => {
      childLogger.debug({
        event: 'api_response',
        http: { statusCode },
        duration,
        ...metadata
      }, 'API response received');
    }
  };
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Main logger instance - use for application-level logging
 */
export const structuredLogger: StructuredLogger = wrapPinoLogger(logger);

/**
 * Create a request-specific logger with context
 * 
 * @param requestId - Unique identifier for this request
 * @param toolName - Optional tool name for additional context
 * @returns RequestLogger instance with pre-bound context
 * 
 * @example
 * ```typescript
 * const requestLogger = createStructuredRequestLogger('req-123', 'exa_search');
 * requestLogger.start('search query');
 * requestLogger.info({ userId: 'user-456' }, 'Processing request');
 * requestLogger.complete(1250);
 * ```
 */
export function createStructuredRequestLogger(requestId: string, toolName?: string, metaRequestId?: string): RequestLogger {
  return createStructuredRequestLoggerInternal(logger, requestId, toolName, metaRequestId);
}

/**
 * Create a child logger with additional context
 * 
 * @param context - Additional fields to bind to all log entries
 * @returns StructuredLogger instance with pre-bound context
 * 
 * @example
 * ```typescript
 * const moduleLogger = createChildLogger({ module: 'UserService' });
 * moduleLogger.info('Service initialized');
 * ```
 */
export function createChildLogger(context: object): StructuredLogger {
  return wrapPinoLogger(logger.child(context));
}

// Legacy compatibility exports - these maintain the same interface as the old logger
// but output structured JSON logs instead of formatted text
export const log = (message: string) => structuredLogger.debug(message);
export const logInfo = (message: string) => structuredLogger.info(message);
export const logWarn = (message: string) => structuredLogger.warn(message);
export const logError = (message: string) => structuredLogger.error(message);

/**
 * Legacy request logger factory for backward compatibility
 * Returns a request logger that matches the old interface but outputs structured logs
 */
export const createRequestLogger = (requestId: string, toolName: string, metaRequestId?: string) => {
  const requestLogger = createStructuredRequestLogger(requestId, toolName, metaRequestId);
  
  return {
    log: (message: string) => requestLogger.debug(message),
    info: (message: string) => requestLogger.info(message),
    warn: (message: string) => requestLogger.warn(message),
    start: (query: string) => requestLogger.start(query),
    error: (error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      requestLogger.error({ error: error instanceof Error ? { 
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error }, errorMsg);
    },
    complete: () => requestLogger.complete()
  };
};

import axios, { AxiosInstance, AxiosError } from "axios";
let _sharedClient: AxiosInstance | null = null;
import axiosRetry from "axios-retry";
import { getConfig } from "../config/index.js";
import { createRequestLogger, logWarn, generateRequestId } from "./pinoLogger.js";
import { ResponseFormatter } from "./formatter.js";

/**
 * Creates a configured Axios instance for Exa API requests.
 * Centralizes configuration to reduce duplication across tools.
 * 
 * @returns {AxiosInstance} Configured Axios instance with Exa API settings
 * @throws {Error} Throws error if EXA_API_KEY environment variable is not set
 * 
 * @example
 * ```typescript
 * const client = createExaClient();
 * const response = await client.post('/search', requestData);
 * ```
 */
export function createExaClient(): AxiosInstance {
  const config = getConfig();

  const client = axios.create({
    baseURL: config.exa.baseUrl,
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': config.exa.apiKey
    },
    timeout: config.exa.timeout
  });

  axiosRetry(client, {
    retries: config.exa.retries,
    retryDelay,
    retryCondition: isRetryable,
    onRetry: (retryCount, error, requestConfig) => {
      logWarn(`Retrying ${requestConfig.method?.toUpperCase()} ${requestConfig.url} (attempt ${retryCount}/${config.exa.retries}): ${error.message}`);
    }
  });

  return client;
}

/**
 * POST endpoints that only read data, so repeating a request cannot create
 * anything. POSTs to other endpoints (agent runs, monitors, websets) create
 * billable resources and are never retried.
 */
const READ_ONLY_POST_PATHS = new Set(['/search', '/contents', '/answer', '/context', '/findSimilar']);

/**
 * True when repeating the request cannot create a duplicate resource
 */
export function isSafeToRetry(requestConfig?: { method?: string; url?: string }): boolean {
  const method = (requestConfig?.method ?? 'get').toLowerCase();
  if (method === 'get') return true;
  return method === 'post' && READ_ONLY_POST_PATHS.has(requestConfig?.url ?? '');
}

/**
 * Retry network errors, 5xx and 429 for requests that are safe to repeat.
 * Client cancellations are never retried.
 */
export function isRetryable(error: AxiosError): boolean {
  if (axios.isCancel(error) || !isSafeToRetry(error.config)) return false;
  const status = error.response?.status;
  if (status === undefined) return axiosRetry.isNetworkError(error);
  return status === 429 || status >= 500;
}

/**
 * Honor Retry-After (seconds or HTTP date) on 429/503; otherwise exponential
 * backoff (1s, 2s, 4s...) with up to 500 ms jitter
 */
export function retryDelay(retryCount: number, error: AxiosError): number {
  const header = error.response?.headers?.['retry-after'];
  if (header !== undefined && header !== null) {
    const value = String(header);
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(value);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  return Math.pow(2, retryCount - 1) * 1000 + Math.random() * 500;
}

/**
 * Standard error handler for Exa API requests.
 * Provides consistent error handling across all tools.
 * 
 * @param {unknown} error - The error object to handle
 * @param {string} toolName - Name of the tool that encountered the error
 * @param {ReturnType<typeof createRequestLogger>} logger - Logger instance for the request
 * @returns {Object} Formatted error response with content and isError flag
 * 
 * @example
 * ```typescript
 * try {
 *   // API call
 * } catch (error) {
 *   return handleExaError(error, 'my_tool', logger);
 * }
 * ```
 */
export function handleExaError(
  error: unknown,
  toolName: string,
  logger: ReturnType<typeof createRequestLogger>
): { content: { type: "text"; text: string }[]; isError: boolean } {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status;
    const errorMessage = axiosError.response?.data || axiosError.message;
    
    logger.error(
      `Request failed with status ${statusCode}: ${JSON.stringify(errorMessage)}`
    );
    
    return {
      content: [{
        type: "text",
        text: ResponseFormatter.formatError(error, toolName)
      }],
      isError: true
    };
  }
  
  logger.error(error instanceof Error ? error.message : 'Unexpected error occurred');
  
  return {
    content: [{
      type: "text",
      text: ResponseFormatter.formatError(error, toolName)
    }],
    isError: true
  };
}

/**
 * Creates a standard request handler with logging and error handling.
 * Generic function for creating tool-specific request handlers.
 * 
 * @template TRequest - Type of the request data
 * @template TResponse - Type of the response data
 * @param {string} toolName - Name of the tool
 * @param {string} endpoint - API endpoint to call
 * @returns {Function} Async function that handles the request
 * 
 * @example
 * ```typescript
 * const handler = createExaRequestHandler<MyRequest, MyResponse>(
 *   'my_tool',
 *   '/api/endpoint'
 * );
 * ```
 */
export function createExaRequestHandler<TRequest, TResponse>(
  toolName: string,
  endpoint: string
) {
  return async (
    requestData: TRequest,
    formatResponse: (response: TResponse) => string
  ): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> => {
    const requestId = generateRequestId();
    const logger = createRequestLogger(requestId, toolName);
    
    logger.start(JSON.stringify(requestData));
    
    try {
      const client = createExaClient();
      const response = await client.post<TResponse>(endpoint, requestData);
      
      logger.log("Request completed successfully");
      
      return {
        content: [{
          type: "text",
          text: formatResponse(response.data)
        }]
      };
    } catch (error) {
      return handleExaError(error, toolName, logger);
    }
  };
}

/**
 * Returns a module-level singleton Axios client configured for the Exa API.
 * Avoids rebuilding the client (including retry config) on every tool call.
 * Call resetSharedExaClient() in tests to get a fresh instance.
 */
export function getSharedExaClient(): AxiosInstance {
  if (!_sharedClient) {
    _sharedClient = createExaClient();
  }
  return _sharedClient;
}

/**
 * Resets the shared client singleton. Intended for use in tests only.
 */
export function resetSharedExaClient(): void {
  _sharedClient = null;
}
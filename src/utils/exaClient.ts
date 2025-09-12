import axios, { AxiosInstance, AxiosError } from "axios";
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

  // Configure retry with exponential backoff
  axiosRetry(client, {
    retries: config.exa.retries,
    retryDelay: (retryCount) => {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * 500; // Add up to 500ms jitter
      return delay + jitter;
    },
    retryCondition: (error) => {
      // Retry on network errors or 5xx status codes
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
             (error.response?.status !== undefined && error.response.status >= 500);
    },
    onRetry: (retryCount, error, requestConfig) => {
      logWarn(`Retrying request (attempt ${retryCount}/3): ${error.message}`);
    }
  });

  return client;
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
import axios, { AxiosInstance, AxiosError } from "axios";
import { API_CONFIG } from "../tools/config.js";
import { createRequestLogger } from "./logger.js";
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
  const apiKey = process.env.EXA_API_KEY;
  
  if (!apiKey) {
    throw new Error('EXA_API_KEY environment variable is not set');
  }

  return axios.create({
    baseURL: API_CONFIG.BASE_URL,
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    timeout: 25000
  });
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
    const requestId = `${toolName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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
import { z } from "zod";
import { ToolRegistry } from "./config.js";
import { ExaCrawlRequest, ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";
import { createRequestLogger, generateRequestId } from "../utils/pinoLogger.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { getGlobalCache } from "../utils/cache.js";
import { getConfig } from "../config/index.js";

/**
 * Tool configuration types for different API endpoints
 */
type ToolConfig<T extends z.ZodObject<any>, TRequest, TResponse> = {
  name: string;
  description: string;
  schema: T;
  enabled: boolean;
  endpoint: string;
  createRequest: (args: z.infer<T>) => TRequest;
  formatResponse: (data: TResponse, toolName: string) => string;
  getStartContext: (args: z.infer<T>) => string;
};

/**
 * Type helper to check if a response has results array
 */
type ResponseWithResults = {
  results: unknown[];
};

/**
 * Type guard to check if response data has results array
 */
function hasResults(data: unknown): data is ResponseWithResults {
  return data !== null && 
         typeof data === 'object' && 
         'results' in data && 
         Array.isArray((data as ResponseWithResults).results);
}

/**
 * Unified tool creator that handles all tool types with proper type inference
 * Provides strong typing during tool creation while maintaining compatibility with ToolRegistry
 * 
 * @template T - Zod schema type
 * @template TRequest - API request type
 * @template TResponse - API response type
 * @param config Tool configuration object
 * @returns ToolRegistry instance compatible with MCP server
 */
export function createTool<
  T extends z.ZodObject<any>,
  TRequest,
  TResponse
>(
  config: ToolConfig<T, TRequest, TResponse>
): ToolRegistry {
  return {
    name: config.name,
    description: config.description,
    schema: config.schema,
    enabled: config.enabled,
    handler: async (args, extra) => {
      const requestId = generateRequestId();
      const logger = createRequestLogger(requestId, config.name);

      // Validate arguments with strict parsing - this provides runtime type safety
      const validationResult = config.schema.safeParse(args);
      
      if (!validationResult.success) {
        logger.error(`Validation failed: ${JSON.stringify(validationResult.error.issues)}`);
        return {
          content: [{
            type: "text" as const,
            text: `Invalid arguments for ${config.name}: ${validationResult.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
          }],
          isError: true
        };
      }

      // After validation, we know args conform to z.infer<T>
      const validatedArgs = validationResult.data as z.infer<T>;
      logger.start(config.getStartContext(validatedArgs));

      try {
        // Get cache instance using lazy initialization
        const cache = getGlobalCache();
        
        // Check cache first
        const cachedResponse = cache.get<TResponse>(config.endpoint, config.createRequest(validatedArgs));
        if (cachedResponse) {
          logger.log(`Cache hit for ${config.name}`);
          const formattedResponse = config.formatResponse(cachedResponse, config.name);
          const result = {
            content: [{
              type: "text" as const,
              text: formattedResponse
            }]
          };
          logger.complete();
          return result;
        }

        const client = createExaClient();
        const request = config.createRequest(validatedArgs);

        logger.log(`Sending request to Exa API for ${config.name}`);

        const response = await client.post<TResponse>(
          config.endpoint,
          request
        );

        // Cache the response data
        cache.set(config.endpoint, request, response.data);

        logger.log(`Received response from Exa API for ${config.name}`);

        // Handle empty responses based on response type
        if (!response.data) {
          logger.log(`Warning: Empty response from Exa API for ${config.name}`);
          return {
            content: [{
              type: "text" as const,
              text: `No results found for ${config.name}. Please try a different query.`
            }]
          };
        }

        // Check for results array (search responses) - use proper type guard
        if (hasResults(response.data)) {
          if (response.data.results.length === 0) {
            logger.log(`Warning: No results found for ${config.name}`);
            return {
              content: [{
                type: "text" as const,
                text: `No results found for ${config.name}. Please try a different query.`
              }]
            };
          }
          logger.log(`Found ${response.data.results.length} results for ${config.name}`);
        }

        const formattedResponse = config.formatResponse(response.data, config.name);
        const result = {
          content: [{
            type: "text" as const,
            text: formattedResponse
          }]
        };

        logger.complete();
        return result;
      } catch (error) {
        return handleExaError(error, config.name, logger);
      }
    },
  };
}

/**
 * Helper function to extract query from validated args safely
 */
function getQueryFromArgs<T extends Record<string, any>>(args: T): string {
  return 'query' in args && typeof args.query === 'string' ? args.query : 'search request';
}

/**
 * Helper function to extract URL from validated args safely
 */
function getUrlFromArgs<T extends Record<string, any>>(args: T): string {
  return 'url' in args && typeof args.url === 'string' ? args.url : 'crawl request';
}

/**
 * Helper function to create search-based tools (web search, research papers, etc.)
 * Provides full type safety during tool creation
 */
export function createSearchTool<T extends z.ZodObject<any>>(
  name: string,
  description: string,
  schema: T,
  enabled: boolean,
  createRequest: (args: z.infer<T>) => ExaSearchRequest,
  formatResponse?: (data: ExaSearchResponse, toolName: string) => string
): ToolRegistry {
  return createTool({
    name,
    description,
    schema,
    enabled,
    endpoint: '/search', // Using the API endpoint directly
    createRequest,
    formatResponse: formatResponse || ((data: ExaSearchResponse, toolName: string) => ResponseFormatter.formatSearchResponse(data, toolName)),
    getStartContext: (args) => getQueryFromArgs(args)
  });
}

/**
 * Helper function to create crawl-based tools (URL content extraction)
 * Provides full type safety during tool creation
 */
export function createCrawlTool<T extends z.ZodObject<any>>(
  name: string,
  description: string,
  schema: T,
  enabled: boolean,
  createRequest: (args: z.infer<T>) => ExaCrawlRequest
): ToolRegistry {
  return createTool({
    name,
    description,
    schema,
    enabled,
    endpoint: '/contents', // Using the API endpoint directly
    createRequest,
    formatResponse: (data: ExaSearchResponse) => ResponseFormatter.formatCrawlResponse(data.results),
    getStartContext: (args) => getUrlFromArgs(args)
  });
}

/**
 * Helper function to create competitor finder tools
 * Provides full type safety during tool creation
 */
export function createCompetitorFinderTool<T extends z.ZodObject<any>>(
  name: string,
  description: string,
  schema: T,
  enabled: boolean,
  createRequest: (args: z.infer<T>) => ExaSearchRequest
): ToolRegistry {
  return createTool({
    name,
    description,
    schema,
    enabled,
    endpoint: '/search', // Using the API endpoint directly
    createRequest,
    formatResponse: (data: ExaSearchResponse) => ResponseFormatter.formatCompetitorResponse(data.results),
    getStartContext: (args) => getQueryFromArgs(args)
  });
}

import { z } from "zod";
import { API_CONFIG, ToolRegistry } from "./config.js";
import { ExaCrawlRequest, ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";
import { createRequestLogger } from "../utils/logger.js";
import { ResponseFormatter } from "../utils/formatter.js";

interface CreateToolParams {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  enabled: boolean;
  createRequest: (args: Record<string, any>) => ExaSearchRequest;
}

interface CreateCrawlToolParams {
    name: string;
    description: string;
    schema: z.ZodRawShape;
    enabled: boolean;
    createRequest: (args: Record<string, any>) => ExaCrawlRequest;
}

export function createSearchTool({
  name,
  description,
  schema,
  enabled,
  createRequest,
}: CreateToolParams): ToolRegistry {
  return {
    name,
    description,
    schema,
    enabled,
    handler: async (args, extra) => {
      const requestId = `${name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, name);

      // Validate arguments against schema
      const validationSchema = z.object(schema);
      const validationResult = validationSchema.safeParse(args);
      
      if (!validationResult.success) {
        logger.error(`Validation failed: ${validationResult.error.message}`);
        return {
          content: [{
            type: "text" as const,
            text: `Invalid arguments for ${name}: ${validationResult.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
          }],
          isError: true
        };
      }

      const validatedArgs = validationResult.data;
      logger.start(validatedArgs.query as string);

      try {
        const client = createExaClient();
        const searchRequest = createRequest(validatedArgs);

        logger.log(`Sending request to Exa API for ${name}`);

        const response = await client.post<ExaSearchResponse>(
          API_CONFIG.ENDPOINTS.SEARCH,
          searchRequest
        );

        logger.log(`Received response from Exa API for ${name}`);

        if (!response.data || !response.data.results) {
          logger.log(`Warning: Empty or invalid response from Exa API for ${name}`);
          return {
            content: [{
              type: "text" as const,
              text: `No results found for ${name}. Please try a different query.`
            }]
          };
        }

        logger.log(`Found ${response.data.results.length} results for ${name}`);

        const formattedResponse = ResponseFormatter.formatSearchResponse(response.data, name);
        const result = {
          content: [{
            type: "text" as const,
            text: formattedResponse
          }]
        };

        logger.complete();
        return result;
      } catch (error) {
        return handleExaError(error, name, logger);
      }
    },
  };
}

export function createCrawlTool({
    name,
    description,
    schema,
    enabled,
    createRequest,
    }: CreateCrawlToolParams): ToolRegistry {
    return {
        name,
        description,
        schema,
        enabled,
        handler: async (args, extra) => {
            const requestId = `${name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const logger = createRequestLogger(requestId, name);

            // Validate arguments against schema
            const validationSchema = z.object(schema);
            const validationResult = validationSchema.safeParse(args);
            
            if (!validationResult.success) {
                logger.error(`Validation failed: ${validationResult.error.message}`);
                return {
                    content: [{
                        type: "text" as const,
                        text: `Invalid arguments for ${name}: ${validationResult.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
                    }],
                    isError: true
                };
            }

            const validatedArgs = validationResult.data;
            logger.start(validatedArgs.url as string);

            try {
                const client = createExaClient();
                const crawlRequest = createRequest(validatedArgs);

                logger.log(`Sending request to Exa API for ${name}`);

                const response = await client.post(
                    API_CONFIG.ENDPOINTS.CONTENTS,
                    crawlRequest
                );

                logger.log(`Received response from Exa API for ${name}`);

                if (!response.data || !response.data.results || response.data.results.length === 0) {
                    logger.log(`Warning: Empty or invalid response from Exa API for ${name}`);
                    return {
                        content: [{
                            type: "text" as const,
                            text: `No results found for ${name}. Please try a different query.`
                        }]
                    };
                }

                logger.log(`Found ${response.data.results.length} results for ${name}`);

                const formattedResponse = ResponseFormatter.formatCrawlResponse(response.data.results);
                const result = {
                    content: [{
                        type: "text" as const,
                        text: formattedResponse
                    }]
                };

                logger.complete();
                return result;
            } catch (error) {
                return handleExaError(error, name, logger);
            }
        },
    };
}

interface CreateCompetitorFinderToolParams {
    name: string;
    description: string;
    schema: z.ZodRawShape;
    enabled: boolean;
    createRequest: (args: Record<string, any>) => ExaSearchRequest;
}

export function createCompetitorFinderTool({
    name,
    description,
    schema,
    enabled,
    createRequest,
    }: CreateCompetitorFinderToolParams): ToolRegistry {
    return {
        name,
        description,
        schema,
        enabled,
        handler: async (args, extra) => {
            const requestId = `${name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const logger = createRequestLogger(requestId, name);

            // Validate arguments against schema
            const validationSchema = z.object(schema);
            const validationResult = validationSchema.safeParse(args);
            
            if (!validationResult.success) {
                logger.error(`Validation failed: ${validationResult.error.message}`);
                return {
                    content: [{
                        type: "text" as const,
                        text: `Invalid arguments for ${name}: ${validationResult.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
                    }],
                    isError: true
                };
            }

            const validatedArgs = validationResult.data;
            logger.start(validatedArgs.query as string);

            try {
                const client = createExaClient();
                const searchRequest = createRequest(validatedArgs);

                logger.log(`Sending request to Exa API for ${name}`);

                const response = await client.post<ExaSearchResponse>(
                    API_CONFIG.ENDPOINTS.SEARCH,
                    searchRequest
                );

                logger.log(`Received response from Exa API for ${name}`);

                if (!response.data || !response.data.results) {
                    logger.log(`Warning: Empty or invalid response from Exa API for ${name}`);
                    return {
                        content: [{
                            type: "text" as const,
                            text: `No results found for ${name}. Please try a different query.`
                        }]
                    };
                }

                logger.log(`Found ${response.data.results.length} results for ${name}`);

                const formattedResponse = ResponseFormatter.formatCompetitorResponse(response.data.results);
                const result = {
                    content: [{
                        type: "text" as const,
                        text: formattedResponse
                    }]
                };

                logger.complete();
                return result;
            } catch (error) {
                return handleExaError(error, name, logger);
            }
        },
    };
}

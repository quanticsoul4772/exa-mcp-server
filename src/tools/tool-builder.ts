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

      logger.start(args.query as string);

      try {
        const client = createExaClient();
        const searchRequest = createRequest(args);

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

            logger.start(args.url as string);

            try {
                const client = createExaClient();
                const crawlRequest = createRequest(args);

                logger.log(`Sending request to Exa API for ${name}`);

                const response = await client.post(
                    '/contents',
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

            logger.start(args.query as string);

            try {
                const client = createExaClient();
                const searchRequest = createRequest(args);

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

import { z } from "zod";
import { toolRegistry, API_CONFIG } from "./config.js";
import { ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";
import { createRequestLogger } from "../utils/logger.js";
import { ResponseFormatter } from "../utils/formatter.js";

// Register the exa search tool with renamed identifier to avoid conflict with Claude's built-in web_search
toolRegistry["exa_search"] = {
  name: "exa_search",
  description: "Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs. Supports configurable result counts and returns the content from the most relevant websites.",
  schema: {
    query: z.string().describe("Search query"),
    numResults: z.coerce.number().optional().describe("Number of search results to return (default: 5)")
  },
  handler: async ({ query, numResults }, extra) => {
    const requestId = `exa_search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'exa_search');
    
    logger.start(query);
    
    try {
      const client = createExaClient();

      const searchRequest: ExaSearchRequest = {
        query,
        type: "auto",
        numResults: numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
        contents: {
          text: {
            maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS
          },
          livecrawl: 'always'
        }
      };
      
      logger.log("Sending request to Exa API");
      
      const response = await client.post<ExaSearchResponse>(
        API_CONFIG.ENDPOINTS.SEARCH,
        searchRequest
      );
      
      logger.log("Received response from Exa API");

      if (!response.data || !response.data.results) {
        logger.log("Warning: Empty or invalid response from Exa API");
        return {
          content: [{
            type: "text" as const,
            text: "No search results found. Please try a different query."
          }]
        };
      }

      logger.log(`Found ${response.data.results.length} results`);
      
      const formattedResponse = ResponseFormatter.formatSearchResponse(response.data, 'exa_search');
      const result = {
        content: [{
          type: "text" as const,
          text: formattedResponse
        }]
      };
      
      logger.complete();
      return result;
    } catch (error) {
      return handleExaError(error, 'exa_search', logger);
    }
  },
  enabled: true  // Enabled by default
};
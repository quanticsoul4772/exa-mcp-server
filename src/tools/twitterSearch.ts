import { z } from "zod";
import { toolRegistry, API_CONFIG } from "./config.js";
import { ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";
import { createRequestLogger } from "../utils/logger.js";
import { ResponseFormatter } from "../utils/formatter.js";

// Register the Twitter search tool
toolRegistry["twitter_search"] = {
  name: "twitter_search",
  description: "Search Twitter/X.com posts and accounts using Exa AI - performs targeted searches of Twitter (X.com) content including tweets, profiles, and discussions. Returns relevant tweets, profile information, and conversation threads based on your query. You can search for a user by x.com/username or from:username",
  schema: {
    query: z.string().describe("Twitter username, hashtag, or search term (e.g., 'x.com/username' or search term)"),
    numResults: z.coerce.number().optional().describe("Number of Twitter results to return (default: 5)"),
    startPublishedDate: z.string().optional().describe("Optional ISO date string (e.g., '2023-04-01T00:00:00.000Z') to filter tweets published after this date. Use only when necessary."),
    endPublishedDate: z.string().optional().describe("Optional ISO date string (e.g., '2023-04-30T23:59:59.999Z') to filter tweets published before this date. Use only when necessary.")
  },
  handler: async ({ query, numResults, startPublishedDate, endPublishedDate }, extra) => {
    const requestId = `twitter_search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'twitter_search');
    
    logger.start(query);
    
    try {
      const client = createExaClient();

      const searchRequest: ExaSearchRequest = {
        query,
        includeDomains: ["x.com", "twitter.com"],
        type: "auto",
        numResults: numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
        contents: {
          text: {
            maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS
          },
          livecrawl: 'always'
        }
      };
      
      // Add date filters only if they're provided
      if (startPublishedDate) {
        searchRequest.startPublishedDate = startPublishedDate;
        logger.log(`Filtering tweets after: ${startPublishedDate}`);
      }
      
      if (endPublishedDate) {
        searchRequest.endPublishedDate = endPublishedDate;
        logger.log(`Filtering tweets before: ${endPublishedDate}`);
      }
      
      logger.log("Sending Twitter search request to Exa API");
      
      const response = await client.post<ExaSearchResponse>(
        API_CONFIG.ENDPOINTS.SEARCH,
        searchRequest
      );
      
      logger.log("Received Twitter search response from Exa API");

      if (!response.data || !response.data.results) {
        logger.log("Warning: Empty or invalid response from Exa API for Twitter search");
        return {
          content: [{
            type: "text" as const,
            text: "No Twitter results found. Please try a different query."
          }]
        };
      }

      logger.log(`Found ${response.data.results.length} Twitter results`);
      
      const formattedResponse = ResponseFormatter.formatSearchResponse(response.data, 'twitter_search');
      const result = {
        content: [{
          type: "text" as const,
          text: formattedResponse
        }]
      };
      
      logger.complete();
      return result;
    } catch (error) {
      return handleExaError(error, 'twitter_search', logger);
    }
  },
  enabled: false  // disabled by default
}; 
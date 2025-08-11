import { z } from "zod";
import { toolRegistry, API_CONFIG } from "./config.js";
import { ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";

// Register the competitor finder tool
toolRegistry["competitor_finder"] = {
  name: "competitor_finder",
  description: "Find competitors of a company using Exa AI - performs targeted searches to identify businesses that offer similar products or services. Describe what the company does (without mentioning its name) and optionally provide the company's website to exclude it from results.",
  schema: {
    query: z.string().describe("Describe what the company/product in a few words (e.g., 'web search API', 'AI image generation', 'cloud storage service'). Keep it simple. Do not include the company name."),
    excludeDomain: z.string().optional().describe("Optional: The company's website to exclude from results (e.g., 'exa.ai')"),
    numResults: z.coerce.number().optional().describe("Number of competitors to return (default: 10)")
  },
  handler: async ({ query, excludeDomain, numResults }, extra) => {
    const requestId = `competitor_finder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'competitor_finder');
    
    logger.start(query);
    
    try {
      const client = createExaClient();

      const searchRequest: ExaSearchRequest = {
        query,
        type: "auto",
        numResults: numResults || 10,
        contents: {
          text: {
            maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS
          },
          livecrawl: 'always'
        }
      };
      
      // Add exclude domain if provided
      if (excludeDomain) {
        searchRequest.excludeDomains = [excludeDomain];
        logger.log(`Excluding domain: ${excludeDomain}`);
      }
      
      logger.log(`Finding competitors for: ${query}`);
      logger.log("Sending competitor finder request to Exa API");
      
      const response = await client.post<ExaSearchResponse>(
        API_CONFIG.ENDPOINTS.SEARCH,
        searchRequest
      );
      
      logger.log("Received competitor finder response from Exa API");

      if (!response.data || !response.data.results) {
        logger.log("Warning: Empty or invalid response from Exa API for competitor finder");
        return {
          content: [{
            type: "text" as const,
            text: "No competitors found. Please try a different query."
          }]
        };
      }

      logger.log(`Found ${response.data.results.length} potential competitors`);
      
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
      return handleExaError(error, 'competitor_finder', logger);
    }
  },
  enabled: false  // Disabled by default
}; 
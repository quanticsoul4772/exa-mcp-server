import { z } from "zod";
import { toolRegistry, API_CONFIG } from "./config.js";
import { ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";
import { createRequestLogger } from "../utils/logger.js";
import { ResponseFormatter } from "../utils/formatter.js";

// Register the research paper search tool
toolRegistry["research_paper_search"] = {
  name: "research_paper_search",
  description: "Search across 100M+ research papers with full text access using Exa AI - performs targeted academic paper searches with deep research content coverage. Returns detailed information about relevant academic papers including titles, authors, publication dates, and full text excerpts. Control the number of results and character counts returned to balance comprehensiveness with conciseness based on your task requirements.",
  schema: {
    query: z.string().describe("Research topic or keyword to search for"),
    numResults: z.coerce.number().optional().describe("Number of research papers to return (default: 5)"),
    maxCharacters: z.coerce.number().optional().describe("Maximum number of characters to return for each result's text content (Default: 3000)")
  },
  handler: async ({ query, numResults, maxCharacters }, extra) => {
    const requestId = `research_paper-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'research_paper_search');
    
    logger.start(query);
    
    try {
      const client = createExaClient();

      const searchRequest: ExaSearchRequest = {
        query,
        category: "research paper",
        type: "auto",
        numResults: numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
        contents: {
          text: {
            maxCharacters: maxCharacters || API_CONFIG.DEFAULT_MAX_CHARACTERS
          },
          livecrawl: 'fallback'
        }
      };
      
      logger.log("Sending research paper request to Exa API");
      
      const response = await client.post<ExaSearchResponse>(
        API_CONFIG.ENDPOINTS.SEARCH,
        searchRequest
      );
      
      logger.log("Received research paper response from Exa API");

      if (!response.data || !response.data.results) {
        logger.log("Warning: Empty or invalid response from Exa API for research papers");
        return {
          content: [{
            type: "text" as const,
            text: "No research papers found. Please try a different query."
          }]
        };
      }

      logger.log(`Found ${response.data.results.length} research papers`);
      
      const formattedResponse = ResponseFormatter.formatSearchResponse(response.data, 'research_paper_search');
      const result = {
        content: [{
          type: "text" as const,
          text: formattedResponse
        }]
      };
      
      logger.complete();
      return result;
    } catch (error) {
      return handleExaError(error, 'research_paper_search', logger);
    }
  },
  enabled: false  // disabled by default
}; 
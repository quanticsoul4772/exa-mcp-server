import { z } from "zod";
import { toolRegistry, API_CONFIG } from "./config.js";
import { ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";

// Register the company research tool
toolRegistry["company_research"] = {
  name: "company_research",
  description: "Research companies using Exa AI - performs targeted searches of company websites to gather comprehensive information about businesses. Returns detailed information from company websites including about pages, pricing, FAQs, blogs, and other relevant content. Specify the company URL and optionally target specific sections of their website.",
  schema: {
    query: z.string().describe("Company website URL (e.g., 'exa.ai' or 'https://exa.ai')"),
    subpages: z.coerce.number().optional().describe("Number of subpages to crawl (default: 10)"),
    subpageTarget: z.array(z.string()).optional().describe("Specific sections to target (e.g., ['about', 'pricing', 'faq', 'blog']). If not provided, will crawl the most relevant pages.")
  },
  handler: async ({ query, subpages, subpageTarget }, extra) => {
    const requestId = `company_research-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'company_research');
    
    logger.start(query);
    
    try {
      const client = createExaClient();

      // Extract domain from query if it's a URL
      let domain = query;
      if (query.includes('http')) {
        try {
          const url = new URL(query);
          domain = url.hostname.replace('www.', '');
        } catch (e) {
          logger.log(`Warning: Could not parse URL from query: ${query}`);
        }
      }

      const searchRequest: ExaSearchRequest = {
        query,
        category: "company",
        includeDomains: [query],
        type: "auto",
        numResults: 1,
        contents: {
          text: {
            maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS
          },
          livecrawl: 'always',
          subpages: subpages || 10,
        }
      };
      
      // Add subpage targets if provided
      if (subpageTarget && subpageTarget.length > 0) {
        searchRequest.contents.subpageTarget = subpageTarget;
        logger.log(`Targeting specific sections: ${subpageTarget.join(', ')}`);
      }
      
      logger.log(`Researching company: ${domain}`);
      logger.log("Sending company research request to Exa API");
      
      const response = await client.post<ExaSearchResponse>(
        API_CONFIG.ENDPOINTS.SEARCH,
        searchRequest
      );
      
      logger.log("Received company research response from Exa API");

      if (!response.data || !response.data.results) {
        logger.log("Warning: Empty or invalid response from Exa API for company research");
        return {
          content: [{
            type: "text" as const,
            text: "No company information found. Please try a different query."
          }]
        };
      }

      logger.log(`Found ${response.data.results.length} results about the company`);
      
      const formattedResponse = ResponseFormatter.formatSearchResponse(response.data, 'company_research');
      const result = {
        content: [{
          type: "text" as const,
          text: formattedResponse
        }]
      };
      
      logger.complete();
      return result;
    } catch (error) {
      return handleExaError(error, 'company_research', logger);
    }
  },
  enabled: false  // Disabled by default
}; 
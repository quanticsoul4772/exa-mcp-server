import { z } from "zod";
import { toolRegistry, API_CONFIG } from "./config.js";
import { ExaCrawlRequest } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";

// Register the crawling tool
toolRegistry["crawling"] = {
  name: "crawling",
  description: "Extract content from specific URLs using Exa AI - performs targeted crawling of web pages to retrieve their full content. Useful for reading articles, PDFs, or any web page when you have the exact URL. Returns the complete text content of the specified URL.",
  schema: {
    url: z.string().url().describe("The URL to crawl (e.g., 'https://exa.ai')")
  },
  handler: async ({ url }, extra) => {
    const requestId = `crawling-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'crawling');
    
    logger.start(url);
    
    try {
      const client = createExaClient();

      const crawlRequest: ExaCrawlRequest = {
        ids: [url],
        text: true,
        livecrawl: 'always'
      };
      
      logger.log(`Crawling URL: ${url}`);
      logger.log("Sending crawling request to Exa API");
      
      const response = await client.post(
        '/contents',
        crawlRequest
      );
      
      logger.log("Received crawling response from Exa API");

      if (!response.data || !response.data.results || response.data.results.length === 0) {
        logger.log("Warning: Empty or invalid response from Exa API for crawling");
        return {
          content: [{
            type: "text" as const,
            text: "No content found at the specified URL. Please check the URL and try again."
          }]
        };
      }

      logger.log(`Successfully crawled content from URL`);
      
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
      return handleExaError(error, 'crawling', logger);
    }
  },
  enabled: false  // Disabled by default
}; 
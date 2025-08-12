import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { API_CONFIG } from "./config.js";

export const webSearchTool = createSearchTool({
  name: "exa_search",
  description: "Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs. Supports configurable result counts and returns the content from the most relevant websites.",
  schema: {
    query: z.string().describe("Search query"),
    numResults: z.coerce.number().optional().describe("Number of search results to return (default: 5)")
  },
  enabled: true,
  createRequest: ({ query, numResults }) => ({
    query,
    type: "auto",
    numResults: numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
    contents: {
      text: {
        maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS
      },
      livecrawl: 'always' as const
    }
  })
});
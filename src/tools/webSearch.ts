import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { API_CONFIG } from "./config.js";

const webSearchSchema = z.object({
  query: z.string().describe("Search query"),
  numResults: z.coerce.number().optional().describe("Number of search results to return (default: 5)")
});

export const webSearchTool = createSearchTool(
  "exa_search",
  "Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs. Supports configurable result counts and returns the content from the most relevant websites.",
  webSearchSchema,
  true,
  ({ query, numResults }) => ({
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
);
import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { getConfig } from "../config/index.js";

const webSearchSchema = z.object({
  query: z.string().describe("Search query"),
  numResults: z.coerce.number().optional().describe("Number of search results to return (default: 5)")
});

export const webSearchTool = createSearchTool(
  "exa_search",
  "Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs. Supports configurable result counts and returns the content from the most relevant websites.",
  webSearchSchema,
  true,
  ({ query, numResults }) => {
    const config = getConfig();
    return {
      query,
      type: "auto",
      numResults: numResults || config.tools.defaultNumResults,
      contents: {
        text: {
          maxCharacters: config.tools.defaultMaxCharacters
        },
        livecrawl: 'always' as const
      }
    };
  }
);
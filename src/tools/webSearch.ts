import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { getConfig } from "../config/index.js";

const webSearchSchema = z.object({
  query: z.string().describe("Search query"),
  numResults: z.coerce.number().optional().describe("Number of search results to return (default: 5)"),
  searchType: z.enum(['auto', 'instant', 'fast', 'neural', 'deep', 'deep-reasoning']).optional()
    .describe("Search type: 'instant' (~200ms), 'fast' (~450ms), 'auto' (default ~1s), 'neural' (embeddings), 'deep' (~5-60s complex queries), 'deep-reasoning'"),
  maxAgeHours: z.coerce.number().optional()
    .describe("Content freshness: 0 = force fresh crawl, -1 = cached only, positive number = max age in hours"),
  includeDomains: z.array(z.string()).optional()
    .describe("Only return results from these domains (max 1200)"),
  excludeDomains: z.array(z.string()).optional()
    .describe("Exclude results from these domains (max 1200)"),
  startPublishedDate: z.string().optional()
    .describe("Filter results published after this date (ISO 8601)"),
  endPublishedDate: z.string().optional()
    .describe("Filter results published before this date (ISO 8601)"),
  category: z.enum(['company', 'research paper', 'news', 'personal site', 'financial report', 'people']).optional()
    .describe("Filter by content category"),
  includeText: z.string().optional()
    .describe("Require this phrase in results (max 5 words)"),
  excludeText: z.string().optional()
    .describe("Exclude results containing this phrase"),
  userLocation: z.string().optional()
    .describe("Filter by region (ISO country code, e.g. 'US')"),
  includeSummary: z.boolean().optional()
    .describe("Include LLM-generated summary for each result"),
  includeHighlights: z.boolean().optional()
    .describe("Include key excerpts from each result"),
  includeExtras: z.boolean().optional()
    .describe("Include embedded links and image URLs from results"),
  outputSchema: z.record(z.any()).optional()
    .describe("JSON Schema for structured output (deep search only)")
});

export const webSearchTool = createSearchTool(
  "exa_search",
  "Search the web using Exa AI - performs real-time web searches with configurable search types (instant/fast/auto/deep). Supports domain filtering, date ranges, content categories, freshness control, structured outputs, and returns content from the most relevant websites.",
  webSearchSchema,
  true,
  ({ query, numResults, searchType, maxAgeHours, includeDomains, excludeDomains,
     startPublishedDate, endPublishedDate, category, includeText, excludeText,
     userLocation, includeSummary, includeHighlights, includeExtras, outputSchema }) => {
    const config = getConfig();
    return {
      query,
      type: searchType || "auto",
      numResults: numResults || config.tools.defaultNumResults,
      ...(category && { category }),
      ...(includeDomains && { includeDomains }),
      ...(excludeDomains && { excludeDomains }),
      ...(startPublishedDate && { startPublishedDate }),
      ...(endPublishedDate && { endPublishedDate }),
      ...(includeText && { includeText }),
      ...(excludeText && { excludeText }),
      ...(userLocation && { userLocation }),
      ...(outputSchema && { outputSchema }),
      contents: {
        text: {
          maxCharacters: config.tools.defaultMaxCharacters
        },
        ...(maxAgeHours !== undefined ? { maxAgeHours } : { livecrawl: 'always' as const }),
        ...(includeSummary && { summary: true }),
        ...(includeHighlights && { highlights: { maxCharacters: 500 } }),
        ...(includeExtras && { extras: { links: true, imageUrls: true } })
      }
    };
  }
);

import { z } from "zod";
import { createTool } from "./tool-builder.js";
import { ExaContentsOptions, ExaSearchResponse } from "../types.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { DEFAULT_EXTRAS, freshness, freshnessFields, highlightsOption, summaryOption } from "./shared.js";

interface ExaFindSimilarRequest {
  url: string;
  numResults: number;
  excludeSourceDomain: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  contents: ExaContentsOptions;
}

const findSimilarSchema = z.object({
  url: z.string().url().describe("URL to find similar pages for"),
  numResults: z.coerce.number().int().min(1).max(100).optional().default(10),
  excludeSourceDomain: z.boolean().optional().default(true),
  includeDomains: z.array(z.string()).optional().describe("Only return results from these domains"),
  excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains"),
  startPublishedDate: z.string().optional().describe("ISO date string"),
  endPublishedDate: z.string().optional().describe("ISO date string"),
  includeText: z.boolean().optional().default(false),
  textMaxCharacters: z.coerce.number().int().min(1).max(1000000).optional().default(1000),
  includeHighlights: z.boolean().optional().default(true),
  highlightsQuery: z.string().optional()
    .describe("Pick highlights relevant to this query"),
  includeSummary: z.boolean().optional().default(false).describe("Include LLM-generated summary"),
  summarySchema: z.record(z.any()).optional()
    .describe("JSON Schema for a structured summary per result (implies includeSummary)"),
  summaryQuery: z.string().optional()
    .describe("Guide each summary with this question (implies includeSummary)"),
  ...freshnessFields,
  includeExtras: z.boolean().optional().default(false).describe("Include embedded links and image links")
});

export const findSimilarTool = createTool({
  name: "find_similar",
  title: "Find Similar Pages (Exa)",
  description: "Find pages similar to a reference URL. Use when you have an example page and want more like it. Requires a URL, not a query. Note: Exa marks /findSimilar deprecated; exa_search with a query describing the page is the long-term replacement.",
  schema: findSimilarSchema,
  enabled: true,
  endpoint: '/findSimilar',
  createRequest: (args): ExaFindSimilarRequest => {
    const summary = summaryOption(args.includeSummary, args.summaryQuery, args.summarySchema);
    const highlights = highlightsOption(args.includeHighlights, args.highlightsQuery);
    return {
      url: args.url,
      numResults: args.numResults,
      excludeSourceDomain: args.excludeSourceDomain,
      ...(args.includeDomains && { includeDomains: args.includeDomains }),
      ...(args.excludeDomains && { excludeDomains: args.excludeDomains }),
      ...(args.startPublishedDate && { startPublishedDate: args.startPublishedDate }),
      ...(args.endPublishedDate && { endPublishedDate: args.endPublishedDate }),
      // Content options must be nested under contents; top-level text/highlights are ignored
      contents: {
        ...(args.includeText && { text: { maxCharacters: args.textMaxCharacters } }),
        ...(highlights && { highlights }),
        ...(summary && { summary }),
        ...(args.includeExtras && { extras: DEFAULT_EXTRAS }),
        ...freshness(args)
      }
    };
  },
  formatResponse: (data: ExaSearchResponse) => ResponseFormatter.formatSearchResponse(data, 'find_similar'),
  getStartContext: (args) => `Finding similar to: ${args.url}`,
  progressSteps: [
    "Extracting page features...",
    "Finding similar pages...",
    "Ranking similar pages...",
    "Fetching page details..."
  ]
});

import { z } from "zod";
import { createTool } from "./tool-builder.js";
import { ExaCrawlRequest, ExaCrawlResponse } from "../types.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { DEFAULT_EXTRAS, SECTIONS, freshness, freshnessFields, highlightsOption, summaryOption } from "./shared.js";

/** Default per-URL text limit when the caller does not set one */
export const DEFAULT_TEXT_PER_URL = 10000;
/** Default total text across all URLs when the caller does not set a per-URL limit */
export const DEFAULT_TEXT_TOTAL = 100000;

/**
 * Per-URL text limit: the caller's value, else 10000 shrunk so the total
 * across all URLs stays within 100000 characters
 */
export function textLimitPerUrl(urlCount: number, requested?: number): number {
  if (requested !== undefined) return requested;
  return Math.min(DEFAULT_TEXT_PER_URL, Math.floor(DEFAULT_TEXT_TOTAL / Math.max(1, urlCount)));
}

const webFetchSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(100).describe("URLs to read (1-100)"),
  includeText: z.boolean().optional().default(true)
    .describe("Return page text (default true)"),
  textMaxCharacters: z.coerce.number().int().min(1).max(1000000).optional()
    .describe("Max characters of text per URL. Default: 10000 per URL, reduced so all URLs together stay within 100000 characters"),
  textVerbosity: z.enum(['compact', 'standard', 'full']).optional()
    .describe("Text detail level (Exa default 'compact')"),
  includeHtmlTags: z.boolean().optional().default(false),
  includeSections: z.array(z.enum(SECTIONS)).optional()
    .describe("Only keep these page sections (best effort), e.g. ['body']"),
  excludeSections: z.array(z.enum(SECTIONS)).optional()
    .describe("Drop these page sections (best effort), e.g. ['navigation', 'footer']"),
  includeHighlights: z.boolean().optional().default(false),
  highlightsQuery: z.string().optional()
    .describe("Pick highlights relevant to this query (implies includeHighlights)"),
  includeSummary: z.boolean().optional().default(false)
    .describe("Include an LLM-generated summary per URL"),
  summaryQuery: z.string().optional()
    .describe("Guide each summary with this question (implies includeSummary)"),
  includeExtras: z.boolean().optional().default(false)
    .describe("Include embedded links and image links"),
  ...freshnessFields,
  snapshotAsOf: z.string().optional()
    .describe("Return the stored version as of this date (ISO 8601 or YYYY-MM-DD); never fetches live"),
  subpages: z.coerce.number().int().min(0).max(100).optional()
    .describe("Also crawl up to this many subpages per URL"),
  subpageTarget: z.array(z.string()).max(100).optional()
    .describe("Keywords to pick which subpages to crawl (e.g. ['about', 'pricing'])")
});

export const webFetchTool = createTool({
  name: "web_fetch",
  description: "Read the full content of one or more known URLs (articles, PDFs, any page), up to 100 per call. Use when you already have the URLs. Does NOT search — use exa_search to find URLs first. Reports per-URL failures.",
  schema: webFetchSchema,
  enabled: true,
  endpoint: '/contents',
  createRequest: (args): ExaCrawlRequest => {
    const summary = summaryOption(args.includeSummary, args.summaryQuery);
    const highlights = highlightsOption(args.includeHighlights, args.highlightsQuery);
    return {
      urls: args.urls,
      text: args.includeText ? {
        maxCharacters: textLimitPerUrl(args.urls.length, args.textMaxCharacters),
        includeHtmlTags: args.includeHtmlTags,
        ...(args.textVerbosity && { verbosity: args.textVerbosity }),
        ...(args.includeSections && { includeSections: args.includeSections }),
        ...(args.excludeSections && { excludeSections: args.excludeSections })
      } : false,
      ...(highlights && { highlights }),
      ...(summary && { summary }),
      ...(args.includeExtras && { extras: DEFAULT_EXTRAS }),
      ...freshness(args),
      ...(args.snapshotAsOf && { snapshotAsOf: args.snapshotAsOf }),
      ...(args.subpages && { subpages: args.subpages }),
      ...(args.subpageTarget && { subpageTarget: args.subpageTarget })
    };
  },
  formatResponse: (data: ExaCrawlResponse) => ResponseFormatter.formatContentsResponse(data),
  getStartContext: (args) => `Fetching ${args.urls.length} URL(s)`,
  progressSteps: [
    "Validating URLs...",
    "Fetching content...",
    "Processing content...",
    "Compiling results..."
  ]
});

import { z } from "zod";
import { createSearchTool, LONG_REQUEST_TIMEOUT_MS } from "./tool-builder.js";
import { rerankSearchResults } from "./rerank.js";
import { getConfig } from "../config/index.js";
import { ToolRegistry } from "./config.js";
import { DEFAULT_EXTRAS, LARGE_RESULT_CHARS, freshness, freshnessFields, highlightsOption, summaryOption } from "./shared.js";

/**
 * Candidates to fetch before reranking: the caller's number, else three
 * times the results wanted, capped at Exa's maximum of 100
 */
export function candidateCount(numResults: number, requested?: number): number {
  return Math.min(100, Math.max(numResults, requested ?? numResults * 3));
}

// numResults: min 1 (0 results is meaningless), max 100 (Exa API maximum)
const webSearchSchema = z.object({
  query: z.string().min(1).describe("Search query"),
  numResults: z.coerce.number().int().min(1).max(100).optional().describe("Number of search results to return (default: DEFAULT_NUM_RESULTS, 3)"),
  searchType: z.enum(['instant', 'fast', 'auto', 'deep-lite', 'deep', 'deep-reasoning']).optional()
    .describe("Search type: 'instant' (lowest latency), 'fast', 'auto' (default), 'deep-lite', 'deep' (multi-step, slower), 'deep-reasoning' (most thorough)"),
  category: z.enum(['company', 'publication', 'news', 'personal site', 'financial report', 'people']).optional()
    .describe("Filter by content category. 'publication' = research papers and academic sources. 'company' and 'people' do not allow date filters or excludeDomains."),
  includeDomains: z.array(z.string()).max(1200).optional()
    .describe("Only return results from these domains (e.g. ['x.com', 'twitter.com'] for posts on X; ['example.com'] for one company's site)"),
  excludeDomains: z.array(z.string()).max(1200).optional()
    .describe("Exclude results from these domains (e.g. a company's own domain when looking for its competitors)"),
  startPublishedDate: z.string().optional()
    .describe("Only results published after this date (ISO 8601)"),
  endPublishedDate: z.string().optional()
    .describe("Only results published before this date (ISO 8601)"),
  includeText: z.array(z.string()).max(50).optional()
    .describe("Deprecated by Exa: words that results should contain (approximate, word-level matching)"),
  excludeText: z.array(z.string()).max(50).optional()
    .describe("Deprecated by Exa: words that results should not contain (approximate, word-level matching)"),
  userLocation: z.string().length(2).optional()
    .describe("Two-letter ISO country code to localize results (e.g. 'US')"),
  moderation: z.boolean().optional()
    .describe("Filter unsafe content"),
  ...freshnessFields,
  includeSummary: z.boolean().optional()
    .describe("Include an LLM-generated summary for each result"),
  summarySchema: z.record(z.any()).optional()
    .describe("JSON Schema for a structured summary per result (implies includeSummary)"),
  summaryQuery: z.string().optional()
    .describe("Guide each result's summary with this question (implies includeSummary)"),
  includeHighlights: z.boolean().optional()
    .describe("Include key excerpts from each result (default: on unless page text is requested)"),
  includePageText: z.boolean().optional()
    .describe("Include each result's page text, up to DEFAULT_MAX_CHARACTERS (default 3000) characters. Off by default: results carry highlights instead"),
  textMaxCharacters: z.coerce.number().int().min(1).max(1000000).optional()
    .describe("Include page text up to this many characters per result (implies includePageText)"),
  highlightsQuery: z.string().optional()
    .describe("Pick highlights relevant to this query (implies includeHighlights)"),
  includeExtras: z.boolean().optional()
    .describe("Include embedded links and image links from each result"),
  subpages: z.coerce.number().int().min(0).max(100).optional()
    .describe("Also crawl up to this many subpages per result (e.g. a company's about/pricing pages)"),
  subpageTarget: z.array(z.string()).max(100).optional()
    .describe("Keywords to pick which subpages to crawl (e.g. ['about', 'pricing'])"),
  rerank: z.boolean().optional()
    .describe("Rerank with Voyage: fetch extra candidates, score them against the query, return the best numResults with scores. Needs VOYAGE_API_KEY"),
  rerankCandidates: z.coerce.number().int().min(2).max(100).optional()
    .describe("With rerank: candidates to fetch before reranking (default 3 x numResults, max 100)"),
  outputSchema: z.record(z.any()).optional()
    .describe("JSON Schema for a synthesized answer grounded in the results. Root type 'text' or 'object' (max 10 properties, 2 nesting levels). Adds ~2s."),
  systemPrompt: z.string().optional()
    .describe("Extra instructions for the synthesized output"),
  objective: z.string().max(4096).optional()
    .describe("The broader goal behind the search, to improve relevance"),
  additionalQueries: z.array(z.string()).min(1).max(10).optional()
    .describe("Extra query variations (deep search types only)")
});

export const webSearchTool: ToolRegistry = { ...createSearchTool(
  "exa_search",
  "Search the web with Exa. Use for discovery when you don't have a URL yet. Covers specialized searches through filters: research papers (category 'publication'), companies (category 'company', optionally subpages), people (category 'people'), news, posts on X (includeDomains ['x.com','twitter.com']), and competitors (describe the business, excludeDomains its own site). Set outputSchema for a synthesized, cited answer; set rerank for Voyage relevance ordering. Use answer_question for a direct answer to one question, code_search for code, web_fetch to read known URLs.",
  webSearchSchema,
  true,
  (args) => {
    const config = getConfig();
    const summary = summaryOption(args.includeSummary, args.summaryQuery, args.summarySchema);
    const wantsText = args.includePageText || args.textMaxCharacters !== undefined;
    // Default to highlights (query-relevant excerpts) rather than page text:
    // full text per result is large and rarely needed for discovery
    const highlights = highlightsOption(args.includeHighlights ?? !wantsText, args.highlightsQuery);
    return {
      query: args.query,
      type: args.searchType || "auto",
      numResults: args.rerank
        ? candidateCount(args.numResults || config.tools.defaultNumResults, args.rerankCandidates)
        : args.numResults || config.tools.defaultNumResults,
      ...(args.category && { category: args.category }),
      ...(args.includeDomains && { includeDomains: args.includeDomains }),
      ...(args.excludeDomains && { excludeDomains: args.excludeDomains }),
      ...(args.startPublishedDate && { startPublishedDate: args.startPublishedDate }),
      ...(args.endPublishedDate && { endPublishedDate: args.endPublishedDate }),
      ...(args.includeText && { includeText: args.includeText }),
      ...(args.excludeText && { excludeText: args.excludeText }),
      ...(args.userLocation && { userLocation: args.userLocation }),
      ...(args.moderation !== undefined && { moderation: args.moderation }),
      ...(args.outputSchema && { outputSchema: args.outputSchema }),
      ...(args.systemPrompt && { systemPrompt: args.systemPrompt }),
      ...(args.objective && { objective: args.objective }),
      ...(args.additionalQueries && { additionalQueries: args.additionalQueries }),
      contents: {
        ...(wantsText && { text: { maxCharacters: args.textMaxCharacters ?? config.tools.defaultMaxCharacters } }),
        ...freshness(args),
        ...(summary && { summary }),
        ...(highlights && { highlights }),
        ...(args.includeExtras && { extras: DEFAULT_EXTRAS }),
        ...(args.subpages && { subpages: args.subpages }),
        ...(args.subpageTarget && { subpageTarget: args.subpageTarget })
      }
    };
  },
  undefined,
  undefined,
  // Deep search types can run for minutes
  (args) => args.searchType?.startsWith('deep') ? LONG_REQUEST_TIMEOUT_MS : undefined,
  async (data, args, { signal }) => args.rerank
    ? rerankSearchResults(data, args.query, args.numResults || getConfig().tools.defaultNumResults, signal)
    : data
), title: "Exa Web Search", maxResultChars: LARGE_RESULT_CHARS };

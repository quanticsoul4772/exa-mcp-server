import { z } from "zod";
import { createCrawlTool } from "./tool-builder.js";

const crawlingSchema = z.object({
  url: z.string().url().describe("The URL to crawl (e.g., 'https://exa.ai')"),
  maxAgeHours: z.coerce.number().optional()
    .describe("Content freshness: 0 = force fresh crawl, -1 = cached only, positive = max age in hours"),
  includeSummary: z.boolean().optional().default(false)
    .describe("Include LLM-generated summary"),
  includeExtras: z.boolean().optional().default(false)
    .describe("Include embedded links and image URLs")
});

export const crawlingTool = createCrawlTool(
  "crawling",
  "Extract full content from a specific URL (article, PDF, or any web page). Use when you already have the URL and need its text. Use instead of exa_search when discovery is not needed. Does NOT search — requires an exact URL. Does NOT accept multiple URLs — use batch_extract for that.",
  crawlingSchema,
  false,
  ({ url, maxAgeHours, includeSummary, includeExtras }) => ({
    ids: [url],
    text: true,
    ...(maxAgeHours !== undefined ? { maxAgeHours } : { livecrawl: 'always' as const }),
    ...(includeSummary && { summary: true }),
    ...(includeExtras && { extras: { links: true, imageUrls: true } })
  })
);

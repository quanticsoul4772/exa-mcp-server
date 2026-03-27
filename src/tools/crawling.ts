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
  "Extract content from specific URLs using Exa AI - performs targeted crawling of web pages with freshness control. Useful for reading articles, PDFs, or any web page. Supports summaries and embedded link/image extraction.",
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

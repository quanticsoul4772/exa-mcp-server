import { z } from "zod";
import { createCrawlTool } from "./tool-builder.js";

const crawlingSchema = z.object({
  url: z.string().url().describe("The URL to crawl (e.g., 'https://exa.ai')")
});

export const crawlingTool = createCrawlTool(
  "crawling",
  "Extract content from specific URLs using Exa AI - performs targeted crawling of web pages to retrieve their full content. Useful for reading articles, PDFs, or any web page when you have the exact URL. Returns the complete text content of the specified URL.",
  crawlingSchema,
  false,
  ({ url }) => ({
    ids: [url],
    text: true,
    livecrawl: 'always' as const
  })
);
import { z } from "zod";
import { createCrawlTool } from "./tool-builder.js";

export const crawlingTool = createCrawlTool({
    name: "crawling",
    description: "Extract content from specific URLs using Exa AI - performs targeted crawling of web pages to retrieve their full content. Useful for reading articles, PDFs, or any web page when you have the exact URL. Returns the complete text content of the specified URL.",
    schema: {
        url: z.string().url().describe("The URL to crawl (e.g., 'https://exa.ai')")
    },
    enabled: false,
    createRequest: ({ url }) => ({
        ids: [url],
        text: true,
        livecrawl: 'always' as const
    })
});
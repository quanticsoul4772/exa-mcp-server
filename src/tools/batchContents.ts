import { z } from "zod";
import { createTool } from "./tool-builder.js";

interface ExaBatchContentsResponse {
  results: Array<{
    url: string;
    id: string;
    title?: string;
    text?: string;
    highlights?: string[];
    summary?: string;
    extras?: {
      links?: string[];
      imageUrls?: string[];
    };
    error?: string;
  }>;
  requestId: string;
  statuses?: Array<{
    url: string;
    status: string;
    error?: string;
  }>;
}

const batchContentsSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10).describe("URLs to extract content from"),
  includeText: z.boolean().optional().default(true),
  textMaxCharacters: z.number().optional().default(5000),
  includeHtmlTags: z.boolean().optional().default(false),
  textVerbosity: z.enum(['compact', 'standard', 'full']).optional()
    .describe("Text detail level: 'compact', 'standard', or 'full'"),
  includeHighlights: z.boolean().optional().default(false),
  includeSummary: z.boolean().optional().default(false)
    .describe("Include LLM-generated summary for each URL"),
  includeExtras: z.boolean().optional().default(false)
    .describe("Include embedded links and image URLs"),
  maxAgeHours: z.coerce.number().optional()
    .describe("Content freshness: 0 = fresh, -1 = cached only, positive = max age in hours"),
  subpages: z.number().optional()
    .describe("Number of subpages to crawl per URL"),
  subpageTarget: z.array(z.string()).optional()
    .describe("Target specific subpage sections (e.g. ['about', 'pricing'])")
});

export const batchContentsTool = createTool({
  name: "batch_extract",
  description: "Extract content from multiple URLs in a single request. Use instead of multiple crawling calls when you have a list of URLs. Does NOT search — requires known URLs. Supports text, highlights, summaries, subpage crawling, and embedded link/image extraction.",
  schema: batchContentsSchema,
  enabled: true,
  endpoint: '/contents',
  createRequest: (args) => ({
    urls: args.urls,
    text: args.includeText ? {
      maxCharacters: args.textMaxCharacters,
      includeHtmlTags: args.includeHtmlTags,
      ...(args.textVerbosity && { verbosity: args.textVerbosity })
    } : false,
    highlights: args.includeHighlights ? { maxCharacters: 500 } : false,
    ...(args.includeSummary && { summary: true }),
    ...(args.includeExtras && { extras: { links: true, imageUrls: true } }),
    ...(args.maxAgeHours !== undefined ? { maxAgeHours: args.maxAgeHours } : { livecrawl: 'fallback' }),
    ...(args.subpages && { subpages: args.subpages }),
    ...(args.subpageTarget && { subpageTarget: args.subpageTarget })
  }),
  formatResponse: (data: ExaBatchContentsResponse) => {
    let output = `## Extracted Content from ${data.results.length} URLs\n\n`;
    let successCount = 0;
    const failedUrls: string[] = [];

    data.results.forEach((result, idx) => {
      if (result.error) {
        failedUrls.push(`${result.url}: ${result.error}`);
      } else {
        successCount++;
        output += `### ${idx + 1}. ${result.title || 'Untitled'}\n`;
        output += `URL: ${result.url}\n\n`;
        if (result.summary) {
          output += `**Summary:** ${result.summary}\n\n`;
        }
        if (result.text) {
          output += `${result.text.substring(0, 500)}...\n\n`;
        }
        if (result.extras?.links?.length) {
          output += `**Links:** ${result.extras.links.length} found\n`;
        }
        if (result.extras?.imageUrls?.length) {
          output += `**Images:** ${result.extras.imageUrls.length} found\n`;
        }
      }
    });

    output += `\n## Summary\n`;
    output += `- Successfully extracted: ${successCount}/${data.results.length}\n`;
    if (failedUrls.length > 0) {
      output += `\n### Failed URLs:\n`;
      failedUrls.forEach(url => output += `- ${url}\n`);
    }

    return output;
  },
  getStartContext: (args) => `Extracting ${args.urls.length} URLs`,
  progressSteps: [
    "Validating URLs...",
    "Initiating batch extraction...",
    "Processing content...",
    "Compiling results..."
  ]
});

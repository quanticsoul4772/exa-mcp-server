import { z } from "zod";
import { createTool } from "./tool-builder.js";

interface ExaBatchContentsRequest {
  ids?: string[];
  urls?: string[];
  text?: boolean | { maxCharacters?: number; includeHtmlTags?: boolean };
  highlights?: boolean;
  livecrawl?: 'always' | 'fallback' | 'never';
}

interface ExaBatchContentsResponse {
  results: Array<{
    url: string;
    id: string;
    title?: string;
    text?: string;
    highlights?: string[];
    error?: string;
  }>;
  requestId: string;
}

const batchContentsSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10).describe("URLs to extract content from"),
  includeText: z.boolean().optional().default(true),
  textMaxCharacters: z.number().optional().default(5000),
  includeHtmlTags: z.boolean().optional().default(false),
  includeHighlights: z.boolean().optional().default(false),
  livecrawl: z.enum(['always', 'fallback', 'never']).optional().default('fallback')
});

export const batchContentsTool = createTool({
  name: "batch_extract",
  description: "Extract content from multiple URLs in a single request",
  schema: batchContentsSchema,
  enabled: true,
  endpoint: '/contents',
  createRequest: (args) => ({
    urls: args.urls,
    text: args.includeText ? {
      maxCharacters: args.textMaxCharacters,
      includeHtmlTags: args.includeHtmlTags
    } : false,
    highlights: args.includeHighlights,
    livecrawl: args.livecrawl
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
        if (result.text) {
          output += `${result.text.substring(0, 500)}...\n\n`;
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
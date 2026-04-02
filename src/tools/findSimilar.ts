import { z } from "zod";
import { createTool } from "./tool-builder.js";

interface ExaFindSimilarResponse {
  results: Array<{
    url: string;
    title: string;
    publishedDate?: string;
    author?: string;
    score: number;
    id: string;
    text?: string;
    highlights?: string[];
    summary?: string;
  }>;
  requestId: string;
}

const findSimilarSchema = z.object({
  url: z.string().url().describe("URL to find similar pages for"),
  numResults: z.number().min(1).max(100).optional().default(10),
  excludeSourceDomain: z.boolean().optional().default(true),
  includeDomains: z.array(z.string()).optional().describe("Only return results from these domains"),
  excludeDomains: z.array(z.string()).optional().describe("Exclude results from these domains"),
  startPublishedDate: z.string().optional().describe("ISO date string"),
  endPublishedDate: z.string().optional().describe("ISO date string"),
  includeText: z.boolean().optional().default(false),
  textMaxCharacters: z.number().optional().default(1000),
  includeHighlights: z.boolean().optional().default(true),
  includeSummary: z.boolean().optional().default(false).describe("Include LLM-generated summary"),
  maxAgeHours: z.coerce.number().optional()
    .describe("Content freshness: 0 = fresh, -1 = cached only, positive = max age in hours"),
  includeExtras: z.boolean().optional().default(false).describe("Include embedded links and image URLs")
});

export const findSimilarTool = createTool({
  name: "find_similar",
  description: "Find pages similar in meaning to a provided URL using Exa AI semantic search. Supports freshness control, summaries, and domain filtering.",
  schema: findSimilarSchema,
  enabled: true,
  endpoint: '/findSimilar',
  createRequest: (args) => ({
    url: args.url,
    numResults: args.numResults,
    excludeSourceDomain: args.excludeSourceDomain,
    ...(args.includeDomains && { includeDomains: args.includeDomains }),
    ...(args.excludeDomains && { excludeDomains: args.excludeDomains }),
    ...(args.startPublishedDate && { startPublishedDate: args.startPublishedDate }),
    ...(args.endPublishedDate && { endPublishedDate: args.endPublishedDate }),
    text: args.includeText ? { maxCharacters: args.textMaxCharacters } : false,
    highlights: args.includeHighlights ? { maxCharacters: 500 } : false,
    ...(args.includeSummary && { summary: true }),
    ...(args.includeExtras && { extras: { links: true, imageUrls: true } }),
    ...(args.maxAgeHours !== undefined && { maxAgeHours: args.maxAgeHours })
  }),
  formatResponse: (data: ExaFindSimilarResponse) => {
    let output = `## Found ${data.results.length} Similar Pages\n\n`;
    data.results.forEach((result, idx) => {
      output += `### ${idx + 1}. [${result.title}](${result.url})\n`;
      output += `- Similarity: ${(result.score * 100).toFixed(1)}%\n`;
      if (result.publishedDate) {
        output += `- Published: ${result.publishedDate}\n`;
      }
      if (result.author) {
        output += `- Author: ${result.author}\n`;
      }
      if (result.summary) {
        output += `\n**Summary:** ${result.summary}\n`;
      }
      if (result.highlights?.length) {
        output += `\n**Key Matches:**\n`;
        result.highlights.forEach(h => output += `> ${h}\n`);
      }
      output += '\n';
    });
    return output;
  },
  getStartContext: (args) => `Finding similar to: ${args.url}`,
  progressSteps: [
    "Extracting page features...",
    "Computing semantic similarity...",
    "Ranking similar pages...",
    "Fetching page details..."
  ]
});

import { z } from "zod";
import { createTool } from "./tool-builder.js";

interface ExaFindSimilarRequest {
  url: string;
  numResults?: number;
  excludeSourceDomain?: boolean;
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  text?: boolean | { maxCharacters?: number };
  highlights?: boolean;
}

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
  }>;
  requestId: string;
}

const findSimilarSchema = z.object({
  url: z.string().url().describe("URL to find similar pages for"),
  numResults: z.number().min(1).max(20).optional().default(10),
  excludeSourceDomain: z.boolean().optional().default(true),
  excludeDomains: z.array(z.string()).optional(),
  startPublishedDate: z.string().optional().describe("ISO date string"),
  endPublishedDate: z.string().optional().describe("ISO date string"),
  includeText: z.boolean().optional().default(false),
  textMaxCharacters: z.number().optional().default(1000),
  includeHighlights: z.boolean().optional().default(true)
});

export const findSimilarTool = createTool({
  name: "find_similar",
  description: "Find pages similar in meaning to a provided URL using Exa AI semantic search",
  schema: findSimilarSchema,
  enabled: true,
  endpoint: '/findSimilar',
  createRequest: (args) => ({
    url: args.url,
    numResults: args.numResults,
    excludeSourceDomain: args.excludeSourceDomain,
    excludeDomains: args.excludeDomains,
    startPublishedDate: args.startPublishedDate,
    endPublishedDate: args.endPublishedDate,
    text: args.includeText ? { maxCharacters: args.textMaxCharacters } : false,
    highlights: args.includeHighlights
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
import { z } from "zod";
import { createTool } from "./tool-builder.js";
import { ExaContextResponse } from "../types.js";

const codeSearchSchema = z.object({
  query: z.string().min(1).max(2000).describe("Code search query - describe the pattern, API, or concept you need"),
  tokensNum: z.union([
    z.number().min(50).max(100000),
    z.literal('dynamic')
  ]).optional().default('dynamic')
    .describe("Response size: 'dynamic' (auto) or 50-100000 tokens")
});

export const codeSearchTool = createTool({
  name: "code_search",
  description: "Search for code examples, documentation, and programming patterns using Exa's code-optimized search. Searches billions of GitHub repos, docs, and Stack Overflow. Returns token-efficient code snippets with source URLs.",
  schema: codeSearchSchema,
  enabled: true,
  endpoint: '/context',
  createRequest: (args) => ({
    query: args.query,
    tokensNum: args.tokensNum
  }),
  formatResponse: (data: ExaContextResponse) => {
    if (!data.results || data.results.length === 0) {
      return "No code results found.";
    }

    let output = `## Code Search Results (${data.totalTokens} tokens)\n\n`;
    data.results.forEach((result, idx) => {
      output += `### ${idx + 1}. ${result.url}\n`;
      output += `Tokens: ${result.tokens}\n\n`;
      output += `${result.text}\n\n`;
    });
    return output;
  },
  getStartContext: (args) => `Code search: "${args.query}"`,
  progressSteps: [
    "Searching code repositories...",
    "Extracting relevant snippets...",
    "Formatting code results..."
  ]
});

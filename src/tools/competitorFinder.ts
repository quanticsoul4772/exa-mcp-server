import { z } from "zod";
import { createCompetitorFinderTool } from "./tool-builder.js";
import { getConfig } from "../config/index.js";

const competitorFinderSchema = z.object({
  query: z.string().describe("Describe what the company/product in a few words (e.g., 'web search API', 'AI image generation', 'cloud storage service'). Keep it simple. Do not include the company name."),
  excludeDomain: z.string().optional().describe("Optional: The company's website to exclude from results (e.g., 'exa.ai')"),
  numResults: z.coerce.number().optional().describe("Number of competitors to return (default: 10)")
});

export const competitorFinderTool = createCompetitorFinderTool(
  "competitor_finder",
  "Find competitors of a company using Exa AI - performs targeted searches to identify businesses that offer similar products or services. Describe what the company does (without mentioning its name) and optionally provide the company's website to exclude it from results.",
  competitorFinderSchema,
  false,
  ({ query, excludeDomain, numResults }) => {
    const config = getConfig();
    return {
      query,
      type: "auto",
      numResults: numResults || 10,
      contents: {
        text: {
          maxCharacters: config.tools.defaultMaxCharacters
        },
        livecrawl: 'always' as const
      },
      excludeDomains: excludeDomain ? [excludeDomain] : undefined
    };
  },
  // Progress steps for competitor finder
  [
    "Analyzing target company...",
    "Searching for similar companies...",
    "Evaluating competitor relevance...",
    "Compiling competitor analysis..."
  ]
);
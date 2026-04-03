import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { getConfig } from "../config/index.js";
import { ResponseFormatter } from "../utils/formatter.js";

// numResults: max 100 (Exa API practical ceiling). maxCharacters: max 100000 (prevents runaway memory on large full-text results)
const researchPaperSearchSchema = z.object({
  query: z.string().describe("Research topic or keyword to search for"),
  numResults: z.coerce.number().min(1).max(100).optional().describe("Number of research papers to return (default: 5)"),
  maxCharacters: z.coerce.number().min(1).max(100000).optional().describe("Maximum number of characters to return for each result's text content (Default: 3000)")
});

export const researchPaperSearchTool = createSearchTool(
  "research_paper_search",
  "Search 100M+ academic papers with full text access. Use instead of exa_search for academic/scientific queries — optimized for research papers, not general web. Returns titles, authors, publication dates, and full text excerpts. Does NOT search general web content.",
  researchPaperSearchSchema,
  false,
  ({ query, numResults, maxCharacters }) => {
    const config = getConfig();
    return {
      query,
      category: "research paper",
      type: "auto" as const,
      numResults: numResults || config.tools.defaultNumResults,
      contents: {
        text: {
          maxCharacters: maxCharacters || config.tools.defaultMaxCharacters
        },
        livecrawl: 'fallback' as const
      }
    };
  },
  (_data, _toolName) => ResponseFormatter.formatResearchPaperResponse(_data.results),
  // Progress steps for research paper search
  [
    "Searching academic databases...",
    "Retrieving paper metadata...",
    "Extracting paper content...",
    "Formatting research results..."
  ]
);
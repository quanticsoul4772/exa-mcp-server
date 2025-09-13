import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { getConfig } from "../config/index.js";
import { ResponseFormatter } from "../utils/formatter.js";

const researchPaperSearchSchema = z.object({
  query: z.string().describe("Research topic or keyword to search for"),
  numResults: z.coerce.number().optional().describe("Number of research papers to return (default: 5)"),
  maxCharacters: z.coerce.number().optional().describe("Maximum number of characters to return for each result's text content (Default: 3000)")
});

export const researchPaperSearchTool = createSearchTool(
  "research_paper_search",
  "Search across 100M+ research papers with full text access using Exa AI - performs targeted academic paper searches with deep research content coverage. Returns detailed information about relevant academic papers including titles, authors, publication dates, and full text excerpts. Control the number of results and character counts returned to balance comprehensiveness with conciseness based on your task requirements.",
  researchPaperSearchSchema,
  false,
  ({ query, numResults, maxCharacters }) => {
    const config = getConfig();
    return {
      query,
      category: "research paper",
      type: "auto",
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
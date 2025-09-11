import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { API_CONFIG } from "./config.js";
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
  ({ query, numResults, maxCharacters }) => ({
    query,
    category: "research paper",
    type: "auto",
    numResults: numResults || API_CONFIG.DEFAULT_NUM_RESULTS,
    contents: {
      text: {
        maxCharacters: maxCharacters || API_CONFIG.DEFAULT_MAX_CHARACTERS
      },
      livecrawl: 'fallback' as const
    }
  }),
  (data, toolName) => ResponseFormatter.formatResearchPaperResponse(data.results)
);
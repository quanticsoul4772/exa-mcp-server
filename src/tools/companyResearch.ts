import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { API_CONFIG } from "./config.js";
import { ResponseFormatter } from "../utils/formatter.js";

const companyResearchSchema = z.object({
  query: z.string().describe("Company website URL (e.g., 'exa.ai' or 'https://exa.ai')"),
  subpages: z.coerce.number().optional().describe("Number of subpages to crawl (default: 10)"),
  subpageTarget: z.array(z.string()).optional().describe("Specific sections to target (e.g., ['about', 'pricing', 'faq', 'blog']). If not provided, will crawl the most relevant pages.")
});

export const companyResearchTool = createSearchTool(
  "company_research",
  "Research companies using Exa AI - performs targeted searches of company websites to gather comprehensive information about businesses. Returns detailed information from company websites including about pages, pricing, FAQs, blogs, and other relevant content. Specify the company URL and optionally target specific sections of their website.",
  companyResearchSchema,
  false,
  ({ query, subpages, subpageTarget }) => ({
    query,
    category: "company",
    includeDomains: [query],
    type: "auto",
    numResults: 1,
    contents: {
      text: {
        maxCharacters: API_CONFIG.DEFAULT_MAX_CHARACTERS
      },
      livecrawl: 'always' as const,
      subpages: subpages || 10,
      subpageTarget: subpageTarget
    }
  }),
  (data, toolName) => ResponseFormatter.formatCompanyResponse(data.results)
);
import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { getConfig } from "../config/index.js";
import { ResponseFormatter } from "../utils/formatter.js";

const companyResearchSchema = z.object({
  query: z.string().describe("Company website URL (e.g., 'exa.ai' or 'https://exa.ai')"),
  subpages: z.coerce.number().optional().describe("Number of subpages to crawl (default: 10)"),
  subpageTarget: z.array(z.string()).optional().describe("Specific sections to target (e.g., ['about', 'pricing', 'faq', 'blog']). If not provided, will crawl the most relevant pages."),
  includeSummary: z.boolean().optional().default(false)
    .describe("Include LLM-generated summary for each page"),
  includeExtras: z.boolean().optional().default(false)
    .describe("Include embedded links and image URLs"),
  maxAgeHours: z.coerce.number().optional()
    .describe("Content freshness: 0 = fresh, -1 = cached only, positive = max age in hours")
});

export const companyResearchTool = createSearchTool(
  "company_research",
  "Research companies using Exa AI - performs targeted searches of company websites to gather comprehensive information. Returns detailed content from about pages, pricing, FAQs, blogs, and other relevant sections. Supports summaries and freshness control.",
  companyResearchSchema,
  false,
  ({ query, subpages, subpageTarget, includeSummary, includeExtras, maxAgeHours }) => {
    const config = getConfig();
    return {
      query,
      category: "company",
      includeDomains: [query],
      type: "auto",
      numResults: 1,
      contents: {
        text: {
          maxCharacters: config.tools.defaultMaxCharacters
        },
        ...(maxAgeHours !== undefined ? { maxAgeHours } : { livecrawl: 'always' as const }),
        subpages: subpages || 10,
        subpageTarget: subpageTarget,
        ...(includeSummary && { summary: true }),
        ...(includeExtras && { extras: { links: true, imageUrls: true } })
      }
    };
  },
  (_data, _toolName) => ResponseFormatter.formatCompanyResponse(_data.results),
  [
    "Finding company domain...",
    "Crawling main pages...",
    "Extracting subpage content...",
    "Compiling company information..."
  ]
);

import { webSearchTool } from './webSearch.js';
import { researchPaperSearchTool } from './researchPaperSearch.js';
import { twitterSearchTool } from './twitterSearch.js';
import { companyResearchTool } from './companyResearch.js';
import { crawlingTool } from './crawling.js';
import { competitorFinderTool } from './competitorFinder.js';
import { ToolRegistry } from './config.js';

export const toolRegistry: Record<string, ToolRegistry> = {
  [webSearchTool.name]: webSearchTool,
  [researchPaperSearchTool.name]: researchPaperSearchTool,
  [twitterSearchTool.name]: twitterSearchTool,
  [companyResearchTool.name]: companyResearchTool,
  [crawlingTool.name]: crawlingTool,
  [competitorFinderTool.name]: competitorFinderTool,
};

export { API_CONFIG } from "./config.js";
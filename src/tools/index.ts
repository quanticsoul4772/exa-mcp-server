import { webSearchTool } from './webSearch.js';
import { researchPaperSearchTool } from './researchPaperSearch.js';
import { twitterSearchTool } from './twitterSearch.js';
import { companyResearchTool } from './companyResearch.js';
import { crawlingTool } from './crawling.js';
import { competitorFinderTool } from './competitorFinder.js';
import { answerTool } from './answer.js';
import { findSimilarTool } from './findSimilar.js';
import { batchContentsTool } from './batchContents.js';
import { researchTool } from './research.js';
import { ToolRegistry } from './config.js';

export const toolRegistry: Record<string, ToolRegistry> = {
  [webSearchTool.name]: webSearchTool,
  [researchPaperSearchTool.name]: researchPaperSearchTool,
  [twitterSearchTool.name]: twitterSearchTool,
  [companyResearchTool.name]: companyResearchTool,
  [crawlingTool.name]: crawlingTool,
  [competitorFinderTool.name]: competitorFinderTool,
  [answerTool.name]: answerTool,
  [findSimilarTool.name]: findSimilarTool,
  [batchContentsTool.name]: batchContentsTool,
  [researchTool.name]: researchTool,
};
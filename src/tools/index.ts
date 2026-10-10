import { webSearchTool } from './webSearch.js';
import { webFetchTool } from './webFetch.js';
import { answerTool } from './answer.js';
import { findSimilarTool } from './findSimilar.js';
import { codeSearchTool } from './codeSearch.js';
import { agentRunTool } from './agentRun.js';
import { monitorsTool } from './monitors.js';
import { websetsTool } from './websets.js';
import { ToolRegistry } from './config.js';

export const toolRegistry: Record<string, ToolRegistry> = {
  [webSearchTool.name]: webSearchTool,
  [webFetchTool.name]: webFetchTool,
  [answerTool.name]: answerTool,
  [findSimilarTool.name]: findSimilarTool,
  [codeSearchTool.name]: codeSearchTool,
  [agentRunTool.name]: agentRunTool,
  [monitorsTool.name]: monitorsTool,
  [websetsTool.name]: websetsTool,
};

/**
 * Tool names removed in 0.5.0, mapped to the tool that now covers them, so
 * existing --tools lists keep working.
 */
export const toolAliases: Record<string, string> = {
  research_paper_search: webSearchTool.name,
  twitter_search: webSearchTool.name,
  company_research: webSearchTool.name,
  competitor_finder: webSearchTool.name,
  crawling: webFetchTool.name,
  batch_extract: webFetchTool.name,
  deep_research: agentRunTool.name,
};

/**
 * Resolve requested tool names: map removed names to their replacements and
 * report which names were remapped and which are unknown.
 */
export function resolveToolNames(requested: string[]): { tools: Set<string>; remapped: string[]; unknown: string[] } {
  const tools = new Set<string>();
  const remapped: string[] = [];
  const unknown: string[] = [];
  for (const name of requested) {
    if (toolRegistry[name]) {
      tools.add(name);
    } else if (toolAliases[name]) {
      tools.add(toolAliases[name]);
      remapped.push(`${name} -> ${toolAliases[name]}`);
    } else {
      unknown.push(name);
    }
  }
  return { tools, remapped, unknown };
}

/**
 * Guidance sent to MCP clients at initialization (server `instructions`).
 * Kept short: clients may place it in the model's context.
 */
export const SERVER_INSTRUCTIONS = `Exa web tools. Choosing a tool:
- exa_search: find pages when you don't have URLs. Returns highlights by default; filters cover papers (category "publication"), companies, people, news and posts on X. Set outputSchema for a synthesized, cited answer; set rerank to order results by Voyage relevance.
- web_fetch: read known URLs (1-100 per call). Set relevantTo to get only the passages relevant to a question (needs VOYAGE_API_KEY): far fewer tokens than whole pages.
- answer_question: one direct answer with citations.
- code_search: code examples and API usage.
- find_similar: pages like a given URL.
- agent_run (if enabled): multi-step research; slow and costs dollars per run. Set effort, and maxCostDollars for effort auto/ultra.
- monitors, websets (if enabled): create resources on the user's Exa account; monitors can delete.
Every response ends with Exa's estimated cost.`;

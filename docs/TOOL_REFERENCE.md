# Tool Reference

Generated from the tool schemas in `src/tools/` (version 0.9.0) by `scripts/gen-tool-reference.mjs`. Every tool response ends with the estimated cost when Exa reports one.

## Contents

- [`exa_search`](#exa_search)
- [`web_fetch`](#web_fetch)
- [`answer_question`](#answer_question)
- [`find_similar`](#find_similar)
- [`code_search`](#code_search)
- [`agent_run`](#agent_run) (off by default)
- [`monitors`](#monitors) (off by default)
- [`websets`](#websets) (off by default)
- [Removed tool names](#removed-tool-names)

## exa_search

**Exa Web Search**

Search the web with Exa. Use for discovery when you don't have a URL yet. Covers specialized searches through filters: research papers (category 'publication'), companies (category 'company', optionally subpages), people (category 'people'), news, posts on X (includeDomains ['x.com','twitter.com']), and competitors (describe the business, excludeDomains its own site). Set outputSchema for a synthesized, cited answer; set rerank for Voyage relevance ordering. Use answer_question for a direct answer to one question, code_search for code, web_fetch to read known URLs.

On by default: yes. Hints: readOnly: true, openWorld: true.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | yes |  | Search query |
| `numResults` | number | no |  | Number of search results to return (default: DEFAULT_NUM_RESULTS, 3) |
| `searchType` | `instant` \| `fast` \| `auto` \| `deep-lite` \| `deep` \| `deep-reasoning` | no |  | Search type: 'instant' (lowest latency), 'fast', 'auto' (default), 'deep-lite', 'deep' (multi-step, slower), 'deep-reasoning' (most thorough) |
| `category` | `company` \| `publication` \| `news` \| `personal site` \| `financial report` \| `people` | no |  | Filter by content category. 'publication' = research papers and academic sources. 'company' and 'people' do not allow date filters or excludeDomains. |
| `includeDomains` | array of string | no |  | Only return results from these domains (e.g. ['x.com', 'twitter.com'] for posts on X; ['example.com'] for one company's site) |
| `excludeDomains` | array of string | no |  | Exclude results from these domains (e.g. a company's own domain when looking for its competitors) |
| `startPublishedDate` | string | no |  | Only results published after this date (ISO 8601) |
| `endPublishedDate` | string | no |  | Only results published before this date (ISO 8601) |
| `includeText` | array of string | no |  | Deprecated by Exa: words that results should contain (approximate, word-level matching) |
| `excludeText` | array of string | no |  | Deprecated by Exa: words that results should not contain (approximate, word-level matching) |
| `userLocation` | string | no |  | Two-letter ISO country code to localize results (e.g. 'US') |
| `moderation` | boolean | no |  | Filter unsafe content |
| `maxAgeHours` | number | no |  | Content freshness: 0 = always fetch fresh, -1 = cache only, 1-720 = max cache age in hours. Omit to use cache and fetch live only when nothing is cached. |
| `livecrawlTimeout` | number | no |  | Live crawl timeout in milliseconds (1-90000, Exa default 10000) |
| `includeSummary` | boolean | no |  | Include an LLM-generated summary for each result |
| `summarySchema` | object (JSON Schema) | no |  | JSON Schema for a structured summary per result (implies includeSummary) |
| `summaryQuery` | string | no |  | Guide each result's summary with this question (implies includeSummary) |
| `includeHighlights` | boolean | no |  | Include key excerpts from each result (default: on unless page text is requested) |
| `includePageText` | boolean | no |  | Include each result's page text, up to DEFAULT_MAX_CHARACTERS (default 3000) characters. Off by default: results carry highlights instead |
| `textMaxCharacters` | number | no |  | Include page text up to this many characters per result (implies includePageText) |
| `highlightsQuery` | string | no |  | Pick highlights relevant to this query (implies includeHighlights) |
| `includeExtras` | boolean | no |  | Include embedded links and image links from each result |
| `subpages` | number | no |  | Also crawl up to this many subpages per result (e.g. a company's about/pricing pages) |
| `subpageTarget` | array of string | no |  | Keywords to pick which subpages to crawl (e.g. ['about', 'pricing']) |
| `rerank` | boolean | no |  | Rerank with Voyage: fetch extra candidates, score them against the query, return the best numResults with scores. Needs VOYAGE_API_KEY |
| `rerankCandidates` | number | no |  | With rerank: candidates to fetch before reranking (default 3 x numResults, max 100) |
| `outputSchema` | object (JSON Schema) | no |  | JSON Schema for a synthesized answer grounded in the results. Root type 'text' or 'object' (max 10 properties, 2 nesting levels). Adds ~2s. |
| `systemPrompt` | string | no |  | Extra instructions for the synthesized output |
| `objective` | string | no |  | The broader goal behind the search, to improve relevance |
| `additionalQueries` | array of string | no |  | Extra query variations (deep search types only) |

## web_fetch

**Fetch Web Pages (Exa)**

Read the full content of one or more known URLs (articles, PDFs, any page), up to 100 per call. Set relevantTo to get only the passages that matter for a question. Use when you already have the URLs. Does NOT search — use exa_search to find URLs first. Reports per-URL failures.

On by default: yes. Hints: readOnly: true, openWorld: true.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `urls` | array of string | yes |  | URLs to read (1-100) |
| `includeText` | boolean | no | `true` | Return page text (default true) |
| `textMaxCharacters` | number | no |  | Max characters of text per URL. Default: 10000 per URL, reduced so all URLs together stay within 100000 characters |
| `textVerbosity` | `compact` \| `standard` \| `full` | no |  | Text detail level (Exa default 'compact') |
| `includeHtmlTags` | boolean | no | `false` |  |
| `includeSections` | array of `header` \| `navigation` \| `banner` \| `body` \| `sidebar` \| `footer` \| `metadata` | no |  | Only keep these page sections (best effort), e.g. ['body'] |
| `excludeSections` | array of `header` \| `navigation` \| `banner` \| `body` \| `sidebar` \| `footer` \| `metadata` | no |  | Drop these page sections (best effort), e.g. ['navigation', 'footer'] |
| `relevantTo` | string | no |  | Return only the passages of each page most relevant to this query, scored by Voyage reranking, instead of the whole text. Needs VOYAGE_API_KEY |
| `topChunks` | number | no | `5` | With relevantTo: passages kept per page (default 5) |
| `chunkCharacters` | number | no | `1500` | With relevantTo: approximate passage size in characters (default 1500) |
| `includeHighlights` | boolean | no | `false` |  |
| `highlightsQuery` | string | no |  | Pick highlights relevant to this query (implies includeHighlights) |
| `includeSummary` | boolean | no | `false` | Include an LLM-generated summary per URL |
| `summarySchema` | object (JSON Schema) | no |  | JSON Schema for a structured summary per result (implies includeSummary) |
| `summaryQuery` | string | no |  | Guide each summary with this question (implies includeSummary) |
| `includeExtras` | boolean | no | `false` | Include embedded links and image links |
| `maxAgeHours` | number | no |  | Content freshness: 0 = always fetch fresh, -1 = cache only, 1-720 = max cache age in hours. Omit to use cache and fetch live only when nothing is cached. |
| `livecrawlTimeout` | number | no |  | Live crawl timeout in milliseconds (1-90000, Exa default 10000) |
| `snapshotAsOf` | string | no |  | Return the stored version as of this date (ISO 8601 or YYYY-MM-DD); never fetches live |
| `subpages` | number | no |  | Also crawl up to this many subpages per URL |
| `subpageTarget` | array of string | no |  | Keywords to pick which subpages to crawl (e.g. ['about', 'pricing']) |

## answer_question

**Answer with Citations (Exa)**

Get a direct answer to a question with cited sources. Use instead of exa_search when you want a synthesized answer, not a list of results. Set outputSchema for a structured answer. For open-ended multi-step research use agent_run.

On by default: yes. Hints: readOnly: true, openWorld: true.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | yes |  | Question to answer |
| `model` | `exa` \| `exa-pro` \| `exa-research` \| `exa-fast` | no |  | Answer model: 'exa-fast' (quickest), 'exa' (default), 'exa-pro' (stronger), 'exa-research' (most thorough) |
| `systemPrompt` | string | no |  | Extra instructions for the answer (tone, format, focus) |
| `outputSchema` | object (JSON Schema) | no |  | JSON Schema (Draft 7) for a structured answer instead of prose |
| `userLocation` | string | no |  | Two-letter ISO country code to localize sources (e.g. 'US') |
| `includeText` | boolean | no | `false` | Include each citation's page text |

## find_similar

**Find Similar Pages (Exa)**

Find pages similar to a reference URL. Use when you have an example page and want more like it. Requires a URL, not a query. Note: Exa marks /findSimilar deprecated; exa_search with a query describing the page is the long-term replacement.

On by default: yes. Hints: readOnly: true, openWorld: true.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `url` | string | yes |  | URL to find similar pages for |
| `numResults` | number | no | `10` |  |
| `excludeSourceDomain` | boolean | no | `true` |  |
| `includeDomains` | array of string | no |  | Only return results from these domains |
| `excludeDomains` | array of string | no |  | Exclude results from these domains |
| `startPublishedDate` | string | no |  | ISO date string |
| `endPublishedDate` | string | no |  | ISO date string |
| `includeText` | boolean | no | `false` |  |
| `textMaxCharacters` | number | no | `1000` |  |
| `includeHighlights` | boolean | no | `true` |  |
| `highlightsQuery` | string | no |  | Pick highlights relevant to this query |
| `includeSummary` | boolean | no | `false` | Include LLM-generated summary |
| `summarySchema` | object (JSON Schema) | no |  | JSON Schema for a structured summary per result (implies includeSummary) |
| `summaryQuery` | string | no |  | Guide each summary with this question (implies includeSummary) |
| `maxAgeHours` | number | no |  | Content freshness: 0 = always fetch fresh, -1 = cache only, 1-720 = max cache age in hours. Omit to use cache and fetch live only when nothing is cached. |
| `livecrawlTimeout` | number | no |  | Live crawl timeout in milliseconds (1-90000, Exa default 10000) |
| `includeExtras` | boolean | no | `false` | Include embedded links and image links |

## code_search

**Code Search (Exa)**

Search for code examples, API usage, and programming patterns across GitHub, docs, and Stack Overflow. Use instead of exa_search for code-specific queries. Returns token-efficient snippets with source URLs. Does NOT search general web content.

On by default: yes. Hints: readOnly: true, openWorld: true.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `query` | string | yes |  | Code search query - describe the pattern, API, or concept you need |
| `tokensNum` | number \| `dynamic` | no | `"dynamic"` | Response size: 'dynamic' (auto) or 50-100000 tokens |

## agent_run

**Exa Research Agent**

Run an Exa research agent for multi-step research, list building, and structured output with citations. Slower and costlier than exa_search or answer_question (runs can take minutes and cost dollars; set effort and maxCostDollars). Waits up to waitSeconds, then returns the run id; call again with runId to keep waiting. Cancelling a call that started a run cancels that run on Exa; cancelling a call that resumed a run (runId) leaves it running.

On by default: no. Hints: readOnly: false, destructive: true, idempotent: false, openWorld: true.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `action` | `run` \| `cancel` \| `stop` \| `list` | no | `"run"` | run (default): start a run, or resume waiting on runId. cancel: end runId now. stop: end an 'ultra' runId gracefully, keeping partial output. list: recent runs |
| `query` | string | no |  | The research task or question. Required to start a run. |
| `runId` | string | no |  | An existing run: resume waiting on it (action run), or cancel/stop it |
| `dataSources` | array of `fiber` \| `financial_datasets` \| `similarweb` \| `baselayer` \| `affiliate` \| `particle` \| `jinko` \| `polymarket` \| `macrobond` | no |  | Extra data providers for the agent to query (Exa Connect), e.g. ['similarweb', 'financial_datasets'] |
| `inputData` | array of record | no |  | Records for the agent to work from, e.g. a list of companies to enrich |
| `inputExclusion` | array of record | no |  | Records the agent must leave out of its results, e.g. companies already known |
| `metadata` | object (JSON Schema) | no |  | Your own key/value labels stored with the run |
| `limit` | number | no |  | With action list: runs per page |
| `cursor` | string | no |  | With action list: cursor from the previous page |
| `effort` | `minimal` \| `low` \| `medium` \| `high` \| `xhigh` \| `auto` \| `ultra` | no |  | How much work the agent does (Exa default 'auto'). Higher effort costs more. |
| `systemPrompt` | string | no |  | Extra instructions for the agent's output or behavior |
| `outputSchema` | object (JSON Schema) | no |  | JSON Schema for structured output (returned alongside the text answer) |
| `previousRunId` | string | no |  | A completed run to continue from |
| `maxCostDollars` | number | no |  | Cost cap in dollars ($1-$100; effort 'auto' and 'ultra' only; Exa defaults $5 auto, $20 ultra) |
| `maxDurationSeconds` | number | no |  | Time cap in seconds (effort 'ultra' only) |
| `waitSeconds` | number | no | `600` | How long to wait for completion before returning the run id (default 600). Call again with runId to keep waiting. |

## monitors

**Exa Monitors**

Manage Exa Monitors: searches that run on a schedule (every 1h to Nd) and send results to an HTTPS webhook. Actions: create, list, get, update (rename, change query/schedule, pause/resume), delete, trigger (run now, even if paused), list_runs, get_run (read a run's results here).

On by default: no. Hints: readOnly: false, destructive: true, idempotent: false, openWorld: true.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `action` | `create` \| `list` \| `get` \| `update` \| `delete` \| `trigger` \| `list_runs` \| `get_run` | yes |  | Operation: create \| list \| get \| update \| delete \| trigger \| list_runs \| get_run |
| `monitorId` | string | no |  | Monitor id (get, update, delete, trigger, list_runs, get_run) |
| `runId` | string | no |  | Run id (get_run) |
| `name` | string | no |  | Display name (create, update) |
| `query` | string | no |  | Search query the monitor runs (create; update) |
| `numResults` | number | no |  | Results per run (default 10) |
| `includeDomains` | array of string | no |  |  |
| `excludeDomains` | array of string | no |  |  |
| `period` | string | no |  | Run interval, e.g. '1h', '6h', '1d', '7d' (minimum 1h). Omit for no schedule. |
| `outputSchema` | object (JSON Schema) | no |  | JSON Schema for a synthesized result per run |
| `webhookUrl` | string | no |  | HTTPS URL that receives run results (create; required by Exa) |
| `status` | `active` \| `paused` | no |  | Pause or resume (update) |
| `limit` | number | no |  | Page size (list, list_runs) |
| `cursor` | string | no |  | Pagination cursor from a previous list call |

## websets

**Exa Websets**

Build Exa Websets: collections of companies, people, articles or papers that match your criteria, with optional extracted fields (enrichments). Creation runs in the background; use get to check progress and list_items to read results. Requires an Exa plan with Websets API access.

On by default: no. Hints: readOnly: false, destructive: false, idempotent: false, openWorld: true.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `action` | `create` \| `list` \| `get` \| `list_items` | yes |  | Operation: create \| list \| get \| list_items |
| `websetId` | string | no |  | Webset id or externalId (get, list_items) |
| `title` | string | no |  | Webset title (create) |
| `query` | string | no |  | What to find, e.g. 'AI security startups in the US' (create) |
| `count` | number | no |  | How many items to find (create, default 10) |
| `entityType` | `company` \| `person` \| `article` \| `research_paper` \| `custom` | no |  | Kind of item to find (create) |
| `entityDescription` | string | no |  | Description of the item kind when entityType is 'custom' |
| `criteria` | array of string | no |  | Up to 5 conditions every item must satisfy (create) |
| `enrichments` | array of objects | no |  | Extra fields to extract for each item (create) |
| `externalId` | string | no |  | Your own id for the Webset (create) |
| `limit` | number | no |  | Page size (list, list_items) |
| `cursor` | string | no |  | Pagination cursor from a previous list call |

## Removed tool names

These names were removed in 0.5.0. Passing them to `--tools` enables the replacement and logs a warning.

| Removed | Replacement |
|---|---|
| `research_paper_search` | `exa_search` |
| `twitter_search` | `exa_search` |
| `company_research` | `exa_search` |
| `competitor_finder` | `exa_search` |
| `crawling` | `web_fetch` |
| `batch_extract` | `web_fetch` |
| `deep_research` | `agent_run` |

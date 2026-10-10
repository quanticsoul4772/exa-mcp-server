# Exa MCP Server

A Model Context Protocol (MCP) server that gives Claude and other MCP clients Exa AI's search, page fetching, cited answers, code search, research agents, scheduled monitors and Websets.

## Features

- **Web search** with filters for research papers, companies, people, news, posts on X and competitors, plus synthesized answers with field-level citations (`outputSchema`)
- **Page fetching** for up to 100 URLs per call, with per-URL failure reporting
- **Cited answers** to direct questions, as prose or structured JSON
- **Code search** across GitHub, docs and Stack Overflow
- **Research agent runs** (Exa Agent API) for multi-step research with a cost cap
- **Monitors**: searches that run on a schedule and post results to a webhook
- **Websets**: collections of companies, people or papers matching your criteria, with extracted fields
- Freshness control (`maxAgeHours`), estimated cost on every response, retries with backoff, response caching, log redaction

## Quick Start

### 1. Get an Exa API key

Sign up at [exa.ai](https://exa.ai/) and create an API key.

### 2. Build

Requires Node.js 20.19 or newer.

```bash
git clone https://github.com/quanticsoul4772/exa-mcp-server.git
cd exa-mcp-server
npm install
npm run build
```

### 3. Add to your MCP client

Claude Code:

```bash
claude mcp add exa -s user -e 'EXA_API_KEY=${EXA_API_KEY}' -- node /path/to/exa-mcp-server/build/index.js
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "exa": {
      "command": "node",
      "args": ["/path/to/exa-mcp-server/build/index.js"],
      "env": { "EXA_API_KEY": "your_api_key_here" }
    }
  }
}
```

## Tools

| Tool | What it does | Exa endpoint | On by default |
|------|--------------|--------------|---------------|
| `exa_search` | Web search with filters, subpages and optional synthesized output. Returns highlights by default; page text on request | `POST /search` | Yes |
| `web_fetch` | Read 1-100 known URLs; reports failed URLs. Default 10,000 characters per URL, at most 100,000 in total | `POST /contents` | Yes |
| `answer_question` | Direct answer with citations; optional structured answer | `POST /answer` | Yes |
| `find_similar` | Pages similar to a URL (Exa marks this endpoint deprecated) | `POST /findSimilar` | Yes |
| `code_search` | Code examples and API usage | `POST /context` | Yes |
| `agent_run` | Multi-step research agent; waits, or returns a run id to resume | `/agent/runs` | No |
| `monitors` | Create, list, get, update, delete monitors; read their runs | `/monitors` | No |
| `websets` | Create and list Websets; read their items (needs Websets API access on your plan) | `/websets/v0/websets` | No |

`agent_run`, `monitors` and `websets` are off by default because they cost more or create resources on your Exa account. Enable them with `--tools`.

### Specialized searches with `exa_search`

Version 0.5.0 folded the separate specialized tools into `exa_search` filters:

| Old tool | Use instead |
|----------|-------------|
| `research_paper_search` | `exa_search` with `category: "publication"` |
| `company_research` | `exa_search` with `category: "company"`, optionally `subpages` and `subpageTarget` |
| `twitter_search` | `exa_search` with `includeDomains: ["x.com", "twitter.com"]` |
| `competitor_finder` | `exa_search` describing the business, with `excludeDomains: [its domain]` |
| `crawling`, `batch_extract` | `web_fetch` |
| `deep_research` | `agent_run` (Exa retired the Research API) |

Old names in `--tools` are mapped to their replacements, with a warning in the log.

### Examples

```jsonc
// Research papers from the last year, with highlights
{ "tool": "exa_search", "arguments": { "query": "load testing LLM inference", "category": "publication", "startPublishedDate": "2025-10-01", "includeHighlights": true } }

// Structured, cited answer from search results
{ "tool": "exa_search", "arguments": { "query": "Exa AI headquarters", "outputSchema": { "type": "object", "properties": { "city": { "type": "string" } } } } }

// Read a long page but return only the 3 passages that answer a question (Voyage)
{ "tool": "web_fetch", "arguments": { "urls": ["https://en.wikipedia.org/wiki/Large_language_model"], "relevantTo": "How do LLMs handle long context?", "topChunks": 3 } }

// Search, then rerank 3x candidates with Voyage and keep the best 5
{ "tool": "exa_search", "arguments": { "query": "Rust HTTP load testing tools", "numResults": 5, "rerank": true } }

// Read several pages, forcing a fresh crawl
{ "tool": "web_fetch", "arguments": { "urls": ["https://example.com/a", "https://example.com/b"], "maxAgeHours": 0, "excludeSections": ["navigation", "footer"] } }

// Research agent with a $2 cap; call again with runId if it is still running
{ "tool": "agent_run", "arguments": { "query": "List open-source load testing tools with their licenses", "effort": "auto", "maxCostDollars": 2 } }

// Daily monitor posting new results to a webhook
{ "tool": "monitors", "arguments": { "action": "create", "query": "performance engineer contract roles", "period": "1d", "webhookUrl": "https://your.server/hook" } }
```

### Tool selection

```bash
exa-mcp-server --list-tools                          # list all tools
exa-mcp-server --tools exa_search,web_fetch,agent_run  # enable only these
exa-mcp-server                                        # tools on by default
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXA_API_KEY` | Yes | - | Exa API key |
| `EXA_BASE_URL` | No | `https://api.exa.ai` | API base URL |
| `EXA_TIMEOUT` | No | `25000` | Request timeout in ms (1000-60000) |
| `EXA_RETRIES` | No | `3` | Retries for network errors and 5xx responses |
| `DEFAULT_NUM_RESULTS` | No | `3` | Results per search when `numResults` is omitted |
| `DEFAULT_MAX_CHARACTERS` | No | `3000` | Text characters per search result when `includePageText` is set |
| `CACHE_ENABLED` | No | `true` | Cache identical requests (skipped when `maxAgeHours` is 0) |
| `CACHE_MAX_SIZE` | No | `100` | Max cached responses |
| `CACHE_TTL_MINUTES` | No | `5` | Cache lifetime |
| `LOG_LEVEL` | No | `ERROR` (production) / `DEBUG` (development) | ERROR, WARN, INFO, DEBUG |
| `NODE_ENV` | No | `development` | Environment mode |
| `REDACT_LOGS` | No | `true` | Redact sensitive data in logs |
| `EXA_USAGE_CSV` | No | unset | If set, append one CSV line per tool call to this file |
| `VOYAGE_API_KEY` | For `rerank` / `relevantTo` | unset | Voyage AI key. Those options return an error without it; nothing else uses Voyage |
| `VOYAGE_RERANK_MODEL` | No | `rerank-3-lite` | Voyage reranker (`rerank-3` for higher quality) |
| `VOYAGE_BASE_URL` | No | `https://api.voyageai.com/v1` | Voyage API base URL |
| `VOYAGE_TIMEOUT` | No | `30000` | Voyage request timeout in ms |

## Development

```bash
npm run build          # compile TypeScript
npm test               # run tests
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run inspector      # try the server in MCP Inspector
```

Source layout:

- `src/index.ts`: entry point and CLI
- `src/server.ts`: builds the MCP server and registers tools (title, description, schema, hints)
- `src/instructions.ts`: guidance sent to clients at initialization
- `src/tools/`: one file per tool; `index.ts` holds the registry and old-name aliases
- `src/utils/`: HTTP client, formatter, cache, rate limiter, logging
- `src/types.ts`: Exa API request and response types
- `src/version.ts`: server version (a test keeps it equal to `package.json`)

### Docker

```bash
docker build -t exa-mcp-server .
docker run -i --rm -e EXA_API_KEY exa-mcp-server
```

## Troubleshooting

- **`EXA_API_KEY environment variable is not set`**: set it in the environment or a `.env` file.
- **HTTP 401 on `websets`**: your Exa plan does not include the Websets API.
- **`agent_run` returns "still running"**: call it again with the returned `runId`.
- **Monitor create rejects the webhook**: the URL must be public HTTPS, not localhost, `.local` or a private IP.
- **Debug logging**: `LOG_LEVEL=DEBUG REDACT_LOGS=false`.

More: [Tool Reference](docs/TOOL_REFERENCE.md), [Exa API docs](https://exa.ai/docs).

## License

MIT. See [LICENSE](LICENSE).

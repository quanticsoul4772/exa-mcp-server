# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Examples directory with configuration examples
- SECURITY.md with security policy
- CHANGELOG.md to track changes
- Enhanced documentation with better organization

### Changed
- Improved README.md with better structure and quick start guide
- Enhanced DEVELOPER_GUIDE.md with contribution guidelines
- Updated TOOL_REFERENCE.md with consistent formatting
- Added table of contents to all documentation files

### Fixed
- Documentation inconsistencies
- Missing information in developer guide

## [0.8.1] - 2026-10-10

### Fixed
- Large results no longer get saved to disk by Claude Code. `web_fetch`, `exa_search` and `agent_run` declare `_meta["anthropic/maxResultSizeChars"]: 150000`; without it, Claude Code replaces results above its default limit (25,000 tokens) with a file reference, and `web_fetch`'s default 100,000-character budget can exceed that. Verified with `claude -p`: 12 Wikipedia pages at the default budget arrived inline.

### Not adopted
- MCP `structuredContent`/`outputSchema`. Measured with `claude -p`: when a result carries `structuredContent`, Claude Code passes only that JSON to the model and drops the text block. The text output's notes (truncation, failed URLs, paging cursors, formatted entity summaries) would be lost. See `claudedocs/improvement-research-2026-10-10.md` section 11.

## [0.8.0] - 2026-10-10

### Added
- Company, person and publication entities are rendered in `exa_search`, `find_similar` and `web_fetch` output: company employees, headquarters, funding total and latest round, revenue, monthly web visits and description; a person's location, roles with dates, and education. They were returned by Exa and dropped.
- `agent_run` `action`: `list` (recent runs with status, cost and query), `cancel` (end a run now), `stop` (end an `ultra` run gracefully, keeping partial output). `run` remains the default.
- `agent_run` inputs: `dataSources` (Exa Connect providers), `inputData` and `inputExclusion` records, `metadata`.
- `monitors` `trigger`: run a monitor now, even if paused.
- `summarySchema` on `exa_search`, `web_fetch` and `find_similar`: a JSON Schema for a structured summary per result.
- `web_fetch` notes when a page's text was cut at the character limit, and says to raise `textMaxCharacters`.

### Changed
- `web_fetch` `relevantTo` fetches up to 200,000 characters of a single page to choose passages from (was 50,000); the 500,000 total across pages is unchanged.
- `agent_run` is marked destructive, since `cancel` and `stop` end a run irreversibly.

## [0.7.0] - 2026-10-10

### Added
- `web_fetch` `relevantTo`: splits each page into passages (`chunkCharacters`, default 1500), scores them against the question with one Voyage rerank call, and returns each page's `topChunks` best passages (default 5) in page order instead of the whole text. With `relevantTo`, up to 50,000 characters per URL (500,000 in total) are fetched to choose from. Live: a long Wikipedia article came back as 3 passages, about 4,000 characters instead of 50,000.
- `exa_search` `rerank`: fetches `rerankCandidates` (default 3 x `numResults`, max 100), reranks them with Voyage against the query, and returns the best `numResults` with a relevance score.
- Voyage token usage is shown under Exa's estimated cost.
- Settings: `VOYAGE_API_KEY`, `VOYAGE_RERANK_MODEL` (default `rerank-3-lite`), `VOYAGE_BASE_URL`, `VOYAGE_TIMEOUT`.

Both options are off unless requested. If requested without `VOYAGE_API_KEY`, or if Voyage fails, the call returns an error naming Voyage; it never falls back to unranked output. The raw Exa response is cached before reranking, so a retry costs no Exa call.

## [0.6.0] - 2026-10-10

### Added
- Tool titles and MCP annotations (read-only, destructive, idempotent, open-world hints) on every tool: the five search/fetch tools are read-only; `agent_run` and `websets` create billable resources; `monitors` can delete.
- Server `instructions` sent at initialization: a short guide to choosing a tool and what costs money.
- CI (`.github/workflows/ci.yml`): typecheck, lint, tests and build on Node 20, 22 and 24; checks that startup writes nothing to stdout and that `--list-tools` works without a key; builds and smoke-tests the Docker image.

### Changed
- Tools are registered with `registerTool` (the deprecated `server.tool` call is gone). Server construction moved to `src/server.ts` so tests can connect a real client.
- Requires Node.js 20.19 or newer (yargs 18, lru-cache 11 and eslint 10 already required it).
- Dockerfile: Node 22, `npm ci --omit=dev`, runs as the `node` user; removed the placeholder `EXA_API_KEY` (it passed validation and caused 401s) and the unused `EXPOSE 3000`.
- Claude Code Review workflow runs on `pull_request` instead of `pull_request_target`. It failed on every PR with "Invalid OIDC token", and `pull_request_target` would run fork PRs with this repository's secrets. Workflows use `actions/checkout@v7`.

### Removed
- Unused modules: `factory`, `healthCheck`, `logger`, `memoryOptimizer`, `optimizedCache`, `requestBatcher`, `urlValidator` (nothing imported them; they still shipped in `build/`), and unused exports (`createExaRequestHandler`, `createCachedRequest`, `globalCache`, `withRateLimit`, type guards).
- Unused dependencies `pino-pretty` and `@types/axios-mock-adapter`.
- Stale files: `.eslintrc.json` (ESLint 10 uses `eslint.config.js`), `config/`, and docs describing removed tools and modules (`docs/API.md`, `docs/API_REFERENCE.md`, `docs/TESTING.md`, `docs/testing/TEST_PLAN*.md`, `docs/development/QWEN.md`, `OPTIMIZATION_REPORT.md`, `DOCUMENTATION_IMPROVEMENTS*.md`).

## [0.5.1] - 2026-10-10

### Fixed
- dotenv printed a banner to stdout at every start, which corrupts the stdio protocol stream. It now loads quietly.
- Progress notifications never reached the client: the server called `notification()` on `McpServer`, which has no such method. Tools now use the SDK's `sendNotification` from the request context, and accept numeric progress tokens.
- Client cancellation was ignored. Requests now carry the abort signal, and `agent_run` stops polling at once. If the cancelled call started the run, the run is cancelled on Exa (the caller never received its id); a run resumed by `runId` keeps going.
- Retries could duplicate billable resources: POSTs to `/agent/runs`, `/monitors` and `/websets` were retried on 5xx and network errors. Only GET and the read-only POST endpoints are retried now, 429 is retried, and `Retry-After` is honored.
- `--list-tools` exited when `EXA_API_KEY` was unset, because the logger loaded the full config.
- Ids are URL-encoded in request paths.
- Fetched content was thrown away: search fetched 3000 characters per result and showed 300, highlights were cut to 200 characters, answer citations to 300, and subpage text was dropped. Everything fetched is now shown.
- Empty result lists were cached, and requests were built three times per call.
- `agent_run` rejects `maxCostDollars` for unmetered efforts and `maxDurationSeconds` outside `ultra` before calling Exa (Exa rejects them).

### Changed
- `exa_search` returns highlights by default instead of page text; `includePageText` or `textMaxCharacters` adds text.
- `web_fetch` keeps the default text within 100,000 characters in total (10,000 per URL, less when many URLs are fetched); an explicit `textMaxCharacters` is honored.
- Deep search types and `exa-research`/`exa-pro` answers use a 300 s timeout.

## [0.5.0] - 2026-10-10

Brought the server in line with the current Exa API. Several default tools were failing on every call.

### Fixed
- `deep_research` called the Exa Research API, which Exa retired (HTTP 410). It is replaced by `agent_run`.
- `answer_question` sent `numResults`, `highlights` and an object for `text`, which `/answer` rejects (HTTP 400). It now sends only supported fields and no longer prints a "Relevance" score (Exa removed it).
- `extras` were sent as booleans with `imageUrls`; Exa expects counts and `imageLinks` (HTTP 400). Affected 5 tools.
- `code_search` read a `results` array, but `/context` returns a single `response` string, so it always reported no results.
- `find_similar` sent content options at the top level, where Exa ignores them; they are now nested under `contents`. Removed the "Similarity" percentage (Exa no longer returns scores).
- Structured output from `exa_search` (`outputSchema`) was discarded; it is now shown with field-level grounding.
- Requests with `maxAgeHours: 0` (force fresh) could be answered from the local cache.
- `/contents` per-URL failures (`statuses`) were not reported.
- The usage CSV defaulted to `/home/agent/workspace/metrics`, which created a stray `\home` folder on Windows. It is now written only when `EXA_USAGE_CSV` is set.
- Reported server version was stuck at 0.3.6.
- Clean installs failed: `ts-jest` 29.3 did not support `jest` 30, and the lockfile omitted `jest-util`, so no tests ran.

### Added
- `agent_run`: Exa Agent API runs with effort, cost and time caps, structured output, and resume by `runId`.
- `monitors`: scheduled searches with webhook delivery (create, list, get, update, delete, list_runs, get_run).
- `websets`: create and list Websets and read their items (requires Websets API access).
- `web_fetch`: fetch 1-100 URLs with section filters, guided highlights and summaries, `snapshotAsOf`, subpages.
- `exa_search`: `deep-lite` search type, `publication` category, subpages, guided summaries and highlights, `moderation`, `systemPrompt`, `objective`, `additionalQueries`, `livecrawlTimeout`.
- `answer_question`: `model`, `systemPrompt`, `outputSchema`, `userLocation`.
- Estimated cost (`costDollars`) on every response that reports it.

### Changed
- `research_paper_search`, `company_research`, `twitter_search` and `competitor_finder` are removed; `exa_search` filters cover them. `crawling` and `batch_extract` are replaced by `web_fetch`. Old names passed to `--tools` map to the replacements with a warning.
- Freshness uses `maxAgeHours` (-1 to 720) instead of the deprecated `livecrawl`. When omitted, Exa uses its cache and crawls live only when nothing is cached; previously most tools forced a live crawl on every call.
- `includeText` / `excludeText` are arrays (Exa's current format; Exa marks them deprecated).
- MCP SDK 1.18 to 1.32, `ts-jest` 29.4.

## [0.3.6] - 2024-01-15

### Added
- Competitor finder tool
- Enhanced error handling
- Debug logging capabilities
- Comprehensive test suite

### Changed
- Improved response formatting
- Better tool registration system
- Enhanced documentation
- Updated dependencies

### Fixed
- Rate limiting issues
- Error message formatting
- Test coverage gaps

## [0.3.5] - 2024-01-10

### Added
- Company research tool
- Twitter search tool
- Research paper search tool
- URL crawling tool
- Tool selection via CLI arguments
- List tools command

### Changed
- Renamed `web_search` to `exa_search` to avoid conflicts
- Improved response formatting for Claude UI
- Enhanced error handling
- Updated documentation

### Fixed
- Schema validation issues
- Response truncation problems
- Tool registration bugs

## [0.3.0] - 2024-01-05

### Added
- Initial release
- Basic web search functionality
- MCP server implementation
- Tool registry system
- Response formatting utilities
- Error handling
- Documentation

### Changed
- N/A (Initial release)

### Fixed
- N/A (Initial release)
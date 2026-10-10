# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run build          # Build TypeScript to JavaScript (build/)
npm run watch          # Watch mode
npm test               # Run all tests
npm run test:coverage  # Tests with coverage report
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run inspector      # Test with MCP Inspector
```

## Architecture Overview

An MCP server (stdio) exposing Exa AI APIs as tools. TypeScript, ES modules (`.js` extensions in imports), `@modelcontextprotocol/sdk`, Zod schemas, Axios.

### Core Components

1. **Entry point** (`src/index.ts`): yargs CLI (`--tools`, `--list-tools`), maps removed tool names to replacements via `resolveToolNames`, then serves `buildServer()` over stdio.
   **Server** (`src/server.ts`): `buildServer(tools)` creates the `McpServer` with `instructions` (`src/instructions.ts`) and registers each tool with `registerTool` (title, description, input schema, annotations). Handlers receive the SDK's `extra` (abort `signal`, `requestId`, `_meta.progressToken`, `sendNotification`).

2. **Tool registry** (`src/tools/index.ts`): a single `toolRegistry` object listing every tool, plus `toolAliases` for names removed in 0.5.0. Tools do not self-register.

3. **Tool builders**:
   - `tool-builder.ts`: `createTool` / `createSearchTool` for single-request POST endpoints. Validates args, caches responses (skipped when the request has `maxAgeHours: 0`), rate-limits, sends progress, formats output.
   - `action-tool.ts`: `createActionTool` for stateful APIs with an `action` argument (create/list/get/...). Never caches. Used by `monitors` and `websets`.
   - `agentRun.ts`: custom handler that creates an Agent API run and polls it.
   - `shared.ts`: shared Zod fields and request helpers (freshness, summary/highlights options, extras).

4. **Tools**:
   - `exa_search` (`/search`): search with filters (category, domains, dates, subpages), guided summaries/highlights, optional `outputSchema` synthesis
   - `web_fetch` (`/contents`): 1-100 URLs, reports per-URL `statuses` failures
   - `answer_question` (`/answer`): cited answer, optional structured answer
   - `find_similar` (`/findSimilar`, deprecated by Exa): content options nested under `contents`
   - `code_search` (`/context`): returns one `response` text block
   - `agent_run` (`/agent/runs`): off by default
   - `monitors` (`/monitors`): off by default
   - `websets` (`/websets/v0/websets`): off by default; needs Websets API access on the Exa plan

5. **Configuration** (`src/config/index.ts`): Zod-validated env config, fail-fast. `EXA_API_KEY` required. See `.env.example`.

   Every tool declares a `title` and `annotations` (readOnly/destructive/idempotent/openWorld hints). `createTool` defaults to read-only; tools that create or delete resources must declare their own.

6. **Voyage** (optional): `src/utils/voyage.ts` (rerank client with retries, `chunkText`) and `src/tools/rerank.ts` (`rerankSearchResults` for `exa_search` `rerank`, `selectRelevantChunks` for `web_fetch` `relevantTo`). Both run in `createTool`'s `postProcess` step, after the raw Exa response is cached. Missing key or Voyage failure is a tool error, never a silent fallback.

7. **Utilities** (`src/utils/`): `formatter.ts` (output text, synthesized output, grounding, cost, `/contents` statuses), `exaClient.ts` (shared Axios client, retries, error handling), `cache.ts` (LRU + TTL), `rateLimiter.ts`, `pinoLogger.ts` (redacted structured logs), `usageLogger.ts` (CSV only when `EXA_USAGE_CSV` is set).

8. **Version** (`src/version.ts`): `SERVER_VERSION` must equal `package.json` version; `src/__tests__/version.test.ts` enforces it.

### Adding a New Tool

1. Create `src/tools/<name>.ts` using `createTool`, `createSearchTool` or `createActionTool`.
2. Add it to `toolRegistry` in `src/tools/index.ts`.
3. Add request/response types to `src/types.ts` if shared.
4. Add tests; endpoint-level tests go in `src/__tests__/integration/tools.e2e.test.ts` (an Express test server records request bodies).

### Exa API Notes (checked 2026-10-10)

- Search types: `instant | fast | auto | deep-lite | deep | deep-reasoning`. Category `publication` replaced `research paper`.
- Freshness: `maxAgeHours` (-1 to 720) and `livecrawlTimeout`; `livecrawl` is deprecated.
- `extras` take integer counts (`links`, `imageLinks`, `richLinks`, `richImageLinks`, `codeBlocks`).
- `/answer` accepts `query`, `text` (boolean), `model`, `systemPrompt`, `outputSchema`, `userLocation`, `stream`.
- The Research API (`/research`) is retired (HTTP 410); use `/agent/runs`.
- Responses include `costDollars`; result `score` fields are gone.
- Spec: https://exa.ai/docs/exa-spec.yaml, index: https://exa.ai/docs/llms.txt

## Testing

- Jest with ts-jest; tests in `src/__tests__/` mirroring source.
- Mock external API calls; never call the live API in tests.
- Run one file: `npx jest path/to/test.ts`.

## Important Notes

- Communicates over stdio with MCP clients.
- Tool names must be unique and avoid conflicts with clients' built-in tools.
- Configuration is validated at startup (fail fast).
- TypeScript targets ES2022 with Node16 module resolution; ESLint requires semicolons.

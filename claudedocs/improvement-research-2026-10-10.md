# Exa MCP Server: improvement research (2026-10-10)

Scope: what to update and improve in `exa-mcp-server` 0.5.0. Four areas:
1. MCP protocol and SDK changes.
2. Exa API features still unused, plus a code-health audit.
3. Voyage AI integration.
4. TypeSafe Jev integration.

Research only. No code was changed.

Sources:
- Four parallel research passes, which cite the spec, SDK, Exa, Voyage and TypeSafe docs.
- Prior notes: `agentic-orchestrator-research/TYPESAFE-INTEGRATION-RESEARCH.md`, `W1-JEV-BRIDGE-SPEC.md`, `upscaler/var/jev-gate.py`.
- Local reproduction of the critical bugs.

## 1. Defects in 0.5.0 (all reproduced locally unless marked)

| # | Severity | Defect | Evidence | Fix |
|---|---|---|---|---|
| D1 | Critical | dotenv prints a banner to **stdout** on every start (`◇ injected env (0) from .env …`). On stdio, stdout must carry only JSON-RPC. | Reproduced: `node build/index.js` prints it before any input. Cause: `config/index.ts:6` `dotenv.config()`, and dotenv 17 defaults to `quiet:false`. | `dotenv.config({ quiet: true })` |
| D2 | Critical | Progress notifications never reach the client. `progress-tracker.ts:24` calls `server.notification()` on `McpServer`, which has no such method in SDK 1.32. The TypeError is caught and logged. | Reproduced: `mcp.d.ts` exposes notifications only on `.server`. The unit tests mock `notification`, so they pass. | Use the handler's `extra.sendNotification`; accept a `string \| number` progress token |
| D3 | High | Client cancellation is ignored. Nothing reads `extra.signal`, so `agent_run` keeps polling for up to 600 s and axios calls are never aborted. | Code read (both MCP and audit passes) | Pass the signal to axios and make the poll sleep abortable |
| D4 | High | Retries can create duplicate billable resources. The axios-retry condition retries POST on any 5xx and on network errors, including `POST /agent/runs`, `/monitors` and `/websets`. 429 is never retried, and `Retry-After` is ignored. | `exaClient.ts:42-46` | Retry only GET and read-only POSTs (search, contents, answer, context). Honor `Retry-After` on 429. |
| D5 | Medium | `--list-tools` fails without `EXA_API_KEY`, because the logger reads the config when its module loads. | Reproduced | Read the log level from the environment, or initialize the logger lazily |
| D6 | Medium | IDs are put into URL paths unescaped. | `agentRun.ts:130`, `monitors.ts`, `websets.ts` | `encodeURIComponent` |
| D7 | Medium | Wasted content and tokens. Search fetches 3000 chars per result but shows 300. Highlights are fetched at 500 and cut to 200. Answer citation text is cut to 300. Subpage text is fetched and dropped. `web_fetch` defaults to 10k chars × up to 100 URLs, with no total budget. | `formatter.ts:69,75,84`, `answer.ts:68`, `webSearch.ts:82` | Search defaults to highlights only. Show whatever is fetched. Add a total output budget. |
| D8 | Low | Timeout is 25 s (60 s max), which may be too short for `deep-reasoning` search and `exa-research` answers (UNVERIFIED durations; Exa's official server allows 300 s). | `config/index.ts:16` | Per-tool timeout |
| D9 | Low | Empty results get cached; `createRequest` runs 3× per call. | `tool-builder.ts:123-165` | Cache only after the empty-result check; build the request once |

## 2. MCP protocol and SDK

Versions found:
- **Spec revisions:** 2025-11-25 and 2026-07-28 (the stateless revision).
- **SDK:** v1 is at 1.32.1, which is installed and speaks up to 2025-11-25. v2 is 2.3.1, split into packages, needs Node 20+ and Zod 4.

| Change | Value | Effort | Note |
|---|---|---|---|
| `server.tool()` → `registerTool()` | H | S | `tool()` is deprecated in 1.32.1. Prerequisite for the rows below. |
| Tool `title` + `annotations` | H | S | The 5 search/fetch tools: readOnly, openWorld. `agent_run`: not idempotent (it bills). `monitors`: destructive (has `delete`). `websets`: not idempotent. |
| `structuredContent` + `outputSchema` | H | M | Machine-readable results next to the text (results list, run id/status/cost). |
| Server `instructions` | M | S | Short guide to choosing a tool and the cost of `agent_run`. |
| Resource links for result URLs | M | S | |
| Elicitation (confirm a costly `agent_run`) | M | M | 2026-07-28 changes how this works (multi-round-trip `input_required`). Wait. |
| Tasks (async calls) for `agent_run` / `websets` | M later | L | **Don't adopt yet.** It's experimental in 1.32, moved to an extension in 2026-07-28, and had a security advisory. The current `runId` resume pattern is what 2026-07-28 recommends. |
| Streamable HTTP + OAuth | L | L | Only if you want to host it remotely. |
| Sampling, logging capability | — | — | Deprecated in 2026-07-28. Keep logging on stderr. |
| Icons | L | M | No field for them in 1.32's `registerTool`. |
| Move to v2 SDK | M | M | Codemod available. Needs Node 20+ (the Dockerfile is on Node 18, which is end-of-life). Do it after the fixes above. |

## 3. Exa features still unused

| Gap | Value | Effort |
|---|---|---|
| Agent **stop/cancel**, list runs, delete. Today a running paid run can't be halted. | H | S |
| Agent `dataSources`, `input.data` / `input.exclusion`, `metadata` | H | S |
| **Entities** in results (company/person/publication). Not typed or rendered, so `category: company`/`people` lose their structured data. | H | S |
| `summary.schema`: a structured summary per result | M | S |
| Dynamic highlights (beta header) | M | S |
| Monitors: trigger-now, `search.contents`, `webhook.events`, metadata | M | S |
| Agent run events (SSE) | M | M |
| Websets: update/delete/cancel, add searches, enrichment CRUD, imports | M | L (and your plan has no Websets access) |
| `code_search` uses `/context`, which is missing from Exa's current docs index. The official server now does code search through `/search`. | M | S (verify first) |
| Answer/search streaming, Batches (Enterprise), `compliance`, `userIdentifier`, `userLocation` object, rich extras | L | S–M |

## 4. Voyage AI

Current models:
- **Embeddings:** `voyage-4` family, `voyage-code-4`, `voyage-context-4`. All take 32K context.
- **Rerankers:** `rerank-3` and `rerank-3-lite` (released 2026-09-30; `rerank-2.5` is now legacy).
- **Pricing:** $0.02–0.12 per million tokens. Free-tier tokens are reported but partly UNVERIFIED.

Call the REST API with `fetch`; the SDK isn't needed. The key is already set (`VOYAGE_API_KEY`).

| Integration | Cost per call (est.) | Value | Effort | Verdict |
|---|---|---|---|---|
| `web_fetch` relevant-chunks mode (`relevantTo`, `topChunks`): split pages into chunks, rerank, return only the top chunks with scores | ~$0.0003–0.0006 per 50k-char page | **H**: ~80% fewer tokens to the LLM | M | **Recommend** |
| `exa_search` rerank (over-fetch 3×, return top-k with scores) | ~$0.0004–0.001 + Exa over-fetch cost | M–H | S–M | **Recommend** (opt-in) |
| Local research memory (vectors in SQLite) | ~$0.001 per page | M | L | Maybe. Overlaps mcp-reasoning's Voyage memory. |
| Monitor novelty filter | tiny | M (monitors only) | M | Maybe. Needs a store. |
| Dedupe near-duplicates | tiny | L | S | Skip |
| Rerank code_search / citations | — | L | — | Reject |
| Semantic response cache | — | Negative | — | **Reject**: it would serve wrong cached results silently (e.g. "Python 3.12" vs "3.13") |

Side finding: mcp-reasoning's default reranker is `rerank-2.5` (legacy). `rerank-3` costs the same.

## 5. TypeSafe Jev

- **Model:** `jev-1.13.0`.
- **Price:** $0.042 per million input tokens; output is free.
- **Limits:** 80 requests/s and 100K tokens/s. State limit is 32k tokens.
- **Known weak spots in 1.13:** Score is poorly calibrated; dates are unreliable; first-option bias in Choice; it **does not treat its input as hostile**.
- **Key:** none is set for this server. It currently lives in `upscaler/var/typesafe.env`.

| Integration | Cost per call | Value | Effort | Verdict |
|---|---|---|---|---|
| Back-test + shadow harness (replay ~50 labeled pages/queries; audit JSONL), the same discipline as W1-J | ~$0.001 total | H | S | **Recommend** (prerequisite) |
| **Prompt-injection screen** on `web_fetch` text (and on search text, answers, synthesized output): a Noul for "text addressed to an AI". Above 0.35 → warning banner; above 0.70 → withhold the body, list the URL. | ~$0.0001 per page | H | M | **Recommend.** A defense layer, never the gate. Its own weak spot (#6) makes the back-test mandatory. |
| Relevance filter (a Noul per result). Withheld URLs are always listed. | ~$0.0004 per 10 results | M | M | Recommend, opt-in, only at `numResults` ≥ 10 |
| Grounding check on answers | ~$0.0002 | M | M | Maybe. `/answer` doesn't map claims to citations. |
| Spend gate for `agent_run` / monitor delete | — | L | — | **Reject Jev.** The server never sees your messages. Use code caps and elicitation instead. |
| Query routing, freshness, credibility score | — | L | — | Reject. Exa `auto` and the caller already decide these; Jev is weak on dates and on Score. |

Failure rule for every Voyage/Jev feature: off unless requested, and never silent.
- If a feature was requested but its key is missing, or its call fails: return `isError` naming the service and the status.
- Jev screens fail open only with a visible line such as `[jev: 529 — NOT screened]`.
- The raw Exa response stays cached, so retrying costs no Exa spend.

## 6. Code health

- **No CI runs build, lint or tests.** `claude-code-review.yml` runs on `pull_request_target` with secrets, so a fork's PR content could inject instructions.
- **Dockerfile:**
  - Uses `node:18-alpine` (Node 18 is end-of-life) and the deprecated `npm ci --production`.
  - Bakes in `ENV EXA_API_KEY=your-api-key-here`, which passes validation, so the server starts and then fails with 401s.
  - Also: `engines >=18` is wrong, since yargs 18, lru-cache 11 and eslint 10 need Node 20.19+.
- **One rate limiter for everything** (100/min). Exa's documented limits differ per endpoint: 10 QPS search, 5 deep, 100 contents, 5 agent.
- **Defaults and redaction:**
  - The default log level is DEBUG unless `NODE_ENV=production`.
  - Redaction doesn't cover `x-api-key`. That's latent: headers aren't logged today.
- **Dead code that ships in `build/`:**
  - Modules: `factory.ts`, `healthCheck.ts`, `memoryOptimizer.ts`, `optimizedCache.ts`, `requestBatcher.ts`, `urlValidator.ts`, `logger.ts`.
  - Dead exports, including `enhanceToolHandler`, whose `console.log` would write to stdout.
  - Stale files: `.eslintrc.json`, `config/codebuff.json`, duplicate docs.
- **Duplicated logic:** validation, error-status mapping and usage logging are copied in three builders; `ExaList` / `pageNote` exist in two tools.
- **Dependencies:**
  - Remove `pino-pretty` (unused) and `@types/axios-mock-adapter` (deprecated stub).
  - dotenv 18 is available (breaking; moves the banner to stderr).
  - Zod 4 is available; SDK 1.32 accepts it.
  - TypeScript 7 is blocked by ts-jest and typescript-eslint.
- **Test gaps:**
  - nothing checks that startup writes only protocol output to stdout;
  - `resolveToolNames`;
  - progress with a real `McpServer`;
  - retry and 429 policy;
  - the fresh-content cache bypass;
  - most monitors/websets actions;
  - `agent_run` resume, cancel and abort.

## 7. Answers and live checks (2026-10-10, same day)

User decisions:
- **Jev key:** the server will read `TYPESAFE_API_KEY` from the environment. The user env var is now set (copied from `upscaler/var/typesafe.env`). That key was printed into a session transcript by mistake and **should be rotated**.
- **Hosting:** stays local stdio. HTTP/OAuth and the v2 SDK are not needed for hosting reasons.

Existing work checked:
- **Voyage memory overlap: none.** mcp-reasoning embeds and reranks its own *reasoning sessions* (`src/modes/memory/search.rs`); parallax memory holds curated skills, lessons and facts. Neither stores fetched web pages, so a research-memory tool would not duplicate them. It stays "maybe" on value.
- **Injection test set: none exists locally.** What exists:
  - regex scanners with small unit fixtures (`devharness/runtime/devharness/oss/injection_scan.py`, `agent-harness-v2/.github/external-repo/injection-patterns.txt`);
  - the W3 survey's 12 benign hits.

  Public option found (parallax research): **MAlmasabi/Indirect-Prompt-Injection-BIPIA-GPT** on Hugging Face. Details:
  - 70k JSON rows, balanced: 35k malicious from BIPIA, 35k benign generated by GPT-4o-mini.
  - Each row has a `context` field (the external text) and a 0/1 `label`.
  - Its license is unstated, so check it before use.
  - Others: microsoft/BIPIA (its Web QA and Summarization parts can't be redistributed) and InjecAgent (1,054 cases, but formatted as tool outputs rather than page text).
  - Caveat: the benign half is LLM-generated, so it is not a substitute for real fetched pages. Sample real `web_fetch` pages for false-positive testing as well.

Live checks:

| Check | Result |
|---|---|
| Exa `/context` | **Works** (200, 1.5 s). Keep `code_search`. |
| Agent `stop` / `cancel` / `events` | Endpoints exist (404 `RUN_NOT_FOUND` for a fake id, not route-not-found). List runs works. |
| Monitor `trigger` | Endpoint exists (404 monitor not found for a fake id). |
| Entities | `category: company` returns `entities` with structured company properties. Confirmed missing from our output. |
| Voyage rerank, 60k-char page in 30 chunks of 2,000 chars (~14.8k tokens) | `rerank-3-lite` 0.27 s; `rerank-3` 0.26 s. Same top chunk. |
| Jev noul, ~9.6k-token state | 0.18–0.20 s. Benign page: 0.01. Same page with one blatant injected line in the middle: 0.99. |
| Parallax `research` | **Failed: Anthropic credit balance too low.** Parallax and mcp-reasoning need credits. |

Jev reading: on a blatant injection it separates cleanly at 0.2 s for 10k tokens, so latency is not a concern. One obvious needle says nothing about subtle or adversarial injections (Jev weak spot #6). The back-test is still required.

## 8. Open questions settled (parallax research + primary sources)

- **Dataset licenses.**
  - MAlmasabi/Indirect-Prompt-Injection-BIPIA-GPT is **CC BY-SA 4.0** (Hugging Face API metadata). Back-testing is allowed with attribution. Share-alike applies only if a derived dataset is redistributed.
  - microsoft/BIPIA's code is **MIT**. GitHub reports NOASSERTION because a `NOTICE.md` sits alongside the license. Its Web QA and Summarization data must be fetched from the original sources.
  - Fine for a private back-test.
- **Voyage free tier:** 200M free tokens per account, including the rerank models, one-time (third-party listing plus the pricing page; not confirmed on Voyage's own page for `rerank-3` specifically).
- **Voyage data use (from `voyageai.com/tos`, quoted):**
  - **By default, Voyage may use API inputs "to train, improve, and otherwise further develop the Service (such as by training the artificial intelligence models we use)"**, under a perpetual, irrevocable license.
  - Opting out is done on the website, needs a payment method on file, covers only content sent after opting out, **and may void free-tier credits.**
  - The retention period without an opt-out is not stated.
  - The user already pays for Voyage, so a payment method is on file. The opt-out is just the dashboard toggle: Voyage dashboard → Terms of Service (bottom of the nav) → toggle at the bottom of the page. Losing free credits is moot for a paying account.
  - This already applies to mcp-reasoning, which sends reasoning-session text to Voyage today. Any Voyage feature here would send fetched page text and queries too. **Decide on the opt-out before building Voyage features.**

## 9. Research plan (next steps, before any build)

1. Assemble the injection back-test set:
   - ~100 BIPIA-GPT rows (half malicious);
   - ~50 real pages from `web_fetch`;
   - a handful of hand-written subtle injections (hidden text, instructions disguised as documentation, base64-encoded).
2. Run the Jev back-test offline and record ROC and thresholds before any design. This is the W1-J shadow-first discipline.
3. User picks the tiers. Suggested order, by value per effort:
   - **Tier 1:** fixes D1–D9.
   - **Tier 2:** `registerTool` with titles, annotations and instructions; CI; Node 20+/Dockerfile; remove dead code.
   - **Tier 3:** agent stop/cancel/dataSources, entities, output-budget defaults.
   - **Tier 4:** `structuredContent`.
   - **Tier 5:** Voyage relevant-chunks + rerank (opt-in).
   - **Tier 6:** Jev injection screen in shadow mode (after the back-test).
   - **Later:** tasks, elicitation, v2 SDK.

## 10. Build order (decided with parallax `decide`, 2026-10-10)

Scores (weighing correctness, value per effort, dependencies, rework risk), in build order:

| Order | Item | Score |
|---|---|---|
| 1 | Tier 1: fixes D1–D9 | 90 |
| 2 | Tier 2: `registerTool` + titles, annotations, instructions; CI; Node 20+; dead-code removal | 72 |
| 3 | Tier 5: Voyage relevant-chunks + rerank | 48 |
| 4 | Tier 3: agent stop/cancel/dataSources, entities, output budget | 45 |
| 5 | Tier 4: `structuredContent` | 30 |
| 6 | Tier 6: Jev injection screen, after the back-test | 28 |

Correction to parallax's reasoning: Tier 1 does not depend on Tier 2. SDK 1.x `server.tool` handlers already receive `extra.signal` and `extra.sendNotification`.

User decisions: no Voyage opt-out step; no key rotation.


## 11. Tier 4 (structuredContent) measured and dropped (2026-10-10)

**Measurement.** `claude -p --model haiku` with only this server, after `exa_search` was given an `outputSchema` and returned both a formatted text block and `structuredContent`. The model was asked to repeat the tool result exactly. It received **one part: the `structuredContent` JSON**. The text block never reached it. Claude Code's MCP docs do not document this.

**Consequence.** In Claude Code, adopting `structuredContent` replaces the text output. Everything the text adds would disappear unless rebuilt as JSON fields:
- truncation notes;
- the failed-URL list;
- paging cursors with instructions;
- formatted company and person summaries (the raw entity data includes large web-traffic arrays).

**Decision** (parallax `decide`, causal methodology):

| Option | Score |
|---|---|
| Drop Tier 4 | 82 |
| Opt-in flag | 47 |
| Adopt everywhere and replicate every note as JSON | 24 |

Claude Code is the only client, so adopting would be a net loss.

**Related fix shipped instead (0.8.1).** Claude Code saves MCP results above its default limit (25,000 tokens, `MAX_MCP_OUTPUT_TOKENS`) to disk and gives the model a file reference. A tool can raise its own limit with `_meta["anthropic/maxResultSizeChars"]`, up to 500,000 (https://code.claude.com/docs/en/mcp.md, "Raise the limit for a specific tool"). `web_fetch`, `exa_search` and `agent_run` now declare 150,000.

Verified with `claude -p`: 12 Wikipedia pages at `web_fetch`'s default 100,000-character budget arrived inline.

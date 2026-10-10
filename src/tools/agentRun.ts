import { AxiosInstance } from "axios";
import { z } from "zod";
import { ToolRegistry, ToolHandlerExtra, ToolResult } from "./config.js";
import { ProgressTracker, extractToolContext } from "./progress-tracker.js";
import { getSharedExaClient, handleExaError } from "../utils/exaClient.js";
import { getGlobalRateLimiter } from "../utils/rateLimiter.js";
import { createRequestLogger, generateRequestId, logWarn } from "../utils/pinoLogger.js";
import { logExaUsage } from "../utils/usageLogger.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { ExaCostDollars, ExaGrounding } from "../types.js";

/** How often a run's status is polled (tests lower this) */
export const agentRunTiming = { pollIntervalMs: 5000 };

type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExaAgentRun {
  id: string;
  status: AgentRunStatus;
  stopReason: string | null;
  /** The canonicalized create request, echoed back */
  request?: { query?: string; effort?: string } | null;
  createdAt?: string;
  completedAt?: string | null;
  output?: {
    text?: string;
    structured?: unknown;
    grounding?: ExaGrounding[];
  } | null;
  costDollars?: ExaCostDollars;
}

const TERMINAL: ReadonlySet<AgentRunStatus> = new Set(['completed', 'failed', 'cancelled']);

/** Exa Connect data providers an agent run can query (max 5 per run) */
export const DATA_SOURCES = ['fiber', 'financial_datasets', 'similarweb', 'baselayer', 'affiliate', 'particle', 'jinko', 'polymarket', 'macrobond'] as const;

const agentRunSchema = z.object({
  action: z.enum(['run', 'cancel', 'stop', 'list']).optional().default('run')
    .describe("run (default): start a run, or resume waiting on runId. cancel: end runId now. stop: end an 'ultra' runId gracefully, keeping partial output. list: recent runs"),
  query: z.string().min(1).optional()
    .describe("The research task or question. Required to start a run."),
  runId: z.string().min(1).optional()
    .describe("An existing run: resume waiting on it (action run), or cancel/stop it"),
  dataSources: z.array(z.enum(DATA_SOURCES)).min(1).max(5).optional()
    .describe("Extra data providers for the agent to query (Exa Connect), e.g. ['similarweb', 'financial_datasets']"),
  inputData: z.array(z.record(z.any())).optional()
    .describe("Records for the agent to work from, e.g. a list of companies to enrich"),
  inputExclusion: z.array(z.record(z.any())).optional()
    .describe("Records the agent must leave out of its results, e.g. companies already known"),
  metadata: z.record(z.string()).optional()
    .describe("Your own key/value labels stored with the run"),
  limit: z.coerce.number().int().min(1).max(100).optional()
    .describe("With action list: runs per page"),
  cursor: z.string().optional()
    .describe("With action list: cursor from the previous page"),
  effort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh', 'auto', 'ultra']).optional()
    .describe("How much work the agent does (Exa default 'auto'). Higher effort costs more."),
  systemPrompt: z.string().optional()
    .describe("Extra instructions for the agent's output or behavior"),
  outputSchema: z.record(z.any()).optional()
    .describe("JSON Schema for structured output (returned alongside the text answer)"),
  previousRunId: z.string().optional()
    .describe("A completed run to continue from"),
  maxCostDollars: z.coerce.number().min(1).max(100).optional()
    .describe("Cost cap in dollars ($1-$100; effort 'auto' and 'ultra' only; Exa defaults $5 auto, $20 ultra)"),
  maxDurationSeconds: z.coerce.number().int().min(300).max(10800).optional()
    .describe("Time cap in seconds (effort 'ultra' only)"),
  waitSeconds: z.coerce.number().int().min(0).max(1800).optional().default(600)
    .describe("How long to wait for completion before returning the run id (default 600). Call again with runId to keep waiting.")
});

type AgentRunArgs = z.infer<typeof agentRunSchema>;

function buildCreateRequest(args: AgentRunArgs): Record<string, unknown> {
  const budget = {
    ...(args.maxCostDollars !== undefined && { maxCostDollars: args.maxCostDollars }),
    ...(args.maxDurationSeconds !== undefined && { maxDurationSeconds: args.maxDurationSeconds })
  };
  return {
    query: args.query,
    ...(args.effort && { effort: args.effort }),
    ...(args.systemPrompt && { systemPrompt: args.systemPrompt }),
    ...(args.outputSchema && { outputSchema: args.outputSchema }),
    ...(args.previousRunId && { previousRunId: args.previousRunId }),
    ...(Object.keys(budget).length > 0 && { budget }),
    ...(args.dataSources && { dataSources: args.dataSources.map(provider => ({ provider })) }),
    ...((args.inputData || args.inputExclusion) && {
      input: {
        ...(args.inputData && { data: args.inputData }),
        ...(args.inputExclusion && { exclusion: args.inputExclusion })
      }
    }),
    ...(args.metadata && { metadata: args.metadata })
  };
}

/**
 * Format a run that reached a terminal status
 */
export function formatAgentRun(run: ExaAgentRun): string {
  const lines: string[] = [`## Agent Run ${run.id}`, '', `Status: ${run.status}${run.stopReason ? ` (${run.stopReason})` : ''}`, ''];
  if (run.output?.text) {
    lines.push(run.output.text, '');
  }
  if (run.output?.structured !== undefined && run.output.structured !== null) {
    lines.push(ResponseFormatter.formatSynthesizedOutput(run.output.structured, run.output.grounding));
  } else if (run.output?.grounding?.length) {
    lines.push(ResponseFormatter.formatGrounding(run.output.grounding), '');
  }
  const cost = ResponseFormatter.formatCost(run.costDollars);
  if (cost) lines.push(cost);
  return lines.join('\n');
}

/**
 * Wait for ms, ending early (with an error) if the signal aborts
 */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * On client cancellation: cancel a run this call created (the caller never
 * received its id, so it could not be resumed and would spend to its cap).
 * A run the caller resumed by runId keeps going; the caller has its id.
 * Returns a note describing what happened.
 */
export async function handleCancel(
  client: Pick<AxiosInstance, 'post'>,
  runId: string | undefined,
  createdHere: boolean
): Promise<string> {
  if (!runId) return "no run was created";
  if (!createdHere) return `run ${runId} continues on Exa; resume with runId`;
  try {
    // Deliberately not passing the aborted signal: this request must go out.
    // /cancel, not /stop: Exa's graceful stop works only for 'ultra' runs.
    await client.post(`/agent/runs/${encodeURIComponent(runId)}/cancel`, {});
    return `run ${runId} was cancelled on Exa`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `run ${runId} could NOT be cancelled (${detail}); it continues on Exa until its cost cap`;
  }
}

interface ExaRunList {
  data: ExaAgentRun[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * cancel / stop / list: single requests, no polling
 */
async function runAction(
  args: AgentRunArgs,
  signal: AbortSignal | undefined,
  logger: ReturnType<typeof createRequestLogger>
): Promise<ToolResult> {
  const client = getSharedExaClient();
  const opts = signal ? { signal } : {};
  logger.start(`agent_run ${args.action}`);
  try {
    if (args.action === 'list') {
      await getGlobalRateLimiter().queue();
      const page = (await client.get<ExaRunList>('/agent/runs', {
        ...opts,
        params: { ...(args.limit && { limit: args.limit }), ...(args.cursor && { cursor: args.cursor }) }
      })).data;
      logger.complete();
      if (page.data.length === 0) return textResult('No agent runs.');
      const lines = page.data.map(r => {
        const cost = typeof r.costDollars?.total === 'number' ? `, $${r.costDollars.total.toFixed(4)}` : '';
        const query = typeof r.request?.query === 'string' ? ` "${r.request.query.slice(0, 80)}"` : '';
        return `- ${r.id}: ${r.status}${r.stopReason ? ` (${r.stopReason})` : ''}${cost}, created ${r.createdAt}${query}`;
      });
      const more = page.hasMore && page.nextCursor ? `\nMore available: cursor "${page.nextCursor}"` : '';
      return textResult(`${page.data.length} run(s):\n${lines.join('\n')}${more}`);
    }

    if (!args.runId) {
      return textResult(`Invalid arguments for agent_run: runId is required for action '${args.action}'`, true);
    }
    await getGlobalRateLimiter().queue();
    const run = (await client.post<ExaAgentRun>(`/agent/runs/${encodeURIComponent(args.runId)}/${args.action}`, {}, opts)).data;
    logExaUsage('agent_run', 'ok', args.action ?? '');
    logger.complete();
    return textResult(formatAgentRun(run));
  } catch (error) {
    logExaUsage('agent_run', 'error', String((error as Error)?.message ?? '').slice(0, 80));
    return handleExaError(error, 'agent_run', logger);
  }
}

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], ...(isError && { isError: true }) };
}

export const agentRunTool: ToolRegistry = {
  name: "agent_run",
  title: "Exa Research Agent",
  // Starts billed runs; cancel/stop end a run irreversibly
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  description: "Run an Exa research agent for multi-step research, list building, and structured output with citations. Slower and costlier than exa_search or answer_question (runs can take minutes and cost dollars; set effort and maxCostDollars). Waits up to waitSeconds, then returns the run id; call again with runId to keep waiting. Cancelling a call that started a run cancels that run on Exa; cancelling a call that resumed a run (runId) leaves it running.",
  schema: agentRunSchema,
  enabled: false,
  handler: async (args: Record<string, unknown>, extra?: ToolHandlerExtra) => {
    const context = extractToolContext(extra);
    const requestId = context.requestId || generateRequestId();
    const logger = createRequestLogger(requestId, "agent_run", context.requestId);

    const validation = agentRunSchema.safeParse(args);
    if (!validation.success) {
      return textResult(`Invalid arguments for agent_run: ${validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`, true);
    }
    const validated = validation.data;
    if (validated.action !== 'run') {
      return runAction(validated, context.signal, logger);
    }
    if (!validated.query && !validated.runId) {
      return textResult("Invalid arguments for agent_run: provide query (new run) or runId (existing run)", true);
    }
    // Exa accepts budget caps only for metered efforts ('auto', the default, and 'ultra')
    const metered = validated.effort === undefined || validated.effort === 'auto' || validated.effort === 'ultra';
    if (validated.maxCostDollars !== undefined && !metered) {
      return textResult(`Invalid arguments for agent_run: maxCostDollars applies only to effort 'auto' or 'ultra', not '${validated.effort}'`, true);
    }
    if (validated.maxDurationSeconds !== undefined && validated.effort !== 'ultra') {
      return textResult("Invalid arguments for agent_run: maxDurationSeconds applies only to effort 'ultra'", true);
    }

    const client = getSharedExaClient();
    const progress = new ProgressTracker(100, context.progressToken, context.sendNotification);
    const signal = context.signal;
    const reqOpts = signal ? { signal } : {};
    let runId = validated.runId;
    // True when this call started the run: the caller has not seen its id yet
    let createdHere = false;

    try {
      if (!runId) {
        logger.start(`Agent run: "${validated.query}"`);
        await getGlobalRateLimiter().queue();
        const created = await client.post<ExaAgentRun>('/agent/runs', buildCreateRequest(validated), reqOpts);
        runId = created.data.id;
        createdHere = true;
        logger.log(`Agent run created: ${runId}`);
        await progress.update(1, `Run ${runId} created`);
      } else {
        logger.start(`Agent run resume: ${runId}`);
      }

      const deadline = Date.now() + validated.waitSeconds * 1000;
      for (;;) {
        await getGlobalRateLimiter().queue();
        const run = (await client.get<ExaAgentRun>(`/agent/runs/${encodeURIComponent(runId)}`, reqOpts)).data;

        if (TERMINAL.has(run.status)) {
          await progress.complete(`Run ${run.status}`);
          logExaUsage("agent_run", run.status === 'completed' ? "ok" : "error", run.stopReason ?? undefined);
          logger.complete();
          return textResult(formatAgentRun(run), run.status !== 'completed');
        }

        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          logExaUsage("agent_run", "ok", "still_running");
          logger.complete();
          return textResult(`Agent run ${runId} is still ${run.status}. Call agent_run with runId "${runId}" to keep waiting.`);
        }

        const elapsedPct = Math.min(99, Math.max(1, Math.round(100 - (remainingMs / (validated.waitSeconds * 1000)) * 100)));
        await progress.update(elapsedPct, `Run ${run.status}...`);
        await abortableSleep(Math.min(agentRunTiming.pollIntervalMs, remainingMs), signal);
      }
    } catch (error) {
      if (signal?.aborted) {
        const note = await handleCancel(client, runId, createdHere);
        logWarn(`agent_run cancelled by client: ${note}`);
        logExaUsage("agent_run", "cancelled", runId ?? "");
        return textResult(`agent_run cancelled: ${note}.`, true);
      }
      const err = error as { response?: { status?: number }; message?: string };
      const statusCode = err?.response?.status;
      const status = statusCode === 429 ? "rate_limit" : statusCode === 402 ? "quota_error" : "error";
      logExaUsage("agent_run", status, String(err?.message ?? "").slice(0, 80));
      return handleExaError(error, "agent_run", logger);
    }
  }
};

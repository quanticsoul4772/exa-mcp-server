import { z } from "zod";
import { ToolRegistry, ToolHandlerExtra, ToolResult } from "./config.js";
import { ProgressTracker, extractToolContext } from "./progress-tracker.js";
import { getSharedExaClient, handleExaError } from "../utils/exaClient.js";
import { getGlobalRateLimiter } from "../utils/rateLimiter.js";
import { createRequestLogger, generateRequestId } from "../utils/pinoLogger.js";
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

const agentRunSchema = z.object({
  query: z.string().min(1).optional()
    .describe("The research task or question. Required unless runId is given."),
  runId: z.string().min(1).optional()
    .describe("Resume waiting on an existing run (from an earlier agent_run call) instead of starting a new one"),
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
    ...(Object.keys(budget).length > 0 && { budget })
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

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], ...(isError && { isError: true }) };
}

export const agentRunTool: ToolRegistry = {
  name: "agent_run",
  description: "Run an Exa research agent for multi-step research, list building, and structured output with citations. Slower and costlier than exa_search or answer_question (runs can take minutes and cost dollars; set effort and maxCostDollars). Waits up to waitSeconds, then returns the run id; call again with runId to keep waiting.",
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
    if (!validated.query && !validated.runId) {
      return textResult("Invalid arguments for agent_run: provide query (new run) or runId (existing run)", true);
    }

    const client = getSharedExaClient();
    const progress = new ProgressTracker(100, context.progressToken, context.server);

    try {
      let runId = validated.runId;
      if (!runId) {
        logger.start(`Agent run: "${validated.query}"`);
        await getGlobalRateLimiter().queue();
        const created = await client.post<ExaAgentRun>('/agent/runs', buildCreateRequest(validated));
        runId = created.data.id;
        logger.log(`Agent run created: ${runId}`);
        await progress.update(1, `Run ${runId} created`);
      } else {
        logger.start(`Agent run resume: ${runId}`);
      }

      const deadline = Date.now() + validated.waitSeconds * 1000;
      for (;;) {
        await getGlobalRateLimiter().queue();
        const run = (await client.get<ExaAgentRun>(`/agent/runs/${runId}`)).data;

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
        await new Promise(resolve => setTimeout(resolve, Math.min(agentRunTiming.pollIntervalMs, remainingMs)));
      }
    } catch (error) {
      const err = error as { response?: { status?: number }; message?: string };
      const statusCode = err?.response?.status;
      const status = statusCode === 429 ? "rate_limit" : statusCode === 402 ? "quota_error" : "error";
      logExaUsage("agent_run", status, String(err?.message ?? "").slice(0, 80));
      return handleExaError(error, "agent_run", logger);
    }
  }
};

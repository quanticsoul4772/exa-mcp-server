import { z } from "zod";
import { createActionTool, pathSegment, requireArg } from "./action-tool.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { ExaGrounding, ExaSearchResult } from "../types.js";

interface ExaMonitor {
  id: string;
  name: string | null;
  status: 'active' | 'paused' | 'disabled';
  search: { query: string; numResults?: number; includeDomains?: string[]; excludeDomains?: string[] };
  trigger: { type: 'interval'; period: string } | null;
  webhook: { url: string; events?: string[] };
  nextRunAt: string | null;
  createdAt: string;
  webhookSecret?: string;
}

interface ExaMonitorRun {
  id: string;
  monitorId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  failReason: string | null;
  createdAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  output: {
    results: ExaSearchResult[] | null;
    content?: unknown;
    grounding?: ExaGrounding[] | null;
  } | null;
}

interface ExaList<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

const monitorsSchema = z.object({
  action: z.enum(['create', 'list', 'get', 'update', 'delete', 'list_runs', 'get_run'])
    .describe("Operation: create | list | get | update | delete | list_runs | get_run"),
  monitorId: z.string().optional().describe("Monitor id (get, update, delete, list_runs, get_run)"),
  runId: z.string().optional().describe("Run id (get_run)"),
  name: z.string().optional().describe("Display name (create, update)"),
  query: z.string().min(1).optional().describe("Search query the monitor runs (create; update)"),
  numResults: z.coerce.number().int().min(1).max(100).optional().describe("Results per run (default 10)"),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
  period: z.string().regex(/^\d+[hd]$/).optional()
    .describe("Run interval, e.g. '1h', '6h', '1d', '7d' (minimum 1h). Omit for no schedule."),
  outputSchema: z.record(z.any()).optional()
    .describe("JSON Schema for a synthesized result per run"),
  webhookUrl: z.string().url().optional()
    .describe("HTTPS URL that receives run results (create; required by Exa)"),
  status: z.enum(['active', 'paused']).optional().describe("Pause or resume (update)"),
  limit: z.coerce.number().int().min(1).max(100).optional().describe("Page size (list, list_runs)"),
  cursor: z.string().optional().describe("Pagination cursor from a previous list call")
});

function describeMonitor(m: ExaMonitor): string {
  const schedule = m.trigger ? `every ${m.trigger.period}` : 'no schedule';
  const next = m.nextRunAt ? `, next run ${m.nextRunAt}` : '';
  return `- ${m.id}${m.name ? ` "${m.name}"` : ''}: ${m.status}, ${schedule}${next}\n  query: ${m.search.query}\n  webhook: ${m.webhook.url}`;
}

function describeRun(run: ExaMonitorRun): string {
  const lines = [`## Monitor run ${run.id}`, '', `Status: ${run.status}${run.failReason ? ` (${run.failReason})` : ''}`, `Created: ${run.createdAt}`];
  if (run.durationMs) lines.push(`Duration: ${run.durationMs} ms`);
  if (run.output?.content !== undefined && run.output.content !== null) {
    lines.push('', ResponseFormatter.formatSynthesizedOutput(run.output.content, run.output.grounding));
  }
  if (run.output?.results?.length) {
    lines.push('', ...run.output.results.map((r, i) => ResponseFormatter.formatSearchResult(r, i + 1)));
  }
  return lines.join('\n');
}

function pageNote(page: ExaList<unknown>): string {
  return page.hasMore && page.nextCursor ? `\nMore available: cursor "${page.nextCursor}"` : '';
}

export const monitorsTool = createActionTool({
  name: "monitors",
  title: "Exa Monitors",
  // Bundles create/update/delete, so it carries the worst-case hints
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  description: "Manage Exa Monitors: searches that run on a schedule (every 1h to Nd) and send results to an HTTPS webhook. Actions: create, list, get, update (rename, change query/schedule, pause/resume), delete, list_runs, get_run (read a run's results here).",
  schema: monitorsSchema,
  enabled: false,
  run: async (args, exa) => {
    const pageParams = { ...(args.limit && { limit: args.limit }), ...(args.cursor && { cursor: args.cursor }) };
    const searchFields = {
      ...(args.query && { query: args.query }),
      ...(args.numResults && { numResults: args.numResults }),
      ...(args.includeDomains && { includeDomains: args.includeDomains }),
      ...(args.excludeDomains && { excludeDomains: args.excludeDomains })
    };

    switch (args.action) {
      case 'create': {
        const body = {
          ...(args.name && { name: args.name }),
          search: { ...searchFields, query: requireArg(args.query, 'query', 'create') },
          ...(args.period && { trigger: { type: 'interval', period: args.period } }),
          ...(args.outputSchema && { outputSchema: args.outputSchema }),
          webhook: { url: requireArg(args.webhookUrl, 'webhookUrl', 'create') }
        };
        const m = await exa.post<ExaMonitor>('/monitors', body);
        const secret = m.webhookSecret ? `\n\nWebhook secret (shown only once, store it to verify deliveries): ${m.webhookSecret}` : '';
        return `Monitor created:\n${describeMonitor(m)}${secret}`;
      }
      case 'list': {
        const page = await exa.get<ExaList<ExaMonitor>>('/monitors', pageParams);
        return page.data.length
          ? `${page.data.length} monitor(s):\n${page.data.map(describeMonitor).join('\n')}${pageNote(page)}`
          : 'No monitors.';
      }
      case 'get': {
        const m = await exa.get<ExaMonitor>(`/monitors/${pathSegment(requireArg(args.monitorId, 'monitorId', 'get'))}`);
        return describeMonitor(m);
      }
      case 'update': {
        const id = requireArg(args.monitorId, 'monitorId', 'update');
        const body = {
          ...(args.name && { name: args.name }),
          ...(Object.keys(searchFields).length > 0 && { search: searchFields }),
          ...(args.period && { trigger: { type: 'interval', period: args.period } }),
          ...(args.outputSchema && { outputSchema: args.outputSchema }),
          ...(args.webhookUrl && { webhook: { url: args.webhookUrl } }),
          ...(args.status && { status: args.status })
        };
        const m = await exa.patch<ExaMonitor>(`/monitors/${pathSegment(id)}`, body);
        return `Monitor updated:\n${describeMonitor(m)}`;
      }
      case 'delete': {
        const id = requireArg(args.monitorId, 'monitorId', 'delete');
        await exa.delete(`/monitors/${pathSegment(id)}`);
        return `Monitor ${id} deleted.`;
      }
      case 'list_runs': {
        const id = requireArg(args.monitorId, 'monitorId', 'list_runs');
        const page = await exa.get<ExaList<ExaMonitorRun>>(`/monitors/${pathSegment(id)}/runs`, pageParams);
        return page.data.length
          ? `${page.data.length} run(s) for ${id}:\n${page.data.map(r => `- ${r.id}: ${r.status}${r.failReason ? ` (${r.failReason})` : ''}, ${r.createdAt}`).join('\n')}${pageNote(page)}`
          : `No runs yet for ${id}.`;
      }
      case 'get_run': {
        const id = requireArg(args.monitorId, 'monitorId', 'get_run');
        const runId = requireArg(args.runId, 'runId', 'get_run');
        return describeRun(await exa.get<ExaMonitorRun>(`/monitors/${pathSegment(id)}/runs/${pathSegment(runId)}`));
      }
    }
  }
});

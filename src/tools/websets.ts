import { z } from "zod";
import { createActionTool, pathSegment, requireArg } from "./action-tool.js";

/** Websets live under their own base path on the Exa API host */
const WEBSETS_BASE = '/websets/v0/websets';

interface ExaWebset {
  id: string;
  status: 'idle' | 'pending' | 'running' | 'paused';
  title: string | null;
  externalId: string | null;
  dashboardUrl?: string;
  searches?: Array<{ id: string; status: string; query?: string; progress?: { found?: number; completion?: number } }>;
  enrichments?: Array<{ id: string; status: string; description?: string; format?: string }>;
  createdAt: string;
}

interface ExaWebsetItem {
  id: string;
  properties: {
    type: string;
    url: string;
    description?: string;
    [key: string]: unknown;
  };
  evaluations?: Array<{ criterion: string; satisfied: 'yes' | 'no' | 'unclear'; reasoning?: string }>;
  enrichments?: Array<{ format: string; status: string; result: string[] | null; enrichmentId: string }> | null;
}

interface ExaList<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

const websetsSchema = z.object({
  action: z.enum(['create', 'list', 'get', 'list_items'])
    .describe("Operation: create | list | get | list_items"),
  websetId: z.string().optional().describe("Webset id or externalId (get, list_items)"),
  title: z.string().optional().describe("Webset title (create)"),
  query: z.string().min(1).max(5000).optional().describe("What to find, e.g. 'AI security startups in the US' (create)"),
  count: z.coerce.number().int().min(1).optional().describe("How many items to find (create, default 10)"),
  entityType: z.enum(['company', 'person', 'article', 'research_paper', 'custom']).optional()
    .describe("Kind of item to find (create)"),
  entityDescription: z.string().min(2).max(200).optional()
    .describe("Description of the item kind when entityType is 'custom'"),
  criteria: z.array(z.string().min(1)).min(1).max(5).optional()
    .describe("Up to 5 conditions every item must satisfy (create)"),
  enrichments: z.array(z.object({
    description: z.string().min(1).describe("What to extract for each item, e.g. 'CEO email'"),
    format: z.enum(['text', 'date', 'number', 'options', 'email', 'phone', 'url']).optional(),
    options: z.array(z.string()).min(1).max(150).optional().describe("Allowed labels when format is 'options'")
  })).optional().describe("Extra fields to extract for each item (create)"),
  externalId: z.string().max(300).optional().describe("Your own id for the Webset (create)"),
  limit: z.coerce.number().int().min(1).max(100).optional().describe("Page size (list, list_items)"),
  cursor: z.string().optional().describe("Pagination cursor from a previous list call")
});

function describeWebset(w: ExaWebset): string {
  const lines = [`- ${w.id}${w.title ? ` "${w.title}"` : ''}: ${w.status}`];
  w.searches?.forEach(s => {
    const found = s.progress?.found !== undefined ? `, ${s.progress.found} found` : '';
    lines.push(`  search ${s.id}: ${s.status}${found}${s.query ? ` (${s.query})` : ''}`);
  });
  w.enrichments?.forEach(e => lines.push(`  enrichment ${e.id}: ${e.status}${e.description ? ` (${e.description})` : ''}`));
  if (w.dashboardUrl) lines.push(`  dashboard: ${w.dashboardUrl}`);
  return lines.join('\n');
}

function describeItem(item: ExaWebsetItem, index: number): string {
  const p = item.properties;
  const lines = [`${index}. ${p.url}${p.description ? ` — ${p.description}` : ''}`];
  item.evaluations?.forEach(e => lines.push(`   [${e.satisfied}] ${e.criterion}`));
  item.enrichments?.forEach(e => {
    if (e.result?.length) lines.push(`   ${e.enrichmentId} (${e.format}): ${e.result.join('; ')}`);
  });
  return lines.join('\n');
}

function pageNote(page: ExaList<unknown>): string {
  return page.hasMore && page.nextCursor ? `\nMore available: cursor "${page.nextCursor}"` : '';
}

export const websetsTool = createActionTool({
  name: "websets",
  title: "Exa Websets",
  // Creates billable Websets; has no delete action
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  description: "Build Exa Websets: collections of companies, people, articles or papers that match your criteria, with optional extracted fields (enrichments). Creation runs in the background; use get to check progress and list_items to read results. Requires an Exa plan with Websets API access.",
  schema: websetsSchema,
  enabled: false,
  run: async (args, exa) => {
    const pageParams = { ...(args.limit && { limit: args.limit }), ...(args.cursor && { cursor: args.cursor }) };
    switch (args.action) {
      case 'create': {
        const entity = args.entityType
          ? { entity: { type: args.entityType, ...(args.entityType === 'custom' && { description: requireArg(args.entityDescription, 'entityDescription', "create with entityType 'custom'") }) } }
          : {};
        const body = {
          ...(args.title && { title: args.title }),
          search: {
            query: requireArg(args.query, 'query', 'create'),
            ...(args.count && { count: args.count }),
            ...entity,
            ...(args.criteria && { criteria: args.criteria.map(description => ({ description })) })
          },
          ...(args.enrichments && {
            enrichments: args.enrichments.map(e => ({
              description: e.description,
              ...(e.format && { format: e.format }),
              ...(e.options && { options: e.options.map(label => ({ label })) })
            }))
          }),
          ...(args.externalId && { externalId: args.externalId })
        };
        const w = await exa.post<ExaWebset>(WEBSETS_BASE, body);
        return `Webset created (running in the background):\n${describeWebset(w)}`;
      }
      case 'list': {
        const page = await exa.get<ExaList<ExaWebset>>(WEBSETS_BASE, pageParams);
        return page.data.length ? `${page.data.length} webset(s):\n${page.data.map(describeWebset).join('\n')}${pageNote(page)}` : 'No websets.';
      }
      case 'get': {
        return describeWebset(await exa.get<ExaWebset>(`${WEBSETS_BASE}/${pathSegment(requireArg(args.websetId, 'websetId', 'get'))}`));
      }
      case 'list_items': {
        const id = requireArg(args.websetId, 'websetId', 'list_items');
        const page = await exa.get<ExaList<ExaWebsetItem>>(`${WEBSETS_BASE}/${pathSegment(id)}/items`, pageParams);
        return page.data.length
          ? `${page.data.length} item(s):\n${page.data.map((item, i) => describeItem(item, i + 1)).join('\n')}${pageNote(page)}`
          : 'No items yet (the Webset may still be running).';
      }
    }
  }
});

import { z } from "zod";
import { createTool } from "./tool-builder.js";
import { ExaCostDollars } from "../types.js";
import { ResponseFormatter } from "../utils/formatter.js";

interface ExaAnswerRequest {
  query: string;
  text?: boolean;
  model?: 'exa' | 'exa-pro' | 'exa-research' | 'exa-fast';
  systemPrompt?: string;
  outputSchema?: Record<string, unknown>;
  userLocation?: string;
}

export interface ExaAnswerResponse {
  requestId?: string;
  /** A string, or an object matching outputSchema when one was sent */
  answer: string | Record<string, unknown>;
  citations?: Array<{
    url: string;
    title: string;
    publishedDate?: string;
    author?: string | null;
    text?: string;
  }>;
  costDollars?: ExaCostDollars;
}

const answerSchema = z.object({
  query: z.string().min(1).max(2000).describe("Question to answer"),
  model: z.enum(['exa', 'exa-pro', 'exa-research', 'exa-fast']).optional()
    .describe("Answer model: 'exa-fast' (quickest), 'exa' (default), 'exa-pro' (stronger), 'exa-research' (most thorough)"),
  systemPrompt: z.string().optional()
    .describe("Extra instructions for the answer (tone, format, focus)"),
  outputSchema: z.record(z.any()).optional()
    .describe("JSON Schema (Draft 7) for a structured answer instead of prose"),
  userLocation: z.string().length(2).optional()
    .describe("Two-letter ISO country code to localize sources (e.g. 'US')"),
  includeText: z.boolean().optional().default(false)
    .describe("Include each citation's page text")
});

export const answerTool = createTool({
  name: "answer_question",
  description: "Get a direct answer to a question with cited sources. Use instead of exa_search when you want a synthesized answer, not a list of results. Set outputSchema for a structured answer. For open-ended multi-step research use agent_run.",
  schema: answerSchema,
  enabled: true,
  endpoint: '/answer',
  createRequest: (args): ExaAnswerRequest => ({
    query: args.query,
    text: args.includeText,
    ...(args.model && { model: args.model }),
    ...(args.systemPrompt && { systemPrompt: args.systemPrompt }),
    ...(args.outputSchema && { outputSchema: args.outputSchema }),
    ...(args.userLocation && { userLocation: args.userLocation })
  }),
  formatResponse: (data: ExaAnswerResponse) => {
    const lines: string[] = ['## Answer', ''];
    lines.push(typeof data.answer === 'string'
      ? data.answer
      : '```json\n' + JSON.stringify(data.answer, null, 2) + '\n```');
    if (data.citations?.length) {
      lines.push('', '## Citations', '');
      data.citations.forEach((citation, idx) => {
        const date = citation.publishedDate ? ` (${ResponseFormatter.formatDate(citation.publishedDate)})` : '';
        lines.push(`${idx + 1}. [${citation.title || citation.url}](${citation.url})${date}`);
        if (citation.text) {
          lines.push(`   ${citation.text.replace(/\s+/g, ' ').trim().substring(0, 300)}...`);
        }
      });
    }
    const cost = ResponseFormatter.formatCost(data.costDollars);
    if (cost) lines.push('', cost);
    return lines.join('\n');
  },
  getStartContext: (args) => `Answering: "${args.query}"`,
  progressSteps: [
    "Analyzing question...",
    "Searching for relevant sources...",
    "Synthesizing answer...",
    "Formatting citations..."
  ]
});

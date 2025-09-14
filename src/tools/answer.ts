import { z } from "zod";
import { createTool } from "./tool-builder.js";

interface ExaAnswerRequest {
  query: string;
  numResults?: number;
  useAutoprompt?: boolean;
  text?: boolean | { maxCharacters?: number; includeHtmlTags?: boolean };
  highlights?: boolean | { highlightsPerUrl?: number };
}

interface ExaAnswerResponse {
  answer: string;
  citations: Array<{
    url: string;
    title: string;
    text?: string;
    highlights?: string[];
    score: number;
  }>;
  processingTime: number;
}

const answerSchema = z.object({
  query: z.string().min(1).max(2000).describe("Question to answer"),
  numResults: z.number().min(1).max(10).optional().default(5),
  useAutoprompt: z.boolean().optional().default(true),
  includeText: z.boolean().optional().default(true),
  textMaxCharacters: z.number().optional().default(500),
  includeHtmlTags: z.boolean().optional().default(false),
  includeHighlights: z.boolean().optional().default(false),
  highlightsPerUrl: z.number().min(1).max(5).optional()
});

export const answerTool = createTool({
  name: "answer_question",
  description: "Get direct answers to questions with citations using Exa AI - provides concise answers with source citations for quick Q&A without needing full search results",
  schema: answerSchema,
  enabled: true,
  endpoint: '/answer',
  createRequest: (args) => ({
    query: args.query,
    numResults: args.numResults,
    useAutoprompt: args.useAutoprompt,
    text: args.includeText ? {
      maxCharacters: args.textMaxCharacters,
      includeHtmlTags: args.includeHtmlTags
    } : false,
    highlights: args.includeHighlights ? {
      highlightsPerUrl: args.highlightsPerUrl || 3
    } : false
  }),
  formatResponse: (data: ExaAnswerResponse) => {
    let output = `## Answer\n\n${data.answer}\n\n## Citations\n\n`;
    data.citations.forEach((citation, idx) => {
      output += `### ${idx + 1}. [${citation.title}](${citation.url})\n`;
      output += `Relevance: ${(citation.score * 100).toFixed(1)}%\n`;
      if (citation.text) {
        output += `\n${citation.text.substring(0, 200)}...\n`;
      }
      if (citation.highlights?.length) {
        output += `\n**Key Points:**\n`;
        citation.highlights.forEach(h => output += `- ${h}\n`);
      }
      output += '\n';
    });
    return output;
  },
  getStartContext: (args) => `Answering: "${args.query}"`,
  progressSteps: [
    "Analyzing question...",
    "Searching for relevant sources...",
    "Synthesizing answer...",
    "Formatting citations..."
  ]
});
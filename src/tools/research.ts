import { z } from "zod";
import { AxiosInstance } from "axios";
import { ToolRegistry, ToolHandlerExtra } from "./config.js";
import { ProgressTracker, extractToolContext } from "./progress-tracker.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";
import { createRequestLogger, generateRequestId } from "../utils/pinoLogger.js";
import { getConfig } from "../config/index.js";

interface ExaResearchRequest {
  objective: string;
  model?: 'exa-research' | 'exa-research-pro';
  outputSchema?: Record<string, any>;
  timeRange?: {
    startDate?: string;
    endDate?: string;
  };
  domains?: string[];
  excludeDomains?: string[];
}

interface ExaResearchTaskResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedTime: number;
}

interface ExaResearchStatusResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  currentStep?: string;
  result?: any;
  error?: string;
}

class ResearchPoller {
  private maxAttempts: number;
  private pollInterval: number;

  constructor(
    private client: AxiosInstance,
    private logger: any
  ) {
    const config = getConfig();
    this.maxAttempts = 60; // 2 minutes max with 2 second intervals
    this.pollInterval = 2000; // 2 seconds
  }

  async pollTask(taskId: string, progress?: ProgressTracker): Promise<any> {
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      this.logger.log(`Polling attempt ${attempts + 1}/${this.maxAttempts} for task ${taskId}`);

      const response = await this.client.get<ExaResearchStatusResponse>(`/research/status/${taskId}`);

      if (progress && response.data.currentStep) {
        await progress.update(
          response.data.progress || (attempts / this.maxAttempts * 100),
          response.data.currentStep
        );
      }

      if (response.data.status === 'completed') {
        this.logger.log(`Task ${taskId} completed successfully`);
        return response.data.result;
      }

      if (response.data.status === 'failed') {
        throw new Error(response.data.error || 'Research task failed');
      }

      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      attempts++;
    }

    throw new Error('Research task timed out after 2 minutes');
  }
}

const researchSchema = z.object({
  objective: z.string().min(1).max(4096).describe("Research objective or question"),
  model: z.enum(['exa-research', 'exa-research-pro']).optional().default('exa-research'),
  outputSchema: z.record(z.any()).optional().describe("JSON Schema for structured output"),
  startDate: z.string().optional().describe("Start date for research scope (ISO format)"),
  endDate: z.string().optional().describe("End date for research scope (ISO format)"),
  domains: z.array(z.string()).optional().describe("Domains to include in research"),
  excludeDomains: z.array(z.string()).optional().describe("Domains to exclude from research")
});

export const researchTool: ToolRegistry = {
  name: "deep_research",
  description: "Conduct complex multi-step research with structured output using Exa's Research API",
  schema: researchSchema,
  enabled: true,
  handler: async (args: any, extra?: ToolHandlerExtra) => {
    const context = extractToolContext(extra);
    const requestId = context.requestId || generateRequestId();
    const logger = createRequestLogger(requestId, "deep_research", context.requestId);

    const progress = new ProgressTracker(10, context.progressToken, context.server);
    const client = createExaClient();
    const poller = new ResearchPoller(client, logger);

    try {
      // Validate arguments
      const validationResult = researchSchema.safeParse(args);
      if (!validationResult.success) {
        return {
          content: [{
            type: "text",
            text: `Invalid arguments: ${validationResult.error.issues.map(i => i.message).join(', ')}`
          }],
          isError: true
        };
      }

      const validatedArgs = validationResult.data;
      logger.start(`Research: "${validatedArgs.objective}"`);

      // Step 1: Create research task
      await progress.update(0, "Creating research task...");

      const request: ExaResearchRequest = {
        objective: validatedArgs.objective,
        model: validatedArgs.model,
        outputSchema: validatedArgs.outputSchema,
        timeRange: (validatedArgs.startDate || validatedArgs.endDate) ? {
          startDate: validatedArgs.startDate,
          endDate: validatedArgs.endDate
        } : undefined,
        domains: validatedArgs.domains,
        excludeDomains: validatedArgs.excludeDomains
      };

      const taskResponse = await client.post<ExaResearchTaskResponse>('/research', request);
      logger.log(`Task created: ${taskResponse.data.taskId}, estimated time: ${taskResponse.data.estimatedTime}s`);

      // Step 2: Poll for completion
      await progress.update(10, `Task created. Estimated time: ${taskResponse.data.estimatedTime}s`);
      const result = await poller.pollTask(taskResponse.data.taskId, progress);

      // Step 3: Format result
      await progress.update(90, "Formatting results...");

      let formattedOutput = `## Research Results\n\n`;
      formattedOutput += `**Objective:** ${validatedArgs.objective}\n\n`;

      if (validatedArgs.outputSchema) {
        // Structured output
        formattedOutput += "### Structured Data\n\n";
        formattedOutput += "```json\n";
        formattedOutput += JSON.stringify(result, null, 2);
        formattedOutput += "\n```\n";
      } else {
        // Unstructured output
        if (typeof result === 'string') {
          formattedOutput += result;
        } else if (result.summary) {
          formattedOutput += `### Summary\n\n${result.summary}\n\n`;
          if (result.findings) {
            formattedOutput += `### Key Findings\n\n`;
            result.findings.forEach((finding: any, idx: number) => {
              formattedOutput += `${idx + 1}. ${finding}\n`;
            });
          }
          if (result.sources) {
            formattedOutput += `\n### Sources\n\n`;
            result.sources.forEach((source: any) => {
              formattedOutput += `- [${source.title}](${source.url})\n`;
            });
          }
        } else {
          formattedOutput += JSON.stringify(result, null, 2);
        }
      }

      await progress.complete("Research completed successfully");
      logger.complete();

      return {
        content: [{
          type: "text",
          text: formattedOutput
        }]
      };

    } catch (error) {
      logger.error(`Research failed: ${error}`);
      return handleExaError(error, "deep_research", logger);
    }
  }
};
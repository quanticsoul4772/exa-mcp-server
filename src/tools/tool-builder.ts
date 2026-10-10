import { z } from "zod";
import { READ_ONLY_WEB, ToolAnnotations, ToolRegistry, ToolHandlerExtra } from "./config.js";
import { ExaSearchRequest, ExaSearchResponse } from "../types.js";
import { getSharedExaClient, handleExaError } from "../utils/exaClient.js";
import { getGlobalRateLimiter } from "../utils/rateLimiter.js";
import { createRequestLogger, generateRequestId } from "../utils/pinoLogger.js";
import { ResponseFormatter } from "../utils/formatter.js";
import { getGlobalCache } from "../utils/cache.js";
import { ProgressTracker, extractToolContext } from "./progress-tracker.js";
import { logExaUsage } from "../utils/usageLogger.js";

/**
 * Tool configuration types for different API endpoints
 */
type ToolConfig<T extends z.ZodObject<z.ZodRawShape>, TRequest, TResponse> = {
  name: string;
  /** Display name; defaults to name */
  title?: string;
  /** See ToolRegistry.maxResultChars */
  maxResultChars?: number;
  /**
   * Behavior hints. Defaults to read-only: createTool wraps single POSTs to
   * Exa's read-only endpoints. Tools that create or delete resources use
   * createActionTool or a custom handler and declare their own hints.
   */
  annotations?: ToolAnnotations;
  description: string;
  schema: T;
  enabled: boolean;
  endpoint: string;
  createRequest: (args: z.infer<T>) => TRequest;
  formatResponse: (data: TResponse, toolName: string) => string;
  getStartContext: (args: z.infer<T>) => string;
  /** Optional progress steps for progress tracking */
  progressSteps?: string[];
  /** Per-call request timeout in ms; undefined uses the client default (EXA_TIMEOUT) */
  timeoutMs?: (args: z.infer<T>) => number | undefined;
  /**
   * Transform the Exa response before formatting (e.g. Voyage reranking).
   * Runs on fresh and cached responses; the cache always holds the raw
   * Exa response. Throwing makes the call an error.
   */
  postProcess?: (data: TResponse, args: z.infer<T>, context: { signal?: AbortSignal }) => Promise<TResponse>;
};

/**
 * Timeout for Exa calls that can run for minutes (deep search, research-grade
 * answers). Matches the 300 s Exa's own MCP server allows.
 */
export const LONG_REQUEST_TIMEOUT_MS = 300_000;

/**
 * True when the request asks Exa to fetch fresh content (maxAgeHours 0),
 * either at the top level (/contents) or under contents (/search).
 * Such requests must not be answered from the local response cache.
 */
export function requestsFreshContent(request: unknown): boolean {
  if (request === null || typeof request !== 'object') return false;
  const r = request as { maxAgeHours?: unknown; contents?: { maxAgeHours?: unknown } };
  return r.maxAgeHours === 0 || r.contents?.maxAgeHours === 0;
}

/**
 * Type helper to check if a response has results array
 */
type ResponseWithResults = {
  results: unknown[];
};

/**
 * Type guard to check if response data has results array
 */
function hasResults(data: unknown): data is ResponseWithResults {
  return data !== null && 
         typeof data === 'object' && 
         'results' in data && 
         Array.isArray((data as ResponseWithResults).results);
}

/**
 * Unified tool creator that handles all tool types with proper type inference
 * Provides strong typing during tool creation while maintaining compatibility with ToolRegistry
 * 
 * @template T - Zod schema type
 * @template TRequest - API request type
 * @template TResponse - API response type
 * @param config Tool configuration object
 * @returns ToolRegistry instance compatible with MCP server
 */
export function createTool<
  T extends z.ZodObject<z.ZodRawShape>,
  TRequest,
  TResponse
>(
  config: ToolConfig<T, TRequest, TResponse>
): ToolRegistry {
  return {
    name: config.name,
    title: config.title ?? config.name,
    annotations: config.annotations ?? READ_ONLY_WEB,
    ...(config.maxResultChars && { maxResultChars: config.maxResultChars }),
    description: config.description,
    schema: config.schema,
    enabled: config.enabled,
    handler: async (args, extra) => {
      const context = extractToolContext(extra as ToolHandlerExtra);
      const requestId = context.requestId || generateRequestId();
      const logger = createRequestLogger(requestId, config.name, context.requestId);

      const progress = config.progressSteps
        ? new ProgressTracker(config.progressSteps.length, context.progressToken, context.sendNotification)
        : null;
      const step = async (index: number, fallback: string) => {
        if (progress && config.progressSteps && config.progressSteps.length > index) {
          await progress.increment(config.progressSteps[index] || fallback);
        }
      };

      // Validate arguments with strict parsing - this provides runtime type safety
      const validationResult = config.schema.safeParse(args);
      if (!validationResult.success) {
        logger.error(`Validation failed: ${JSON.stringify(validationResult.error.issues)}`);
        return {
          content: [{
            type: "text" as const,
            text: `Invalid arguments for ${config.name}: ${validationResult.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
          }],
          isError: true
        };
      }

      const validatedArgs = validationResult.data as z.infer<T>;
      logger.start(config.getStartContext(validatedArgs));
      if (progress) {
        await progress.update(0, "Starting request...");
      }

      try {
        const cache = getGlobalCache();
        const request = config.createRequest(validatedArgs);

        // Check cache first, unless the caller asked for fresh content
        const cachedResponse = requestsFreshContent(request)
          ? null
          : cache.get<TResponse>(config.endpoint, request);
        if (cachedResponse) {
          logger.log(`Cache hit for ${config.name}`);
          if (progress) {
            await progress.complete("Using cached response");
          }
          const processed = config.postProcess
            ? await config.postProcess(cachedResponse, validatedArgs, { signal: context.signal })
            : cachedResponse;
          logExaUsage(config.name, "cache_hit");
          logger.complete();
          return {
            content: [{ type: "text" as const, text: config.formatResponse(processed, config.name) }]
          };
        }

        await step(0, "Preparing request...");
        logger.log(`Sending request to Exa API for ${config.name}`);
        await step(1, "Sending API request...");

        await getGlobalRateLimiter().queue();
        const timeout = config.timeoutMs?.(validatedArgs);
        const response = await getSharedExaClient().post<TResponse>(config.endpoint, request, {
          ...(context.signal && { signal: context.signal }),
          ...(timeout !== undefined && { timeout })
        });
        logger.log(`Received response from Exa API for ${config.name}`);
        await step(2, "Processing response...");

        const noResults = {
          content: [{
            type: "text" as const,
            text: `No results found for ${config.name}. Please try a different query.`
          }]
        };
        if (!response.data) {
          logger.log(`Warning: Empty response from Exa API for ${config.name}`);
          return noResults;
        }
        if (hasResults(response.data)) {
          // /contents reports per-URL failures in statuses; let the formatter show them
          const statuses = (response.data as { statuses?: unknown[] }).statuses;
          if (response.data.results.length === 0 && !(Array.isArray(statuses) && statuses.length > 0)) {
            logger.log(`Warning: No results found for ${config.name}`);
            return noResults;
          }
          logger.log(`Found ${response.data.results.length} results for ${config.name}`);
        }

        // Only non-empty responses are cached
        cache.set(config.endpoint, request, response.data);

        const processed = config.postProcess
          ? await config.postProcess(response.data, validatedArgs, { signal: context.signal })
          : response.data;

        await step(3, "Formatting results...");
        const text = config.formatResponse(processed, config.name);
        if (progress) {
          await progress.complete("Request completed successfully");
        }
        logExaUsage(config.name, "ok");
        logger.complete();
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        const err = error as { response?: { status?: number }; message?: string };
        const statusCode = err?.response?.status;
        const status = statusCode === 429 ? "rate_limit"
          : statusCode === 402 ? "quota_error"
          : "error";
        logExaUsage(config.name, status, String(err?.message ?? "").slice(0, 80));
        return handleExaError(error, config.name, logger);
      }
    },
  };
}

/**
 * Helper function to extract query from validated args safely
 */
function getQueryFromArgs<T extends Record<string, unknown>>(args: T): string {
  return 'query' in args && typeof args.query === 'string' ? args.query : 'search request';
}

/**
 * Helper function to create search-based tools (web search, research papers, etc.)
 * Provides full type safety during tool creation
 */
export function createSearchTool<T extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  description: string,
  schema: T,
  enabled: boolean,
  createRequest: (args: z.infer<T>) => ExaSearchRequest,
  formatResponse?: (data: ExaSearchResponse, toolName: string) => string,
  progressSteps?: string[],
  timeoutMs?: (args: z.infer<T>) => number | undefined,
  postProcess?: (data: ExaSearchResponse, args: z.infer<T>, context: { signal?: AbortSignal }) => Promise<ExaSearchResponse>
): ToolRegistry {
  return createTool({
    name,
    description,
    schema,
    enabled,
    endpoint: '/search', // Using the API endpoint directly
    createRequest,
    formatResponse: formatResponse || ((data: ExaSearchResponse, toolName: string) => ResponseFormatter.formatSearchResponse(data, toolName)),
    getStartContext: (args) => getQueryFromArgs(args),
    progressSteps,
    timeoutMs,
    postProcess
  });
}

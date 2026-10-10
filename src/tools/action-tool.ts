import { z } from "zod";
import { AxiosInstance } from "axios";
import { ToolAnnotations, ToolRegistry, ToolHandlerExtra, ToolResult } from "./config.js";
import { extractToolContext } from "./progress-tracker.js";
import { getSharedExaClient, handleExaError } from "../utils/exaClient.js";
import { getGlobalRateLimiter } from "../utils/rateLimiter.js";
import { createRequestLogger, generateRequestId } from "../utils/pinoLogger.js";
import { logExaUsage } from "../utils/usageLogger.js";

/**
 * Thrown by an action when the arguments are valid for the schema but not for
 * the chosen action (e.g. "get" without an id). Reported as a tool error.
 */
export class ActionArgumentError extends Error {}

/**
 * Exa call helper given to actions: rate-limited, never cached
 */
export interface ExaCaller {
  get<T>(path: string, params?: Record<string, unknown>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

/**
 * Encode one id for use as a URL path segment
 */
export function pathSegment(id: string): string {
  return encodeURIComponent(id);
}

function createCaller(client: AxiosInstance, signal?: AbortSignal): ExaCaller {
  const opts = signal ? { signal } : {};
  const limited = async <T>(fn: () => Promise<{ data: T }>): Promise<T> => {
    await getGlobalRateLimiter().queue();
    return (await fn()).data;
  };
  return {
    get: (path, params) => limited(() => client.get(path, { ...opts, ...(params && { params }) })),
    post: (path, body) => limited(() => client.post(path, body, opts)),
    patch: (path, body) => limited(() => client.patch(path, body, opts)),
    delete: (path) => limited(() => client.delete(path, opts))
  };
}

/**
 * Create a tool whose single "action" argument selects an operation
 * (create, list, get, ...). Used for stateful APIs (Monitors, Websets)
 * where responses must not be cached.
 */
export function createActionTool<T extends z.ZodObject<z.ZodRawShape>>(config: {
  name: string;
  title: string;
  annotations: ToolAnnotations;
  description: string;
  schema: T;
  enabled: boolean;
  run: (args: z.infer<T>, exa: ExaCaller) => Promise<string>;
}): ToolRegistry {
  return {
    name: config.name,
    title: config.title,
    annotations: config.annotations,
    description: config.description,
    schema: config.schema,
    enabled: config.enabled,
    handler: async (args: Record<string, unknown>, extra?: ToolHandlerExtra): Promise<ToolResult> => {
      const context = extractToolContext(extra);
      const requestId = context.requestId || generateRequestId();
      const logger = createRequestLogger(requestId, config.name, context.requestId);

      const validation = config.schema.safeParse(args);
      if (!validation.success) {
        return {
          content: [{
            type: "text",
            text: `Invalid arguments for ${config.name}: ${validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          }],
          isError: true
        };
      }

      const validated = validation.data as z.infer<T>;
      logger.start(`${config.name}: ${String((validated as { action?: unknown }).action ?? '')}`);
      try {
        const text = await config.run(validated, createCaller(getSharedExaClient(), context.signal));
        logExaUsage(config.name, "ok", String((validated as { action?: unknown }).action ?? ''));
        logger.complete();
        return { content: [{ type: "text", text }] };
      } catch (error) {
        if (error instanceof ActionArgumentError) {
          return { content: [{ type: "text", text: `Invalid arguments for ${config.name}: ${error.message}` }], isError: true };
        }
        const err = error as { response?: { status?: number }; message?: string };
        const statusCode = err?.response?.status;
        const status = statusCode === 429 ? "rate_limit" : statusCode === 402 ? "quota_error" : "error";
        logExaUsage(config.name, status, String(err?.message ?? "").slice(0, 80));
        return handleExaError(error, config.name, logger);
      }
    }
  };
}

/**
 * Require an argument for the chosen action
 */
export function requireArg<V>(value: V | undefined, name: string, action: string): V {
  if (value === undefined || value === null || value === '') {
    throw new ActionArgumentError(`'${name}' is required for action '${action}'`);
  }
  return value;
}

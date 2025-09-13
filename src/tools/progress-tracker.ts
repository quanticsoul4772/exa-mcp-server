import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ToolHandlerExtra, ToolResult } from "./config.js";

/**
 * Sends a progress notification to the MCP client
 * @param progressToken - Token for progress tracking
 * @param server - MCP server instance
 * @param progress - Current progress value
 * @param total - Total expected value
 * @param message - Optional progress message
 */
export async function sendProgressNotification(
  progressToken: string | undefined,
  server: Server | undefined,
  progress: number,
  total: number,
  message?: string
): Promise<void> {
  if (!progressToken || !server) {
    return;
  }

  try {
    await server.notification({
      method: "notifications/progress",
      params: {
        progressToken,
        progress,
        total,
        ...(message && { message })
      }
    });
  } catch (error) {
    // Silently ignore notification errors to prevent tool failure
    console.error("Failed to send progress notification:", error);
  }
}

/**
 * Helper class for managing progress during tool execution
 */
export class ProgressTracker {
  private current = 0;

  constructor(
    private readonly total: number,
    private readonly progressToken: string | undefined,
    private readonly server: Server | undefined
  ) {}

  /**
   * Increment progress and send notification
   * @param message - Optional progress message
   */
  async increment(message?: string): Promise<void> {
    this.current++;
    await this.update(this.current, message);
  }

  /**
   * Update progress to a specific value
   * @param value - New progress value
   * @param message - Optional progress message
   */
  async update(value: number, message?: string): Promise<void> {
    this.current = value;
    await sendProgressNotification(
      this.progressToken,
      this.server,
      this.current,
      this.total,
      message
    );
  }

  /**
   * Mark progress as complete
   * @param message - Optional completion message
   */
  async complete(message?: string): Promise<void> {
    await this.update(this.total, message || "Complete");
  }
}

/**
 * Extracts metadata and server from extra parameter
 * @param extra - Extra context from tool handler
 * @returns Extracted metadata and server
 */
export function extractToolContext(extra?: ToolHandlerExtra): {
  progressToken?: string;
  requestId?: string;
  server?: Server;
  metadata?: Record<string, unknown>;
} {
  if (!extra) {
    return {};
  }

  const { _meta, server, ...rest } = extra;

  return {
    progressToken: _meta?.progressToken,
    requestId: _meta?.requestId,
    server: server as Server | undefined,
    metadata: { ..._meta, ...rest }
  };
}

/**
 * Wraps a tool handler with enhanced capabilities
 * @param handler - Original tool handler
 * @param toolName - Name of the tool for logging
 * @returns Enhanced tool handler
 */
export function enhanceToolHandler(
  handler: (args: Record<string, unknown>, extra?: ToolHandlerExtra) => Promise<ToolResult>,
  toolName: string
): (args: Record<string, unknown>, extra?: ToolHandlerExtra) => Promise<ToolResult> {
  return async (args, extra) => {
    const context = extractToolContext(extra);

    // Log request with metadata
    if (context.requestId) {
      console.log(`[${toolName}] Processing request ${context.requestId}`);
    }

    try {
      // Pass through to original handler with context
      const result = await handler(args, {
        ...extra,
        _meta: {
          ...extra?._meta,
          toolName
        }
      });

      return result;
    } catch (error) {
      console.error(`[${toolName}] Error:`, error);
      throw error;
    }
  };
}

/**
 * Creates a progress-aware tool handler wrapper
 * @param steps - Array of step descriptions
 * @param handler - Tool handler function that receives progress tracker
 * @returns Enhanced tool handler
 */
export function createProgressHandler<T extends Record<string, unknown>>(
  steps: string[],
  handler: (
    args: T,
    progress: ProgressTracker,
    context: ReturnType<typeof extractToolContext>
  ) => Promise<ToolResult>
): (args: Record<string, unknown>, extra?: ToolHandlerExtra) => Promise<ToolResult> {
  return async (args, extra) => {
    const context = extractToolContext(extra);
    const progress = new ProgressTracker(
      steps.length,
      context.progressToken,
      context.server
    );

    return handler(args as T, progress, context);
  };
}
import { ToolHandlerExtra } from "./config.js";
import { logWarn } from "../utils/pinoLogger.js";

/** Progress token as defined by MCP (string or integer) */
export type ProgressToken = string | number;

/** The notification sender the SDK passes to every request handler */
export type NotificationSender = ToolHandlerExtra["sendNotification"];

/**
 * Sends a progress notification to the MCP client.
 * Does nothing when the client did not ask for progress (no token).
 * A failed notification is logged to stderr and does not fail the tool.
 */
export async function sendProgressNotification(
  progressToken: ProgressToken | undefined,
  sendNotification: NotificationSender | undefined,
  progress: number,
  total: number,
  message?: string
): Promise<void> {
  if (progressToken === undefined || !sendNotification) {
    return;
  }

  try {
    await sendNotification({
      method: "notifications/progress",
      params: {
        progressToken,
        progress,
        total,
        ...(message && { message })
      }
    });
  } catch (error) {
    logWarn(`Failed to send progress notification: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper class for managing progress during tool execution
 */
export class ProgressTracker {
  private current = 0;

  constructor(
    private readonly total: number,
    private readonly progressToken: ProgressToken | undefined,
    private readonly sendNotification: NotificationSender | undefined
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
      this.sendNotification,
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
 * What a tool handler needs from the SDK's request context
 */
export interface ToolContext {
  progressToken?: ProgressToken;
  requestId?: string;
  signal?: AbortSignal;
  sendNotification?: NotificationSender;
}

/**
 * Extracts the progress token, request id, abort signal and notification
 * sender from the extra argument the SDK passes to tool handlers
 */
export function extractToolContext(extra?: ToolHandlerExtra): ToolContext {
  if (!extra) {
    return {};
  }
  return {
    progressToken: extra._meta?.progressToken,
    requestId: extra.requestId !== undefined ? String(extra.requestId) : undefined,
    signal: extra.signal,
    sendNotification: extra.sendNotification
  };
}

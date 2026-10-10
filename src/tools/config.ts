import { z } from "zod";

/**
 * Request metadata sent by the client (`params._meta`)
 */
export interface ToolMetadata {
  /** Token for sending progress notifications (MCP allows string or integer) */
  progressToken?: string | number;
  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * The parts of the SDK's request handler context (`extra`) that tools use
 */
export interface ToolHandlerExtra {
  /** Metadata from the request */
  _meta?: ToolMetadata;
  /** JSON-RPC id of the request */
  requestId?: string | number;
  /** Aborted when the client cancels the request */
  signal?: AbortSignal;
  /** Sends a notification related to this request */
  sendNotification?: (notification: {
    method: string;
    params?: Record<string, unknown>;
  }) => Promise<void>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  content: {
    type: "text";
    text: string;
  }[];
  isError?: boolean;
}

/**
 * Enhanced tool handler type with metadata support
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  extra?: ToolHandlerExtra
) => Promise<ToolResult>;

/**
 * Base interface for tool registration in the MCP server.
 * Each tool must implement this interface to be registered.
 */
export interface ToolRegistry {
  /** Unique identifier for the tool (snake_case) */
  name: string;
  /** Human-readable description of the tool's functionality */
  description: string;
  /** Zod schema defining the tool's parameters */
  schema: z.ZodRawShape | z.ZodObject<z.ZodRawShape>;
  /** Async function that executes the tool's logic */
  handler: ToolHandler;
  /** Whether the tool is enabled by default */
  enabled: boolean;
}

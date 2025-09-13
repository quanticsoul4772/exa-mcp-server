import { z } from "zod";

/**
 * Metadata that can be passed with tool requests (v1.18.0+)
 */
export interface ToolMetadata {
  /** Token for sending progress notifications */
  progressToken?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Extra context passed to tool handlers
 */
export interface ToolHandlerExtra {
  /** Metadata from the request (v1.18.0+) */
  _meta?: ToolMetadata;
  /** MCP server instance for sending notifications */
  server?: any; // Will be typed properly when server is imported
  /** Any other extra data */
  [key: string]: unknown;
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
  schema: z.ZodRawShape | z.ZodObject<any>;
  /** Async function that executes the tool's logic */
  handler: ToolHandler;
  /** Whether the tool is enabled by default */
  enabled: boolean;
}

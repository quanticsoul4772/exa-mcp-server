import { z } from "zod";

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
  handler: (
    args: Record<string, unknown>, 
    extra: unknown
  ) => Promise<{
    content: {
      type: "text";
      text: string;
    }[];
    isError?: boolean;
  }>;
  /** Whether the tool is enabled by default */
  enabled: boolean;
}

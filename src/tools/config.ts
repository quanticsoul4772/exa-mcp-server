import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Interface for tool registration in the MCP server.
 * Each tool must implement this interface to be registered.
 * 
 * @interface ToolRegistry
 * @property {string} name - Unique identifier for the tool (snake_case)
 * @property {string} description - Human-readable description of the tool's functionality
 * @property {z.ZodRawShape} schema - Zod schema defining the tool's parameters
 * @property {Function} handler - Async function that executes the tool's logic
 * @property {boolean} enabled - Whether the tool is enabled by default
 */
export interface ToolRegistry {
  /** Unique identifier for the tool (snake_case) */
  name: string;
  /** Human-readable description of the tool's functionality */
  description: string;
  /** Zod schema defining the tool's parameters */
  schema: z.ZodRawShape;
  /** Async function that executes the tool's logic */
  handler: (
    args: { [key: string]: any }, 
    extra: any
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

/**
 * Configuration constants for the Exa API.
 * Centralizes API settings used across all tools.
 * 
 * @constant {Object} API_CONFIG
 * @property {string} BASE_URL - Base URL for Exa API
 * @property {Object} ENDPOINTS - API endpoint paths
 * @property {number} DEFAULT_NUM_RESULTS - Default number of results to return
 * @property {number} DEFAULT_MAX_CHARACTERS - Default character limit for text content
 */
export const API_CONFIG = {
  BASE_URL: 'https://api.exa.ai',
  ENDPOINTS: {
    SEARCH: '/search'
  },
  DEFAULT_NUM_RESULTS: 3,
  DEFAULT_MAX_CHARACTERS: 3000
} as const;

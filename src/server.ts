import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toolRegistry } from "./tools/index.js";
import { ToolAnnotations, ToolHandlerExtra, ToolResult } from "./tools/config.js";
import { SERVER_VERSION } from "./version.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";

/**
 * registerTool with its generics fixed to what this server passes. The SDK's
 * own generic signature is deep enough that some TypeScript configurations
 * (ts-jest) fail with TS2589 when inferring it.
 */
type RegisterTool = (
  name: string,
  config: {
    title: string;
    description: string;
    inputSchema: z.ZodRawShape;
    annotations: ToolAnnotations;
    _meta?: Record<string, unknown>;
  },
  cb: (args: Record<string, unknown>, extra: ToolHandlerExtra) => Promise<ToolResult>
) => unknown;

/**
 * Build the MCP server and register tools.
 *
 * @param specifiedTools - tool names to register; empty means every tool
 *   that is enabled by default
 * @returns the server (not yet connected) and the registered tool names
 */
export function buildServer(specifiedTools: Set<string>): { server: McpServer; registered: string[] } {
  const server = new McpServer(
    { name: "exa-search-server", version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS }
  );
  const registered: string[] = [];

  Object.entries(toolRegistry).forEach(([toolId, tool]) => {
    const shouldRegister = specifiedTools.size > 0 ? specifiedTools.has(toolId) : tool.enabled;
    if (!shouldRegister) return;

    // registerTool takes a raw Zod shape
    const schema: z.ZodRawShape = tool.schema instanceof z.ZodObject ? tool.schema.shape : tool.schema;

    // The SDK's extra carries the abort signal, request id, progress token
    // and sendNotification; tools read those fields directly
    const handler = async (args: Record<string, unknown>, extra: ToolHandlerExtra) =>
      tool.handler(args, extra);

    const registerTool = server.registerTool.bind(server) as unknown as RegisterTool;
    registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: schema,
        annotations: tool.annotations,
        ...(tool.maxResultChars && { _meta: { 'anthropic/maxResultSizeChars': tool.maxResultChars } })
      },
      handler
    );
    registered.push(toolId);
  });

  return { server, registered };
}

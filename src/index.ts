#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Import configuration first to validate environment variables
import { getConfig } from "./config/index.js";
// Import the tool registry system
import { toolRegistry, resolveToolNames } from "./tools/index.js";
import { logInfo, logError, logWarn } from "./utils/pinoLogger.js";
import { CLIArguments } from "./types/cli.js";
import { buildServer } from "./server.js";

/**
 * Exa AI Web Search MCP Server
 * 
 * This MCP server integrates Exa AI's search capabilities with Claude and other MCP-compatible clients.
 * Exa is a search engine and API specifically designed for up-to-date web searching and retrieval,
 * offering more recent and comprehensive results than what might be available in an LLM's training data.
 * 
 * The server provides tools for web search, page fetching, answers with
 * citations, code search, research agent runs, scheduled monitors and Websets.
 */

/**
 * Build the server and serve it over stdio
 */
async function run(specifiedTools: Set<string>): Promise<void> {
  const { server, registered } = buildServer(specifiedTools);
  logInfo(`Starting Exa MCP server with ${registered.length} tools: ${registered.join(', ')}`);

  const transport = new StdioServerTransport();
  transport.onerror = (error) => {
    logError(`Transport error: ${error.message}`);
  };
  await server.connect(transport);
  logInfo("Exa Search MCP server running on stdio");
}

// Main entry point
async function main() {
  try {
    // Parse command line arguments to determine which tools to enable
    const argv = await yargs(hideBin(process.argv))
      .option('tools', {
        type: 'string',
        description: 'Comma-separated list of tools to enable (if not specified, all enabled-by-default tools are used)',
        default: ''
      })
      .option('list-tools', {
        type: 'boolean',
        description: 'List all available tools and exit',
        default: false
      })
      .help()
      .parseAsync() as CLIArguments;

    // Convert comma-separated string to Set for easier lookups
    const toolsString = argv.tools || '';
    const requestedTools = toolsString
      ? toolsString.split(',').map((tool: string) => tool.trim()).filter(Boolean)
      : [];
    const { tools: specifiedTools, remapped, unknown } = resolveToolNames(requestedTools);
    if (remapped.length) {
      logWarn(`Removed tool names mapped to replacements: ${remapped.join(', ')}`);
    }
    if (unknown.length) {
      logWarn(`Unknown tool names ignored: ${unknown.join(', ')}`);
    }

    // List all available tools if requested
    if (argv['list-tools']) {
      /* eslint-disable no-console */
      console.log("Available tools:");

      Object.entries(toolRegistry).forEach(([id, tool]) => {
        console.log(`- ${id}: ${tool.name}`);
        console.log(`  Description: ${tool.description}`);
        console.log(`  Enabled by default: ${tool.enabled ? 'Yes' : 'No'}`);
        console.log();
      });
      /* eslint-enable no-console */

      process.exit(0);
    }

    // Validate configuration early (after handling list-tools to allow listing without a key)
    const config = getConfig();
    logInfo(`Configuration loaded successfully for environment: ${config.environment.nodeEnv}`);

    await run(specifiedTools);
  } catch (error) {
    logError(`Fatal server error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the main function
main();

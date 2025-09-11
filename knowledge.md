# Exa MCP Server

This is a Model Context Protocol (MCP) server that provides Exa AI search capabilities to Claude and other MCP-compatible clients.

## Key Development Practices

- Run `npm run typecheck` after making changes to check TypeScript types
- Use `npm run lint` to maintain code quality
- All tools must be self-registering in the `toolRegistry` pattern
- API responses are formatted as single-line text for Claude UI compatibility
- Environment variable `EXA_API_KEY` is required for operation
- **Runtime validation**: All tool handlers validate arguments using `z.object(schema).safeParse(args)` before processing

## Architecture Notes

- Plugin-based tool system with central registry in `src/tools/config.ts`
- Each tool implements the `ToolRegistry` interface with Zod schemas for validation
- Uses ES modules with `.js` extensions in imports
- MCP server communicates via stdio with clients

## Testing

- Jest with ts-jest for TypeScript support
- Mock external API calls in tests
- Test files mirror source structure in `__tests__` directories

## Tool Development

- New tools go in `src/tools/` and must import/register with `toolRegistry`
- Tools must have unique names to avoid conflicts with Claude's built-in tools
- Import new tools in `src/tools/index.ts` to make them available

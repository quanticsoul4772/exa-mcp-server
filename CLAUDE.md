# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Development
```bash
npm run build          # Build TypeScript to JavaScript
npm run watch         # Watch mode for development
npm run prepare       # Build before npm install
```

### Testing
```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Type Checking and Linting
```bash
npm run typecheck    # Check TypeScript types without building
npm run lint         # Run ESLint to check code quality
npm run lint:fix     # Run ESLint and auto-fix issues
```

### Running the Server
```bash
npm run inspector     # Test with MCP Inspector tool
npx exa-mcp-server   # Run server directly (after build)
```

## Architecture Overview

This is a Model Context Protocol (MCP) server that provides Exa AI search capabilities to Claude and other MCP-compatible clients. The server is built with TypeScript and follows a plugin-based tool architecture.

### Core Components

1. **Entry Point** (`src/index.ts`): 
   - MCP server initialization using `@modelcontextprotocol/sdk`
   - CLI argument parsing with yargs for tool selection
   - Dynamic tool registration based on command-line arguments

2. **Tool System** (`src/tools/`):
   - Plugin-based architecture where each tool is self-registering
   - Central registry pattern in `config.ts` with `toolRegistry` object
   - Each tool module imports the registry and registers itself on load
   - Tools implement the `ToolRegistry` interface with name, description, schema (Zod), handler, and enabled flag

3. **Available Tools**:
   - `exa_search`: General web search (renamed from web_search to avoid conflicts)
   - `research_paper_search`: Academic paper search
   - `twitter_search`: Twitter/X.com search
   - `company_research`: Company website crawling
   - `crawling`: Direct URL content extraction
   - `competitor_finder`: Competitor identification

4. **Utilities** (`src/utils/`):
   - `formatter.ts`: Response formatting with single-line output for Claude UI compatibility
   - `logger.ts`: Logging utilities for debugging
   - `exaClient.ts`: Centralized Axios client configuration and error handling

### Key Design Patterns

- **Self-registering tools**: Each tool module automatically registers itself when imported
- **Zod schemas**: Type-safe parameter validation for all tools including URL validation
- **Async handlers**: All tool handlers return promises for non-blocking operations
- **Centralized error handling**: Shared utilities in `exaClient.ts` for consistent error handling
- **Environment configuration**: Uses dotenv for API keys with proper validation
- **ESM modules**: Uses ES modules with `.js` extensions in imports

### Adding New Tools

1. Create new tool file in `src/tools/`
2. Import and use `toolRegistry` from `./config.js`
3. Register tool with unique name, schema, and handler
4. Import the new tool in `src/tools/index.ts`
5. Tool will be automatically available with `--tools` flag

### Testing Approach

- Jest with ts-jest for TypeScript support
- Test files in `__tests__` directories mirroring source structure
- Mock external API calls in tests
- Coverage reports generated in HTML and LCOV formats

## Important Notes

- The server communicates via stdio with MCP clients
- Tool names must be unique and avoid conflicts with Claude's built-in tools
- All responses are formatted as single-line text to prevent Claude UI issues
- API key must be set as `EXA_API_KEY` environment variable
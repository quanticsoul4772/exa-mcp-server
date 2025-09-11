# Exa MCP Server - Project Context

## Project Overview

This is a Model Context Protocol (MCP) server that enables AI assistants like Claude to use the Exa AI Search API for web searches. The server provides multiple tools for different search capabilities including web search, academic paper search, Twitter/X.com search, company research, content crawling, and competitor finding.

### Key Features:
- Enables AI assistants to perform web searches using Exa's search API
- Provides search results including titles, URLs, and content snippets
- Caches recent searches as resources for reference
- Handles rate limiting and error cases
- Supports real-time web crawling
- Configurable tool selection (enable/disable specific capabilities)

### Technologies:
- TypeScript/Node.js
- Exa AI Search API
- Model Context Protocol SDK
- Axios for HTTP requests
- Yargs for CLI argument parsing
- Zod for schema validation
- Jest for testing
- ESLint for code quality

## Project Structure

```
exa-mcp-server/
├── src/
│   ├── index.ts           # Main server entry point
│   ├── tools/             # Tool implementations
│   │   ├── config.ts      # Tool registry and configuration
│   │   ├── index.ts       # Tool exports and registration
│   │   ├── webSearch.ts           # Web search tool
│   │   ├── researchPaperSearch.ts # Academic paper search
│   │   ├── twitterSearch.ts       # Twitter/X.com search
│   │   ├── companyResearch.ts     # Company research tool
│   │   ├── crawling.ts            # Content crawling tool
│   │   └── competitorFinder.ts    # Competitor finding tool
│   ├── utils/             # Utility functions
│   │   ├── exaClient.ts   # API client
│   │   ├── formatter.ts   # Response formatting
│   │   └── logger.ts      # Logging utilities
│   ├── types/             # TypeScript type definitions
│   │   └── cli.ts         # CLI argument types
│   └── types.ts           # Shared type definitions
├── src/__tests__/         # Test files
├── build/                 # Compiled JavaScript output
├── examples/              # Example configurations and usage
├── package.json           # Project configuration
├── tsconfig.json          # TypeScript configuration
└── jest.config.ts         # Jest testing configuration
```

## Available Tools

1. **exa_search**: Performs web searches with content extraction
2. **research_paper_search**: Search for academic papers and research content
3. **twitter_search**: Search Twitter/X.com for tweets, profiles, and conversations
4. **company_research**: Research companies by crawling their websites
5. **crawling**: Extracts content from specific URLs
6. **competitor_finder**: Identifies competitors of a company

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode for development |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run inspector` | Test with MCP Inspector |
| `npm run lint` | Run ESLint to check for code style issues |
| `npm run lint:fix` | Run ESLint and automatically fix issues |
| `npm run typecheck` | Check TypeScript types without building |

## Key Implementation Details

### Tool Architecture
- Tools are registered in a central registry (`src/tools/config.ts`)
- Each tool implements the `ToolRegistry` interface with:
  - A unique name (snake_case)
  - Human-readable description
  - Zod schema for parameter validation
  - Async handler function
  - Enabled/disabled flag

### Error Handling
- Standardized error handling through `handleExaError` utility
- Detailed logging with request IDs
- Proper error formatting for Claude UI

### Response Formatting
- Consistent formatting through `ResponseFormatter` utility
- Different formatting methods for different tool types
- Truncation of long content with ellipsis
- Proper date formatting

### Configuration
- API key is read from `EXA_API_KEY` environment variable
- Tool selection via CLI arguments: `--tools=tool1,tool2`
- List available tools with `--list-tools`

## Testing

The project uses Jest for testing with:
- Unit tests for individual components
- Integration tests for tool registration
- Coverage reporting
- TypeScript ESM module support

## Code Quality

The project uses ESLint for code quality with:
- TypeScript ESLint plugin
- Import order validation
- Code style enforcement
- Automatic fixing capabilities

## Building and Running

### Prerequisites
- Node.js 18+
- Exa API key

### Build Process
1. TypeScript compilation to `build/` directory
2. File permissions set for executable
3. Package prepared for npm distribution

### Running the Server
```bash
# Run with all tools enabled by default
npx exa-mcp-server

# Enable specific tools only
npx exa-mcp-server --tools=exa_search

# Enable multiple tools
npx exa-mcp-server --tools=exa_search,research_paper_search

# List all available tools
npx exa-mcp-server --list-tools
```

## Integration with Claude Desktop

The server can be configured in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Documentation

The project includes comprehensive documentation:
- README.md: Project overview and quick start guide
- DEVELOPER_GUIDE.md: Development setup and contribution guidelines
- API.md: API endpoints and request/response formats
- TOOL_REFERENCE.md: Detailed tool specifications and examples
- CLAUDE.md: Claude-specific integration notes
- TESTING.md: Testing setup and patterns
- TROUBLESHOOTING.md: Common issues and solutions
- SECURITY.md: Security considerations and best practices
- CHANGELOG.md: Version history and changes
- Examples directory: Configuration examples and usage patterns

## Development Guidelines

### Code Style
- TypeScript with strict typing
- ES modules with `.js` extensions
- 2-space indentation
- Double quotes for strings
- Semicolons required
- ESLint for automated code quality

### Tool Development
1. Create tool file in `src/tools/`
2. Register tool in the tool registry
3. Define Zod schema for parameter validation
4. Implement handler with proper error handling
5. Add response formatting as needed
6. Write tests for the tool
7. Register tool import in `src/tools/index.ts`

### Testing
- Unit tests for individual functions
- Integration tests for tool registration
- Error case testing
- Response formatting validation
- Coverage targets (80%+)

### Security
- API key management best practices
- Input validation with Zod
- Error message sanitization
- No exposure of sensitive information
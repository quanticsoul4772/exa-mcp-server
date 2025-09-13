# Exa MCP Server

A Model Context Protocol (MCP) server that provides Exa AI search capabilities to Claude and other MCP-compatible clients. Search the web, academic papers, Twitter, and more with real-time results.

## Features

- 🔍 **Web Search** - General web search with live crawling
- 📚 **Research Papers** - Academic paper search from scholarly sources
- 🐦 **Twitter/X Search** - Search tweets and social media content
- 🏢 **Company Research** - Targeted company information gathering
- 🌐 **URL Crawling** - Extract content from specific URLs
- 🏆 **Competitor Analysis** - Find competitors for any business
- ⚡ **Configurable Tools** - Enable/disable specific search capabilities
- 🔒 **Privacy-First** - Sensitive data redaction in logs
- 🔄 **Resilient** - Automatic retries with exponential backoff

## MCP SDK v1.18.0 Features

This server fully supports the latest MCP SDK v1.18.0 features:

### 📊 Progress Tracking
Real-time progress notifications for long-running searches. Claude and other MCP clients will display progress indicators during:
- Research paper searches (4 stages: searching, retrieving, extracting, formatting)
- Company research (4 stages: finding domain, crawling, extracting, compiling)
- Competitor analysis (4 stages: analyzing, searching, evaluating, compiling)

### 🔗 Request ID Correlation
Enhanced request tracking with support for client-provided request IDs via the `_meta.requestId` field. This enables:
- Better debugging with correlated logs between client and server
- Request tracing across distributed systems
- Improved error tracking and monitoring

### 🎯 Metadata Support
Full support for the `_meta` field in tool requests, allowing:
- Custom metadata pass-through
- Enhanced context for tool execution
- Future extensibility for new MCP features

## Quick Start

### 1. Get an Exa API Key

Sign up at [exa.ai](https://exa.ai/) and get your API key.

### 2. Installation

```bash
npm install -g exa-mcp-server
```

### 3. Configuration

Create a `.env` file in your project directory:

```bash
cp .env.example .env
# Edit .env and add your EXA_API_KEY
```

### 4. Usage with Claude Desktop

Add to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "exa-search": {
      "command": "exa-mcp-server",
      "args": ["--tools", "exa_search,research_paper_search"],
      "env": {
        "EXA_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

| Tool | ID | Description | Default |
|------|----|--------------|---------|
| Web Search | `exa_search` | General web search with live crawling | ✅ |
| Research Papers | `research_paper_search` | Academic paper search | ✅ |
| Twitter Search | `twitter_search` | Search tweets and social media | ✅ |
| Company Research | `company_research` | Company information gathering | ✅ |
| URL Crawling | `crawling` | Extract content from URLs | ✅ |
| Competitor Finder | `competitor_finder` | Find business competitors | ❌ |

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXA_API_KEY` | ✅ | - | Your Exa AI API key |
| `LOG_LEVEL` | ❌ | `DEBUG` (dev) / `ERROR` (prod) | Logging level (ERROR, WARN, INFO, DEBUG) |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `REDACT_LOGS` | ❌ | `true` | Redact sensitive data in logs |

### Tool Selection

```bash
# Enable specific tools
exa-mcp-server --tools exa_search,research_paper_search

# List all available tools
exa-mcp-server --list-tools

# Use all default tools (no --tools flag)
exa-mcp-server
```

## Development

### Setup

```bash
git clone https://github.com/quanticsoul4772/exa-mcp-server.git
cd exa-mcp-server
npm install
cp .env.example .env
# Edit .env with your API key
```

### Available Scripts

```bash
npm run build          # Build TypeScript to JavaScript
npm run watch         # Watch mode for development
npm test              # Run tests
npm run test:coverage # Run tests with coverage
npm run lint          # Check code quality
npm run typecheck     # Check TypeScript types
npm run inspector     # Test with MCP Inspector
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Test with MCP Inspector
npm run inspector
```

## Architecture

### Core Components

- **Entry Point** (`src/index.ts`) - MCP server initialization and CLI
- **Tool System** (`src/tools/`) - Plugin-based tool architecture
- **Utilities** (`src/utils/`) - Shared utilities for HTTP, logging, formatting
- **Types** (`src/types.ts`) - TypeScript interfaces for API data

### Key Features

- **Runtime Validation** - All inputs validated with Zod schemas
- **Structured Logging** - Multi-level logging with sensitive data redaction
- **Retry Logic** - Exponential backoff for failed API requests
- **Type Safety** - Full TypeScript support with strict typing
- **Extensible** - Easy to add new tools and search capabilities

## Examples

### Web Search
```typescript
// Search the web for recent AI developments
{
  "tool": "exa_search",
  "arguments": {
    "query": "latest AI developments 2024",
    "numResults": 5
  }
}
```

### Research Papers
```typescript
// Find academic papers on machine learning
{
  "tool": "research_paper_search",
  "arguments": {
    "query": "transformer architecture machine learning",
    "numResults": 3
  }
}
```

### Company Research
```typescript
// Research a specific company
{
  "tool": "company_research",
  "arguments": {
    "query": "openai.com"
  }
}
```

## Troubleshooting

### Common Issues

**API Key Error**
```
Error: EXA_API_KEY environment variable is not set
```
- Solution: Add your Exa API key to the `.env` file or environment variables

**Tool Not Found**
```
Tool 'tool_name' not found
```
- Solution: Check available tools with `--list-tools` or enable the tool with `--tools`

**Network Timeouts**
- The server includes automatic retries with exponential backoff
- Check your internet connection and API key validity

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
export LOG_LEVEL=DEBUG
export REDACT_LOGS=false
exa-mcp-server
```

## Project Structure

```
exa-mcp-server/
├── src/                    # Source code
│   ├── config/            # Configuration management
│   ├── tools/             # Tool implementations
│   └── utils/             # Utility functions
├── docs/                   # Documentation
│   ├── testing/           # Test plans and reports
│   └── development/       # Development guides
├── config/                 # Configuration files
├── examples/              # Usage examples
└── __mocks__/             # Test mocks
```

## Documentation

- [API Reference](docs/API.md) - Detailed API documentation
- [Tool Reference](docs/TOOL_REFERENCE.md) - Complete tool documentation
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Developer Guide](docs/development/DEVELOPER_GUIDE.md) - Development setup and practices
- [Testing Guide](docs/testing/TESTING.md) - Testing strategies and coverage

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📧 Issues: [GitHub Issues](https://github.com/quanticsoul4772/exa-mcp-server/issues)
- 📖 Documentation: [Exa API Docs](https://docs.exa.ai/)
- 💬 Discussions: [GitHub Discussions](https://github.com/quanticsoul4772/exa-mcp-server/discussions)

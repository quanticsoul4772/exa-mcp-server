# Developer Guide for Exa MCP Server

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Creating New Tools](#creating-new-tools)
4. [Testing Guidelines](#testing-guidelines)
5. [Code Style Guide](#code-style-guide)
6. [Debugging](#debugging)
7. [Performance & Security](#performance--security)
8. [Resources](#resources)
9. [Troubleshooting](#troubleshooting)

## Architecture Overview

### Project Structure

```
exa-mcp-server/
├── src/
│   ├── index.ts           # Main server entry point
│   ├── tools/             # Tool implementations
│   │   ├── config.ts      # Tool registry and configuration
│   │   ├── index.ts       # Tool exports and registration
│   │   └── *.ts           # Individual tool implementations
│   ├── utils/             # Utility functions
│   │   ├── exaClient.ts   # API client
│   │   ├── formatter.ts   # Response formatting
│   │   └── logger.ts      # Logging utilities
│   ├── types/             # TypeScript type definitions
│   │   └── cli.ts         # CLI argument types
│   └── types.ts           # Shared type definitions
├── __tests__/             # Test files
├── build/                 # Compiled JavaScript output
└── package.json           # Project configuration
```

### Core Components

#### 1. MCP Server (`src/index.ts`)

The main server class that:
- Initializes the MCP server with stdio transport
- Registers tools based on CLI arguments
- Validates environment variables
- Handles tool execution requests

```typescript
class ExaServer {
  private server: McpServer;
  private specifiedTools: Set<string>;
  
  constructor(specifiedTools: Set<string>) {
    // Server initialization
  }
  
  private setupTools(): string[] {
    // Tool registration logic
  }
  
  async run(): Promise<void> {
    // Server startup
  }
}
```

#### 2. Tool Registry (`src/tools/config.ts`)

Central registry for all tools:

```typescript
export interface ToolRegistry {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (args: any, extra: any) => Promise<{
    content: { type: "text"; text: string }[];
    isError?: boolean;
  }>;
  enabled: boolean;
}

export const toolRegistry: Record<string, ToolRegistry> = {};
```

#### 3. Shared Utilities (`src/utils/`)

- **exaClient.ts**: Axios configuration and error handling
- **formatter.ts**: Response formatting for different content types
- **logger.ts**: Request logging and debugging

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- TypeScript knowledge
- Exa API key

### Initial Setup

1. Clone the repository:
```bash
git clone https://github.com/quanticsoul4772/exa-mcp-server.git
cd exa-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment:
```bash
echo "EXA_API_KEY=your_api_key_here" > .env
```

4. Build the project:
```bash
npm run build
```

5. Run in development mode:
```bash
npm run watch
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode for development |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run inspector` | Test with MCP Inspector |

## Creating New Tools

### Step-by-Step Guide

#### 1. Create Tool File

Create `src/tools/yourTool.ts`:

```typescript
import { z } from "zod";
import { toolRegistry, API_CONFIG } from "./config.js";
import { createExaClient, handleExaError } from "../utils/exaClient.js";
import { createRequestLogger } from "../utils/logger.js";
import { ResponseFormatter } from "../utils/formatter.js";

// Define your tool's parameters
const schema = {
  param1: z.string().describe("Parameter description"),
  param2: z.number().optional().describe("Optional parameter")
};

// Register the tool
toolRegistry["your_tool"] = {
  name: "your_tool",
  description: "Description of what your tool does",
  schema,
  handler: async ({ param1, param2 }, extra) => {
    // Create request ID and logger
    const requestId = `your_tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'your_tool');
    
    logger.start(param1);
    
    try {
      // Create API client
      const client = createExaClient();
      
      // Build request
      const request = {
        // Your request structure
      };
      
      // Make API call
      const response = await client.post('/endpoint', request);
      
      // Format response
      const formattedResponse = ResponseFormatter.formatYourResponse(response.data);
      
      logger.complete();
      
      return {
        content: [{
          type: "text" as const,
          text: formattedResponse
        }]
      };
    } catch (error) {
      return handleExaError(error, 'your_tool', logger);
    }
  },
  enabled: true  // or false for opt-in tools
};
```

#### 2. Register Tool Import

Add to `src/tools/index.ts`:

```typescript
import "./yourTool.js";
```

#### 3. Add Response Formatter (if needed)

Extend `src/utils/formatter.ts`:

```typescript
static formatYourResponse(data: YourResponseType): string {
  const lines: string[] = [];
  
  // Format your response
  lines.push(`Results from your tool:`);
  // Add formatted content
  
  return lines.join('\n');
}
```

#### 4. Add TypeScript Types

Update `src/types.ts`:

```typescript
export interface YourRequestType {
  // Request structure
}

export interface YourResponseType {
  // Response structure
}
```

#### 5. Create Tests

Add `src/__tests__/tools/yourTool.test.ts`:

```typescript
import { describe, it, expect, jest } from '@jest/globals';
import { toolRegistry } from '../../tools/config';
import '../../tools/yourTool';

describe('YourTool', () => {
  it('should be registered', () => {
    expect(toolRegistry['your_tool']).toBeDefined();
  });
  
  it('should handle valid input', async () => {
    const result = await toolRegistry['your_tool'].handler(
      { param1: 'test' },
      {}
    );
    
    expect(result.content).toBeDefined();
    expect(result.isError).toBeUndefined();
  });
});
```

### Tool Practices

1. **Validation**: Validate inputs with Zod schemas
2. **Error Handling**: Use centralized error handling
3. **Logging**: Log requests for debugging
4. **Formatting**: Return formatted text
5. **Documentation**: Include descriptions
6. **Testing**: Write tests

## Testing Guidelines

### Test Structure

```
src/__tests__/
├── tools/
│   ├── config.test.ts
│   └── yourTool.test.ts
├── utils/
│   ├── formatter.test.ts
│   └── logger.test.ts
└── types/
    └── cli.test.ts
```

### Writing Tests

#### Unit Tests

```typescript
describe('Tool Handler', () => {
  beforeEach(() => {
    // Setup
  });
  
  it('should handle valid input', async () => {
    // Test implementation
  });
  
  it('should handle errors gracefully', async () => {
    // Error case testing
  });
});
```

#### Integration Tests

```typescript
describe('Tool Integration', () => {
  it('should register with correct schema', () => {
    // Schema validation
  });
  
  it('should format responses correctly', () => {
    // Response formatting
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- yourTool.test.ts

# Run in watch mode
npm run test:watch
```

## Code Style Guide

### TypeScript Conventions

1. **Imports**: Use ES modules with `.js` extensions
```typescript
import { something } from "./module.js";
```

2. **Types**: Define interfaces for all data structures
```typescript
export interface MyType {
  field: string;
  optional?: number;
}
```

3. **Async/Await**: Always use async/await over promises
```typescript
async function myFunction() {
  const result = await apiCall();
  return result;
}
```

4. **Error Handling**: Use try/catch with typed errors
```typescript
try {
  // Code
} catch (error) {
  if (axios.isAxiosError(error)) {
    // Handle axios error
  }
  // Handle generic error
}
```

### Naming Conventions

- **Files**: camelCase (`myTool.ts`)
- **Interfaces**: PascalCase (`ExaSearchRequest`)
- **Functions**: camelCase (`formatResponse`)
- **Constants**: UPPER_SNAKE_CASE (`API_CONFIG`)
- **Tool Names**: snake_case (`exa_search`)

### Formatting Rules

- Indent: 2 spaces
- Line length: 100 characters
- Semicolons: Required
- Quotes: Double quotes for strings

## Debugging

### Enable Debug Logging

```bash
# Redirect stderr to file
npx exa-mcp-server 2> debug.log

# Watch logs in real-time
tail -f debug.log
```

### Debug Output Format

```
[EXA-MCP-DEBUG] [request-id] [tool-name] Message
```

### Common Debugging Scenarios

#### 1. Tool Not Found

Check registration:
```typescript
console.error('Registered tools:', Object.keys(toolRegistry));
```

#### 2. API Errors

Log full error:
```typescript
logger.error(JSON.stringify(error.response?.data, null, 2));
```

#### 3. Schema Validation

Test schema:
```typescript
const result = schema.safeParse(input);
if (!result.success) {
  console.error('Validation errors:', result.error);
}
```

### Using MCP Inspector

```bash
npm run inspector
```

This opens an interactive UI to:
- Test tool invocations
- View request/response pairs
- Debug parameter validation

## Performance & Security

### Performance Optimization

1. **Request Batching**: Consider batching multiple requests
2. **Caching**: Implement result caching if needed
3. **Timeout Optimization**: Adjust timeouts based on use case
4. **Connection Pooling**: Reuse HTTP connections

### Security Considerations

1. **API Key Management**: Don't log or expose API keys
2. **Input Validation**: Validate and sanitize inputs
3. **URL Validation**: Use Zod's `.url()` validator
4. **Error Messages**: Don't expose sensitive information

### Monitoring

Add custom monitoring:

```typescript
const metrics = {
  requestCount: 0,
  errorCount: 0,
  avgResponseTime: 0
};

// In handler
const startTime = Date.now();
// ... processing ...
metrics.avgResponseTime = Date.now() - startTime;
```

## Resources

### Documentation
- [MCP Protocol Spec](https://modelcontextprotocol.io/docs)
- [Exa API Docs](https://docs.exa.ai)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev)

### Examples
- [MCP Server Examples](https://github.com/modelcontextprotocol/servers)
- [Exa API Documentation](https://docs.exa.ai)

### Repository
- [GitHub Repository](https://github.com/quanticsoul4772/exa-mcp-server)

## Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clean build
rm -rf build/
npm run build
```

#### Test Failures
```bash
# Clear Jest cache
npx jest --clearCache
```

#### Runtime Errors
```bash
# Check Node version
node --version  # Should be 18+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## License

This project is licensed under the MIT License. See LICENSE file for details.

# Architecture Documentation

## System Overview

The exa-mcp-server is built on a modular, plugin-based architecture that provides search capabilities through the Model Context Protocol (MCP). The system is designed for high performance, security, and maintainability.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         MCP Client (Claude)                       │
└────────────────────────┬─────────────────────────────────────────┘
                         │ stdio (JSON-RPC)
┌────────────────────────▼─────────────────────────────────────────┐
│                        MCP Server Layer                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    index.ts (Entry Point)                 │   │
│  │  - Server initialization                                  │   │
│  │  - Tool registration                                      │   │
│  │  - Request routing                                        │   │
│  └──────────────────────┬───────────────────────────────────┘   │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                         Tool Layer                                │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Tool Registry│ │ Tool Builder │ │     Tool Handlers        │ │
│  │             │ │              │ │ - webSearch               │ │
│  │ Self-       │ │ Factory      │ │ - researchPaperSearch     │ │
│  │ registering │ │ pattern for  │ │ - twitterSearch           │ │
│  │ plugin      │ │ creating     │ │ - companyResearch         │ │
│  │ system      │ │ tools        │ │ - crawling                │ │
│  │             │ │              │ │ - competitorFinder        │ │
│  └─────────────┘ └──────────────┘ └──────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                        Utility Layer                              │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐  │
│  │    Cache     │ │ Rate Limiter │ │   URL Validator        │  │
│  │  - LRU       │ │  - Token     │ │  - SSRF protection     │  │
│  │  - TTL       │ │    bucket    │ │  - Domain filtering    │  │
│  │  - Stats     │ │  - Queue     │ │  - IP blocking         │  │
│  └──────────────┘ └──────────────┘ └────────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐  │
│  │   Logger     │ │Health Check  │ │  Memory Optimizer      │  │
│  │  - Pino      │ │  - System    │ │  - GC management       │  │
│  │  - Redaction │ │    status    │ │  - Heap monitoring     │  │
│  │  - Levels    │ │  - Metrics   │ │  - Auto cleanup        │  │
│  └──────────────┘ └──────────────┘ └────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                      External Layer                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Exa AI API                           │   │
│  │  - Search endpoint                                        │   │
│  │  - Contents endpoint                                      │   │
│  │  - Rate limits                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Entry Point (`src/index.ts`)

The main server initialization point that:
- Sets up the MCP server using `@modelcontextprotocol/sdk`
- Parses command-line arguments with yargs
- Dynamically registers tools based on CLI flags
- Handles stdio communication with MCP clients

```typescript
// Simplified structure
const server = new Server({
  name: 'exa-mcp-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Register tools dynamically
Object.entries(toolRegistry.tools).forEach(([name, tool]) => {
  if (tool.enabled) {
    server.setRequestHandler(
      McpSchema.CallToolRequestSchema,
      tool.handler
    );
  }
});
```

### 2. Tool System

#### Tool Registry (`src/tools/config.ts`)

Central registry implementing the plugin pattern:

```typescript
interface ToolRegistry {
  tools: Record<string, Tool>;
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): string[];
}

// Self-registering pattern
// Each tool file imports the registry and registers itself
```

#### Tool Builder (`src/tools/tool-builder.ts`)

Factory pattern for creating standardized tools:

```typescript
function createSearchTool(
  name: string,
  description: string,
  schema: ZodSchema,
  handler: ToolHandler
): Tool {
  return {
    name,
    description,
    schema,
    handler: wrapWithErrorHandling(handler)
  };
}
```

#### Tool Handlers

Each tool follows a consistent pattern:

```typescript
const toolHandler: ToolHandler = async (args, context) => {
  // 1. Validate input
  const validated = schema.parse(args);
  
  // 2. Check cache
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  // 3. Apply rate limiting
  await rateLimiter.consume();
  
  // 4. Make API call
  const result = await exaClient.post('/search', params);
  
  // 5. Format response
  const formatted = formatter.format(result);
  
  // 6. Cache result
  cache.set(cacheKey, formatted);
  
  return formatted;
};
```

### 3. Configuration System

#### Configuration Management (`src/config/index.ts`)

Centralized configuration with validation:

```typescript
const configSchema = z.object({
  exa: z.object({
    apiKey: z.string(),
    baseUrl: z.string().url(),
    timeout: z.number(),
    retries: z.number()
  }),
  // ... other config
});

function getConfig(): AppConfig {
  // Singleton pattern with caching
  if (!configCache) {
    configCache = validateAndBuildConfig();
  }
  return configCache;
}
```

#### Environment Variable Loading

Priority order:
1. Environment variables
2. `.env` file
3. Default values

### 4. Utility Layer

#### Cache System (`src/utils/cache.ts`)

LRU cache with TTL support:

```typescript
class RequestCache {
  private cache: LRUCache<string, CacheEntry>;
  
  constructor(options: CacheOptions) {
    this.cache = new LRUCache({
      max: options.maxSize,
      ttl: options.ttlMinutes * 60 * 1000,
      updateAgeOnGet: true
    });
  }
}
```

#### Rate Limiter (`src/utils/rateLimiter.ts`)

Token bucket algorithm implementation:

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  
  async consume(): Promise<void> {
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    throw new RateLimitError('Rate limit exceeded');
  }
}
```

#### URL Validator (`src/utils/urlValidator.ts`)

Security-focused URL validation:

```typescript
class URLValidator {
  validate(url: string): URL {
    // Check protocol
    // Check for private IPs
    // Check for localhost
    // Check domain allowlist/blocklist
    // Check for suspicious patterns
  }
}
```

## Data Flow

### Request Lifecycle

```
1. Client Request
   ↓
2. MCP Server receives via stdio
   ↓
3. Request routing to tool handler
   ↓
4. Input validation (Zod schema)
   ↓
5. Cache check
   ↓ (cache miss)
6. Rate limit check
   ↓
7. URL validation (if applicable)
   ↓
8. API request to Exa
   ↓
9. Response processing
   ↓
10. Response formatting
    ↓
11. Cache storage
    ↓
12. Return to client
```

### Error Handling Flow

```
Error Occurs
   ↓
Catch in handler
   ↓
Log error with context
   ↓
Determine error type
   ↓
Format error response
   ↓
Return error to client
```

## Design Patterns

### 1. Singleton Pattern

Used for global instances:
- Configuration
- Cache
- Rate limiter
- Health checker

```typescript
let instance: Service | null = null;

export function getService(): Service {
  if (!instance) {
    instance = new Service();
  }
  return instance;
}
```

### 2. Factory Pattern

Tool creation:

```typescript
function createTool(config: ToolConfig): Tool {
  return {
    ...baseToolProperties,
    ...config,
    handler: wrapHandler(config.handler)
  };
}
```

### 3. Plugin Pattern

Self-registering tools:

```typescript
// In each tool file
toolRegistry.register({
  name: 'my_tool',
  handler: myHandler
});
```

### 4. Strategy Pattern

Response formatting:

```typescript
interface Formatter {
  format(data: any): ToolResponse;
}

class TextFormatter implements Formatter { /* ... */ }
class JSONFormatter implements Formatter { /* ... */ }
```

### 5. Observer Pattern

Health monitoring:

```typescript
class HealthMonitor {
  private observers: Observer[] = [];
  
  subscribe(observer: Observer) {
    this.observers.push(observer);
  }
  
  notify(status: HealthStatus) {
    this.observers.forEach(o => o.update(status));
  }
}
```

## Security Architecture

### Input Validation

- All inputs validated with Zod schemas
- Type-safe parameter handling
- Sanitization of user input

### URL Security

- SSRF protection
- Private IP blocking
- Localhost restriction
- Domain filtering
- Pattern detection

### Data Protection

- Sensitive data redaction in logs
- No credential storage
- Secure environment variable handling

### Rate Limiting

- Per-client rate limits
- Token bucket algorithm
- Queue management
- Burst protection

## Performance Architecture

### Caching Strategy

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       ↓
┌──────▼──────┐
│ Cache Check │─── Hit ──→ Return cached
└──────┬──────┘
       │ Miss
       ↓
┌──────▼──────┐
│  API Call   │
└──────┬──────┘
       ↓
┌──────▼──────┐
│Cache Result │
└─────────────┘
```

### Memory Management

- Automatic garbage collection
- Heap monitoring
- Resource pooling
- Aggressive cleanup at thresholds

### Request Optimization

- Batching for concurrent requests
- Connection pooling
- Retry with exponential backoff
- Timeout management

## Testing Architecture

### Test Pyramid

```
        /\
       /  \  E2E Tests (13)
      /    \
     /──────\ Integration Tests
    /        \
   /──────────\ Unit Tests (105)
```

### E2E Testing Infrastructure

```typescript
class TestServer {
  // Express server for mocking Exa API
  mock(endpoint: string, response: any): void;
  start(): Promise<number>;
  stop(): Promise<void>;
}

class E2ETestSetup {
  // Complete test environment
  start(): Promise<void>;
  mockSuccessfulSearch(results: any[]): void;
  assertApiCalled(path: string): void;
}
```

## Deployment Architecture

### Docker Support

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY build ./build
CMD ["node", "build/index.js"]
```

### Environment Configuration

```yaml
production:
  LOG_LEVEL: ERROR
  CACHE_ENABLED: true
  CACHE_TTL_MINUTES: 10
  RATE_LIMIT_MAX: 100

development:
  LOG_LEVEL: DEBUG
  CACHE_ENABLED: false
  RATE_LIMIT_MAX: 1000
```

## Scalability Considerations

### Horizontal Scaling

- Stateless design
- External cache support (Redis ready)
- Load balancer compatible

### Vertical Scaling

- Memory optimization
- CPU-efficient algorithms
- Configurable resource limits

## Monitoring and Observability

### Health Checks

```typescript
GET /health
{
  "healthy": true,
  "components": {
    "api": "healthy",
    "cache": "healthy",
    "rateLimiter": "healthy"
  },
  "metrics": {
    "uptime": 3600,
    "requestCount": 1000
  }
}
```

### Metrics Collection

- Request latency
- Cache hit rate
- Memory usage
- Error rates
- API call count

### Logging Strategy

```typescript
// Structured logging with Pino
logger.info({
  requestId,
  toolName,
  duration,
  cacheHit
}, 'Request completed');
```

## Future Architecture Considerations

### Planned Improvements

1. **GraphQL Support**
   - Alternative API interface
   - Schema introspection
   - Subscription support

2. **WebSocket Streaming**
   - Real-time results
   - Progressive loading
   - Reduced latency

3. **Microservices Architecture**
   - Tool separation
   - Independent scaling
   - Service mesh

4. **Event-Driven Architecture**
   - Message queue integration
   - Event sourcing
   - CQRS pattern

## Architecture Decision Records (ADRs)

### ADR-001: Plugin-Based Tool System

**Status**: Accepted

**Context**: Need flexible tool management

**Decision**: Self-registering plugin pattern

**Consequences**: 
- ✅ Easy to add new tools
- ✅ Loose coupling
- ⚠️ Runtime registration complexity

### ADR-002: LRU Cache Implementation

**Status**: Accepted

**Context**: Need efficient caching

**Decision**: Use lru-cache library

**Consequences**:
- ✅ Proven implementation
- ✅ Good performance
- ⚠️ External dependency

### ADR-003: TypeScript with ESM

**Status**: Accepted

**Context**: Modern JavaScript development

**Decision**: TypeScript with ES modules

**Consequences**:
- ✅ Type safety
- ✅ Modern syntax
- ⚠️ Build step required

## Dependencies

### Core Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `axios`: HTTP client
- `zod`: Schema validation
- `lru-cache`: Caching
- `pino`: Logging
- `yargs`: CLI parsing

### Development Dependencies

- `typescript`: Type checking
- `jest`: Testing
- `express`: E2E test server
- `eslint`: Linting

## Configuration Files

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### `jest.config.ts`

```typescript
{
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  clearMocks: true,
  resetModules: true
}
```

## Conclusion

The exa-mcp-server architecture prioritizes:
- **Modularity**: Plugin-based tool system
- **Performance**: Caching, batching, optimization
- **Security**: Input validation, SSRF protection
- **Reliability**: Error handling, retries, health checks
- **Maintainability**: Clean code, comprehensive tests
- **Scalability**: Stateless design, resource management

This architecture provides a solid foundation for future enhancements while maintaining high performance and reliability.
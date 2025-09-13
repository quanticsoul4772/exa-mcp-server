# API Reference

## Table of Contents
- [Tools](#tools)
- [Configuration](#configuration)
- [Utilities](#utilities)
- [Types](#types)
- [Error Handling](#error-handling)

---

## Tools

### Tool Registry Interface

All tools must implement the following interface:

```typescript
interface Tool {
  name: string;
  description: string;
  schema: ZodSchema;
  handler: ToolHandler;
  enabled: boolean;
}

type ToolHandler = (
  args: any,
  context: {}
) => Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}>;
```

### Available Tools

#### `exa_search`

General web search with content extraction.

**Schema:**
```typescript
{
  query: string;           // Required: Search query
  numResults?: number;     // Optional: Number of results (default: 5)
}
```

**Response:**
```typescript
{
  content: [{
    type: 'text',
    text: string  // Formatted search results
  }],
  isError?: boolean
}
```

**Example:**
```javascript
const result = await webSearchTool.handler({
  query: "TypeScript best practices",
  numResults: 10
}, {});
```

#### `research_paper_search`

Search academic papers with domain filtering.

**Schema:**
```typescript
{
  query: string;             // Required: Research topic
  numResults?: number;       // Optional: Number of papers
  maxCharacters?: number;    // Optional: Max chars per result
}
```

**Response:** Same as `exa_search`

**Example:**
```javascript
const result = await researchPaperSearchTool.handler({
  query: "machine learning optimization",
  numResults: 5,
  maxCharacters: 5000
}, {});
```

#### `twitter_search`

Search Twitter/X.com with date filtering.

**Schema:**
```typescript
{
  query: string;                    // Required: Search term
  numResults?: number;              // Optional: Number of tweets
  startPublishedDate?: string;      // Optional: ISO date string
  endPublishedDate?: string;        // Optional: ISO date string
}
```

**Response:** Same as `exa_search`

**Example:**
```javascript
const result = await twitterSearchTool.handler({
  query: "@username",
  numResults: 20,
  startPublishedDate: "2024-01-01T00:00:00.000Z"
}, {});
```

#### `company_research`

Deep research into company websites.

**Schema:**
```typescript
{
  query: string;               // Required: Company URL/name
  subpages?: number;           // Optional: Pages to crawl
  subpageTarget?: string[];    // Optional: Target sections
}
```

**Response:** Same as `exa_search`

**Example:**
```javascript
const result = await companyResearchTool.handler({
  query: "stripe.com",
  subpages: 10,
  subpageTarget: ["pricing", "docs", "about"]
}, {});
```

#### `crawling`

Direct URL content extraction.

**Schema:**
```typescript
{
  url: string;  // Required: URL to crawl
}
```

**Response:** Same as `exa_search`

**Example:**
```javascript
const result = await crawlingTool.handler({
  url: "https://example.com/article"
}, {});
```

#### `competitor_finder`

Find competitor companies.

**Schema:**
```typescript
{
  query: string;           // Required: Product description
  excludeDomain?: string;  // Optional: Domain to exclude
  numResults?: number;     // Optional: Number of competitors
}
```

**Response:** Same as `exa_search`

**Example:**
```javascript
const result = await competitorFinderTool.handler({
  query: "payment processing API",
  excludeDomain: "stripe.com",
  numResults: 10
}, {});
```

---

## Configuration

### Configuration Schema

```typescript
interface AppConfig {
  exa: {
    apiKey: string;        // Required: Exa API key
    baseUrl: string;       // API base URL
    timeout: number;       // Request timeout in ms
    retries: number;       // Number of retry attempts
  };
  tools: {
    defaultNumResults: number;      // Default search results
    defaultMaxCharacters: number;   // Default max chars
  };
  cache: {
    enabled: boolean;      // Enable/disable caching
    maxSize: number;       // Max cache entries
    ttlMinutes: number;    // Cache TTL in minutes
  };
  logging: {
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
    redactLogs: boolean;   // Redact sensitive data
  };
  environment: {
    nodeEnv: 'development' | 'production' | 'test';
  };
}
```

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `EXA_API_KEY` | string | Required | Exa API key |
| `EXA_BASE_URL` | string | `https://api.exa.ai` | API endpoint |
| `EXA_TIMEOUT` | number | `25000` | Request timeout (ms) |
| `EXA_RETRIES` | number | `3` | Retry attempts |
| `DEFAULT_NUM_RESULTS` | number | `5` | Default results |
| `DEFAULT_MAX_CHARACTERS` | number | `3000` | Max chars per result |
| `CACHE_ENABLED` | boolean | `true` | Enable caching |
| `CACHE_MAX_SIZE` | number | `100` | Cache size |
| `CACHE_TTL_MINUTES` | number | `5` | Cache TTL |
| `LOG_LEVEL` | string | `INFO` | Log level |
| `REDACT_LOGS` | boolean | `true` | Redact sensitive data |

### Configuration Functions

```typescript
// Get current configuration
function getConfig(): AppConfig;

// Clear configuration cache
function clearConfigCache(): void;
```

---

## Utilities

### Cache Management

```typescript
class RequestCache {
  constructor(options?: CacheOptions);
  get(key: string): any | null;
  set(key: string, value: any): void;
  clear(): void;
  getStats(): CacheStats;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// Global cache instance
function getGlobalCache(): RequestCache;
function resetGlobalCache(): void;
```

### Rate Limiting

```typescript
class RateLimiter {
  constructor(config?: RateLimiterConfig);
  consume(): Promise<void>;
  queue(): Promise<void>;
  canProceed(): boolean;
  getStatus(): RateLimiterStatus;
  reset(): void;
}

interface RateLimiterConfig {
  maxRequests: number;      // Max requests per window
  windowMs: number;         // Time window in ms
  maxBurst: number;         // Burst capacity
  queueMaxSize: number;     // Max queue size
}

// Global rate limiter
function getGlobalRateLimiter(): RateLimiter;
function resetGlobalRateLimiter(): void;
```

### URL Validation

```typescript
class URLValidator {
  constructor(config?: URLValidationConfig);
  validate(url: string): URL;
  sanitize(url: string): string;
  validateBatch(urls: string[]): ValidationResult[];
}

interface URLValidationConfig {
  allowedProtocols?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowPrivateIPs?: boolean;
  allowLocalhost?: boolean;
}

// Global validator
function getGlobalURLValidator(): URLValidator;
function validateURLInput(url: string): string;
```

### Health Monitoring

```typescript
class HealthCheckService {
  check(detailed?: boolean): Promise<HealthStatus>;
  getStatus(maxAge?: number): Promise<HealthStatus>;
  formatStatus(status: HealthStatus): string;
}

interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  components: {
    api: ComponentHealth;
    cache: ComponentHealth;
    rateLimiter: ComponentHealth;
    config: ComponentHealth;
  };
  metrics?: {
    cacheHitRate?: number;
    rateLimiterTokens?: number;
    uptime?: number;
  };
}

// Health check functions
function checkHealth(detailed?: boolean): Promise<HealthStatus>;
function getHealthReport(): Promise<string>;
```

### Memory Optimization

```typescript
class MemoryOptimizer {
  constructor(options?: OptimizationOptions);
  getMemoryStats(): MemoryStats;
  checkMemoryUsage(): boolean;
  getStats(): OptimizerStats;
  stop(): void;
}

interface OptimizationOptions {
  gcThresholdMB?: number;
  pruneIntervalMs?: number;
  maxHeapUsageMB?: number;
  enableAutoGC?: boolean;
}

// Global optimizer
function getMemoryOptimizer(): MemoryOptimizer;
function resetMemoryOptimizer(): void;
```

### Request Batching

```typescript
class RequestBatcher<T> {
  constructor(
    batchProcessor: (requests: any[]) => Promise<T[]>,
    options?: BatcherOptions
  );
  add(params: any): Promise<T>;
  flush(): Promise<void>;
  getStats(): BatcherStats;
}

interface BatcherOptions {
  maxBatchSize?: number;    // Max requests per batch
  batchDelayMs?: number;    // Batch window
  maxWaitMs?: number;       // Max wait time
}
```

### Resource Pooling

```typescript
class ResourcePool<T> {
  constructor(
    factory: () => Promise<T>,
    destroyer: (resource: T) => Promise<void>,
    options?: PoolOptions
  );
  acquire(): Promise<T>;
  release(resource: T): void;
  getStats(): PoolStats;
  drain(): Promise<void>;
}

interface PoolOptions {
  minSize?: number;
  maxSize?: number;
  acquireTimeoutMs?: number;
  idleTimeoutMs?: number;
}
```

---

## Types

### Common Types

```typescript
// MCP Tool Response
interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Exa API Response
interface ExaSearchResponse {
  results: Array<{
    id: string;
    title?: string;
    url: string;
    publishedDate?: string;
    author?: string;
    text?: string;
  }>;
}

// Request Logger
interface RequestLogger {
  start(): void;
  log(level: string, message: string, data?: any): void;
  error(message: string, error: any): void;
  complete(stats?: any): void;
}
```

---

## Error Handling

### Error Classes

```typescript
class URLValidationError extends Error {
  constructor(message: string);
}

class RateLimitError extends Error {
  constructor(message: string, retryAfter?: number);
  retryAfter?: number;
}

class ConfigurationError extends Error {
  constructor(message: string, errors?: ZodError);
  validationErrors?: ZodError;
}
```

### Error Handling Functions

```typescript
// Handle Exa API errors
function handleExaError(
  error: unknown,
  toolName: string,
  logger: RequestLogger
): ToolResponse;

// Format error response
function formatErrorResponse(
  message: string,
  details?: any
): ToolResponse;
```

### Common Error Patterns

```typescript
// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// Safe JSON parsing
function safeJsonParse<T>(
  json: string,
  fallback: T
): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
```

---

## Examples

### Creating a Custom Tool

```typescript
import { z } from 'zod';
import { toolRegistry } from './config.js';
import { createExaClient } from '../utils/exaClient.js';
import { ResponseFormatter } from '../utils/formatter.js';

const myToolSchema = z.object({
  param1: z.string(),
  param2: z.number().optional()
});

toolRegistry.register({
  name: 'my_custom_tool',
  description: 'My custom search tool',
  schema: myToolSchema,
  enabled: true,
  handler: async (args, context) => {
    const validated = myToolSchema.parse(args);
    const client = createExaClient();
    
    try {
      const response = await client.post('/search', {
        query: validated.param1,
        numResults: validated.param2 || 5
      });
      
      return ResponseFormatter.format(
        response.data.results,
        'My Tool Results'
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
});
```

### Using the Cache

```typescript
import { getGlobalCache } from './utils/cache.js';

const cache = getGlobalCache();

// Check cache
const cached = cache.get('my-key');
if (cached) {
  return cached;
}

// Perform operation
const result = await expensiveOperation();

// Store in cache
cache.set('my-key', result);

// Get cache statistics
const stats = cache.getStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);
```

### Implementing Rate Limiting

```typescript
import { getGlobalRateLimiter } from './utils/rateLimiter.js';

const limiter = getGlobalRateLimiter();

// Check if can proceed
if (!limiter.canProceed()) {
  // Queue the request
  await limiter.queue();
}

// Consume a token
await limiter.consume();

// Perform the operation
const result = await makeApiCall();

// Check status
const status = limiter.getStatus();
console.log(`Tokens available: ${status.tokensAvailable}`);
```

### URL Validation

```typescript
import { getGlobalURLValidator } from './utils/urlValidator.js';

const validator = getGlobalURLValidator();

try {
  // Validate URL
  const url = validator.validate('https://example.com');
  
  // Sanitize URL (remove credentials, hash)
  const clean = validator.sanitize('https://user:pass@example.com#hash');
  
  // Batch validation
  const results = validator.validateBatch([
    'https://example.com',
    'http://localhost',  // Will fail
    'https://google.com'
  ]);
  
} catch (error) {
  if (error instanceof URLValidationError) {
    console.error('Invalid URL:', error.message);
  }
}
```

---

## Best Practices

1. **Always validate input** using Zod schemas
2. **Use the cache** for repeated requests
3. **Implement rate limiting** for API calls
4. **Validate URLs** before making requests
5. **Handle errors gracefully** with proper error messages
6. **Use structured logging** for debugging
7. **Monitor memory usage** in production
8. **Batch requests** when possible
9. **Pool resources** for efficiency
10. **Test thoroughly** with E2E tests

---

## Performance Tips

1. **Enable caching**: Set `CACHE_ENABLED=true`
2. **Batch requests**: Use `RequestBatcher` for multiple calls
3. **Pool connections**: Use `ResourcePool` for reusable resources
4. **Optimize memory**: Enable `MemoryOptimizer`
5. **Monitor health**: Use `HealthCheckService`
6. **Profile performance**: Use Node.js built-in profiler
7. **Reduce payload size**: Use `maxCharacters` parameter
8. **Implement pagination**: Use smaller `numResults` values
9. **Use appropriate timeouts**: Configure `EXA_TIMEOUT`
10. **Enable compression**: Use gzip for large responses
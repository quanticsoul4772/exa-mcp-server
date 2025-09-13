# Testing Guide

## Test Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Jest testing framework

### Installation

```bash
npm install --save-dev jest @types/jest ts-jest
```

### Configuration

Jest configuration is in `jest.config.ts`:

```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**'
  ]
};
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- yourTool.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should handle valid input"
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

## Test Structure

```
src/__tests__/
├── tools/
│   ├── config.test.ts        # Tool registry tests
│   ├── exaSearch.test.ts     # Web search tests
│   ├── researchPaper.test.ts # Research paper tests
│   └── twitter.test.ts       # Twitter search tests
├── utils/
│   ├── exaClient.test.ts     # API client tests
│   ├── formatter.test.ts     # Response formatter tests
│   └── logger.test.ts        # Logger tests
└── types/
    └── cli.test.ts            # CLI argument tests
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { toolRegistry } from '../../tools/config';

describe('Tool Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register tool with correct schema', () => {
    const tool = toolRegistry['exa_search'];
    expect(tool).toBeDefined();
    expect(tool.name).toBe('exa_search');
    expect(tool.schema).toBeDefined();
  });

  it('should handle valid input', async () => {
    const tool = toolRegistry['exa_search'];
    const result = await tool.handler(
      { query: 'test query', numResults: 3 },
      {}
    );
    
    expect(result.content).toBeDefined();
    expect(result.isError).toBeUndefined();
  });
});
```

### Mock Testing

```typescript
import axios from 'axios';
jest.mock('axios');

describe('API Client', () => {
  it('should make API request', async () => {
    const mockResponse = { data: { results: [] } };
    (axios.post as jest.Mock).mockResolvedValue(mockResponse);
    
    // Test implementation
    const result = await makeApiRequest();
    
    expect(axios.post).toHaveBeenCalledWith(
      '/search',
      expect.objectContaining({ query: 'test' })
    );
  });
});
```

### Error Testing

```typescript
describe('Error Handling', () => {
  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    (axios.post as jest.Mock).mockRejectedValue(networkError);
    
    const result = await tool.handler({ query: 'test' }, {});
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });

  it('should handle validation errors', async () => {
    const result = await tool.handler({ query: '' }, {});
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid');
  });
});
```

## Test Patterns

### Testing Tool Schemas

```typescript
import { z } from 'zod';

describe('Schema Validation', () => {
  it('should validate required fields', () => {
    const schema = z.object(toolRegistry['exa_search'].schema);
    
    const validInput = { query: 'test' };
    const result = schema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid input', () => {
    const schema = z.object(toolRegistry['exa_search'].schema);
    
    const invalidInput = { query: 123 }; // Wrong type
    const result = schema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});
```

### Testing Response Formatting

```typescript
describe('Response Formatting', () => {
  it('should format search results', () => {
    const mockData = {
      results: [
        {
          url: 'https://example.com',
          title: 'Test Title',
          text: 'Test content'
        }
      ]
    };
    
    const formatted = ResponseFormatter.formatSearchResults(mockData);
    
    expect(formatted).toContain('Test Title');
    expect(formatted).toContain('https://example.com');
    expect(formatted).toContain('Test content');
  });
});
```

### Testing Async Operations

```typescript
describe('Async Operations', () => {
  it('should handle timeouts', async () => {
    jest.setTimeout(30000);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 25000)
    );
    
    await expect(timeoutPromise).rejects.toThrow('Timeout');
  });
});
```

## Integration Testing

### Testing with MCP Inspector

```bash
# Launch MCP Inspector
npm run inspector
```

The Inspector provides:
- Interactive tool testing
- Request/response visualization
- Parameter validation testing
- Error scenario testing

### End-to-End Testing

```typescript
describe('E2E Tool Flow', () => {
  it('should complete full search flow', async () => {
    // Setup
    process.env.EXA_API_KEY = 'test-key';
    
    // Execute
    const server = new ExaServer(new Set(['exa_search']));
    await server.run();
    
    // Verify
    expect(server.getRegisteredTools()).toContain('exa_search');
  });
});
```

## Test Data

### Mock Data Files

Create test fixtures in `__tests__/fixtures/`:

```typescript
// __tests__/fixtures/searchResponse.json
{
  "results": [
    {
      "url": "https://example.com",
      "title": "Test Result",
      "publishedDate": "2024-01-15",
      "text": "Test content"
    }
  ]
}
```

### Using Test Data

```typescript
import searchResponse from '../fixtures/searchResponse.json';

describe('Data Processing', () => {
  it('should process mock data', () => {
    const result = processSearchResults(searchResponse);
    expect(result).toBeDefined();
  });
});
```

## Environment Testing

### Test Environment Variables

```typescript
describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should require API key', () => {
    delete process.env.EXA_API_KEY;
    
    expect(() => new ExaServer(new Set()))
      .toThrow('EXA_API_KEY environment variable is not set');
  });
});
```

## Performance Testing

### Measuring Execution Time

```typescript
describe('Performance', () => {
  it('should complete within timeout', async () => {
    const startTime = Date.now();
    
    await tool.handler({ query: 'test' }, {});
    
    const executionTime = Date.now() - startTime;
    expect(executionTime).toBeLessThan(25000);
  });
});
```

## Debugging Tests

### Debug Output

```typescript
describe('Debug Tests', () => {
  it('should log debug information', () => {
    const consoleSpy = jest.spyOn(console, 'error');
    
    // Run test
    await tool.handler({ query: 'test' }, {});
    
    // Check debug output
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EXA-MCP-DEBUG]')
    );
  });
});
```

### Using Node Inspector

```bash
# Run tests with inspector
node --inspect-brk ./node_modules/.bin/jest

# Connect Chrome DevTools
# Navigate to chrome://inspect
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      
      - uses: codecov/codecov-action@v2
        with:
          file: ./coverage/lcov.info
```

## Test Checklist

### Before Committing

- [ ] All tests pass locally
- [ ] Coverage meets minimum threshold (80%)
- [ ] No console.log statements in tests
- [ ] Mock data is realistic
- [ ] Error cases are tested
- [ ] Edge cases are covered
- [ ] Performance tests pass

### Test Categories

1. **Unit Tests**: Individual functions
2. **Integration Tests**: Component interactions
3. **E2E Tests**: Complete workflows
4. **Performance Tests**: Timing and efficiency
5. **Error Tests**: Failure scenarios

## Common Issues

### Test Timeouts

```typescript
// Increase timeout for slow tests
jest.setTimeout(60000);

// Or per test
it('should handle slow operation', async () => {
  // Test code
}, 60000);
```

### Mock Cleanup

```typescript
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
```

### Async Test Errors

```typescript
// Always return or await async operations
it('should handle async', async () => {
  await expect(asyncFunction()).resolves.toBeDefined();
});

// Or return the promise
it('should handle async', () => {
  return expect(asyncFunction()).resolves.toBeDefined();
});
```

## Test Utilities

### Custom Matchers

```typescript
expect.extend({
  toBeValidUrl(received) {
    const pass = /^https?:\/\/.+/.test(received);
    return {
      pass,
      message: () => `Expected ${received} to be a valid URL`
    };
  }
});

// Usage
expect(result.url).toBeValidUrl();
```

### Test Helpers

```typescript
// __tests__/helpers/testUtils.ts
export function createMockTool(overrides = {}) {
  return {
    name: 'test_tool',
    description: 'Test tool',
    schema: {},
    handler: jest.fn(),
    enabled: true,
    ...overrides
  };
}
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing TypeScript](https://www.typescriptlang.org/docs/handbook/testing.html)
- [MCP Testing Guide](https://modelcontextprotocol.io/docs/testing)

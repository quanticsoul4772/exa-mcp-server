# Testing Guide

## Overview

The exa-mcp-server includes a comprehensive testing suite with 118 tests covering unit, integration, and end-to-end scenarios.

## Test Structure

```
src/__tests__/
├── config/              # Configuration tests
│   └── index.test.ts
├── helpers/             # Test utilities
│   ├── e2eSetup.ts     # E2E test environment
│   └── testServer.ts   # Mock HTTP server
├── integration/         # E2E tests
│   └── tools.e2e.test.ts
├── tools/              # Tool-specific tests
│   ├── config.test.ts
│   └── validation.test.ts
├── utils/              # Utility tests
│   ├── cache.test.ts
│   ├── formatter.test.ts
│   ├── logger.test.ts
│   ├── rateLimiter.test.ts
│   └── urlValidator.test.ts
└── setup.ts           # Test setup file
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- cache.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should validate URL"
```

### Test Categories

```bash
# Unit tests only
npm test -- --testPathIgnorePatterns=e2e

# E2E tests only
npm test -- --testPathPattern=e2e

# Tool tests only
npm test -- --testPathPattern=tools

# Utility tests only
npm test -- --testPathPattern=utils
```

## Unit Testing

### Testing Utilities

Example: Testing the cache system

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RequestCache } from '../../utils/cache.js';

describe('RequestCache', () => {
  let cache: RequestCache;

  beforeEach(() => {
    cache = new RequestCache({ 
      maxSize: 5, 
      ttlMinutes: 1 
    });
  });

  afterEach(() => {
    cache.clear();
  });

  it('should store and retrieve values', () => {
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('should track hit rate', () => {
    cache.set('key', 'value');
    cache.get('key'); // hit
    cache.get('missing'); // miss
    
    const stats = cache.getStats();
    expect(stats.hitRate).toBe(50);
  });
});
```

### Testing Tools

Example: Testing a search tool

```typescript
describe('WebSearchTool', () => {
  it('should validate input parameters', async () => {
    const result = await webSearchTool.handler({
      // Missing required 'query' field
      numResults: 5
    }, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('should format results correctly', async () => {
    const mockResults = [{
      title: 'Test',
      url: 'https://example.com',
      text: 'Content'
    }];

    const formatted = ResponseFormatter.format(mockResults);
    expect(formatted.content[0].text).toContain('Test');
  });
});
```

## E2E Testing

### Test Server Setup

The E2E tests use a real HTTP server to mock the Exa API:

```typescript
import { E2ETestSetup } from '../helpers/e2eSetup.js';

describe('Tool E2E Tests', () => {
  let e2e: E2ETestSetup;

  beforeAll(async () => {
    e2e = new E2ETestSetup();
    await e2e.start();
  });

  afterAll(async () => {
    await e2e.stop();
  });

  beforeEach(() => {
    e2e.clearMocks();
  });
});
```

### E2E Test Examples

```typescript
it('should perform web search', async () => {
  // Mock API response
  e2e.mockSuccessfulSearch([{
    id: '1',
    title: 'Result',
    url: 'https://example.com',
    text: 'Content'
  }]);

  // Import tool after setup
  const { webSearchTool } = await import('../../tools/webSearch.js');

  // Execute search
  const result = await webSearchTool.handler({
    query: 'test'
  }, {});

  // Verify results
  expect(result.isError).toBeUndefined();
  expect(result.content[0].text).toContain('Result');

  // Verify API was called
  e2e.assertApiCalled('/search', 1);
});

it('should handle errors', async () => {
  e2e.mockFailedSearch('Server Error', 500);

  const { webSearchTool } = await import('../../tools/webSearch.js');
  
  const result = await webSearchTool.handler({
    query: 'test'
  }, {});

  expect(result.isError).toBe(true);
});
```

## Mocking

### Mocking Dependencies

```typescript
// Mock logger
jest.mock('../../utils/pinoLogger.js', () => ({
  createRequestLogger: jest.fn(() => ({
    start: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    complete: jest.fn()
  })),
  structuredLogger: {
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  }
}));

// Mock cache
jest.mock('../../utils/cache.js', () => ({
  getGlobalCache: jest.fn(() => ({
    get: jest.fn(() => null),
    set: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(() => ({ 
      hits: 0, 
      misses: 0, 
      size: 0, 
      hitRate: 0 
    }))
  }))
}));
```

### Mock Data Generators

```typescript
// Generate mock search results
function generateMockResults(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    title: `Result ${i}`,
    url: `https://example.com/${i}`,
    text: `Content for result ${i}`,
    publishedDate: new Date().toISOString()
  }));
}

// Generate mock error
function generateMockError(status: number) {
  return {
    response: {
      status,
      data: { error: 'Mock error' }
    },
    isAxiosError: true
  };
}
```

## Test Coverage

### Current Coverage

```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   92.34 |    88.12 |   90.45 |   91.78 |
 config/            |   95.12 |    91.30 |   93.75 |   94.87 |
 tools/             |   89.45 |    85.71 |   88.23 |   89.12 |
 utils/             |   93.67 |    89.47 |   91.30 |   93.02 |
--------------------|---------|----------|---------|---------|
```

### Coverage Reports

```bash
# Generate HTML coverage report
npm run test:coverage

# Open coverage report
open coverage/lcov-report/index.html
```

### Coverage Configuration

In `jest.config.ts`:

```typescript
{
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

## Test Environment

### Environment Variables

Tests use specific environment variables:

```bash
# Test environment
NODE_ENV=test
LOG_LEVEL=ERROR
EXA_API_KEY=test-api-key
EXA_RETRIES=0
EXA_TIMEOUT=2000
CACHE_ENABLED=false
```

### Test Timeouts

Configure timeouts for different test types:

```typescript
// Unit tests - fast
describe('Unit Test', () => {
  it('should complete quickly', async () => {
    // Test code
  }, 1000); // 1 second timeout
});

// Integration tests - moderate
describe('Integration Test', () => {
  it('should handle API calls', async () => {
    // Test code
  }, 5000); // 5 second timeout
});

// E2E tests - slower
describe('E2E Test', () => {
  it('should complete workflow', async () => {
    // Test code
  }, 10000); // 10 second timeout
});
```

## Best Practices

### 1. Test Isolation

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

afterEach(() => {
  cache.clear();
  resetGlobalRateLimiter();
});
```

### 2. Descriptive Test Names

```typescript
// Good
it('should return 429 error when rate limit is exceeded', ...);

// Bad
it('should work', ...);
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should validate URL correctly', () => {
  // Arrange
  const validator = new URLValidator();
  const testUrl = 'https://example.com';

  // Act
  const result = validator.validate(testUrl);

  // Assert
  expect(result.protocol).toBe('https:');
  expect(result.hostname).toBe('example.com');
});
```

### 4. Test Edge Cases

```typescript
describe('Edge Cases', () => {
  it('should handle empty input', ...);
  it('should handle null values', ...);
  it('should handle maximum size', ...);
  it('should handle special characters', ...);
  it('should handle concurrent requests', ...);
});
```

### 5. Use Test Fixtures

```typescript
// fixtures/searchResults.json
{
  "valid": [{
    "id": "1",
    "title": "Test",
    "url": "https://example.com"
  }],
  "empty": [],
  "malformed": [{ "invalid": "data" }]
}

// In test
import fixtures from './fixtures/searchResults.json';

it('should handle valid results', () => {
  const result = formatter.format(fixtures.valid);
  // assertions
});
```

## Debugging Tests

### Debug Single Test

```bash
# Run test with debugging
node --inspect-brk node_modules/.bin/jest --runInBand cache.test.ts

# With VS Code debugger
# Add breakpoint and use "Debug Jest Tests" configuration
```

### Verbose Output

```bash
# Show all test output
npm test -- --verbose

# Show console.log statements
npm test -- --silent=false
```

### Test Specific Scenarios

```typescript
// Skip tests
describe.skip('Skipped Suite', () => {
  it('will not run', () => {});
});

// Run only specific test
it.only('will run exclusively', () => {});

// Conditional tests
const isCI = process.env.CI === 'true';
(isCI ? it : it.skip)('runs only in CI', () => {});
```

## Continuous Integration

### GitHub Actions Configuration

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
      - run: npm run build
      - run: npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

## Performance Testing

### Load Testing Example

```typescript
describe('Performance', () => {
  it('should handle 100 concurrent requests', async () => {
    const promises = Array.from({ length: 100 }, () =>
      webSearchTool.handler({ query: 'test' }, {})
    );

    const start = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
    expect(results.every(r => !r.isError)).toBe(true);
  });

  it('should maintain cache performance', () => {
    const cache = new RequestCache({ maxSize: 1000 });
    
    // Populate cache
    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    // Measure retrieval time
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      cache.get(`key${i}`);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // < 10ms
  });
});
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout: `jest.setTimeout(10000)`
   - Check for missing `await` statements
   - Verify mock server is running

2. **Module not found**
   - Clear Jest cache: `npx jest --clearCache`
   - Check import paths (.js extensions)
   - Verify tsconfig.json settings

3. **Mocks not working**
   - Ensure mocks are before imports
   - Use `jest.resetModules()`
   - Check mock path matches actual

4. **Flaky tests**
   - Add proper cleanup in afterEach
   - Use fixed timestamps/data
   - Avoid time-dependent assertions

5. **Coverage gaps**
   - Add tests for error paths
   - Test edge cases
   - Cover all branches

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Mock Service Worker](https://mswjs.io/)
- [Test Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
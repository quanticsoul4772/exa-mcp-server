import { describe, it, expect, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { createSearchTool } from '../../tools/tool-builder.js';

// Mock the exaClient module at the top level
jest.mock('../../utils/pinoLogger.js', () => ({
  createRequestLogger: jest.fn(() => ({
    start: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    complete: jest.fn()
  })),
  generateRequestId: jest.fn(() => 'test-request-id'),
  structuredLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  }
}));

jest.mock('../../utils/exaClient.js', () => ({
  createExaClient: () => ({
    post: jest.fn().mockResolvedValue({
      data: {
        results: [{
          id: '1',
          title: 'Test Result',
          url: 'https://example.com',
          publishedDate: '2024-01-01',
          author: 'Test Author',
          text: 'Test content'
        }]
      }
    })
  }),
  handleExaError: jest.fn()
}));

describe('Tool Runtime Validation', () => {
  beforeEach(() => {
    // Mock environment for tests to avoid config validation errors
    process.env.EXA_API_KEY = 'test-api-key-for-validation-tests';
  });
  it('should validate arguments and return error for invalid input', async () => {
    const testSchema = z.object({
      query: z.string().describe('Search query'),
      numResults: z.coerce.number().optional().describe('Number of results')
    });

    const testTool = createSearchTool(
      'test_search',
      'Test search tool',
      testSchema,
      true,
      ({ query, numResults }: { query: string; numResults?: number }) => ({
        query,
        type: 'auto',
        numResults: numResults || 3,
        contents: { text: { maxCharacters: 3000 } }
      })
    );

    // Test with invalid arguments (missing required query)
    const result = await testTool.handler({}, {});
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments for test_search');
    expect(result.content[0].text).toContain('query: Required');
  });

  it('should validate arguments and proceed with valid input', async () => {
    const testSchema = z.object({
      query: z.string().describe('Search query'),
      numResults: z.coerce.number().optional().describe('Number of results')
    });

    const testTool = createSearchTool(
      'test_search',
      'Test search tool',
      testSchema,
      true,
      ({ query, numResults }: { query: string; numResults?: number }) => ({
        query,
        type: 'auto',
        numResults: numResults || 3,
        contents: { text: { maxCharacters: 3000 } }
      })
    );

    // Test with valid arguments
    const result = await testTool.handler({ query: 'test query' }, {});
    
    // Should not be an error (though it might fail due to mocking issues)
    // The important part is that validation passed
    expect(result.isError).not.toBe(true);
  });
});

import { ResponseFormatter } from '../../utils/formatter.js';
import { ExaSearchResponse, ExaSearchResult } from '../../types.js';

describe('ResponseFormatter', () => {
  describe('formatSearchResponse', () => {
    it('should format a search response with results', () => {
      const mockResponse: ExaSearchResponse = {
        requestId: 'test-123',
        results: [
          {
            id: '1',
            title: 'Test Article',
            url: 'https://example.com/test',
            publishedDate: '2024-01-15',
            author: 'John Doe',
            text: 'This is a test article with some content that should be truncated if it exceeds the maximum length...',
          },
          {
            id: '2',
            title: 'Another Article',
            url: 'https://example.com/another',
            publishedDate: '2024-01-16',
            author: '',
            text: 'Short content',
          },
        ],
      };

      const formatted = ResponseFormatter.formatSearchResponse(mockResponse, 'exa_search');
      
      expect(formatted).toContain('Found 2 results');
      expect(formatted).toContain('Test Article');
      expect(formatted).toContain('https://example.com/test');
      expect(formatted).toContain('John Doe');
      expect(formatted).toContain('Jan 15, 2024');
    });

    it('should handle empty results', () => {
      const mockResponse: ExaSearchResponse = {
        requestId: 'test-123',
        results: [],
      };

      const formatted = ResponseFormatter.formatSearchResponse(mockResponse, 'web_search');
      expect(formatted).toBe('No results found.');
    });
  });

  describe('formatContentsResponse', () => {
    it('formats each fetched page and lists failed URLs', () => {
      const formatted = ResponseFormatter.formatContentsResponse({
        requestId: 'r',
        results: [{ id: '1', title: 'Crawled Page', url: 'https://example.com/page', author: 'Jane Smith', text: 'Full content.' }],
        statuses: [
          { id: 'https://example.com/page', status: 'success' },
          { id: 'https://bad.example', status: 'error', error: { tag: 'CRAWL_TIMEOUT', httpStatusCode: null } }
        ],
        costDollars: { total: 0.002 }
      });
      expect(formatted).toContain('Crawled Page');
      expect(formatted).toContain('Author: Jane Smith');
      expect(formatted).toContain('Full content.');
      expect(formatted).toContain('https://bad.example: CRAWL_TIMEOUT');
      expect(formatted).not.toContain('https://example.com/page: ');
      expect(formatted).toContain('Estimated cost: $0.0020');
    });

    it('handles an empty response', () => {
      expect(ResponseFormatter.formatContentsResponse({ requestId: 'r', results: [] }))
        .toBe('Could not fetch content from the provided URLs.');
    });
  });

  describe('formatSynthesizedOutput', () => {
    it('renders string content as-is and objects as JSON with grounding', () => {
      expect(ResponseFormatter.formatSynthesizedOutput('plain answer')).toContain('plain answer');
      const formatted = ResponseFormatter.formatSynthesizedOutput(
        { price: 10 },
        [{ field: 'price', citations: [{ url: 'https://p.com' }], confidence: 'low' }]
      );
      expect(formatted).toContain('"price": 10');
      expect(formatted).toContain('price (low confidence): https://p.com');
    });
  });

  describe('summary label', () => {
    it('drops a leading Summary: label from Exa summaries', () => {
      const formatted = ResponseFormatter.formatContentsResponse({
        requestId: 'r', results: [{ id: '1', url: 'https://a.com', summary: 'Summary: The gist.' }]
      });
      expect(formatted).toContain('**Summary:** The gist.');
      expect(formatted).not.toContain('Summary: Summary:');
    });
  });

  describe('formatCost', () => {
    it('formats total cost and is empty without one', () => {
      expect(ResponseFormatter.formatCost({ total: 0.1 })).toBe('Estimated cost: $0.1000');
      expect(ResponseFormatter.formatCost(undefined)).toBe('');
      expect(ResponseFormatter.formatCost({})).toBe('');
    });
  });

  describe('formatError', () => {
    it('should format axios error with response', () => {
      const error = {
        response: {
          data: {
            message: 'API rate limit exceeded',
          },
        },
      };

      const formatted = ResponseFormatter.formatError(error, 'exa_search');
      expect(formatted).toContain('Error in exa search');
      expect(formatted).toContain('API rate limit exceeded');
    });

    it('should format generic error', () => {
      const error = new Error('Network timeout');
      const formatted = ResponseFormatter.formatError(error, 'exa_search');
      expect(formatted).toContain('Error in exa search');
      expect(formatted).toContain('Network timeout');
    });

    it('should handle unknown error', () => {
      const formatted = ResponseFormatter.formatError({}, 'exa_search');
      expect(formatted).toContain('Error in exa search');
      expect(formatted).toContain('Unexpected error');
    });
  });

  describe('full content', () => {
    it('shows the whole fetched text, whitespace collapsed', () => {
      const result: ExaSearchResult = {
        id: '1',
        title: 'Test',
        url: 'https://example.com',
        text: 'A'.repeat(400) + '\n\n  end',
        highlights: ['B'.repeat(450)],
      };

      const formatted = ResponseFormatter.formatSearchResult(result, 1);
      expect(formatted).toContain('A'.repeat(400) + ' end');
      expect(formatted).toContain('B'.repeat(450));
      expect(formatted).not.toContain('...');
    });

    it('shows subpage summary and text', () => {
      const result: ExaSearchResult = {
        id: '1',
        url: 'https://example.com',
        subpages: [{ url: 'https://example.com/about', title: 'About', summary: 'Summary: Who we are', text: 'Founded in 2020' }],
      };

      const formatted = ResponseFormatter.formatSearchResult(result, 1);
      expect(formatted).toContain('About: https://example.com/about');
      expect(formatted).toContain('Summary: Who we are');
      expect(formatted).toContain('Text: Founded in 2020');
    });
  });

});

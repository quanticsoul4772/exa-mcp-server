import { ResponseFormatter } from '../../utils/formatter.js';
import { ExaSearchResponse, ExaSearchResult } from '../../types.js';

describe('ResponseFormatter', () => {
  describe('formatSearchResponse', () => {
    it('should format a search response with results', () => {
      const mockResponse: ExaSearchResponse = {
        requestId: 'test-123',
        autopromptString: 'test query',
        resolvedSearchType: 'auto',
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
        autopromptString: 'test query',
        resolvedSearchType: 'auto',
        results: [],
      };

      const formatted = ResponseFormatter.formatSearchResponse(mockResponse, 'web_search');
      expect(formatted).toBe('No results found.');
    });
  });

  describe('formatCrawlResponse', () => {
    it('should format a crawl response', () => {
      const mockResults: ExaSearchResult[] = [
        {
          id: '1',
          title: 'Crawled Page',
          url: 'https://example.com/page',
          publishedDate: '2024-01-15',
          author: 'Jane Smith',
          text: 'This is the full content of the crawled page.',
        },
      ];

      const formatted = ResponseFormatter.formatCrawlResponse(mockResults);
      
      expect(formatted).toContain('Content from: https://example.com/page');
      expect(formatted).toContain('Title: Crawled Page');
      expect(formatted).toContain('Author: Jane Smith');
      expect(formatted).toContain('This is the full content of the crawled page.');
    });

    it('should handle empty crawl results', () => {
      const formatted = ResponseFormatter.formatCrawlResponse([]);
      expect(formatted).toBe('Could not fetch content from the provided URL.');
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
      expect(formatted).toContain('An unknown error occurred');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const result: ExaSearchResult = {
        id: '1',
        title: 'Test',
        url: 'https://example.com',
        publishedDate: '2024-01-01',
        author: '',
        text: 'A'.repeat(400),
      };

      const formatted = ResponseFormatter.formatSearchResult(result, 1);
      expect(formatted).toContain('...');
      expect(formatted.indexOf('A'.repeat(300))).toBeGreaterThan(-1);
    });

    it('should not truncate short text', () => {
      const result: ExaSearchResult = {
        id: '1',
        title: 'Test',
        url: 'https://example.com',
        publishedDate: '2024-01-01',
        author: '',
        text: 'Short text',
      };

      const formatted = ResponseFormatter.formatSearchResult(result, 1);
      expect(formatted).toContain('Short text');
      expect(formatted).not.toContain('...');
    });
  });

  describe('formatTwitterResponse', () => {
    it('should format Twitter search results', () => {
      const mockResults: ExaSearchResult[] = [
        {
          id: '1',
          title: 'Tweet about AI',
          url: 'https://twitter.com/user/status/123',
          publishedDate: '2024-01-15',
          author: '@techuser',
          text: 'Just discovered this amazing AI tool that can help with coding!',
        },
      ];

      const formatted = ResponseFormatter.formatTwitterResponse(mockResults);
      
      expect(formatted).toContain('Found 1 tweets');
      expect(formatted).toContain('Tweet about AI');
      expect(formatted).toContain('https://twitter.com/user/status/123');
      expect(formatted).toContain('@techuser');
      expect(formatted).toContain('Just discovered this amazing AI tool that can help with coding!');
    });

    it('should handle empty Twitter results', () => {
      const formatted = ResponseFormatter.formatTwitterResponse([]);
      expect(formatted).toBe('No tweets found.');
    });
  });

  describe('formatResearchPaperResponse', () => {
    it('should format research paper results', () => {
      const mockResults: ExaSearchResult[] = [
        {
          id: '1',
          title: 'Deep Learning in Medical Imaging',
          url: 'https://arxiv.org/abs/2401.12345',
          publishedDate: '2024-01-15',
          author: 'Smith et al.',
          text: 'This paper presents a novel approach to medical image analysis using deep learning...',
        },
      ];

      const formatted = ResponseFormatter.formatResearchPaperResponse(mockResults);
      
      expect(formatted).toContain('Found 1 research papers');
      expect(formatted).toContain('Deep Learning in Medical Imaging');
      expect(formatted).toContain('Authors: Smith et al.');
      expect(formatted).toContain('Abstract:');
    });
  });

  describe('formatCompanyResponse', () => {
    it('should format company research results', () => {
      const mockResults: ExaSearchResult[] = [
        {
          id: '1',
          title: 'TechCorp - Leading Innovation',
          url: 'https://techcorp.com',
          publishedDate: '2024-01-15',
          author: '',
          text: 'TechCorp is a leading technology company specializing in AI solutions...',
        },
      ];

      const formatted = ResponseFormatter.formatCompanyResponse(mockResults);
      
      expect(formatted).toContain('Found 1 company-related results');
      expect(formatted).toContain('TechCorp - Leading Innovation');
      expect(formatted).toContain('Summary:');
    });
  });

  describe('formatCompetitorResponse', () => {
    it('should format competitor results', () => {
      const mockResults: ExaSearchResult[] = [
        {
          id: '1',
          title: 'CompetitorAI Inc',
          url: 'https://competitorai.com',
          publishedDate: '',
          author: '',
          text: 'AI-powered search and analysis platform...',
        },
      ];

      const formatted = ResponseFormatter.formatCompetitorResponse(mockResults);
      
      expect(formatted).toContain('Found 1 potential competitors');
      expect(formatted).toContain('CompetitorAI Inc');
      expect(formatted).toContain('Description:');
    });
  });
});

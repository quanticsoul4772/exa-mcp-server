import { describe, it, expect } from '@jest/globals';
import { isExaSearchResponse, isExaCrawlResponse } from '../types.js';

describe('Type Guards', () => {
  describe('isExaSearchResponse', () => {
    it('should return true for valid search response', () => {
      const validResponse = {
        requestId: '123',
        autopromptString: 'test',
        resolvedSearchType: 'keyword',
        results: [
          {
            id: '1',
            url: 'https://example.com',
            title: 'Example',
            text: 'Content'
          }
        ]
      };
      
      expect(isExaSearchResponse(validResponse)).toBe(true);
    });

    it('should return true for empty results', () => {
      const response = {
        requestId: '123',
        autopromptString: 'test',
        resolvedSearchType: 'keyword',
        results: []
      };
      
      expect(isExaSearchResponse(response)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isExaSearchResponse(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isExaSearchResponse(undefined)).toBe(false);
    });

    it('should return false for missing requestId', () => {
      const response = {
        results: []
      };
      
      expect(isExaSearchResponse(response)).toBe(false);
    });

    it('should return false for missing results', () => {
      const response = {
        requestId: '123'
      };
      
      expect(isExaSearchResponse(response)).toBe(false);
    });

    it('should return false for non-array results', () => {
      const response = {
        requestId: '123',
        results: 'not-an-array'
      };
      
      expect(isExaSearchResponse(response)).toBe(false);
    });

    it('should return false for primitive types', () => {
      expect(isExaSearchResponse('string')).toBe(false);
      expect(isExaSearchResponse(123)).toBe(false);
      expect(isExaSearchResponse(true)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isExaSearchResponse([])).toBe(false);
      expect(isExaSearchResponse([1, 2, 3])).toBe(false);
    });
  });

  describe('isExaCrawlResponse', () => {
    it('should return true for valid crawl response', () => {
      const validResponse = {
        requestId: '456',
        results: [
          {
            id: '1',
            url: 'https://example.com',
            text: 'Crawled content'
          }
        ]
      };
      
      expect(isExaCrawlResponse(validResponse)).toBe(true);
    });

    it('should return true for empty results', () => {
      const response = {
        requestId: '456',
        results: []
      };
      
      expect(isExaCrawlResponse(response)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isExaCrawlResponse(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isExaCrawlResponse(undefined)).toBe(false);
    });

    it('should return false for missing requestId', () => {
      const response = {
        results: []
      };
      
      expect(isExaCrawlResponse(response)).toBe(false);
    });

    it('should return false for missing results', () => {
      const response = {
        requestId: '456'
      };
      
      expect(isExaCrawlResponse(response)).toBe(false);
    });

    it('should return false for non-array results', () => {
      const response = {
        requestId: '456',
        results: 'not-an-array'
      };
      
      expect(isExaCrawlResponse(response)).toBe(false);
    });

    it('should return false for primitive types', () => {
      expect(isExaCrawlResponse('string')).toBe(false);
      expect(isExaCrawlResponse(123)).toBe(false);
      expect(isExaCrawlResponse(true)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isExaCrawlResponse([])).toBe(false);
      expect(isExaCrawlResponse([1, 2, 3])).toBe(false);
    });

    it('should handle complex nested objects', () => {
      const complexResponse = {
        requestId: '789',
        results: [
          {
            id: '1',
            url: 'https://example.com',
            title: 'Title',
            text: 'Text content',
            publishedDate: '2024-01-01',
            author: 'Author Name',
            image: 'https://example.com/image.jpg',
            favicon: 'https://example.com/favicon.ico',
            score: 0.95
          }
        ]
      };
      
      expect(isExaCrawlResponse(complexResponse)).toBe(true);
    });
  });

  describe('Type guard edge cases', () => {
    it('should handle objects with extra properties', () => {
      const responseWithExtras = {
        requestId: '999',
        results: [],
        extraField: 'should not affect validation',
        anotherExtra: 123
      };
      
      expect(isExaSearchResponse(responseWithExtras)).toBe(true);
      expect(isExaCrawlResponse(responseWithExtras)).toBe(true);
    });

    it('should handle objects with null results array', () => {
      const responseWithNull = {
        requestId: '999',
        results: null
      };
      
      expect(isExaSearchResponse(responseWithNull)).toBe(false);
      expect(isExaCrawlResponse(responseWithNull)).toBe(false);
    });

    it('should handle functions', () => {
      const func = () => ({ requestId: '123', results: [] });
      
      expect(isExaSearchResponse(func)).toBe(false);
      expect(isExaCrawlResponse(func)).toBe(false);
    });

    it('should handle symbols', () => {
      const sym = Symbol('test');
      
      expect(isExaSearchResponse(sym)).toBe(false);
      expect(isExaCrawlResponse(sym)).toBe(false);
    });
  });
});
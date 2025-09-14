import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// Define the schema as in the actual implementation
const answerSchema = z.object({
  query: z.string().min(1).max(2000).describe("Question to answer"),
  numResults: z.number().min(1).max(10).optional().default(5),
  useAutoprompt: z.boolean().optional().default(true),
  includeText: z.boolean().optional().default(true),
  textMaxCharacters: z.number().optional().default(500),
  includeHtmlTags: z.boolean().optional().default(false),
  includeHighlights: z.boolean().optional().default(false),
  highlightsPerUrl: z.number().min(1).max(5).optional()
});

// Helper function to create request
function createRequest(args: any) {
  return {
    query: args.query,
    numResults: args.numResults,
    useAutoprompt: args.useAutoprompt,
    text: args.includeText ? {
      maxCharacters: args.textMaxCharacters,
      includeHtmlTags: args.includeHtmlTags
    } : false,
    highlights: args.includeHighlights ? {
      highlightsPerUrl: args.highlightsPerUrl || 3
    } : false
  };
}

// Helper function to format response
function formatResponse(data: any) {
  let output = `## Answer\n\n${data.answer}\n\n## Citations\n\n`;
  data.citations.forEach((citation: any, idx: number) => {
    output += `### ${idx + 1}. [${citation.title}](${citation.url})\n`;
    output += `Relevance: ${(citation.score * 100).toFixed(1)}%\n`;
    if (citation.text) {
      output += `\n${citation.text.substring(0, 200)}...\n`;
    }
    if (citation.highlights?.length) {
      output += `\n**Key Points:**\n`;
      citation.highlights.forEach((h: string) => output += `- ${h}\n`);
    }
    output += '\n';
  });
  return output;
}

describe('Answer Tool', () => {
  describe('Schema Validation', () => {
    it('should validate query length', () => {
      const result = answerSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
    });

    it('should accept valid query', () => {
      const result = answerSchema.safeParse({ query: 'What is quantum computing?' });
      expect(result.success).toBe(true);
    });

    it('should enforce query max length', () => {
      const longQuery = 'a'.repeat(2001);
      const result = answerSchema.safeParse({ query: longQuery });
      expect(result.success).toBe(false);
    });

    it('should validate numResults range', () => {
      const tooFew = answerSchema.safeParse({ query: 'test', numResults: 0 });
      expect(tooFew.success).toBe(false);

      const tooMany = answerSchema.safeParse({ query: 'test', numResults: 11 });
      expect(tooMany.success).toBe(false);

      const justRight = answerSchema.safeParse({ query: 'test', numResults: 5 });
      expect(justRight.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = answerSchema.parse({ query: 'test' });
      expect(result.numResults).toBe(5);
      expect(result.useAutoprompt).toBe(true);
      expect(result.includeText).toBe(true);
      expect(result.textMaxCharacters).toBe(500);
    });
  });

  describe('Request Creation', () => {
    it('should create correct request format', () => {
      const args = {
        query: 'What is quantum computing?',
        numResults: 3,
        includeHighlights: true,
        highlightsPerUrl: 3,
        includeText: true,
        textMaxCharacters: 500,
        includeHtmlTags: false,
        useAutoprompt: true
      };
      const request = createRequest(args);
      expect(request).toMatchObject({
        query: 'What is quantum computing?',
        numResults: 3,
        highlights: { highlightsPerUrl: 3 }
      });
    });

    it('should handle text options correctly', () => {
      const args = {
        query: 'test',
        includeText: true,
        textMaxCharacters: 1000,
        includeHtmlTags: true
      };
      const request = createRequest(args);
      expect(request.text).toEqual({
        maxCharacters: 1000,
        includeHtmlTags: true
      });
    });

    it('should disable text when includeText is false', () => {
      const args = {
        query: 'test',
        includeText: false
      };
      const request = createRequest(args);
      expect(request.text).toBe(false);
    });
  });

  describe('Response Formatting', () => {
    it('should format response correctly', () => {
      const mockResponse = {
        answer: 'Quantum computing is a type of computing that uses quantum phenomena.',
        citations: [{
          url: 'https://example.com',
          title: 'Example Article',
          score: 0.95,
          text: 'Sample text about quantum computing'
        }],
        processingTime: 1234
      };
      const formatted = formatResponse(mockResponse);
      expect(formatted).toContain('## Answer');
      expect(formatted).toContain('Quantum computing is');
      expect(formatted).toContain('95.0%');
      expect(formatted).toContain('Example Article');
    });

    it('should handle highlights in response', () => {
      const mockResponse = {
        answer: 'Test answer',
        citations: [{
          url: 'https://example.com',
          title: 'Test',
          score: 0.8,
          highlights: ['First highlight', 'Second highlight']
        }]
      };
      const formatted = formatResponse(mockResponse);
      expect(formatted).toContain('**Key Points:**');
      expect(formatted).toContain('- First highlight');
      expect(formatted).toContain('- Second highlight');
    });

    it('should handle multiple citations', () => {
      const mockResponse = {
        answer: 'Test answer',
        citations: [
          { url: 'https://example1.com', title: 'First', score: 0.9 },
          { url: 'https://example2.com', title: 'Second', score: 0.8 },
          { url: 'https://example3.com', title: 'Third', score: 0.7 }
        ]
      };
      const formatted = formatResponse(mockResponse);
      expect(formatted).toContain('### 1. [First]');
      expect(formatted).toContain('### 2. [Second]');
      expect(formatted).toContain('### 3. [Third]');
    });
  });
});
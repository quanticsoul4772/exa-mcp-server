import { ExaSearchResult, ExaSearchResponse } from "../types.js";

/**
 * Formats Exa search responses into human-readable text.
 * Provides static methods for formatting different types of responses.
 * All methods return single-line formatted text for Claude UI compatibility.
 * 
 * @class ResponseFormatter
 */
export class ResponseFormatter {
  /**
   * Format a complete search response.
   * 
   * @param {ExaSearchResponse} response - The search response from Exa API
   * @param {string} toolName - Name of the tool that made the request
   * @returns {string} Formatted multi-line string with search results
   * 
   * @example
   * ```typescript
   * const formatted = ResponseFormatter.formatSearchResponse(response, 'exa_search');
   * ```
   */
  static formatSearchResponse(response: ExaSearchResponse, toolName: string): string {
    if (!response.results || response.results.length === 0) {
      return "No results found.";
    }

    const lines: string[] = [];
    
    lines.push(`Found ${response.results.length} results for your ${toolName.replace('_', ' ')} query:\n`);

    response.results.forEach((result, index) => {
      lines.push(this.formatSearchResult(result, index + 1));
    });

    return lines.join('\n');
  }

  /**
   * Format a single search result
   */
  static formatSearchResult(result: ExaSearchResult, index: number): string {
    const lines: string[] = [];
    
    lines.push(`${index}. ${result.title || 'Untitled'}`);
    lines.push(`   URL: ${result.url}`);
    
    if (result.publishedDate) {
      lines.push(`   Published: ${this.formatDate(result.publishedDate)}`);
    }
    
    if (result.author) {
      lines.push(`   Author: ${result.author}`);
    }
    
    if (result.text) {
      const preview = this.truncateText(result.text, 300);
      lines.push(`   Preview: ${preview}`);
    }
    
    lines.push(''); // Empty line between results
    
    return lines.join('\n');
  }

  /**
   * Format a crawling response (single URL fetch)
   */
  static formatCrawlResponse(results: ExaSearchResult[]): string {
    if (!results || results.length === 0) {
      return "Could not fetch content from the provided URL.";
    }

    const result = results[0];
    const lines: string[] = [];
    
    lines.push(`Content from: ${result.url}\n`);
    
    if (result.title) {
      lines.push(`Title: ${result.title}`);
    }
    
    if (result.author) {
      lines.push(`Author: ${result.author}`);
    }
    
    if (result.publishedDate) {
      lines.push(`Published: ${this.formatDate(result.publishedDate)}`);
    }
    
    lines.push('\n--- Content ---\n');
    
    if (result.text) {
      lines.push(result.text);
    } else {
      lines.push('No text content available.');
    }
    
    return lines.join('\n');
  }

  /**
   * Format error messages for consistent error reporting.
   * 
   * @param {any} error - Error object (can be AxiosError or generic Error)
   * @param {string} toolName - Name of the tool that encountered the error
   * @returns {string} Formatted error message
   * 
   * @example
   * ```typescript
   * const errorMsg = ResponseFormatter.formatError(error, 'my_tool');
   * ```
   */
  static formatError(error: any, toolName: string): string {
    let message = `Error in ${toolName.replace('_', ' ')}:\n\n`;
    
    if (error.response?.data?.message) {
      message += error.response.data.message;
    } else if (error.message) {
      message += error.message;
    } else {
      message += 'An unknown error occurred.';
    }
    
    return message;
  }

  /**
   * Truncate text with ellipsis
   */
  private static truncateText(text: string, maxLength: number): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return cleaned.substring(0, maxLength) + '...';
  }

  /**
   * Format date string
   */
  private static formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Format Twitter search results
   */
  static formatTwitterResponse(results: ExaSearchResult[]): string {
    if (!results || results.length === 0) {
      return "No tweets found.";
    }

    const lines: string[] = [];
    
    lines.push(`Found ${results.length} tweets:\n`);

    results.forEach((result, index) => {
      lines.push(`${index + 1}. ${result.title || 'Tweet'}`);
      lines.push(`   URL: ${result.url}`);
      
      if (result.publishedDate) {
        lines.push(`   Posted: ${this.formatDate(result.publishedDate)}`);
      }
      
      if (result.author) {
        lines.push(`   Author: ${result.author}`);
      }
      
      if (result.text) {
        const preview = this.truncateText(result.text, 280); // Twitter-like length
        lines.push(`   ${preview}`);
      }
      
      lines.push(''); // Empty line between tweets
    });

    return lines.join('\n');
  }

  /**
   * Format research paper results
   */
  static formatResearchPaperResponse(results: ExaSearchResult[]): string {
    if (!results || results.length === 0) {
      return "No research papers found.";
    }

    const lines: string[] = [];
    
    lines.push(`Found ${results.length} research papers:\n`);

    results.forEach((result, index) => {
      lines.push(`${index + 1}. ${result.title || 'Untitled Paper'}`);
      lines.push(`   URL: ${result.url}`);
      
      if (result.publishedDate) {
        lines.push(`   Published: ${this.formatDate(result.publishedDate)}`);
      }
      
      if (result.author) {
        lines.push(`   Authors: ${result.author}`);
      }
      
      if (result.text) {
        const preview = this.truncateText(result.text, 400);
        lines.push(`   Abstract: ${preview}`);
      }
      
      lines.push(''); // Empty line between papers
    });

    return lines.join('\n');
  }

  /**
   * Format company research results
   */
  static formatCompanyResponse(results: ExaSearchResult[]): string {
    if (!results || results.length === 0) {
      return "No company information found.";
    }

    const lines: string[] = [];
    
    lines.push(`Found ${results.length} company-related results:\n`);

    results.forEach((result, index) => {
      lines.push(`${index + 1}. ${result.title || 'Company Information'}`);
      lines.push(`   URL: ${result.url}`);
      
      if (result.publishedDate) {
        lines.push(`   Updated: ${this.formatDate(result.publishedDate)}`);
      }
      
      if (result.text) {
        const preview = this.truncateText(result.text, 350);
        lines.push(`   Summary: ${preview}`);
      }
      
      lines.push(''); // Empty line between results
    });

    return lines.join('\n');
  }

  /**
   * Format competitor finder results
   */
  static formatCompetitorResponse(results: ExaSearchResult[]): string {
    if (!results || results.length === 0) {
      return "No competitors found.";
    }

    const lines: string[] = [];
    
    lines.push(`Found ${results.length} potential competitors:\n`);

    results.forEach((result, index) => {
      lines.push(`${index + 1}. ${result.title || 'Company'}`);
      lines.push(`   URL: ${result.url}`);
      
      if (result.text) {
        const preview = this.truncateText(result.text, 200);
        lines.push(`   Description: ${preview}`);
      }
      
      lines.push(''); // Empty line between competitors
    });

    return lines.join('\n');
  }

  /**
   * Format raw JSON response (fallback)
   */
  static formatRawResponse(data: any): string {
    return JSON.stringify(data, null, 2);
  }
}

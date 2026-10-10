import {
  ExaContentStatus,
  ExaCostDollars,
  ExaCrawlResponse,
  ExaGrounding,
  ExaSearchResponse,
  ExaSearchResult
} from "../types.js";

/**
 * Formats Exa responses into human-readable text.
 * Provides static methods for formatting different types of responses.
 *
 * @class ResponseFormatter
 */
export class ResponseFormatter {
  /**
   * Format a complete search response: synthesized output (if any), results, cost.
   *
   * @param {ExaSearchResponse} response - The search response from Exa API
   * @param {string} toolName - Name of the tool that made the request
   * @returns {string} Formatted multi-line string with search results
   */
  static formatSearchResponse(response: ExaSearchResponse, toolName: string): string {
    if (!response.results || response.results.length === 0) {
      return "No results found.";
    }

    const lines: string[] = [];

    lines.push(`Found ${response.results.length} results for your ${toolName.replace('_', ' ')} query:\n`);

    if (response.output) {
      lines.push(this.formatSynthesizedOutput(response.output.content, response.output.grounding));
    }

    response.results.forEach((result, index) => {
      lines.push(this.formatSearchResult(result, index + 1));
    });

    const cost = this.formatCost(response.costDollars);
    if (cost) lines.push(cost);

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

    if (result.summary) {
      lines.push(`   Summary: ${this.cleanSummary(result.summary)}`);
    }

    if (result.text) {
      lines.push(`   Text: ${this.collapseWhitespace(result.text)}`);
    }

    if (result.highlights?.length) {
      lines.push(`   Highlights:`);
      result.highlights.forEach(h => lines.push(`   - ${this.collapseWhitespace(h)}`));
    }

    lines.push(...this.formatExtras(result, '   '));

    if (result.subpages?.length) {
      lines.push(`   Subpages:`);
      result.subpages.forEach(sp => {
        lines.push(`   - ${sp.title || 'Untitled'}: ${sp.url}`);
        if (sp.summary) lines.push(`     Summary: ${this.cleanSummary(sp.summary)}`);
        if (sp.text) lines.push(`     Text: ${this.collapseWhitespace(sp.text)}`);
      });
    }

    lines.push(''); // Empty line between results

    return lines.join('\n');
  }

  /**
   * Format synthesized output (search/answer outputSchema, agent runs)
   * with its field-level grounding citations
   */
  static formatSynthesizedOutput(content: unknown, grounding?: ExaGrounding[] | null): string {
    const lines: string[] = ['## Synthesized Output', ''];
    lines.push(typeof content === 'string'
      ? content
      : '```json\n' + JSON.stringify(content, null, 2) + '\n```');
    if (grounding?.length) {
      lines.push('', this.formatGrounding(grounding));
    }
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Format field-level grounding citations
   */
  static formatGrounding(grounding: ExaGrounding[]): string {
    const lines = ['### Grounding'];
    grounding.forEach(g => {
      const confidence = g.confidence ? ` (${g.confidence} confidence)` : '';
      const sources = g.citations.map(c => c.title ? `[${c.title}](${c.url})` : c.url).join(', ');
      lines.push(`- ${g.field || 'output'}${confidence}: ${sources}`);
    });
    return lines.join('\n');
  }

  /**
   * Exa summaries often start with their own "Summary:" label; drop it
   */
  private static cleanSummary(summary: string): string {
    return summary.replace(/^\s*Summary:\s*/i, '');
  }

  /**
   * Format the estimated cost line, or an empty string when the response has no cost
   */
  static formatCost(cost?: ExaCostDollars | null): string {
    if (typeof cost?.total !== 'number') return '';
    return `Estimated cost: $${cost.total.toFixed(4)}`;
  }

  /**
   * Format embedded links, images and code blocks for a result
   */
  static formatExtras(result: ExaSearchResult, indent: string): string[] {
    const lines: string[] = [];
    if (result.extras?.links?.length) {
      lines.push(`${indent}Links: ${result.extras.links.join(', ')}`);
    }
    if (result.extras?.imageLinks?.length) {
      lines.push(`${indent}Images: ${result.extras.imageLinks.join(', ')}`);
    }
    if (result.extras?.codeBlocks?.length) {
      lines.push(`${indent}Code blocks: ${result.extras.codeBlocks.length}`);
    }
    return lines;
  }

  /**
   * Format a /contents response: full content per URL, then failed URLs from statuses
   */
  static formatContentsResponse(response: ExaCrawlResponse): string {
    const results = response.results || [];
    const failures = (response.statuses || []).filter(st => st.status === 'error');
    if (results.length === 0 && failures.length === 0) {
      return "Could not fetch content from the provided URLs.";
    }

    const lines: string[] = [];
    results.forEach((result, idx) => {
      lines.push(`## ${idx + 1}. ${result.title || 'Untitled'}`);
      lines.push(`URL: ${result.url}`);
      if (result.author) lines.push(`Author: ${result.author}`);
      if (result.publishedDate) lines.push(`Published: ${this.formatDate(result.publishedDate)}`);
      if (result.summary) lines.push('', `**Summary:** ${this.cleanSummary(result.summary)}`);
      if (result.highlights?.length) {
        lines.push('', '**Highlights:**');
        result.highlights.forEach(h => lines.push(`- ${h}`));
      }
      if (result.text) lines.push('', result.text);
      lines.push(...this.formatExtras(result, ''));
      if (result.subpages?.length) {
        lines.push('', '**Subpages:**');
        result.subpages.forEach(sp => {
          lines.push(`### ${sp.title || 'Untitled'} (${sp.url})`);
          if (sp.summary) lines.push(`**Summary:** ${this.cleanSummary(sp.summary)}`);
          if (sp.text) lines.push(sp.text);
        });
      }
      lines.push('');
    });

    if (failures.length) {
      lines.push('## Failed URLs');
      failures.forEach(f => lines.push(`- ${this.formatStatusError(f)}`));
      lines.push('');
    }

    const cost = this.formatCost(response.costDollars);
    if (cost) lines.push(cost);
    return lines.join('\n');
  }

  /**
   * Describe one failed /contents status entry
   */
  static formatStatusError(status: ExaContentStatus): string {
    const tag = status.error?.tag || 'error';
    const http = status.error?.httpStatusCode ? ` (HTTP ${status.error.httpStatusCode})` : '';
    return `${status.id}: ${tag}${http}`;
  }

  /**
   * Format error messages for consistent error reporting.
   *
   * @param {unknown} error - Error object (can be AxiosError or generic Error)
   * @param {string} toolName - Name of the tool that encountered the error
   * @returns {string} Formatted error message
   */
  static formatError(error: unknown, toolName: string): string {
    let message = `Error in ${toolName.replace('_', ' ')}:\n\n`;

    const err = error as { response?: { status?: number; data?: { message?: string; error?: string } }; message?: string };
    const status: number | undefined = err.response?.status;

    if (err.response?.data?.message) {
      message += err.response.data.message;
    } else if (err.response?.data?.error) {
      message += err.response.data.error;
    } else if (err.message) {
      message += err.message;
    } else {
      message += `Unexpected error (type: ${typeof error}).`;
    }

    if (status) {
      message += `\n\nHTTP ${status}`;
      if (status === 401 || status === 403) {
        message += ' — check that EXA_API_KEY is set and valid, and that your Exa plan includes this API.';
      } else if (status === 429) {
        message += ' — rate limit exceeded. Wait before retrying.';
      } else if (status >= 500) {
        message += ' — Exa server error. Try again later.';
      }
    }

    return message;
  }

  /**
   * Collapse runs of whitespace so multi-line page text fits one result entry
   */
  private static collapseWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Format date string
   */
  static formatDate(dateString: string): string {
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
   * Format raw JSON response (fallback)
   */
  static formatRawResponse(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }
}

// Exa API Types
export interface ExaSearchRequest {
  query: string;
  type: string;
  category?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  numResults: number;
  contents: {
    text: {
      maxCharacters?: number;
    } | boolean;
    livecrawl?: 'always' | 'fallback';
    subpages?: number;
    subpageTarget?: string[];
  };
}

export interface ExaCrawlRequest {
  ids: string[];
  text: boolean;
  livecrawl?: 'always' | 'fallback';
}

export interface ExaSearchResult {
  id: string;
  title?: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  image?: string;
  favicon?: string;
  score?: number;
}

export interface ExaSearchResponse {
  requestId: string;
  autopromptString: string;
  resolvedSearchType: string;
  results: ExaSearchResult[];
}

/**
 * Stronger typing for crawl responses
 */
export interface ExaCrawlResponse {
  requestId: string;
  results: ExaSearchResult[];
}

/**
 * Union type for all possible Exa API responses
 */
export type ExaApiResponse = ExaSearchResponse | ExaCrawlResponse;

// Tool Types
export interface SearchArgs {
  query: string;
  numResults?: number;
  livecrawl?: 'always' | 'fallback';
}

/**
 * Strongly typed search arguments
 */
export interface TypedSearchArgs extends Record<string, unknown> {
  query: string;
  numResults?: number;
}

/**
 * Strongly typed crawl arguments
 */
export interface TypedCrawlArgs extends Record<string, unknown> {
  url: string;
}

/**
 * Tool response type for consistent return types
 */
export interface ToolResponse {
  content: {
    type: "text";
    text: string;
  }[];
  isError?: boolean;
}

/**
 * Type guard to check if an object is a valid search response
 */
export function isExaSearchResponse(response: unknown): response is ExaSearchResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'requestId' in response &&
    'results' in response &&
    Array.isArray((response as ExaSearchResponse).results)
  );
}

/**
 * Type guard to check if an object is a valid crawl response
 */
export function isExaCrawlResponse(response: unknown): response is ExaCrawlResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'requestId' in response &&
    'results' in response &&
    Array.isArray((response as ExaCrawlResponse).results)
  );
}
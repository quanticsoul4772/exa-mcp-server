// Exa API Types

/**
 * Search type controls the speed/quality tradeoff
 */
export type ExaSearchType = 'auto' | 'instant' | 'fast' | 'neural' | 'deep' | 'deep-reasoning';

/**
 * Content category filters
 */
export type ExaCategory = 'company' | 'research paper' | 'news' | 'personal site' | 'financial report' | 'people';

/**
 * Text content options for search results
 */
export interface ExaTextOptions {
  maxCharacters?: number;
  includeHtmlTags?: boolean;
  verbosity?: 'compact' | 'standard' | 'full';
  includeSections?: string[];
  excludeSections?: string[];
}

/**
 * Highlights content options
 */
export interface ExaHighlightsOptions {
  maxCharacters?: number;
  query?: string;
}

/**
 * Summary content options
 */
export interface ExaSummaryOptions {
  query?: string;
  schema?: Record<string, any>;
}

/**
 * Extras content options for embedded links and images
 */
export interface ExaExtrasOptions {
  links?: boolean;
  imageUrls?: boolean;
}

/**
 * Contents configuration for search requests
 */
export interface ExaContentsOptions {
  text?: ExaTextOptions | boolean;
  highlights?: ExaHighlightsOptions | boolean;
  summary?: ExaSummaryOptions | boolean;
  subpages?: number;
  subpageTarget?: string[];
  extras?: ExaExtrasOptions;
  maxAgeHours?: number;
  // Deprecated: use maxAgeHours instead
  livecrawl?: 'always' | 'fallback' | 'never';
}

export interface ExaSearchRequest {
  query: string;
  type: ExaSearchType;
  category?: ExaCategory;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  startCrawlDate?: string;
  endCrawlDate?: string;
  includeText?: string;
  excludeText?: string;
  numResults: number;
  userLocation?: string;
  moderation?: boolean;
  outputSchema?: Record<string, any>;
  systemPrompt?: string;
  additionalQueries?: string[];
  contents: ExaContentsOptions;
}

export interface ExaCrawlRequest {
  ids?: string[];
  urls?: string[];
  text?: ExaTextOptions | boolean;
  highlights?: ExaHighlightsOptions | boolean;
  summary?: ExaSummaryOptions | boolean;
  subpages?: number;
  subpageTarget?: string[];
  extras?: ExaExtrasOptions;
  maxAgeHours?: number;
  // Deprecated: use maxAgeHours instead
  livecrawl?: 'always' | 'fallback' | 'never';
}

/**
 * Context (code search) request
 */
export interface ExaContextRequest {
  query: string;
  tokensNum?: number | 'dynamic';
}

/**
 * Context (code search) response
 */
export interface ExaContextResponse {
  results: Array<{
    url: string;
    text: string;
    tokens: number;
  }>;
  totalTokens: number;
}

export interface ExaSearchResult {
  id: string;
  title?: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  highlights?: string[];
  summary?: string;
  image?: string;
  favicon?: string;
  score?: number;
  extras?: {
    links?: string[];
    imageUrls?: string[];
  };
  subpages?: Array<{
    url: string;
    title?: string;
    text?: string;
  }>;
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
  statuses?: Array<{
    url: string;
    status: string;
    error?: string;
  }>;
}

/**
 * Union type for all possible Exa API responses
 */
export type ExaApiResponse = ExaSearchResponse | ExaCrawlResponse | ExaContextResponse;

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
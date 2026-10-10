// Exa API Types

/**
 * Search type controls the speed/quality tradeoff
 */
export type ExaSearchType = 'instant' | 'fast' | 'auto' | 'deep-lite' | 'deep' | 'deep-reasoning';

/**
 * Content category filters ('publication' replaced 'research paper' in July 2026)
 */
export type ExaCategory = 'company' | 'publication' | 'news' | 'personal site' | 'financial report' | 'people';

/**
 * Page sections for text include/exclude filtering
 */
export type ExaSection = 'header' | 'navigation' | 'banner' | 'body' | 'sidebar' | 'footer' | 'metadata';

/**
 * Text content options for search results
 */
export interface ExaTextOptions {
  maxCharacters?: number;
  includeHtmlTags?: boolean;
  verbosity?: 'compact' | 'standard' | 'full';
  includeSections?: ExaSection[];
  excludeSections?: ExaSection[];
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
  schema?: Record<string, unknown>;
}

/**
 * Extras content options: how many of each item to return per result (0-1000)
 */
export interface ExaExtrasOptions {
  links?: number;
  imageLinks?: number;
  richLinks?: number;
  richImageLinks?: number;
  codeBlocks?: number;
}

/**
 * Content freshness and snapshot options shared by /search contents and /contents
 */
export interface ExaFreshnessOptions {
  /** -1 = cache only, 0 = always fetch fresh, 1-720 = max cache age in hours */
  maxAgeHours?: number;
  /** Live crawl timeout in milliseconds (1-90000) */
  livecrawlTimeout?: number;
}

/**
 * Contents configuration for search requests
 */
export interface ExaContentsOptions extends ExaFreshnessOptions {
  text?: ExaTextOptions | boolean;
  highlights?: ExaHighlightsOptions | boolean;
  summary?: ExaSummaryOptions | boolean;
  subpages?: number;
  subpageTarget?: string[];
  extras?: ExaExtrasOptions;
}

export interface ExaSearchRequest {
  query: string;
  type?: ExaSearchType;
  category?: ExaCategory;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  /** Deprecated by Exa; word-level approximate matching */
  includeText?: string[];
  /** Deprecated by Exa; word-level approximate matching */
  excludeText?: string[];
  numResults: number;
  userLocation?: string;
  moderation?: boolean;
  outputSchema?: Record<string, unknown>;
  systemPrompt?: string;
  objective?: string;
  additionalQueries?: string[];
  contents?: ExaContentsOptions;
}

export interface ExaCrawlRequest extends ExaFreshnessOptions {
  ids?: string[];
  urls?: string[];
  text?: ExaTextOptions | boolean;
  highlights?: ExaHighlightsOptions | boolean;
  summary?: ExaSummaryOptions | boolean;
  subpages?: number;
  subpageTarget?: string[];
  extras?: ExaExtrasOptions;
  snapshotAsOf?: string;
}

/**
 * Estimated cost breakdown returned by most endpoints
 */
export interface ExaCostDollars {
  total?: number;
  [key: string]: unknown;
}

/**
 * Field-level citations for synthesized output
 */
export interface ExaGrounding {
  field: string;
  citations: Array<{ url: string; title?: string }>;
  confidence?: 'low' | 'medium' | 'high' | null;
}

/**
 * Context (code search) request
 */
export interface ExaContextRequest {
  query: string;
  tokensNum?: number | 'dynamic';
}

/**
 * Context (code search) response: one pre-formatted text block
 */
export interface ExaContextResponse {
  requestId?: string;
  query?: string;
  response: string;
  costDollars?: ExaCostDollars;
}

/**
 * Voyage usage attached to a response that was reranked
 */
export interface VoyageUsage {
  model: string;
  totalTokens: number;
}

/**
 * A passage selected from a page by relevance to a query
 */
export interface RelevantChunk {
  text: string;
  score: number;
}

export interface ExaSearchResult {
  id: string;
  /** Voyage relevance score, when the results were reranked */
  rerankScore?: number;
  /** Most relevant passages, when web_fetch was called with relevantTo */
  relevantChunks?: RelevantChunk[];
  /** Number of chunks the page was split into, with relevantTo */
  totalChunks?: number;
  title?: string;
  url: string;
  publishedDate?: string;
  author?: string | null;
  text?: string;
  highlights?: string[];
  summary?: string;
  image?: string;
  favicon?: string;
  extras?: {
    links?: string[];
    imageLinks?: string[];
    codeBlocks?: Array<{ text: string; source?: string }>;
  };
  subpages?: Array<{
    url: string;
    title?: string;
    text?: string;
    summary?: string;
  }>;
}

export interface ExaSearchResponse {
  requestId: string;
  results: ExaSearchResult[];
  /** Present when outputSchema was sent */
  output?: {
    content: string | Record<string, unknown>;
    grounding?: ExaGrounding[];
  };
  costDollars?: ExaCostDollars;
  searchTime?: number;
  /** Set when results were reranked with Voyage */
  voyage?: VoyageUsage;
}

/**
 * Per-URL status entry from /contents
 */
export interface ExaContentStatus {
  id: string;
  status: 'success' | 'error';
  source?: 'cached' | 'crawled';
  error?: { tag: string; httpStatusCode?: number | null };
}

/**
 * Stronger typing for crawl responses
 */
export interface ExaCrawlResponse {
  requestId: string;
  results: ExaSearchResult[];
  statuses?: ExaContentStatus[];
  costDollars?: ExaCostDollars;
  /** Set when passages were selected with Voyage */
  voyage?: VoyageUsage;
}

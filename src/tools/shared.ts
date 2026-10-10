import { z } from "zod";
import {
  ExaExtrasOptions,
  ExaFreshnessOptions,
  ExaHighlightsOptions,
  ExaSummaryOptions
} from "../types.js";

/**
 * Page sections accepted by text.includeSections / text.excludeSections
 */
export const SECTIONS = ['header', 'navigation', 'banner', 'body', 'sidebar', 'footer', 'metadata'] as const;

/**
 * Extras requested when a tool's includeExtras flag is set
 */
export const DEFAULT_EXTRAS: ExaExtrasOptions = { links: 20, imageLinks: 10 };

/**
 * Zod fields for content freshness, shared by every tool that fetches page content
 */
export const freshnessFields = {
  maxAgeHours: z.coerce.number().int().min(-1).max(720).optional()
    .describe("Content freshness: 0 = always fetch fresh, -1 = cache only, 1-720 = max cache age in hours. Omit to use cache and fetch live only when nothing is cached."),
  livecrawlTimeout: z.coerce.number().int().min(1).max(90000).optional()
    .describe("Live crawl timeout in milliseconds (1-90000, Exa default 10000)")
};

/**
 * Build the freshness part of a request, sending only the fields that were set
 */
export function freshness(args: ExaFreshnessOptions): ExaFreshnessOptions {
  return {
    ...(args.maxAgeHours !== undefined && { maxAgeHours: args.maxAgeHours }),
    ...(args.livecrawlTimeout !== undefined && { livecrawlTimeout: args.livecrawlTimeout })
  };
}

/**
 * Summary option: a query-guided summary object, or true for a default summary
 */
export function summaryOption(include: boolean | undefined, query?: string): ExaSummaryOptions | true | undefined {
  if (!include && !query) return undefined;
  return query ? { query } : true;
}

/**
 * Highlights option: an object with an optional guiding query
 */
export function highlightsOption(include: boolean | undefined, query?: string, maxCharacters = 500): ExaHighlightsOptions | undefined {
  if (!include && !query) return undefined;
  return { maxCharacters, ...(query && { query }) };
}

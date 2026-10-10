import axios, { AxiosError, AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { getConfig } from "../config/index.js";
import { logWarn } from "./pinoLogger.js";
import { retryDelay } from "./exaClient.js";

/**
 * Raised when a Voyage feature was requested but cannot run. Tools report it
 * as an error; they never fall back to unranked output.
 */
export class VoyageError extends Error {}

export interface RerankResult {
  /** Index into the documents passed in */
  index: number;
  relevanceScore: number;
}

export interface RerankResponse {
  results: RerankResult[];
  model: string;
  totalTokens: number;
}

interface VoyageRerankBody {
  object: string;
  data: Array<{ index: number; relevance_score: number }>;
  model: string;
  usage: { total_tokens: number };
}

let _client: AxiosInstance | null = null;

function voyageClient(): AxiosInstance {
  if (_client) return _client;
  const config = getConfig();
  if (!config.voyage.apiKey) {
    throw new VoyageError("VOYAGE_API_KEY is not set; it is required for rerank and relevantTo");
  }
  _client = axios.create({
    baseURL: config.voyage.baseUrl,
    timeout: config.voyage.timeout,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.voyage.apiKey}`
    }
  });
  // Reranking reads only, so every failure class worth retrying is safe to retry
  axiosRetry(_client, {
    retries: 3,
    retryDelay,
    retryCondition: (error: AxiosError) => {
      if (axios.isCancel(error)) return false;
      const status = error.response?.status;
      if (status === undefined) return axiosRetry.isNetworkError(error);
      return status === 429 || status >= 500;
    },
    onRetry: (count, error) => logWarn(`Retrying Voyage rerank (attempt ${count}/3): ${error.message}`)
  });
  return _client;
}

/**
 * Score documents against a query with a Voyage reranker.
 *
 * @throws VoyageError when the key is missing or the API call fails
 */
export async function rerank(
  query: string,
  documents: string[],
  options: { topK?: number; signal?: AbortSignal } = {}
): Promise<RerankResponse> {
  if (documents.length === 0) {
    return { results: [], model: getConfig().voyage.rerankModel, totalTokens: 0 };
  }
  const client = voyageClient();
  try {
    const response = await client.post<VoyageRerankBody>('/rerank', {
      query,
      documents,
      model: getConfig().voyage.rerankModel,
      ...(options.topK !== undefined && { top_k: Math.min(options.topK, documents.length) })
    }, options.signal ? { signal: options.signal } : undefined);
    return {
      results: response.data.data.map(d => ({ index: d.index, relevanceScore: d.relevance_score })),
      model: response.data.model,
      totalTokens: response.data.usage.total_tokens
    };
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    const err = error as AxiosError<{ detail?: string }>;
    const status = err.response?.status;
    const detail = err.response?.data?.detail ?? err.message;
    throw new VoyageError(`Voyage rerank failed${status ? ` (HTTP ${status})` : ''}: ${detail}`);
  }
}

/** Reset the cached client (tests change config between cases) */
export function resetVoyageClient(): void {
  _client = null;
}

/**
 * Split text into chunks of roughly maxChars, breaking at blank lines where
 * possible and splitting any longer paragraph at whitespace.
 */
export function chunkText(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  const flush = () => {
    if (current) chunks.push(current);
    current = '';
  };
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush();
      let rest = paragraph;
      while (rest.length > maxChars) {
        const cut = rest.lastIndexOf(' ', maxChars);
        const at = cut > maxChars / 2 ? cut : maxChars;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest;
      continue;
    }
    if (current && current.length + 2 + paragraph.length > maxChars) flush();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();
  return chunks;
}

import { ExaCrawlResponse, ExaSearchResponse, ExaSearchResult } from "../types.js";
import { chunkText, rerank } from "../utils/voyage.js";

/**
 * Text that represents a search result for reranking: title plus whatever
 * content Exa returned (summary, highlights, text)
 */
export function resultDocument(result: ExaSearchResult): string {
  const parts = [
    result.title,
    result.summary,
    ...(result.highlights ?? []),
    result.text
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length > 0 ? parts.join('\n') : result.url;
}

/**
 * Rerank search results against the query with Voyage and keep the top
 * topK, each carrying its relevance score
 *
 * @throws VoyageError when Voyage cannot be used
 */
export async function rerankSearchResults(
  data: ExaSearchResponse,
  query: string,
  topK: number,
  signal?: AbortSignal
): Promise<ExaSearchResponse> {
  const ranked = await rerank(query, data.results.map(resultDocument), { topK, signal });
  return {
    ...data,
    results: ranked.results.map(r => ({ ...data.results[r.index], rerankScore: r.relevanceScore })),
    voyage: { model: ranked.model, totalTokens: ranked.totalTokens }
  };
}

/**
 * Split each page's text into chunks, score every chunk against relevantTo
 * in one Voyage call, and keep each page's topChunks best chunks in page
 * order. Pages without text are left as they are.
 *
 * @throws VoyageError when Voyage cannot be used
 */
export async function selectRelevantChunks(
  data: ExaCrawlResponse,
  relevantTo: string,
  topChunks: number,
  chunkCharacters: number,
  signal?: AbortSignal
): Promise<ExaCrawlResponse> {
  const perPage = data.results.map(r => (r.text ? chunkText(r.text, chunkCharacters) : []));
  const owners: Array<{ page: number; chunk: number }> = [];
  const documents: string[] = [];
  perPage.forEach((chunks, page) => chunks.forEach((text, chunk) => {
    owners.push({ page, chunk });
    documents.push(text);
  }));

  const ranked = await rerank(relevantTo, documents, { signal });
  const scores = perPage.map(chunks => new Array<number>(chunks.length).fill(0));
  for (const r of ranked.results) {
    const owner = owners[r.index];
    scores[owner.page][owner.chunk] = r.relevanceScore;
  }

  const results = data.results.map((result, page) => {
    const chunks = perPage[page];
    if (chunks.length === 0) return result;
    const best = chunks
      .map((text, i) => ({ text, score: scores[page][i], i }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topChunks)
      .sort((a, b) => a.i - b.i)
      .map(({ text, score }) => ({ text, score }));
    // The passages replace the full text
    const selected: ExaSearchResult = { ...result, relevantChunks: best, totalChunks: chunks.length };
    delete selected.text;
    return selected;
  });

  return { ...data, results, voyage: { model: ranked.model, totalTokens: ranked.totalTokens } };
}

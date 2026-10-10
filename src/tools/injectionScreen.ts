import { getConfig } from "../config/index.js";
import { ExaCrawlResponse, ExaSearchResult } from "../types.js";
import { audit, screenAll } from "../utils/jev.js";
import { logWarn } from "../utils/pinoLogger.js";

/**
 * The third-party text a result actually returns to the model: the selected
 * passages (relevantTo) or the page text, plus any highlights
 */
export function returnedText(result: ExaSearchResult): string {
  const body = result.relevantChunks
    ? result.relevantChunks.map(c => c.text).join('\n\n')
    : result.text ?? '';
  return [body, ...(result.highlights ?? [])].filter(Boolean).join('\n\n');
}

/**
 * Apply JEV_SCREEN to web_fetch results.
 * - off: unchanged, no calls
 * - shadow: score every page, log and audit; output unchanged
 * - warn: score every page, audit, and mark each result so the formatter
 *   shows a warning at or above the threshold, or "not screened" on error.
 * Content is never withheld.
 */
export async function applyInjectionScreen(data: ExaCrawlResponse, signal?: AbortSignal): Promise<ExaCrawlResponse> {
  const config = getConfig().jevScreen;
  if (config.mode === 'off') return data;

  const targets = data.results
    .map((r, index) => ({ index, url: r.url, text: returnedText(r) }))
    .filter(t => t.text.trim().length > 0);
  if (targets.length === 0) return data;

  const verdicts = await screenAll(targets, signal);
  await audit(targets.map((t, i) => ({ mode: config.mode, url: t.url, chars: t.text.length, ...verdicts[i] })));

  if (config.mode === 'shadow') {
    targets.forEach((t, i) => {
      const v = verdicts[i];
      logWarn(`jev shadow ${t.url}: ${'score' in v ? v.score.toFixed(2) : `not screened (${v.error})`}`);
    });
    return data;
  }

  const results = [...data.results];
  targets.forEach((t, i) => {
    const v = verdicts[i];
    results[t.index] = {
      ...results[t.index],
      injectionScreen: 'score' in v
        ? { score: v.score, flagged: v.score >= config.threshold }
        : { error: v.error }
    };
  });
  return { ...data, results };
}

import { describe, it, expect } from '@jest/globals';
import { AxiosError, AxiosHeaders, CanceledError } from 'axios';
import { isRetryable, isSafeToRetry, retryDelay } from '../../utils/exaClient.js';

function httpError(method: string, url: string, status?: number, headers: Record<string, string> = {}): AxiosError {
  const config = { method, url, headers: new AxiosHeaders() };
  const response = status === undefined ? undefined : {
    status, statusText: '', data: {}, headers, config
  };
  return new AxiosError('failed', status === undefined ? 'ECONNRESET' : 'ERR_BAD_RESPONSE', config, {}, response as any);
}

describe('retry policy', () => {
  describe('isSafeToRetry', () => {
    it('allows GET and read-only POST endpoints', () => {
      expect(isSafeToRetry({ method: 'get', url: '/agent/runs/x' })).toBe(true);
      for (const url of ['/search', '/contents', '/answer', '/context', '/findSimilar']) {
        expect(isSafeToRetry({ method: 'post', url })).toBe(true);
      }
    });

    it('refuses POSTs that create resources, and PATCH/DELETE', () => {
      expect(isSafeToRetry({ method: 'post', url: '/agent/runs' })).toBe(false);
      expect(isSafeToRetry({ method: 'post', url: '/monitors' })).toBe(false);
      expect(isSafeToRetry({ method: 'post', url: '/websets/v0/websets' })).toBe(false);
      expect(isSafeToRetry({ method: 'patch', url: '/monitors/m1' })).toBe(false);
      expect(isSafeToRetry({ method: 'delete', url: '/monitors/m1' })).toBe(false);
    });
  });

  describe('isRetryable', () => {
    it('retries 5xx, 429 and network errors on safe requests', () => {
      expect(isRetryable(httpError('post', '/search', 503))).toBe(true);
      expect(isRetryable(httpError('post', '/search', 429))).toBe(true);
      expect(isRetryable(httpError('get', '/agent/runs/x', undefined))).toBe(true);
    });

    it('never retries a POST that creates a billable run, even on 5xx', () => {
      expect(isRetryable(httpError('post', '/agent/runs', 502))).toBe(false);
      expect(isRetryable(httpError('post', '/agent/runs', undefined))).toBe(false);
    });

    it('does not retry 4xx other than 429', () => {
      expect(isRetryable(httpError('post', '/search', 400))).toBe(false);
      expect(isRetryable(httpError('post', '/search', 401))).toBe(false);
    });

    it('does not retry a client cancellation', () => {
      const cancel = new CanceledError('aborted') as unknown as AxiosError;
      (cancel as any).config = { method: 'post', url: '/search' };
      expect(isRetryable(cancel)).toBe(false);
    });
  });

  describe('retryDelay', () => {
    it('uses Retry-After seconds', () => {
      expect(retryDelay(1, httpError('post', '/search', 429, { 'retry-after': '7' }))).toBe(7000);
    });

    it('uses a Retry-After HTTP date', () => {
      const at = new Date(Date.now() + 5000).toUTCString();
      const delay = retryDelay(1, httpError('post', '/search', 429, { 'retry-after': at }));
      expect(delay).toBeGreaterThan(3000);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('backs off exponentially without Retry-After', () => {
      const first = retryDelay(1, httpError('post', '/search', 503));
      const third = retryDelay(3, httpError('post', '/search', 503));
      expect(first).toBeGreaterThanOrEqual(1000);
      expect(first).toBeLessThan(1500);
      expect(third).toBeGreaterThanOrEqual(4000);
      expect(third).toBeLessThan(4500);
    });
  });
});

import { describe, it, expect, jest } from '@jest/globals';

jest.unmock('../../config/index.js');

import { validateConfig } from '../../config/index.js';

const base = { exa: { apiKey: 'k' }, server: {}, logging: {}, environment: {}, tools: {}, cache: {} };

describe('JEV_SCREEN configuration', () => {
  it('defaults to off without a TypeSafe key', () => {
    const config = validateConfig(base);
    expect(config.jevScreen.mode).toBe('off');
    expect(config.jevScreen.threshold).toBe(0.35);
  });

  it('refuses shadow or warn without TYPESAFE_API_KEY', () => {
    for (const mode of ['shadow', 'warn']) {
      expect(() => validateConfig({ ...base, jevScreen: { mode } }))
        .toThrow('TYPESAFE_API_KEY is required when JEV_SCREEN is shadow or warn');
    }
  });

  it('accepts warn with a key and a custom threshold', () => {
    const config = validateConfig({ ...base, jevScreen: { mode: 'warn', apiKey: 't', threshold: '0.5' } });
    expect(config.jevScreen).toMatchObject({ mode: 'warn', threshold: 0.5, model: 'jev-latest' });
  });

  it('rejects an unknown mode', () => {
    expect(() => validateConfig({ ...base, jevScreen: { mode: 'block', apiKey: 't' } })).toThrow();
  });
});

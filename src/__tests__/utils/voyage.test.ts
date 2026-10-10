import { describe, it, expect } from '@jest/globals';
import { chunkText } from '../../utils/voyage.js';
import { resultDocument } from '../../tools/rerank.js';

describe('chunkText', () => {
  it('groups paragraphs up to the size limit', () => {
    const text = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)].join('\n\n');
    expect(chunkText(text, 90)).toEqual(['a'.repeat(40) + '\n\n' + 'b'.repeat(40), 'c'.repeat(40)]);
  });

  it('splits an oversized paragraph at whitespace', () => {
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(words, 60);
    expect(chunks.every(c => c.length <= 60)).toBe(true);
    expect(chunks.join(' ')).toBe(words);
  });

  it('returns no chunks for empty text', () => {
    expect(chunkText('  \n\n ', 100)).toEqual([]);
  });
});

describe('resultDocument', () => {
  it('joins title, summary, highlights and text', () => {
    expect(resultDocument({ id: '1', url: 'https://u', title: 'T', summary: 'S', highlights: ['H1', 'H2'], text: 'X' }))
      .toBe('T\nS\nH1\nH2\nX');
  });

  it('falls back to the URL when there is no content', () => {
    expect(resultDocument({ id: '1', url: 'https://u' })).toBe('https://u');
  });
});

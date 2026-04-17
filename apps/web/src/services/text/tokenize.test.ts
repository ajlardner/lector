import { describe, it, expect } from 'vitest';
import { tokenize, sentenceAround } from './tokenize.js';

describe('tokenize (es)', () => {
  it('splits words and preserves punctuation as non-word tokens', () => {
    const tokens = tokenize('¿Cómo estás, amigo?', 'es');
    const words = tokens.filter((t) => t.isWord).map((t) => t.text);
    expect(words).toEqual(['Cómo', 'estás', 'amigo']);
  });

  it('handles diacritics and ñ', () => {
    const tokens = tokenize('La mañana está aquí.', 'es');
    const words = tokens.filter((t) => t.isWord).map((t) => t.text);
    expect(words).toEqual(['La', 'mañana', 'está', 'aquí']);
  });

  it('reports start offsets aligned with source', () => {
    const src = 'Hola mundo.';
    const tokens = tokenize(src, 'es');
    for (const t of tokens) {
      expect(src.slice(t.start, t.start + t.text.length)).toBe(t.text);
    }
  });
});

describe('sentenceAround', () => {
  it('returns the containing sentence for an offset', () => {
    const src = 'Hola amigo. El hombre caminaba por la calle. Hace frío.';
    const s = sentenceAround(src, src.indexOf('caminaba'), 'es');
    expect(s).toBe('El hombre caminaba por la calle.');
  });
});

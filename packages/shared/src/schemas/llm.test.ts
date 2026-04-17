import { describe, it, expect } from 'vitest';
import { LLMTranslationSchema } from './llm.js';

describe('LLMTranslationSchema', () => {
  it('accepts minimal shape', () => {
    const r = LLMTranslationSchema.safeParse({ translation: 'the house' });
    expect(r.success).toBe(true);
  });

  it('accepts full shape', () => {
    const r = LLMTranslationSchema.safeParse({
      translation: 'the house',
      lemma: 'casa',
      partOfSpeech: 'noun',
      grammarNotes: 'feminine singular',
      examples: [{ source: 'la casa es roja', translation: 'the house is red' }],
      alternativeTranslations: ['home'],
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing translation', () => {
    const r = LLMTranslationSchema.safeParse({ lemma: 'casa' });
    expect(r.success).toBe(false);
  });

  it('rejects example missing translation field', () => {
    const r = LLMTranslationSchema.safeParse({
      translation: 'x',
      examples: [{ source: 'y' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-string translation', () => {
    const r = LLMTranslationSchema.safeParse({ translation: 42 });
    expect(r.success).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  TranslateRequestSchema,
  TranslateResponseSchema,
  ApiErrorSchema,
} from './api.js';

describe('TranslateRequestSchema', () => {
  it('accepts valid request', () => {
    const r = TranslateRequestSchema.safeParse({
      text: 'caminaba',
      context: 'El hombre caminaba por la calle.',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty text', () => {
    const r = TranslateRequestSchema.safeParse({
      text: '',
      context: 'x',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown sourceLang', () => {
    const r = TranslateRequestSchema.safeParse({
      text: 'x',
      context: 'x',
      sourceLang: 'xx',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(r.success).toBe(false);
  });
});

describe('TranslateResponseSchema', () => {
  it('accepts valid response', () => {
    const r = TranslateResponseSchema.safeParse({
      result: { translation: 'he was walking' },
      metadata: { latencyMs: 342, model: 'claude-haiku-4-5' },
    });
    expect(r.success).toBe(true);
  });
});

describe('ApiErrorSchema', () => {
  it('accepts rate_limited error', () => {
    const r = ApiErrorSchema.safeParse({ error: 'rate_limited', retryAfter: 120 });
    expect(r.success).toBe(true);
  });
});

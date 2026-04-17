import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createLLMProvider } from './llm.js';
import { isOk, isErr } from '@lector/shared';

const mockResponse = {
  result: { translation: 'he was walking', lemma: 'caminar' },
  metadata: { latencyMs: 123, model: 'claude-haiku-4-5' },
};

const req = {
  text: 'caminaba',
  context: 'El hombre caminaba por la calle.',
  sourceLang: 'es' as const,
  targetLang: 'en' as const,
  promptId: 'es-basic',
};

const createMessages = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMessages };
  },
}));

describe('LLMProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('proxy mode', () => {
    it('POSTs to /api/translate and returns ok on 200', async () => {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const p = createLLMProvider({ mode: 'proxy', apiBaseUrl: 'http://api' });
      const r = await p.translate(req);
      expect(isOk(r)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://api/api/translate',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
    });

    it('returns rate_limited error on 429', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })),
      );
      const p = createLLMProvider({ mode: 'proxy', apiBaseUrl: 'http://api' });
      const r = await p.translate(req);
      expect(isErr(r)).toBe(true);
      if (isErr(r)) expect(r.error.reason).toBe('rate_limited');
    });

    it('returns network error on fetch throw', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('offline');
        }),
      );
      const p = createLLMProvider({ mode: 'proxy', apiBaseUrl: 'http://api' });
      const r = await p.translate(req);
      expect(isErr(r)).toBe(true);
      if (isErr(r)) expect(r.error.reason).toBe('network');
    });

    it('surfaces upstream rawResponse in detail when proxy returns 502 with body', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(
            JSON.stringify({
              error: 'upstream_error',
              message: 'zod_failed_after_retry',
              rawResponse: 'Sure! Here is the translation: not-json',
            }),
            { status: 502, headers: { 'content-type': 'application/json' } },
          ),
        ),
      );
      const p = createLLMProvider({ mode: 'proxy', apiBaseUrl: 'http://api' });
      const r = await p.translate(req);
      expect(isErr(r)).toBe(true);
      if (isErr(r)) {
        expect(r.error.reason).toBe('server');
        expect(r.error.detail).toBeTruthy();
        expect(r.error.detail).toContain('zod_failed_after_retry');
        expect(r.error.detail).toContain('not-json');
      }
    });

    it('returns zod err with detail when proxy returns invalid schema', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          new Response(JSON.stringify({ result: { translation: '' } }), { status: 200 }),
        ),
      );
      const p = createLLMProvider({ mode: 'proxy', apiBaseUrl: 'http://api' });
      const r = await p.translate(req);
      expect(isErr(r)).toBe(true);
      if (isErr(r)) {
        expect(r.error.reason).toBe('zod');
        expect(r.error.detail).toBeTruthy();
        expect(r.error.detail!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('direct mode', () => {
    beforeEach(() => createMessages.mockReset());

    it('returns zod err with detail containing raw text when model returns non-JSON', async () => {
      createMessages.mockResolvedValue({
        content: [{ type: 'text', text: 'this is not json at all' }],
      });
      const p = createLLMProvider({ mode: 'direct', anthropicKey: 'k' });
      const r = await p.translate(req);
      expect(isErr(r)).toBe(true);
      if (isErr(r)) {
        expect(r.error.reason).toBe('zod');
        expect(r.error.detail).toBeTruthy();
        expect(r.error.detail).toContain('this is not json at all');
      }
    });

    it('returns zod err with detail containing schema issues when JSON misses required fields', async () => {
      createMessages.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ wrong: 'shape' }) }],
      });
      const p = createLLMProvider({ mode: 'direct', anthropicKey: 'k' });
      const r = await p.translate(req);
      expect(isErr(r)).toBe(true);
      if (isErr(r)) {
        expect(r.error.reason).toBe('zod');
        expect(r.error.detail).toBeTruthy();
        expect(r.error.detail!.toLowerCase()).toMatch(/translation|required|invalid/);
      }
    });

    it('returns ok when model returns valid JSON', async () => {
      createMessages.mockResolvedValue({
        content: [
          { type: 'text', text: JSON.stringify({ translation: 'he walked', lemma: 'caminar' }) },
        ],
      });
      const p = createLLMProvider({ mode: 'direct', anthropicKey: 'k' });
      const r = await p.translate(req);
      expect(isOk(r)).toBe(true);
      if (isOk(r)) {
        expect(r.value.result.translation).toBe('he walked');
        expect(r.value.result.lemma).toBe('caminar');
      }
    });

    it('parses JSON wrapped in markdown code fences', async () => {
      const fenced =
        '```json\n' +
        JSON.stringify({ translation: 'he walked', lemma: 'caminar' }) +
        '\n```';
      createMessages.mockResolvedValue({
        content: [{ type: 'text', text: fenced }],
      });
      const p = createLLMProvider({ mode: 'direct', anthropicKey: 'k' });
      const r = await p.translate(req);
      expect(isOk(r)).toBe(true);
      if (isOk(r)) {
        expect(r.value.result.translation).toBe('he walked');
        expect(r.value.result.lemma).toBe('caminar');
      }
    });
  });
});

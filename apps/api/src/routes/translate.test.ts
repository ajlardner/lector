import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { resetRateLimitStore } from '../middleware/rate-limit.js';
import * as anthropicModule from '../anthropic.js';
import { ok, err } from '@lector/shared';

const makeApp = () =>
  buildApp({
    anthropicKey: 'test',
    rateLimitPerHour: 100,
    rateLimitPerDay: 100,
    allowedOrigins: ['http://localhost:5173'],
  });

const validBody = {
  text: 'caminaba',
  context: 'El hombre caminaba por la calle.',
  sourceLang: 'es',
  targetLang: 'en',
  promptId: 'es-basic',
};

const post = (app: ReturnType<typeof makeApp>, body: unknown) =>
  app.request('/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
    body: JSON.stringify(body),
  });

describe('POST /api/translate', () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.restoreAllMocks();
  });

  it('returns 400 on invalid body', async () => {
    const app = makeApp();
    const res = await post(app, { text: '' });
    expect(res.status).toBe(400);
  });

  it('returns 200 and validated response on happy path', async () => {
    const spy = vi.spyOn(anthropicModule, 'translateWithRetry').mockResolvedValueOnce(
      ok({
        result: { translation: 'he was walking', lemma: 'caminar' },
        metadata: { latencyMs: 100, model: 'claude-haiku-4-5' },
      }),
    );
    const app = makeApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { translation: string } };
    expect(body.result.translation).toBe('he was walking');
    expect(spy).toHaveBeenCalled();
  });

  it('returns 502 on upstream failure', async () => {
    vi.spyOn(anthropicModule, 'translateWithRetry').mockRejectedValueOnce(
      new Error('anthropic down'),
    );
    const app = makeApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('upstream_error');
  });

  it('includes rawResponse in 502 body when zod retry fails', async () => {
    vi.spyOn(anthropicModule, 'translateWithRetry').mockResolvedValueOnce(
      err({
        reason: 'zod_failed_after_retry',
        rawResponse: '```json\n{"translation":"x"}\n```',
      }),
    );
    const app = makeApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; message: string; rawResponse?: string };
    expect(body.error).toBe('upstream_error');
    expect(body.message).toBe('zod_failed_after_retry');
    expect(body.rawResponse).toContain('translation');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimit, resetRateLimitStore } from './rate-limit.js';

const build = (perHour = 3, perDay = 5) => {
  const app = new Hono();
  app.use('/api/translate', rateLimit({ perHour, perDay }));
  app.post('/api/translate', (c) => c.json({ ok: true }));
  return app;
};

const req = (app: ReturnType<typeof build>, ip = '1.2.3.4', cookie?: string) =>
  app.request('/api/translate', {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
      ...(cookie ? { cookie } : {}),
    },
  });

describe('rateLimit middleware', () => {
  beforeEach(() => resetRateLimitStore());

  it('sets a session cookie on first request when absent', async () => {
    const app = build();
    const res = await req(app);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/lector_session=/);
  });

  it('allows up to perHour requests from one IP', async () => {
    const app = build(3, 100);
    for (let i = 0; i < 3; i++) {
      const res = await req(app);
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 when IP exceeds perHour', async () => {
    const app = build(2, 100);
    await req(app);
    await req(app);
    const res = await req(app);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; retryAfter: number };
    expect(body.error).toBe('rate_limited');
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it('returns 429 when session exceeds perDay', async () => {
    const app = build(100, 2);
    const r1 = await req(app, '1.1.1.1');
    const cookie = r1.headers.get('set-cookie')?.split(';')[0] ?? '';
    await req(app, '2.2.2.2', cookie);
    const res = await req(app, '3.3.3.3', cookie);
    expect(res.status).toBe(429);
  });
});

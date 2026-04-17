import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';

describe('buildApp', () => {
  it('returns a Hono app with GET /api/health', async () => {
    const app = buildApp({
      anthropicKey: 'test-key',
      rateLimitPerHour: 20,
      rateLimitPerDay: 50,
      allowedOrigins: ['http://localhost:5173'],
    });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

import { serve } from '@hono/node-server';
import { buildApp } from './app.js';

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

const app = buildApp({
  anthropicKey: requireEnv('ANTHROPIC_API_KEY'),
  rateLimitPerHour: Number(process.env.RATE_LIMIT_PER_HOUR ?? 20),
  rateLimitPerDay: Number(process.env.RATE_LIMIT_PER_DAY ?? 50),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','),
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`api listening on http://localhost:${port}`);

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimit } from './middleware/rate-limit.js';
import { buildTranslateRoute } from './routes/translate.js';

export type AppConfig = {
  anthropicKey: string;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  allowedOrigins: string[];
};

export const buildApp = (config: AppConfig) => {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origin) =>
        config.allowedOrigins.includes(origin ?? '') ? (origin ?? null) : null,
      credentials: true,
    }),
  );

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.use(
    '/api/translate',
    rateLimit({ perHour: config.rateLimitPerHour, perDay: config.rateLimitPerDay }),
  );

  app.route('/api/translate', buildTranslateRoute(config));

  app.onError((err, c) => {
    console.error('unhandled error', err);
    return c.json({ error: 'internal', message: err.message }, 500);
  });

  return app;
};

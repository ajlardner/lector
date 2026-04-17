import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

type Counter = { count: number; windowStart: number };
const ipStore = new Map<string, Counter>();
const sessionStore = new Map<string, Counter>();

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const bump = (
  store: Map<string, Counter>,
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } => {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || now - existing.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - existing.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }
  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
};

export const resetRateLimitStore = () => {
  ipStore.clear();
  sessionStore.clear();
};

const randomId = () =>
  globalThis.crypto.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const rateLimit = (opts: { perHour: number; perDay: number }): MiddlewareHandler => {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';

    let session = getCookie(c, 'lector_session');
    if (!session) {
      session = randomId();
      setCookie(c, 'lector_session', session, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    const ipCheck = bump(ipStore, ip, opts.perHour, HOUR_MS);
    if (!ipCheck.allowed) {
      return c.json(
        { error: 'rate_limited', retryAfter: ipCheck.retryAfter },
        429,
      );
    }

    const sessionCheck = bump(sessionStore, session, opts.perDay, DAY_MS);
    if (!sessionCheck.allowed) {
      return c.json(
        { error: 'rate_limited', retryAfter: sessionCheck.retryAfter },
        429,
      );
    }

    await next();
  };
};

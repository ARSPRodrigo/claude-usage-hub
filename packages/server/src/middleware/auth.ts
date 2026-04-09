import type { Context, Next } from 'hono';

/**
 * Auth middleware stub for alpha (local mode).
 * In team mode, this will verify JWT tokens and API keys.
 */
export async function authMiddleware(c: Context, next: Next): Promise<void | Response> {
  // Local mode: no auth required
  await next();
}

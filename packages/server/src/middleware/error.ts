import type { Context, Next } from 'hono';

/**
 * Global error handling middleware.
 */
export async function errorHandler(c: Context, next: Next): Promise<Response> {
  try {
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Unhandled error:', err);
    return c.json({ error: message }, 500);
  }
  return undefined as unknown as Response;
}

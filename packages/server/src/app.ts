import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { api } from './routes/api.js';
import { errorHandler } from './middleware/error.js';

/**
 * Create the Hono application.
 *
 * In production, static file serving for the dashboard is handled
 * by the CLI package (which knows the dashboard dist path).
 * The server app only handles API routes.
 */
export function createApp(): Hono {
  const app = new Hono();

  // Middleware
  app.use('*', cors());
  app.use('*', errorHandler);

  // API routes
  app.route('/api/v1', api);

  return app;
}

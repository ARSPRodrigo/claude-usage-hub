import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppMode } from '@claude-usage-hub/shared';
import type { AppEnv } from './env.js';
import { api } from './routes/api.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { apiKeyAuth, jwtAuth, requireAdmin } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';

/**
 * Create the Hono application.
 *
 * In team mode, auth middleware is applied to protect routes.
 * In local mode, all routes are open (backward compatible).
 */
export function createApp(mode: AppMode = 'local'): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Middleware
  app.use('*', cors());
  app.use('*', errorHandler);

  if (mode === 'team') {
    // Auth routes (login is public, me/logout require JWT)
    app.route('/auth', authRoutes);

    // Ingest: API key auth
    app.use('/api/v1/ingest', apiKeyAuth);

    // Dashboard/session/project routes: JWT auth
    app.use('/api/v1/dashboard/*', jwtAuth);
    app.use('/api/v1/sessions/*', jwtAuth);
    app.use('/api/v1/sessions', jwtAuth);
    app.use('/api/v1/projects/*', jwtAuth);
    app.use('/api/v1/projects', jwtAuth);

    // Admin routes: JWT + admin role
    app.use('/api/v1/admin/*', jwtAuth, requireAdmin);
    app.route('/api/v1/admin', adminRoutes);
  }

  // API routes (existing)
  app.route('/api/v1', api);

  return app;
}

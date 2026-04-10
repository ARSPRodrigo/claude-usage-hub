import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppMode } from '@claude-usage-hub/shared';
import type { AppEnv } from './env.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function getDashboardDistPath(): string {
  return (
    process.env['DASHBOARD_DIST_PATH'] ??
    resolve(__dirname, '../../../dashboard/dist')
  );
}
import { api } from './routes/api.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { acceptInvite } from './routes/invitations.js';
import { profileRoutes } from './routes/profile.js';
import { downloadRoutes } from './routes/downloads.js';
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

    // Ingest + collector identity: API key auth
    app.use('/api/v1/ingest', apiKeyAuth);
    app.use('/api/v1/me', apiKeyAuth);

    // Dashboard/session/project/profile routes: JWT auth
    app.use('/api/v1/dashboard/*', jwtAuth);
    app.use('/api/v1/sessions/*', jwtAuth);
    app.use('/api/v1/sessions', jwtAuth);
    app.use('/api/v1/projects/*', jwtAuth);
    app.use('/api/v1/projects', jwtAuth);
    app.use('/api/v1/profile/*', jwtAuth);
    app.route('/api/v1/profile', profileRoutes);

    // Admin routes: JWT + admin role (invitations are sub-routes within adminRoutes)
    app.use('/api/v1/admin/*', jwtAuth, requireAdmin);
    app.route('/api/v1/admin', adminRoutes);

    // Invitation accept — public, token-gated
    app.post('/auth/invite/accept', acceptInvite);
  }

  // API routes (existing)
  app.route('/api/v1', api);

  // Download routes — always public (collector bundle + install scripts)
  app.route('/', downloadRoutes);

  // Serve dashboard static files + SPA index.html fallback
  const distPath = getDashboardDistPath();
  if (existsSync(distPath)) {
    app.use('/assets/*', serveStatic({ root: distPath }));
    app.use('/favicon*', serveStatic({ root: distPath }));
    // SPA fallback — all remaining routes return index.html
    app.get('*', (c) => {
      const indexPath = resolve(distPath, 'index.html');
      if (existsSync(indexPath)) {
        const html = readFileSync(indexPath, 'utf-8');
        c.header('Content-Type', 'text/html; charset=utf-8');
        return c.body(html);
      }
      return c.json({ error: 'Dashboard not built' }, 404);
    });
  }

  return app;
}

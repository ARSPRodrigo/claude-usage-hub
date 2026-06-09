import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
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
import { apiKeyAuth, jwtAuth, requireAdminOrOwner } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';

/**
 * Create the Hono application.
 *
 * In team mode, auth middleware is applied to protect routes.
 * In local mode, all routes are open (backward compatible).
 */
export function createApp(mode: AppMode = 'local'): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Security headers
  app.use('*', secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    referrerPolicy: 'strict-origin-when-cross-origin',
    // COOP must be 'unsafe-none' — 'same-origin' (Hono default) nullifies
    // window.opener in the Google Sign-In popup, breaking the postMessage
    // credential return flow.
    crossOriginOpenerPolicy: 'unsafe-none',
  }));

  // CORS — allow same-origin in production, localhost in development
  app.use('*', cors({
    origin: (origin) => {
      if (!origin) return origin; // same-origin requests have no Origin header
      if (process.env['NODE_ENV'] !== 'production' && origin.startsWith('http://localhost')) {
        return origin;
      }
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }));

  app.use('*', errorHandler);

  // Body size limit on ingest — collector payloads should not exceed 10 MB
  app.use('/api/v1/ingest', bodyLimit({ maxSize: 10 * 1024 * 1024 }));

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

    // Admin routes: JWT + admin-or-owner. Per-route guards (requirePlatformAdmin,
    // requirePlatformOwner) and handler-level scope checks gate writes more
    // tightly than the mount allows.
    app.use('/api/v1/admin/*', jwtAuth, requireAdminOrOwner);
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
    // Content-hashed assets: long cache, immutable.
    // Guard: only set immutable if serveStatic actually found the file (not HTML SPA fallback).
    app.use('/assets/*', async (c, next) => {
      await next();
      if (!c.res.headers.get('content-type')?.startsWith('text/html')) {
        c.header('Cache-Control', 'public, max-age=31536000, immutable');
      }
    });
    app.use('/assets/*', serveStatic({ root: distPath }));
    app.use('/favicon*', serveStatic({ root: distPath }));
    // SPA fallback — never cache so Cloudflare can't capture a stale entry.
    app.get('*', (c) => {
      const indexPath = resolve(distPath, 'index.html');
      if (existsSync(indexPath)) {
        const html = readFileSync(indexPath, 'utf-8');
        c.header('Content-Type', 'text/html; charset=utf-8');
        c.header('Cache-Control', 'no-store');
        return c.body(html);
      }
      return c.json({ error: 'Dashboard not built' }, 404);
    });
  }

  return app;
}

# ─── Stage 1: Build collector bundle ─────────────────────────────────────────
FROM node:20-slim AS collector-build

WORKDIR /build

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace config + package manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/collector/package.json packages/collector/

# Install only collector + shared deps
RUN pnpm install --frozen-lockfile --filter @claude-usage-hub/collector --filter @claude-usage-hub/shared

# Copy source
COPY packages/shared packages/shared
COPY packages/collector packages/collector

# Build shared first, then bundle collector into single file
RUN pnpm --filter @claude-usage-hub/shared build
RUN pnpm --filter @claude-usage-hub/collector build:bundle


# ─── Stage 2: Build dashboard ─────────────────────────────────────────────────
FROM node:20-slim AS dashboard-build

WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/dashboard/package.json packages/dashboard/

RUN pnpm install --frozen-lockfile --filter @claude-usage-hub/dashboard --filter @claude-usage-hub/shared

COPY packages/shared packages/shared
COPY packages/dashboard packages/dashboard

RUN pnpm --filter @claude-usage-hub/shared build
RUN pnpm --filter @claude-usage-hub/dashboard build


# ─── Stage 3: Build server ────────────────────────────────────────────────────
FROM node:20-slim AS server-build

WORKDIR /build

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile --filter @claude-usage-hub/server --filter @claude-usage-hub/shared

COPY packages/shared packages/shared
COPY packages/server packages/server

RUN pnpm --filter @claude-usage-hub/shared build
RUN pnpm --filter @claude-usage-hub/server build


# ─── Stage 4: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install only production deps for server
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile --prod \
    --filter @claude-usage-hub/server \
    --filter @claude-usage-hub/shared

# Copy built artifacts
COPY --from=server-build /build/packages/shared/dist packages/shared/dist
COPY --from=server-build /build/packages/server/dist packages/server/dist

# Dashboard static files — served by the Hono server
COPY --from=dashboard-build /build/packages/dashboard/dist packages/dashboard/dist

# Collector bundle — served at /download/collector.js
COPY --from=collector-build /build/packages/collector/dist/collector.bundle.js packages/collector/dist/collector.bundle.js

# Data directory for SQLite + logs
RUN mkdir -p /data && chown node:node /data

USER node

EXPOSE 8080

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/usage.db \
    DASHBOARD_DIST_PATH=/app/packages/dashboard/dist \
    COLLECTOR_BUNDLE_PATH=/app/packages/collector/dist/collector.bundle.js

CMD ["node", "packages/server/dist/server.js"]

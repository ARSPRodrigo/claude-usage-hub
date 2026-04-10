// Public API for the server package
export { startServer } from './server.js';
export { createApp } from './app.js';
export { createDb, getDb, getRawDb, closeDb } from './db/connection.js';
export { runMigrations } from './db/migrate.js';
export { insertEntries, getEntryCount, getSessionDetail, getCostBreakdown, getSessionCount } from './db/repository.js';
export { ingestPayload, ingestDirect } from './services/ingest.js';
export { loadServerConfig, loadAuthConfig } from './config.js';
export type { AuthConfig } from './config.js';
export { hashPassword, verifyPassword, generateApiKey, hashApiKey } from './services/auth-utils.js';
export {
  findUserByEmail,
  findUserById,
  createUser,
  listUsers,
  findApiKeyByHash,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from './db/auth-repository.js';
export type { UserRow, ApiKeyRow } from './db/auth-repository.js';
export { setJwtSecret, signJwt, apiKeyAuth, jwtAuth, requireAdmin } from './middleware/auth.js';

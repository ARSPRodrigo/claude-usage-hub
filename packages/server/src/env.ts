import type { AuthContext } from '@claude-usage-hub/shared';

/**
 * Hono environment type for typed context variables.
 */
export type AppEnv = {
  Variables: {
    auth: AuthContext;
  };
};

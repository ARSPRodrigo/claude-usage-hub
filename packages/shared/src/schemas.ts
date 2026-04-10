import { z } from 'zod';

/**
 * Zod schema for a JSONL assistant entry's message.usage field.
 */
export const usageFieldSchema = z.object({
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  cache_creation_input_tokens: z.number().int().min(0).default(0),
  cache_read_input_tokens: z.number().int().min(0).default(0),
  service_tier: z.string().default('standard'),
});

/**
 * Zod schema for a JSONL assistant entry's message field.
 */
export const assistantMessageSchema = z.object({
  id: z.string(),
  model: z.string(),
  role: z.literal('assistant'),
  usage: usageFieldSchema,
});

/**
 * Zod schema for a JSONL assistant entry (top-level line).
 * Only validates the fields we need — ignores content, cwd, gitBranch, etc.
 */
export const assistantEntrySchema = z.object({
  type: z.literal('assistant'),
  sessionId: z.string(),
  timestamp: z.string(),
  requestId: z.string(),
  message: assistantMessageSchema,
});

/** Type inferred from the assistant entry schema. */
export type AssistantEntryRaw = z.infer<typeof assistantEntrySchema>;

/**
 * Zod schema for a single enriched entry in an ingest payload.
 */
export const enrichedEntrySchema = z.object({
  sessionId: z.string(),
  messageId: z.string(),
  requestId: z.string(),
  timestamp: z.string(),
  model: z.string(),
  usage: z.object({
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
    cacheCreationTokens: z.number().int().min(0),
    cacheReadTokens: z.number().int().min(0),
  }),
  serviceTier: z.string(),
  developerId: z.string(),
  projectAlias: z.string(),
  costUsd: z.number().min(0),
});

/**
 * Zod schema for the ingest payload the collector POSTs to the server.
 */
export const ingestPayloadSchema = z.object({
  collectorVersion: z.string(),
  developerId: z.string(),
  timestamp: z.string(),
  entries: z.array(enrichedEntrySchema),
  statsSummary: z
    .object({
      totalSessions: z.number().int().min(0),
      totalMessages: z.number().int().min(0),
      dailyActivity: z.array(
        z.object({
          date: z.string(),
          messageCount: z.number().int().min(0),
          sessionCount: z.number().int().min(0),
          toolCallCount: z.number().int().min(0),
        }),
      ),
      dailyModelTokens: z.array(
        z.object({
          date: z.string(),
          tokensByModel: z.record(z.string(), z.number()),
        }),
      ),
    })
    .optional(),
});

/**
 * Zod schema for ~/.claude/stats-cache.json.
 */
export const statsCacheSchema = z.object({
  version: z.number(),
  lastComputedDate: z.string().optional(),
  dailyActivity: z
    .array(
      z.object({
        date: z.string(),
        messageCount: z.number(),
        sessionCount: z.number(),
        toolCallCount: z.number(),
      }),
    )
    .default([]),
  dailyModelTokens: z
    .array(
      z.object({
        date: z.string(),
        tokensByModel: z.record(z.string(), z.number()),
      }),
    )
    .default([]),
  modelUsage: z
    .record(
      z.string(),
      z.object({
        inputTokens: z.number().default(0),
        outputTokens: z.number().default(0),
        cacheReadInputTokens: z.number().default(0),
        cacheCreationInputTokens: z.number().default(0),
        costUSD: z.number().default(0),
      }),
    )
    .default({}),
  totalSessions: z.number().default(0),
  totalMessages: z.number().default(0),
});

/**
 * Zod schema for collector config file.
 */
export const collectorConfigSchema = z.object({
  serverUrl: z.string().url(),
  apiKey: z.string().min(1),
  developerId: z.string().min(1),
  salt: z.string().min(8),
  intervalMinutes: z.number().int().min(1).default(30),
  claudeDataPath: z.string().default('~/.claude/projects'),
});

// ---------------------------------------------------------------------------
// Auth schemas (team mode)
// ---------------------------------------------------------------------------

/** Login request validation. */
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/** Create API key request validation. */
export const createApiKeySchema = z.object({
  userId: z.string().min(1),
  label: z.string().min(1).max(100),
});

/** Create developer request validation. */
export const createDeveloperSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
  developerId: z.string().min(1).max(100),
});

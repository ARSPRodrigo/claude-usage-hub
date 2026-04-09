import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const usageEntries = sqliteTable(
  'usage_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: text('session_id').notNull(),
    messageId: text('message_id').notNull(),
    requestId: text('request_id').notNull(),
    timestamp: text('timestamp').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    cacheCreationTokens: integer('cache_creation_tokens').notNull(),
    cacheReadTokens: integer('cache_read_tokens').notNull(),
    serviceTier: text('service_tier').notNull().default('standard'),
    developerId: text('developer_id').notNull(),
    projectAlias: text('project_alias').notNull(),
    costUsd: real('cost_usd').notNull(),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  },
  (table) => ({
    messageRequestIdx: uniqueIndex('idx_message_request').on(table.messageId, table.requestId),
    timestampIdx: index('idx_timestamp').on(table.timestamp),
    sessionIdx: index('idx_session_id').on(table.sessionId),
    projectIdx: index('idx_project_alias').on(table.projectAlias),
    modelIdx: index('idx_model').on(table.model),
    timestampModelIdx: index('idx_timestamp_model').on(table.timestamp, table.model),
  }),
);

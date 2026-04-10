import { sqliteTable, text, integer, real, uniqueIndex, index, foreignKey } from 'drizzle-orm/sqlite-core';

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

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('developer'),
  developerId: text('developer_id').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    label: text('label').notNull(),
    developerId: text('developer_id').notNull(),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    revokedAt: text('revoked_at'),
  },
  (table) => ({
    hashIdx: index('idx_api_keys_hash_drizzle').on(table.keyHash),
    userIdx: index('idx_api_keys_user_drizzle').on(table.userId),
    userFk: foreignKey({ columns: [table.userId], foreignColumns: [users.id] }),
  }),
);

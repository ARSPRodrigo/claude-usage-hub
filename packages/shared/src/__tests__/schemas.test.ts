import { describe, it, expect } from 'vitest';
import { assistantEntrySchema, ingestPayloadSchema } from '../schemas.js';

describe('assistantEntrySchema', () => {
  const validEntry = {
    type: 'assistant',
    sessionId: 'abc-123',
    timestamp: '2026-04-01T10:00:00Z',
    requestId: 'req_001',
    message: {
      id: 'msg_001',
      model: 'claude-opus-4-6',
      role: 'assistant',
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 25,
        service_tier: 'standard',
      },
    },
  };

  it('validates a correct assistant entry', () => {
    const result = assistantEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it('rejects non-assistant type', () => {
    const result = assistantEntrySchema.safeParse({ ...validEntry, type: 'user' });
    expect(result.success).toBe(false);
  });

  it('rejects missing sessionId', () => {
    const { sessionId, ...missing } = validEntry;
    const result = assistantEntrySchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('defaults cache tokens to 0 when missing', () => {
    const entry = {
      ...validEntry,
      message: {
        ...validEntry.message,
        usage: {
          input_tokens: 100,
          output_tokens: 200,
        },
      },
    };
    const result = assistantEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message.usage.cache_creation_input_tokens).toBe(0);
      expect(result.data.message.usage.cache_read_input_tokens).toBe(0);
    }
  });

  it('rejects negative token counts', () => {
    const entry = {
      ...validEntry,
      message: {
        ...validEntry.message,
        usage: { ...validEntry.message.usage, input_tokens: -1 },
      },
    };
    const result = assistantEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });
});

describe('ingestPayloadSchema', () => {
  it('validates a correct payload', () => {
    const payload = {
      collectorVersion: '0.1.0',
      developerId: 'dev-123',
      timestamp: '2026-04-01T10:00:00Z',
      entries: [
        {
          sessionId: 's1',
          messageId: 'm1',
          requestId: 'r1',
          timestamp: '2026-04-01T10:00:00Z',
          model: 'claude-opus-4-6',
          usage: { inputTokens: 100, outputTokens: 200, cacheCreationTokens: 0, cacheReadTokens: 0 },
          serviceTier: 'standard',
          developerId: 'dev-123',
          projectAlias: 'abc123',
          costUsd: 0.05,
        },
      ],
    };
    const result = ingestPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('accepts empty entries array', () => {
    const payload = {
      collectorVersion: '0.1.0',
      developerId: 'dev-123',
      timestamp: '2026-04-01T10:00:00Z',
      entries: [],
    };
    const result = ingestPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

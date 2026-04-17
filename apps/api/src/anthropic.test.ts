import { describe, it, expect, vi } from 'vitest';
import { translateWithRetry } from './anthropic.js';
import type { Anthropic } from '@anthropic-ai/sdk';

const mockClient = (
  responses: string[],
): Pick<Anthropic['messages'], 'create'> & { create: ReturnType<typeof vi.fn> } => {
  const create = vi.fn();
  for (const r of responses) {
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: r }],
    });
  }
  return { create } as never;
};

const buildMockAnthropic = (responses: string[]) =>
  ({ messages: mockClient(responses) }) as unknown as Anthropic;

describe('translateWithRetry', () => {
  it('returns parsed JSON on first valid response', async () => {
    const client = buildMockAnthropic([
      JSON.stringify({ translation: 'the house', lemma: 'casa' }),
    ]);
    const result = await translateWithRetry(client, {
      systemPrompt: 'sp',
      userPrompt: 'up',
      model: 'claude-haiku-4-5',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.result.translation).toBe('the house');
  });

  it('retries once when the first response fails Zod', async () => {
    const client = buildMockAnthropic([
      'not json',
      JSON.stringify({ translation: 'the house' }),
    ]);
    const result = await translateWithRetry(client, {
      systemPrompt: 'sp',
      userPrompt: 'up',
      model: 'claude-haiku-4-5',
    });
    expect(result.ok).toBe(true);
  });

  it('returns err after both attempts fail', async () => {
    const client = buildMockAnthropic(['not json', 'still not json']);
    const result = await translateWithRetry(client, {
      systemPrompt: 'sp',
      userPrompt: 'up',
      model: 'claude-haiku-4-5',
    });
    expect(result.ok).toBe(false);
  });

  it('parses JSON wrapped in markdown code fences', async () => {
    const fenced = '```json\n' + JSON.stringify({ translation: 'the house', lemma: 'casa' }) + '\n```';
    const client = buildMockAnthropic([fenced]);
    const result = await translateWithRetry(client, {
      systemPrompt: 'sp',
      userPrompt: 'up',
      model: 'claude-haiku-4-5',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.result.translation).toBe('the house');
  });
});

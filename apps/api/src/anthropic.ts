import type { Anthropic } from '@anthropic-ai/sdk';
import { LLMTranslationSchema, type TranslateResponse, ok, err, type Result } from '@lector/shared';

export const DEFAULT_MODEL = 'claude-haiku-4-5';

type TranslateArgs = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
};

type MessageResponse = { content: Array<{ type: string; text?: string }> };

const extractText = (resp: unknown): string => {
  const message = resp as MessageResponse;
  const block = Array.isArray(message.content) ? message.content[0] : null;
  if (!block || block.type !== 'text' || typeof block.text !== 'string') return '';
  return block.text;
};

const stripCodeFences = (s: string): string => {
  const trimmed = s.trim();
  const m = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return m?.[1]?.trim() ?? trimmed;
};

const tryParse = (raw: string) => {
  try {
    const json = JSON.parse(stripCodeFences(raw));
    return LLMTranslationSchema.safeParse(json);
  } catch {
    return { success: false as const, error: new Error('non-json') };
  }
};

export const translateWithRetry = async (
  client: Anthropic,
  args: TranslateArgs,
): Promise<Result<TranslateResponse, { reason: string; rawResponse: string }>> => {
  const start = Date.now();

  const first = await client.messages.create({
    model: args.model,
    max_tokens: 1024,
    system: args.systemPrompt,
    messages: [{ role: 'user', content: args.userPrompt }],
  });
  const firstText = extractText(first);
  const firstParsed = tryParse(firstText);
  if (firstParsed.success) {
    return ok({
      result: firstParsed.data,
      metadata: { latencyMs: Date.now() - start, model: args.model },
    });
  }

  console.error('[anthropic] first attempt did not parse', { text: firstText });

  const correction = `Your previous response did not parse as the required JSON object. Respond again with ONLY a valid JSON object matching the schema in the system prompt. Previous response was: ${firstText.slice(0, 500)}`;
  const second = await client.messages.create({
    model: args.model,
    max_tokens: 1024,
    system: args.systemPrompt,
    messages: [{ role: 'user', content: args.userPrompt + '\n\n' + correction }],
  });
  const secondText = extractText(second);
  const secondParsed = tryParse(secondText);
  if (secondParsed.success) {
    return ok({
      result: secondParsed.data,
      metadata: { latencyMs: Date.now() - start, model: args.model },
    });
  }

  console.error('[anthropic] second attempt did not parse', { text: secondText });
  return err({ reason: 'zod_failed_after_retry', rawResponse: secondText });
};

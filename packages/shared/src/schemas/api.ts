import { z } from 'zod';
import { LLMTranslationSchema } from './llm.js';

export const SupportedSourceLang = z.enum(['es']);
export const SupportedTargetLang = z.enum(['en']);

export const TranslateRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  context: z.string().max(4000),
  sourceLang: SupportedSourceLang,
  targetLang: SupportedTargetLang,
  promptId: z.string().min(1),
});

export const TranslateResponseSchema = z.object({
  result: LLMTranslationSchema,
  metadata: z.object({
    latencyMs: z.number().nonnegative(),
    model: z.string(),
  }),
});

export const ApiErrorSchema = z.object({
  error: z.enum(['rate_limited', 'bad_request', 'upstream_error', 'internal']),
  message: z.string().optional(),
  retryAfter: z.number().optional(),
});

export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;
export type TranslateResponse = z.infer<typeof TranslateResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

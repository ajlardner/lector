import { z } from 'zod';

export const LLMExampleSchema = z.object({
  source: z.string(),
  translation: z.string(),
});

export const LLMTranslationSchema = z.object({
  translation: z.string().min(1),
  lemma: z.string().optional(),
  partOfSpeech: z.string().optional(),
  grammarNotes: z.string().optional(),
  examples: z.array(LLMExampleSchema).optional(),
  alternativeTranslations: z.array(z.string()).optional(),
});

export type LLMTranslation = z.infer<typeof LLMTranslationSchema>;
export type LLMExample = z.infer<typeof LLMExampleSchema>;

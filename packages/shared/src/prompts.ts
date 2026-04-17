import { z } from 'zod';

export const PromptSchema = z.object({
  id: z.string().min(1),
  language: z.string().min(2).max(8),
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  builtIn: z.boolean(),
  version: z.number().int().positive(),
});

export type Prompt = z.infer<typeof PromptSchema>;

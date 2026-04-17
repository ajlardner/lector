import { describe, it, expect } from 'vitest';
import { esBasicPrompt } from './es-basic.js';
import { PromptSchema } from '../../prompts.js';

describe('esBasicPrompt', () => {
  it('is a valid Prompt', () => {
    expect(PromptSchema.safeParse(esBasicPrompt).success).toBe(true);
  });

  it('has language es and is builtIn', () => {
    expect(esBasicPrompt.language).toBe('es');
    expect(esBasicPrompt.builtIn).toBe(true);
  });

  it('mentions all template variables', () => {
    const sp = esBasicPrompt.systemPrompt;
    expect(sp).toContain('{selectedText}');
    expect(sp).toContain('{surroundingContext}');
    expect(sp).toContain('{sourceLanguage}');
    expect(sp).toContain('{targetLanguage}');
  });

  it('instructs the model to return JSON matching LLMTranslation', () => {
    const sp = esBasicPrompt.systemPrompt.toLowerCase();
    expect(sp).toContain('json');
    expect(sp).toContain('translation');
  });
});

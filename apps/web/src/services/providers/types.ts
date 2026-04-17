import type { Result, LLMTranslation } from '@lector/shared';

export type TranslationRequest = {
  text: string;
  context: string;
  sourceLang: 'es';
  targetLang: 'en';
  promptId: string;
};

export type DictionaryResult = {
  translation: string;
  lemma: string;
  partOfSpeech?: string;
};

export type DictionaryError = { reason: 'not_found' | 'network' | 'parse'; detail?: string };
export type LLMError = { reason: 'network' | 'zod' | 'rate_limited' | 'unauthorized' | 'server'; detail?: string };

export type DictionaryProvider = {
  lookup: (req: TranslationRequest) => Promise<Result<DictionaryResult, DictionaryError>>;
};

export type LLMProvider = {
  translate: (req: TranslationRequest) => Promise<Result<{ result: LLMTranslation; rawResponse: string }, LLMError>>;
};

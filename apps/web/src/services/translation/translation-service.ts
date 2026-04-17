import { ok, err, type Result, type LLMTranslation } from '@lector/shared';
import type { DictionaryProvider, LLMProvider, TranslationRequest } from '../providers/types.js';
import type { LookupsRepo } from '../db/repositories/lookups.js';
import type { VocabItemsRepo } from '../db/repositories/vocab-items.js';

export type TierRequest = TranslationRequest & { tier: 'dictionary' | 'llm' };

export type DictionaryTranslation = {
  tier: 'dictionary';
  translation: string;
  lemma: string;
  partOfSpeech?: string;
};

export type LLMTranslationResult = {
  tier: 'llm';
  result: LLMTranslation;
};

export type TranslationResult = DictionaryTranslation | LLMTranslationResult;

export type TranslationError =
  | { reason: 'not_found' }
  | { reason: 'rate_limited' }
  | { reason: 'unauthorized' }
  | { reason: 'network'; detail?: string }
  | { reason: 'server'; detail?: string }
  | { reason: 'zod'; detail?: string };

type Deps = {
  dict: DictionaryProvider;
  llm: LLMProvider;
  lookups: LookupsRepo;
  vocabItems: VocabItemsRepo;
};

export const createTranslationService = (deps: Deps) => ({
  translate: async (
    req: TierRequest,
  ): Promise<Result<TranslationResult, TranslationError>> => {
    if (req.tier === 'dictionary') {
      const r = await deps.dict.lookup(req);
      if (!r.ok) {
        if (r.error.reason === 'not_found') return err({ reason: 'not_found' });
        return err({
          reason: 'network',
          ...(r.error.detail !== undefined ? { detail: r.error.detail } : {}),
        });
      }
      await deps.lookups.insert({
        sourceText: req.text,
        sourceLang: req.sourceLang,
        translation: r.value.translation,
        context: req.context,
        articleId: null,
        provider: 'wiktionary',
        promptId: null,
        tier: 'dictionary',
        rawResponse: JSON.stringify(r.value),
      });
      await deps.vocabItems.upsert({ lemma: r.value.lemma, language: req.sourceLang });
      return ok({
        tier: 'dictionary',
        translation: r.value.translation,
        lemma: r.value.lemma,
        ...(r.value.partOfSpeech ? { partOfSpeech: r.value.partOfSpeech } : {}),
      });
    }

    const r = await deps.llm.translate(req);
    if (!r.ok) return err(r.error);

    const lemma = r.value.result.lemma ?? req.text;
    await deps.lookups.insert({
      sourceText: req.text,
      sourceLang: req.sourceLang,
      translation: r.value.result.translation,
      context: req.context,
      articleId: null,
      provider: 'anthropic',
      promptId: req.promptId,
      tier: 'llm',
      rawResponse: r.value.rawResponse,
    });
    await deps.vocabItems.upsert({ lemma, language: req.sourceLang });

    return ok({ tier: 'llm', result: r.value.result });
  },
});

export type TranslationService = ReturnType<typeof createTranslationService>;

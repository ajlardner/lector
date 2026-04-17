import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, type DbClient } from '../db/client.js';
import { runMigrations } from '../db/migrations.js';
import { createLookupsRepo } from '../db/repositories/lookups.js';
import { createVocabItemsRepo } from '../db/repositories/vocab-items.js';
import { createTranslationService } from './translation-service.js';
import { ok, err } from '@lector/shared';
import type { DictionaryProvider, LLMProvider } from '../providers/types.js';

const mkProviders = () => {
  const dict: DictionaryProvider = {
    lookup: async () =>
      ok({ translation: 'house', lemma: 'casa', partOfSpeech: 'Noun' }),
  };
  const llm: LLMProvider = {
    translate: async () =>
      ok({
        result: { translation: 'the house', lemma: 'casa' },
        rawResponse: '{"translation":"the house"}',
      }),
  };
  return { dict, llm };
};

describe('TranslationService', () => {
  let db: DbClient;
  beforeEach(async () => {
    db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
  });

  it('dictionary tier logs lookup and upserts vocab', async () => {
    const { dict, llm } = mkProviders();
    const svc = createTranslationService({
      dict,
      llm,
      lookups: createLookupsRepo(db),
      vocabItems: createVocabItemsRepo(db),
    });
    const r = await svc.translate({
      text: 'casa',
      context: 'la casa',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
      tier: 'dictionary',
    });
    expect(r.ok).toBe(true);
    const lookups = await db.query('SELECT * FROM lookups;');
    expect(lookups).toHaveLength(1);
    const vocab = await db.query('SELECT * FROM vocab_items;');
    expect(vocab).toHaveLength(1);
    expect((vocab[0] as any).lemma).toBe('casa');
  });

  it('llm tier returns structured translation', async () => {
    const { dict, llm } = mkProviders();
    const svc = createTranslationService({
      dict,
      llm,
      lookups: createLookupsRepo(db),
      vocabItems: createVocabItemsRepo(db),
    });
    const r = await svc.translate({
      text: 'la casa roja',
      context: 'Vivo en la casa roja.',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
      tier: 'llm',
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.tier === 'llm') {
      expect(r.value.result.translation).toBe('the house');
    }
  });

  it('llm error still surfaces; no lookup row written', async () => {
    const llm: LLMProvider = {
      translate: async () => err({ reason: 'rate_limited' }),
    };
    const svc = createTranslationService({
      dict: mkProviders().dict,
      llm,
      lookups: createLookupsRepo(db),
      vocabItems: createVocabItemsRepo(db),
    });
    const r = await svc.translate({
      text: 'x',
      context: 'x',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
      tier: 'llm',
    });
    expect(r.ok).toBe(false);
    const lookups = await db.query('SELECT * FROM lookups;');
    expect(lookups).toHaveLength(0);
  });
});

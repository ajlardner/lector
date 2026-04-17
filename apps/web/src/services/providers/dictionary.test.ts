import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWiktionaryDictionary } from './dictionary.js';
import { isOk, isErr } from '@lector/shared';

const wiktionaryResponse = {
  en: [
    {
      partOfSpeech: 'Verb',
      language: 'Spanish',
      definitions: [{ definition: 'to walk' }],
    },
  ],
};

describe('WiktionaryDictionary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns translation and part of speech on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(wiktionaryResponse), { status: 200 }),
      ),
    );
    const dict = createWiktionaryDictionary();
    const r = await dict.lookup({
      text: 'caminar',
      context: '',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.translation).toBe('to walk');
      expect(r.value.lemma).toBe('caminar');
      expect(r.value.partOfSpeech).toBe('Verb');
    }
  });

  it('returns err not_found on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const dict = createWiktionaryDictionary();
    const r = await dict.lookup({
      text: 'xyzabc',
      context: '',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.reason).toBe('not_found');
  });

  it('returns err network on fetch throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    const dict = createWiktionaryDictionary();
    const r = await dict.lookup({
      text: 'caminar',
      context: '',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.reason).toBe('network');
  });
});

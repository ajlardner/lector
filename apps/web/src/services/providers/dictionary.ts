import { ok, err } from '@lector/shared';
import type { DictionaryProvider } from './types.js';

const WIKI_BASE =
  'https://en.wiktionary.org/api/rest_v1/page/definition/';

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const SOURCE_LANG_NAMES: Record<string, string> = {
  es: 'Spanish',
};

export const createWiktionaryDictionary = (): DictionaryProvider => ({
  lookup: async (req) => {
    try {
      const resp = await fetch(`${WIKI_BASE}${encodeURIComponent(req.text)}`);
      if (resp.status === 404) return err({ reason: 'not_found' });
      if (!resp.ok) return err({ reason: 'network', detail: `status ${resp.status}` });

      const data = (await resp.json()) as Record<string, Array<{
        partOfSpeech?: string;
        language?: string;
        definitions?: Array<{ definition?: string }>;
      }>>;

      const en = data.en ?? [];
      const sourceName = SOURCE_LANG_NAMES[req.sourceLang];
      const match =
        en.find((e) => e.language === sourceName) ?? en[0];

      if (!match) return err({ reason: 'not_found' });
      const defRaw = match.definitions?.[0]?.definition;
      if (!defRaw) return err({ reason: 'not_found' });

      const result: Awaited<ReturnType<DictionaryProvider['lookup']>> = ok({
        translation: stripHtml(defRaw),
        lemma: req.text,
        ...(match.partOfSpeech ? { partOfSpeech: match.partOfSpeech } : {}),
      });
      return result;
    } catch (e) {
      return err({ reason: 'network', detail: (e as Error).message });
    }
  },
});

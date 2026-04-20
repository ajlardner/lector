import { ok, err } from '@lector/shared';
import type { DictionaryProvider } from './types.js';

const WIKI_BASE =
  'https://en.wiktionary.org/api/rest_v1/page/definition/';

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

type WiktEntry = {
  partOfSpeech?: string;
  language?: string;
  definitions?: Array<{ definition?: string }>;
};

const fetchDefinition = async (
  term: string,
  sourceLang: string,
): Promise<{ match: WiktEntry; term: string } | null> => {
  const resp = await fetch(`${WIKI_BASE}${encodeURIComponent(term)}`);
  if (!resp.ok) return null;
  const data = (await resp.json()) as Record<string, WiktEntry[]>;
  const entry = data[sourceLang]?.[0];
  if (!entry?.definitions?.[0]?.definition) return null;
  return { match: entry, term };
};

export const createWiktionaryDictionary = (): DictionaryProvider => ({
  lookup: async (req) => {
    try {
      const lower = req.text.toLowerCase();
      const hit =
        (await fetchDefinition(req.text, req.sourceLang)) ??
        (req.text !== lower ? await fetchDefinition(lower, req.sourceLang) : null);

      if (!hit) return err({ reason: 'not_found' });

      const defRaw = hit.match.definitions?.[0]?.definition ?? '';
      return ok({
        translation: stripHtml(defRaw),
        lemma: hit.term,
        ...(hit.match.partOfSpeech ? { partOfSpeech: hit.match.partOfSpeech } : {}),
      });
    } catch (e) {
      return err({ reason: 'network', detail: (e as Error).message });
    }
  },
});

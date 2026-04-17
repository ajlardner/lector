import { useMemo } from 'react';
import { toast } from 'sonner';
import { getDb } from '@/services/db/index.js';
import { createWiktionaryDictionary } from '@/services/providers/dictionary.js';
import { createLLMProvider } from '@/services/providers/llm.js';
import { createTranslationService } from '@/services/translation/translation-service.js';
import { useAppStore } from '@/store/index.js';
import { isOk } from '@lector/shared';
import type { TierRequest } from '@/services/translation/translation-service.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

export const useTranslation = () => {
  const mode = useAppStore((s) => s.mode);
  const apiKey = useAppStore((s) => s.apiKey);
  const setActiveLookup = useAppStore((s) => s.setActiveLookup);

  return useMemo(() => {
    const dict = createWiktionaryDictionary();
    const llm =
      mode === 'byo-key' && apiKey
        ? createLLMProvider({ mode: 'direct', anthropicKey: apiKey })
        : createLLMProvider({ mode: 'proxy', apiBaseUrl: API_BASE_URL });

    return {
      run: async (req: TierRequest, anchor: { x: number; y: number }) => {
        setActiveLookup({ anchor, status: 'loading' });
        const db = await getDb();
        const svc = createTranslationService({
          dict,
          llm,
          lookups: db.lookups,
          vocabItems: db.vocabItems,
        });
        const r = await svc.translate(req);
        if (isOk(r)) {
          const payload =
            r.value.tier === 'dictionary'
              ? {
                  kind: 'dictionary' as const,
                  translation: r.value.translation,
                  lemma: r.value.lemma,
                  ...(r.value.partOfSpeech ? { partOfSpeech: r.value.partOfSpeech } : {}),
                }
              : {
                  kind: 'llm' as const,
                  translation: r.value.result.translation,
                  ...(r.value.result.lemma ? { lemma: r.value.result.lemma } : {}),
                  ...(r.value.result.grammarNotes
                    ? { grammarNotes: r.value.result.grammarNotes }
                    : {}),
                  ...(r.value.result.examples ? { examples: r.value.result.examples } : {}),
                  ...(r.value.result.alternativeTranslations
                    ? { alternativeTranslations: r.value.result.alternativeTranslations }
                    : {}),
                };
          setActiveLookup({ anchor, status: 'ok', payload });
          return;
        }

        let msg = 'Translation failed.';
        if (r.error.reason === 'rate_limited') {
          msg = 'Demo limit reached. Add your Anthropic key in Settings to continue.';
          toast.error(msg);
        } else if (r.error.reason === 'unauthorized') {
          msg = 'Your API key was rejected. Check Settings.';
          toast.error(msg);
        } else if (r.error.reason === 'not_found') {
          msg = 'No dictionary entry. Try a longer selection for an LLM translation.';
        } else if (r.error.reason === 'zod') {
          msg = `Invalid translation response. ${r.error.detail ?? 'See console for details.'}`;
          toast.error(msg);
        } else if (r.error.reason === 'network' || r.error.reason === 'server') {
          msg = `${r.error.reason === 'network' ? 'Network' : 'Server'} error${r.error.detail ? `: ${r.error.detail}` : '.'}`;
          toast.error(msg);
        } else {
          toast.error(msg);
        }
        setActiveLookup({ anchor, status: 'error', errorMessage: msg });
      },
    };
  }, [mode, apiKey, setActiveLookup]);
};

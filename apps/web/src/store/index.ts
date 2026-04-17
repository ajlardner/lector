import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TranslationMode = 'demo' | 'byo-key';

export type ActiveLookup = {
  anchor: { x: number; y: number };
  status: 'loading' | 'ok' | 'error';
  payload?:
    | { kind: 'dictionary'; translation: string; lemma: string; partOfSpeech?: string }
    | { kind: 'llm'; translation: string; lemma?: string; grammarNotes?: string; examples?: { source: string; translation: string }[]; alternativeTranslations?: string[] };
  errorMessage?: string;
} | null;

type State = {
  mode: TranslationMode;
  apiKey: string;
  activeLookup: ActiveLookup;
  setMode: (m: TranslationMode) => void;
  setApiKey: (k: string) => void;
  setActiveLookup: (l: ActiveLookup) => void;
  clearActiveLookup: () => void;
};

export const useAppStore = create<State>()(
  persist(
    (set) => ({
      mode: 'demo',
      apiKey: '',
      activeLookup: null,
      setMode: (mode) => set({ mode }),
      setApiKey: (apiKey) => set({ apiKey }),
      setActiveLookup: (activeLookup) => set({ activeLookup }),
      clearActiveLookup: () => set({ activeLookup: null }),
    }),
    {
      name: 'lector-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ mode: s.mode, apiKey: s.apiKey }),
    },
  ),
);

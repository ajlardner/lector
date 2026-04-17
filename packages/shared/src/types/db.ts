export type LookupRow = {
  id: string;
  timestamp: number;
  sourceText: string;
  sourceLang: string;
  translation: string;
  context: string;
  articleId: string | null;
  provider: 'wiktionary' | 'anthropic';
  promptId: string | null;
  tier: 'dictionary' | 'llm';
  rawResponse: string;
};

export type VocabItemRow = {
  id: string;
  lemma: string;
  language: string;
  firstSeenAt: number;
  lookupCount: number;
  lastSeenAt: number;
  userNotes: string;
  tags: string[];
  exportedToAnki: boolean;
};

export type ArticleRow = {
  id: string;
  url: string | null;
  title: string;
  rawText: string;
  language: string;
  addedAt: number;
};

export type PromptRow = {
  id: string;
  language: string;
  name: string;
  systemPrompt: string;
  builtIn: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
};

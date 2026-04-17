import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const lookups = sqliteTable(
  'lookups',
  {
    id: text('id').primaryKey(),
    timestamp: integer('timestamp').notNull(),
    sourceText: text('source_text').notNull(),
    sourceLang: text('source_lang').notNull(),
    translation: text('translation').notNull(),
    context: text('context').notNull().default(''),
    articleId: text('article_id'),
    provider: text('provider', { enum: ['wiktionary', 'anthropic'] }).notNull(),
    promptId: text('prompt_id'),
    tier: text('tier', { enum: ['dictionary', 'llm'] }).notNull(),
    rawResponse: text('raw_response').notNull().default(''),
  },
  (t) => ({
    tsIdx: index('lookups_timestamp_idx').on(t.timestamp),
  }),
);

export const vocabItems = sqliteTable(
  'vocab_items',
  {
    id: text('id').primaryKey(),
    lemma: text('lemma').notNull(),
    language: text('language').notNull(),
    firstSeenAt: integer('first_seen_at').notNull(),
    lookupCount: integer('lookup_count').notNull().default(0),
    lastSeenAt: integer('last_seen_at').notNull(),
    userNotes: text('user_notes').notNull().default(''),
    tags: text('tags').notNull().default('[]'),
    exportedToAnki: integer('exported_to_anki', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({
    lemmaLangUniq: uniqueIndex('vocab_lemma_lang_uniq').on(t.lemma, t.language),
    expoIdx: index('vocab_exported_idx').on(t.exportedToAnki),
  }),
);

export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  url: text('url'),
  title: text('title').notNull().default(''),
  rawText: text('raw_text').notNull(),
  language: text('language').notNull(),
  addedAt: integer('added_at').notNull(),
});

export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  language: text('language').notNull(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

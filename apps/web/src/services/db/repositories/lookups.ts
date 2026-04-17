import type { DbClient } from '../client.js';
import type { LookupRow } from '@lector/shared';

type InsertInput = Omit<LookupRow, 'id' | 'timestamp'>;

const rowFromDb = (r: Record<string, unknown>): LookupRow => ({
  id: r.id as string,
  timestamp: r.timestamp as number,
  sourceText: r.source_text as string,
  sourceLang: r.source_lang as string,
  translation: r.translation as string,
  context: r.context as string,
  articleId: (r.article_id as string | null) ?? null,
  provider: r.provider as 'wiktionary' | 'anthropic',
  promptId: (r.prompt_id as string | null) ?? null,
  tier: r.tier as 'dictionary' | 'llm',
  rawResponse: r.raw_response as string,
});

export const createLookupsRepo = (db: DbClient) => ({
  insert: async (input: InsertInput): Promise<LookupRow> => {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    await db.exec(
      `INSERT INTO lookups (id, timestamp, source_text, source_lang, translation, context, article_id, provider, prompt_id, tier, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        timestamp,
        input.sourceText,
        input.sourceLang,
        input.translation,
        input.context,
        input.articleId,
        input.provider,
        input.promptId,
        input.tier,
        input.rawResponse,
      ],
    );
    return { id, timestamp, ...input };
  },

  list: async (): Promise<LookupRow[]> => {
    const rows = await db.query('SELECT * FROM lookups ORDER BY timestamp DESC;');
    return rows.map(rowFromDb);
  },
});

export type LookupsRepo = ReturnType<typeof createLookupsRepo>;

import type { DbClient } from '../client.js';
import type { VocabItemRow } from '@lector/shared';

const rowFromDb = (r: Record<string, unknown>): VocabItemRow => ({
  id: r.id as string,
  lemma: r.lemma as string,
  language: r.language as string,
  firstSeenAt: r.first_seen_at as number,
  lookupCount: r.lookup_count as number,
  lastSeenAt: r.last_seen_at as number,
  userNotes: r.user_notes as string,
  tags: JSON.parse((r.tags as string) ?? '[]') as string[],
  exportedToAnki: Boolean(r.exported_to_anki),
});

export const createVocabItemsRepo = (db: DbClient) => ({
  upsert: async (input: { lemma: string; language: string }): Promise<VocabItemRow> => {
    const existing = await db.query(
      'SELECT * FROM vocab_items WHERE lemma = ? AND language = ? LIMIT 1;',
      [input.lemma, input.language],
    );
    const now = Date.now();
    if (existing.length > 0) {
      const row = existing[0]!;
      await db.exec(
        'UPDATE vocab_items SET lookup_count = lookup_count + 1, last_seen_at = ? WHERE id = ?;',
        [now, row.id],
      );
      return rowFromDb({
        ...row,
        lookup_count: (row.lookup_count as number) + 1,
        last_seen_at: now,
      });
    }
    const id = crypto.randomUUID();
    await db.exec(
      `INSERT INTO vocab_items (id, lemma, language, first_seen_at, lookup_count, last_seen_at, user_notes, tags, exported_to_anki)
       VALUES (?, ?, ?, ?, 1, ?, '', '[]', 0);`,
      [id, input.lemma, input.language, now, now],
    );
    return {
      id,
      lemma: input.lemma,
      language: input.language,
      firstSeenAt: now,
      lookupCount: 1,
      lastSeenAt: now,
      userNotes: '',
      tags: [],
      exportedToAnki: false,
    };
  },

  listAll: async (): Promise<VocabItemRow[]> => {
    const rows = await db.query('SELECT * FROM vocab_items ORDER BY last_seen_at DESC;');
    return rows.map(rowFromDb);
  },
});

export type VocabItemsRepo = ReturnType<typeof createVocabItemsRepo>;

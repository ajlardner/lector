import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, type DbClient } from '../client.js';
import { runMigrations } from '../migrations.js';
import { createVocabItemsRepo } from './vocab-items.js';

describe('vocabItemsRepo', () => {
  let db: DbClient;
  beforeEach(async () => {
    db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
  });

  it('upsert inserts on first call', async () => {
    const repo = createVocabItemsRepo(db);
    const row = await repo.upsert({ lemma: 'caminar', language: 'es' });
    expect(row.lemma).toBe('caminar');
    expect(row.lookupCount).toBe(1);
    expect(row.firstSeenAt).toBeGreaterThan(0);
    expect(row.lastSeenAt).toBe(row.firstSeenAt);
  });

  it('upsert increments on second call and updates lastSeenAt', async () => {
    const repo = createVocabItemsRepo(db);
    const first = await repo.upsert({ lemma: 'caminar', language: 'es' });
    await new Promise((r) => setTimeout(r, 5));
    const second = await repo.upsert({ lemma: 'caminar', language: 'es' });
    expect(second.id).toBe(first.id);
    expect(second.lookupCount).toBe(2);
    expect(second.lastSeenAt).toBeGreaterThanOrEqual(first.lastSeenAt);
  });

  it('treats (lemma, language) as unique', async () => {
    const repo = createVocabItemsRepo(db);
    const es = await repo.upsert({ lemma: 'casa', language: 'es' });
    const pt = await repo.upsert({ lemma: 'casa', language: 'pt' });
    expect(es.id).not.toBe(pt.id);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, type DbClient } from '../client.js';
import { runMigrations } from '../migrations.js';
import { createLookupsRepo } from './lookups.js';

describe('lookupsRepo', () => {
  let db: DbClient;
  beforeEach(async () => {
    db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
  });

  it('inserts and lists', async () => {
    const repo = createLookupsRepo(db);
    const row = await repo.insert({
      sourceText: 'caminaba',
      sourceLang: 'es',
      translation: 'he was walking',
      context: 'El hombre caminaba.',
      articleId: null,
      provider: 'anthropic',
      promptId: 'es-basic',
      tier: 'llm',
      rawResponse: '{"translation":"he was walking"}',
    });
    expect(row.id).toBeTruthy();
    expect(row.timestamp).toBeGreaterThan(0);

    const all = await repo.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.sourceText).toBe('caminaba');
  });
});

import { describe, it, expect } from 'vitest';
import { createDbClient } from './client.js';
import { runMigrations } from './migrations.js';

describe('runMigrations', () => {
  it('creates all expected tables', async () => {
    const db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain('lookups');
    expect(names).toContain('vocab_items');
    expect(names).toContain('articles');
    expect(names).toContain('prompts');
    expect(names).toContain('vocab_notes_fts');
    expect(names).toContain('lookup_context_fts');
  });

  it('is idempotent (second run is a no-op)', async () => {
    const db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
    await runMigrations(db);
    const rows = await db.query('SELECT 1 AS one FROM lookups LIMIT 1;');
    expect(rows).toEqual([]);
  });
});

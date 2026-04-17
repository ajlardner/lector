import init0000 from './migrations/0000_init.sql?raw';
import type { DbClient } from './client.js';

const migrations: { id: number; sql: string }[] = [
  { id: 0, sql: init0000 },
];

const ensureMigrationTable = async (db: DbClient) => {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);',
  );
};

const applied = async (db: DbClient): Promise<Set<number>> => {
  const rows = await db.query<{ id: number }>('SELECT id FROM _migrations;');
  return new Set(rows.map((r) => r.id));
};

export const runMigrations = async (db: DbClient): Promise<void> => {
  await ensureMigrationTable(db);
  const done = await applied(db);
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    for (const stmt of m.sql.split('--> statement-breakpoint')) {
      const s = stmt.trim();
      if (s) await db.exec(s);
    }
    await db.exec('INSERT INTO _migrations (id, applied_at) VALUES (?, ?);', [
      m.id,
      Date.now(),
    ]);
  }
};

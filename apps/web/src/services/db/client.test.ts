import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, type DbClient } from './client.js';

describe('DbClient', () => {
  let db: DbClient;

  beforeEach(async () => {
    db = await createDbClient({ mode: 'memory' });
  });

  it('executes a DDL statement', async () => {
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT);');
    await db.exec("INSERT INTO t (name) VALUES ('a');");
    const rows = await db.query<{ id: number; name: string }>('SELECT id, name FROM t;');
    expect(rows).toEqual([{ id: 1, name: 'a' }]);
  });
});

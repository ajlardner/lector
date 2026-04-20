import { toast } from 'sonner';
import { createDbClient, type DbClient } from './client.js';
import { runMigrations } from './migrations.js';
import { createLookupsRepo, type LookupsRepo } from './repositories/lookups.js';
import { createVocabItemsRepo, type VocabItemsRepo } from './repositories/vocab-items.js';

export type DbHandle = {
  client: DbClient;
  lookups: LookupsRepo;
  vocabItems: VocabItemsRepo;
};

let handle: DbHandle | null = null;
let booting: Promise<DbHandle> | null = null;

export const getDb = async (): Promise<DbHandle> => {
  if (handle) return handle;
  if (booting) return booting;
  booting = (async () => {
    const client = await createDbClient({ mode: 'opfs', filename: 'lector.sqlite3' });
    await runMigrations(client);
    if (!client.persistent) {
      toast.warning('Storage unavailable — vocabulary data will not persist across page reloads.');
    }
    handle = {
      client,
      lookups: createLookupsRepo(client),
      vocabItems: createVocabItemsRepo(client),
    };
    return handle;
  })();
  return booting;
};

export const resetDbForTests = (): void => {
  handle = null;
  booting = null;
};

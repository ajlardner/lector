export type DbClient = {
  exec: (sql: string, bind?: unknown[]) => Promise<void>;
  query: <T = Record<string, unknown>>(sql: string, bind?: unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
  persistent: boolean;
};

type ClientOpts = { mode: 'opfs'; filename: string } | { mode: 'memory' };

const createWorkerClient = (filename: string): Promise<DbClient> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const pending = new Map<string, { res: (rows: any[]) => void; rej: (e: Error) => void }>();

    worker.addEventListener('message', (ev: MessageEvent<any>) => {
      const data = ev.data;
      if (data.type === 'opened') {
        resolve({
          exec: (sql, bind) =>
            new Promise((r) => {
              worker.postMessage({ type: 'exec', sql, bind });
              queueMicrotask(() => r());
            }),
          query: (sql, bind) =>
            new Promise((res, rej) => {
              const id = crypto.randomUUID();
              pending.set(id, { res, rej });
              worker.postMessage({ type: 'query', sql, bind, id });
            }),
          close: async () => worker.terminate(),
          persistent: data.persistent ?? true,
        });
      }
      if (data.type === 'result') {
        pending.get(data.id)?.res(data.rows);
        pending.delete(data.id);
      }
      if (data.type === 'error') {
        if (data.id) {
          pending.get(data.id)?.rej(new Error(data.message));
          pending.delete(data.id);
        } else {
          reject(new Error(data.message));
        }
      }
    });

    worker.postMessage({ type: 'open', filename });
  });

const createMemoryClient = async (): Promise<DbClient> => {
  if (typeof window === 'undefined' || !('Worker' in globalThis)) {
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(':memory:');
    return {
      exec: async (sql, bind) => {
        if (bind && bind.length > 0) {
          db.prepare(sql).run(...(bind as never[]));
        } else {
          db.exec(sql);
        }
      },
      query: async <T>(sql: string, bind?: unknown[]) => {
        const stmt = db.prepare(sql);
        return (bind ? stmt.all(...(bind as never[])) : stmt.all()) as T[];
      },
      close: async () => {
        db.close();
      },
      persistent: false,
    };
  }

  const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;
  const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
  // sqlite-wasm types for BindingSpec/callbacks don't cleanly align with our DbClient shape;
  // cast to any to avoid fighting the declarations at this boundary.
  const db: any = new sqlite3.oo1.DB(':memory:', 'ct');

  return {
    exec: async (sql, bind) => {
      db.exec({ sql, bind: bind ?? [] });
    },
    query: async <T>(sql: string, bind?: unknown[]) => {
      const rows: T[] = [];
      db.exec({
        sql,
        bind: bind ?? [],
        rowMode: 'object',
        callback: (r: T) => rows.push(r),
      });
      return rows;
    },
    close: async () => db.close(),
    persistent: false,
  };
};

export const createDbClient = async (opts: ClientOpts): Promise<DbClient> => {
  if (opts.mode === 'memory') return createMemoryClient();
  return createWorkerClient(opts.filename);
};

/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

type OpenMsg = { type: 'open'; filename: string };
type ExecMsg = { type: 'exec'; sql: string; bind?: unknown[] };
type QueryMsg = { type: 'query'; sql: string; bind?: unknown[]; id: string };
type Msg = OpenMsg | ExecMsg | QueryMsg;

let db: any = null;

self.onmessage = async (ev: MessageEvent<Msg>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'open') {
      const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
      db = new sqlite3.oo1.OpfsDb(msg.filename);
      self.postMessage({ type: 'opened' });
      return;
    }
    if (!db) throw new Error('db not opened');
    if (msg.type === 'exec') {
      db.exec({ sql: msg.sql, bind: msg.bind ?? [] });
      return;
    }
    if (msg.type === 'query') {
      const rows: Record<string, unknown>[] = [];
      db.exec({
        sql: msg.sql,
        bind: msg.bind ?? [],
        rowMode: 'object',
        callback: (r: Record<string, unknown>) => {
          rows.push(r);
        },
      });
      self.postMessage({ type: 'result', id: msg.id, rows });
    }
  } catch (e) {
    self.postMessage({
      type: 'error',
      id: 'id' in msg ? msg.id : undefined,
      message: (e as Error).message,
    });
  }
};

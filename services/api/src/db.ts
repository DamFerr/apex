import { DatabaseSync } from "./sqlite";

export const openDatabase = (path: string) => new DatabaseSync(path);
/** Tiny key-value cache on SQLite (built into Node, nothing to compile). */
export interface Cache { get(key: string): { value: string; at: number } | undefined; set(key: string, value: string, at: number): void }
export function makeCache(db: DatabaseSync): Cache {
  db.exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, fetched_at INTEGER NOT NULL)");
  const get = db.prepare("SELECT value, fetched_at AS at FROM kv WHERE key = ?"), put = db.prepare("INSERT OR REPLACE INTO kv (key, value, fetched_at) VALUES (?, ?, ?)");
  return { get: (k) => get.get(k) as { value: string; at: number } | undefined, set: (k, v, at) => { put.run(k, v, at); } };
}

/**
 * A D1-shaped database on node:sqlite. Used by the tests and by the local dev server, so the real
 * Worker code runs without a Cloudflare account. (On Cloudflare the real D1 is used.)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { D1Like, D1Statement } from '../src/env';

class Statement implements D1Statement {
  constructor(
    private db: DatabaseSync,
    readonly sql: string,
    private params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1Statement {
    return new Statement(this.db, this.sql, values);
  }

  private prepared(): StatementSync {
    return this.db.prepare(this.sql);
  }

  async first<T>(): Promise<T | null> {
    return ((this.prepared().get(...(this.params as never[])) as T | undefined) ?? null) as T | null;
  }

  async run(): Promise<{ meta: { changes: number } }> {
    return this.runSync();
  }

  runSync(): { meta: { changes: number } } {
    const r = this.prepared().run(...(this.params as never[]));
    return { meta: { changes: Number(r.changes) } };
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.prepared().all(...(this.params as never[])) as T[] };
  }
}

export interface SqliteD1 extends D1Like {
  raw: DatabaseSync;
}

/** Opens a database (":memory:" by default) and applies every migration in worker/migrations. */
export function createD1(path = ':memory:', migrationsDir = join(__dirname, '..', 'migrations')): SqliteD1 {
  const db = new DatabaseSync(path);
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  return {
    raw: db,
    prepare: (sql) => new Statement(db, sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map((s) => (s as Statement).runSync());
        db.exec('COMMIT');
        return results;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

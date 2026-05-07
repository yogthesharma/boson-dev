import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "../lib/postgres.ts";

/**
 * Boot-time migration runner.
 *
 * Reads every `*.sql` file under `apps/server/migrations/` (lexicographic order)
 * and executes its contents against the configured Postgres connection. Each
 * file MUST be idempotent (`CREATE TABLE IF NOT EXISTS …`, etc.) — we don't
 * yet maintain a migrations tracker table. When the schema gets non-trivial
 * we'll graduate to something like `node-pg-migrate` or roll our own tracker.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "..", "migrations");

export async function runMigrations(): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) return;

  for (const file of files) {
    const stmt = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      await sql.unsafe(stmt);
      console.log(`[migrate] applied ${file}`);
    } catch (err) {
      console.error(`[migrate] failed ${file}:`, err);
      throw err;
    }
  }
}

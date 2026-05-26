/**
 * Runs all pending SQL migrations in order.
 * Usage: npm run migrate
 *
 * Migrations are plain .sql files in /migrations, run in filename order.
 * A `schema_migrations` table tracks which have already been applied.
 */
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from '../src/db/client.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../migrations');

const sql = getDb();

// Ensure the migrations tracking table exists
await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const applied = new Set(
  (await sql<Array<{ filename: string }>>`SELECT filename FROM schema_migrations`)
    .map((r) => r.filename),
);

const files = (await readdir(MIGRATIONS_DIR))
  .filter((f) => f.endsWith('.sql'))
  .sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`  skip  ${file}`);
    continue;
  }
  const sqlText = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
  await sql.begin(async (tx) => {
    await tx.unsafe(sqlText);
    await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`;
  });
  console.log(`  apply ${file}`);
  ran++;
}

console.log(`\nMigrations: ${ran} applied, ${files.length - ran} already up-to-date.`);
await closeDb();

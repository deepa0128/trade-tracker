/**
 * Exports seed portfolio definitions to JSON files under data/seed/.
 * These files are consumed by Jetro canvas refresh scripts (Python).
 *
 * Run: npm run export-portfolios
 */
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SEED_PORTFOLIOS } from '../src/seed/portfolios.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_DIR = join(ROOT, 'data', 'seed');

await mkdir(SEED_DIR, { recursive: true });

for (const portfolio of SEED_PORTFOLIOS) {
  const path = join(SEED_DIR, `${portfolio.id}.json`);
  await writeFile(path, JSON.stringify(portfolio, null, 2));
  console.log(`Wrote ${path}`);
}

console.log(`\nExported ${SEED_PORTFOLIOS.length} portfolios to data/seed/`);

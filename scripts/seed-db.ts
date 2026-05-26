/**
 * Seeds the DB with a demo user and the 3 dummy portfolios.
 * Usage: npm run seed-db
 *
 * Demo credentials: demo@trade-tracker.local / demo1234
 */
import bcrypt from 'bcryptjs';
import { getDb, closeDb } from '../src/db/client.js';
import { SEED_PORTFOLIOS } from '../src/seed/portfolios.js';
import type { UserRow, PortfolioRow } from '../src/db/types.js';

const DEMO_EMAIL = 'demo@trade-tracker.local';
const DEMO_PASSWORD = 'demo1234';

const sql = getDb();

// Upsert demo user
const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
const [user] = await sql<UserRow[]>`
  INSERT INTO users (email, password_hash)
  VALUES (${DEMO_EMAIL}, ${hash})
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  RETURNING *
`;
console.log(`User: ${user!.email} (id: ${user!.id})`);

for (const seed of SEED_PORTFOLIOS) {
  // Upsert portfolio
  const [portfolio] = await sql<PortfolioRow[]>`
    INSERT INTO portfolios (id, name, exchange, user_id)
    VALUES (${seed.id}, ${seed.name}, ${seed.exchange}, ${user!.id})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    RETURNING *
  `;
  console.log(`  Portfolio: ${portfolio!.name}`);

  for (const h of seed.holdings) {
    await sql`
      INSERT INTO holdings (portfolio_id, ticker, name, sector, exchange, shares, avg_cost)
      VALUES (${portfolio!.id}, ${h.ticker}, ${h.name}, ${h.sector}, ${h.exchange},
              ${h.shares}, ${h.avgCost})
      ON CONFLICT (portfolio_id, ticker) DO UPDATE
        SET shares = EXCLUDED.shares, avg_cost = EXCLUDED.avg_cost
    `;
    // Seed a BUY transaction to populate the ledger
    await sql`
      INSERT INTO transactions (portfolio_id, holding_id, ticker, type, shares, price)
      SELECT ${portfolio!.id}, id, ${h.ticker}, 'BUY', ${h.shares}, ${h.avgCost}
      FROM holdings WHERE portfolio_id = ${portfolio!.id} AND ticker = ${h.ticker}
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`    Seeded ${seed.holdings.length} holdings`);
}

console.log('\nSeed complete.');
await closeDb();

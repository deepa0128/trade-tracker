import type { Sql } from '../db/client.js';
import type { PortfolioRow, HoldingRow, TransactionRow } from '../db/types.js';
import type { Result } from '../result.js';
import { ok, err, tryAsync } from '../result.js';
import { ConflictError, DatabaseError, PortfolioNotFoundError, ValidationError } from '../errors.js';
import type { ExchangeId, Holding } from '../types.js';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreatePortfolioInput {
  name: string;
  exchange: ExchangeId;
  userId?: string;
  guestSessionId?: string;
}

export interface RecordTransactionInput {
  portfolioId: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  name: string;
  sector: string;
  exchange: ExchangeId;
  note?: string;
}

export interface TransactionOutput {
  id: string;
  portfolioId: string;
  holdingId: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  note: string | null;
  executedAt: Date;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toHolding(row: HoldingRow): Holding & { id: string } {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    sector: row.sector,
    exchange: row.exchange as ExchangeId,
    shares: parseFloat(row.shares),
    avgCost: parseFloat(row.avgCost),
  };
}

function toTransaction(row: TransactionRow): TransactionOutput {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    holdingId: row.holdingId,
    ticker: row.ticker,
    type: row.type,
    shares: parseFloat(row.shares),
    price: parseFloat(row.price),
    note: row.note,
    executedAt: row.executedAt,
  };
}

// ── Repository ────────────────────────────────────────────────────────────────

export class PortfolioRepository {
  constructor(private readonly sql: Sql) {}

  async listByOwner(userId?: string, guestSessionId?: string): Promise<Result<PortfolioRow[]>> {
    return tryAsync(async () => {
      if (userId) {
        return this.sql<PortfolioRow[]>`
          SELECT * FROM portfolios WHERE user_id = ${userId} ORDER BY created_at DESC
        `;
      }
      if (guestSessionId) {
        return this.sql<PortfolioRow[]>`
          SELECT * FROM portfolios WHERE guest_session_id = ${guestSessionId} ORDER BY created_at DESC
        `;
      }
      return [];
    }, (e) => new DatabaseError(String(e)));
  }

  async findById(id: string): Promise<Result<PortfolioRow>> {
    return tryAsync(async () => {
      const [row] = await this.sql<PortfolioRow[]>`
        SELECT * FROM portfolios WHERE id = ${id}
      `;
      if (!row) throw new PortfolioNotFoundError(id);
      return row;
    }, (e) => (e instanceof PortfolioNotFoundError ? e : new DatabaseError(String(e))));
  }

  async create(input: CreatePortfolioInput): Promise<Result<PortfolioRow>> {
    return tryAsync(async () => {
      const [row] = await this.sql<PortfolioRow[]>`
        INSERT INTO portfolios (name, exchange, user_id, guest_session_id)
        VALUES (${input.name}, ${input.exchange}, ${input.userId ?? null}, ${input.guestSessionId ?? null})
        RETURNING *
      `;
      return row!;
    }, (e) => new DatabaseError(String(e)));
  }

  async delete(id: string): Promise<Result<void>> {
    return tryAsync(async () => {
      await this.sql`DELETE FROM portfolios WHERE id = ${id}`;
    }, (e) => new DatabaseError(String(e)));
  }

  async listHoldings(portfolioId: string): Promise<Result<Array<Holding & { id: string }>>> {
    return tryAsync(async () => {
      const rows = await this.sql<HoldingRow[]>`
        SELECT * FROM holdings WHERE portfolio_id = ${portfolioId} ORDER BY ticker
      `;
      return rows.map(toHolding);
    }, (e) => new DatabaseError(String(e)));
  }

  /**
   * Records a BUY or SELL transaction atomically:
   *   1. BUY  → upsert holding, recompute avg_cost
   *   2. SELL → decrement shares; delete holding row if shares reach 0
   *   3. Insert transaction row
   *
   * All three operations run inside a single SQL transaction.
   */
  async recordTransaction(input: RecordTransactionInput): Promise<Result<TransactionOutput>> {
    return tryAsync(async () => {
      return this.sql.begin(async (sql) => {
        if (input.type === 'BUY') {
          // Upsert the holding, recomputing weighted avg cost.
          const [holding] = await sql<HoldingRow[]>`
            INSERT INTO holdings (portfolio_id, ticker, name, sector, exchange, shares, avg_cost)
            VALUES (
              ${input.portfolioId}, ${input.ticker}, ${input.name},
              ${input.sector}, ${input.exchange}, ${input.shares}, ${input.price}
            )
            ON CONFLICT (portfolio_id, ticker) DO UPDATE SET
              shares   = holdings.shares + EXCLUDED.shares,
              avg_cost = (holdings.shares * holdings.avg_cost + EXCLUDED.shares * EXCLUDED.avg_cost)
                         / (holdings.shares + EXCLUDED.shares),
              name     = EXCLUDED.name,
              sector   = EXCLUDED.sector
            RETURNING *
          `;

          const [tx] = await sql<TransactionRow[]>`
            INSERT INTO transactions (portfolio_id, holding_id, ticker, type, shares, price, note)
            VALUES (${input.portfolioId}, ${holding!.id}, ${input.ticker},
                    'BUY', ${input.shares}, ${input.price}, ${input.note ?? null})
            RETURNING *
          `;

          await sql`UPDATE portfolios SET updated_at = now() WHERE id = ${input.portfolioId}`;
          return toTransaction(tx!);

        } else {
          // SELL: validate sufficient shares first.
          const [existing] = await sql<HoldingRow[]>`
            SELECT * FROM holdings WHERE portfolio_id = ${input.portfolioId} AND ticker = ${input.ticker}
          `;
          if (!existing) throw new ValidationError(`No holding for ${input.ticker} in this portfolio`);
          const currentShares = parseFloat(existing.shares);
          if (input.shares > currentShares) {
            throw new ConflictError(
              `Cannot sell ${input.shares} shares — only ${currentShares} held`,
            );
          }

          const remainingShares = parseFloat((currentShares - input.shares).toFixed(4));

          if (remainingShares === 0) {
            await sql`DELETE FROM holdings WHERE id = ${existing.id}`;
          } else {
            await sql`
              UPDATE holdings SET shares = ${remainingShares} WHERE id = ${existing.id}
            `;
          }

          const [tx] = await sql<TransactionRow[]>`
            INSERT INTO transactions (portfolio_id, holding_id, ticker, type, shares, price, note)
            VALUES (${input.portfolioId}, ${existing.id}, ${input.ticker},
                    'SELL', ${input.shares}, ${input.price}, ${input.note ?? null})
            RETURNING *
          `;

          await sql`UPDATE portfolios SET updated_at = now() WHERE id = ${input.portfolioId}`;
          return toTransaction(tx!);
        }
      });
    }, (e) => (e instanceof ConflictError || e instanceof ValidationError ? e : new DatabaseError(String(e))));
  }

  async listTransactions(portfolioId: string): Promise<Result<TransactionOutput[]>> {
    return tryAsync(async () => {
      const rows = await this.sql<TransactionRow[]>`
        SELECT * FROM transactions
        WHERE portfolio_id = ${portfolioId}
        ORDER BY executed_at DESC
        LIMIT 200
      `;
      return rows.map(toTransaction);
    }, (e) => new DatabaseError(String(e)));
  }

  /** Migrate all guest portfolios to a registered user account. */
  async migrateGuestPortfolios(guestSessionId: string, userId: string): Promise<Result<number>> {
    return tryAsync(async () => {
      const result = await this.sql`
        UPDATE portfolios
        SET user_id = ${userId}, guest_session_id = NULL
        WHERE guest_session_id = ${guestSessionId}
      `;
      return result.count;
    }, (e) => new DatabaseError(String(e)));
  }

  /** Returns the most recently updated portfolio timestamp for a given owner. */
  async latestUpdateTime(userId?: string, guestSessionId?: string): Promise<Result<Date | null>> {
    return tryAsync(async () => {
      if (userId) {
        const rows = await this.sql<Array<{ updatedAt: Date }>>`
          SELECT MAX(updated_at) AS updated_at FROM portfolios WHERE user_id = ${userId}
        `;
        return rows[0]?.updatedAt ?? null;
      }
      if (guestSessionId) {
        const rows = await this.sql<Array<{ updatedAt: Date }>>`
          SELECT MAX(updated_at) AS updated_at FROM portfolios WHERE guest_session_id = ${guestSessionId}
        `;
        return rows[0]?.updatedAt ?? null;
      }
      return null;
    }, (e) => new DatabaseError(String(e)));
  }
}

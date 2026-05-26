import { randomUUID } from 'crypto';
import type { PortfolioRow, HoldingRow, TransactionRow } from './types.js';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { ConflictError, PortfolioNotFoundError, ValidationError } from '../errors.js';
import type { ExchangeId, Holding } from '../types.js';
import { SEED_PORTFOLIOS } from '../seed/portfolios.js';
import type { CreatePortfolioInput, RecordTransactionInput, TransactionOutput } from '../portfolio/repository.js';
import type { IPortfolioRepository } from '../portfolio/irepository.js';

export const DEMO_GUEST_ID = 'demo-guest-00000000-0000-0000-0000-000000000000';

export class InMemoryPortfolioRepository implements IPortfolioRepository {
  private portfolios   = new Map<string, PortfolioRow>();
  private holdings     = new Map<string, HoldingRow>();
  private transactions = new Map<string, TransactionRow>();

  constructor() {
    this.seed();
  }

  private seed() {
    for (const p of SEED_PORTFOLIOS) {
      const now = new Date(p.createdAt);
      this.portfolios.set(p.id, {
        id: p.id,
        name: p.name,
        exchange: p.exchange,
        userId: null,
        guestSessionId: DEMO_GUEST_ID,
        createdAt: now,
        updatedAt: now,
      });
      for (const h of p.holdings) {
        const hId = randomUUID();
        this.holdings.set(hId, {
          id: hId,
          portfolioId: p.id,
          ticker: h.ticker,
          name: h.name,
          sector: h.sector,
          exchange: h.exchange,
          shares: String(h.shares),
          avgCost: String(h.avgCost),
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  async listByOwner(userId?: string, guestSessionId?: string): Promise<Result<PortfolioRow[]>> {
    const rows = [...this.portfolios.values()]
      .filter(p =>
        (userId && p.userId === userId) ||
        (guestSessionId && p.guestSessionId === guestSessionId),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return ok(rows);
  }

  async findById(id: string): Promise<Result<PortfolioRow>> {
    const row = this.portfolios.get(id);
    if (!row) return err(new PortfolioNotFoundError(id));
    return ok(row);
  }

  async create(input: CreatePortfolioInput): Promise<Result<PortfolioRow>> {
    const now = new Date();
    const row: PortfolioRow = {
      id: randomUUID(),
      name: input.name,
      exchange: input.exchange,
      userId: input.userId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.portfolios.set(row.id, row);
    return ok(row);
  }

  async delete(id: string): Promise<Result<void>> {
    this.portfolios.delete(id);
    for (const [hId, h] of this.holdings) {
      if (h.portfolioId === id) {
        this.holdings.delete(hId);
        for (const [txId, tx] of this.transactions) {
          if (tx.portfolioId === id) this.transactions.delete(txId);
        }
      }
    }
    return ok(undefined);
  }

  async listHoldings(portfolioId: string): Promise<Result<Array<Holding & { id: string }>>> {
    const rows = [...this.holdings.values()]
      .filter(h => h.portfolioId === portfolioId)
      .sort((a, b) => a.ticker.localeCompare(b.ticker))
      .map(h => ({
        id: h.id,
        ticker: h.ticker,
        name: h.name,
        sector: h.sector,
        exchange: h.exchange as ExchangeId,
        shares: parseFloat(h.shares),
        avgCost: parseFloat(h.avgCost),
      }));
    return ok(rows);
  }

  async recordTransaction(input: RecordTransactionInput): Promise<Result<TransactionOutput>> {
    const now = new Date();

    if (input.type === 'BUY') {
      let holding = [...this.holdings.values()].find(
        h => h.portfolioId === input.portfolioId && h.ticker === input.ticker,
      );

      if (holding) {
        const prevShares = parseFloat(holding.shares);
        const prevAvg    = parseFloat(holding.avgCost);
        const newAvg = (prevShares * prevAvg + input.shares * input.price) / (prevShares + input.shares);
        holding = {
          ...holding,
          shares:  String(prevShares + input.shares),
          avgCost: String(newAvg),
          name:    input.name,
          sector:  input.sector,
          updatedAt: now,
        };
        this.holdings.set(holding.id, holding);
      } else {
        const hId = randomUUID();
        holding = {
          id: hId, portfolioId: input.portfolioId,
          ticker: input.ticker, name: input.name, sector: input.sector, exchange: input.exchange,
          shares: String(input.shares), avgCost: String(input.price),
          createdAt: now, updatedAt: now,
        };
        this.holdings.set(hId, holding);
      }

      const txId = randomUUID();
      const tx: TransactionRow = {
        id: txId, portfolioId: input.portfolioId, holdingId: holding.id,
        ticker: input.ticker, type: 'BUY',
        shares: String(input.shares), price: String(input.price),
        note: input.note ?? null, executedAt: now,
      };
      this.transactions.set(txId, tx);
      this.touchPortfolio(input.portfolioId, now);

      return ok({ id: txId, portfolioId: input.portfolioId, holdingId: holding.id,
        ticker: input.ticker, type: 'BUY',
        shares: input.shares, price: input.price,
        note: input.note ?? null, executedAt: now });

    } else {
      const holding = [...this.holdings.values()].find(
        h => h.portfolioId === input.portfolioId && h.ticker === input.ticker,
      );
      if (!holding) return err(new ValidationError(`No holding for ${input.ticker} in this portfolio`));

      const currentShares = parseFloat(holding.shares);
      if (input.shares > currentShares) {
        return err(new ConflictError(`Cannot sell ${input.shares} shares — only ${currentShares} held`));
      }

      const remaining = parseFloat((currentShares - input.shares).toFixed(4));
      if (remaining === 0) {
        this.holdings.delete(holding.id);
      } else {
        this.holdings.set(holding.id, { ...holding, shares: String(remaining), updatedAt: now });
      }

      const txId = randomUUID();
      const tx: TransactionRow = {
        id: txId, portfolioId: input.portfolioId, holdingId: holding.id,
        ticker: input.ticker, type: 'SELL',
        shares: String(input.shares), price: String(input.price),
        note: input.note ?? null, executedAt: now,
      };
      this.transactions.set(txId, tx);
      this.touchPortfolio(input.portfolioId, now);

      return ok({ id: txId, portfolioId: input.portfolioId, holdingId: holding.id,
        ticker: input.ticker, type: 'SELL',
        shares: input.shares, price: input.price,
        note: input.note ?? null, executedAt: now });
    }
  }

  async listTransactions(portfolioId: string): Promise<Result<TransactionOutput[]>> {
    const rows = [...this.transactions.values()]
      .filter(tx => tx.portfolioId === portfolioId)
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
      .slice(0, 200)
      .map(tx => ({
        id: tx.id, portfolioId: tx.portfolioId, holdingId: tx.holdingId,
        ticker: tx.ticker, type: tx.type,
        shares: parseFloat(tx.shares), price: parseFloat(tx.price),
        note: tx.note, executedAt: tx.executedAt,
      }));
    return ok(rows);
  }

  async migrateGuestPortfolios(_guestId: string, _userId: string): Promise<Result<number>> {
    return ok(0);
  }

  async latestUpdateTime(userId?: string, guestSessionId?: string): Promise<Result<Date | null>> {
    const matching = [...this.portfolios.values()].filter(p =>
      (userId && p.userId === userId) ||
      (guestSessionId && p.guestSessionId === guestSessionId),
    );
    if (matching.length === 0) return ok(null);
    const latest = matching.reduce(
      (max, p) => (p.updatedAt > max ? p.updatedAt : max),
      matching[0]!.updatedAt,
    );
    return ok(latest);
  }

  private touchPortfolio(id: string, now: Date) {
    const p = this.portfolios.get(id);
    if (p) this.portfolios.set(id, { ...p, updatedAt: now });
  }
}

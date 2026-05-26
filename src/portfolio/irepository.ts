import type { PortfolioRow } from '../db/types.js';
import type { Result } from '../result.js';
import type { Holding } from '../types.js';
import type { CreatePortfolioInput, RecordTransactionInput, TransactionOutput } from './repository.js';

export interface IPortfolioRepository {
  listByOwner(userId?: string, guestSessionId?: string): Promise<Result<PortfolioRow[]>>;
  findById(id: string): Promise<Result<PortfolioRow>>;
  create(input: CreatePortfolioInput): Promise<Result<PortfolioRow>>;
  delete(id: string): Promise<Result<void>>;
  listHoldings(portfolioId: string): Promise<Result<Array<Holding & { id: string }>>>;
  recordTransaction(input: RecordTransactionInput): Promise<Result<TransactionOutput>>;
  listTransactions(portfolioId: string): Promise<Result<TransactionOutput[]>>;
  migrateGuestPortfolios(guestSessionId: string, userId: string): Promise<Result<number>>;
  latestUpdateTime(userId?: string, guestSessionId?: string): Promise<Result<Date | null>>;
}

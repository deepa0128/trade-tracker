/** Raw DB row types — these are what postgres returns before any domain mapping. */

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuestSessionRow {
  id: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PortfolioRow {
  id: string;
  name: string;
  exchange: string;
  userId: string | null;
  guestSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HoldingRow {
  id: string;
  portfolioId: string;
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  shares: string;    // NUMERIC comes back as string from postgres driver
  avgCost: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionRow {
  id: string;
  portfolioId: string;
  holdingId: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: string;
  price: string;
  note: string | null;
  executedAt: Date;
}

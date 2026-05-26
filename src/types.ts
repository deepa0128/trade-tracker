// ── Exchange ──────────────────────────────────────────────────────────────────

export type ExchangeId = 'NSE' | 'BSE' | 'NSE_BSE';

export interface MarketHours {
  timezone: string;
  open: string;      // "09:15"
  close: string;     // "15:30"
  weekdays: number[]; // 1=Mon … 5=Fri
}

// ── Market Data ───────────────────────────────────────────────────────────────

export interface Quote {
  ticker: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap?: number;
  fetchedAt: string; // ISO-8601
}

export interface OHLCV {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface Holding {
  ticker: string;
  name: string;
  sector: string;
  shares: number;
  avgCost: number;    // per share, INR
  exchange: ExchangeId;
}

export interface HoldingSnapshot extends Holding {
  ltp: number;
  currentValue: number;
  invested: number;
  pnl: number;
  pnlPct: number;
  weight: number;     // % of portfolio total value
  dayChange: number;
  dayChangePct: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLPct: number;
  dayChange: number;
  dayChangePct: number;
  holdingCount: number;
}

export interface Portfolio {
  id: string;
  name: string;
  exchange: ExchangeId;
  holdings: Holding[];
  createdAt: string; // ISO-8601
  updatedAt: string;
}

export interface PortfolioSnapshot extends Omit<Portfolio, 'holdings'> {
  holdings: HoldingSnapshot[];
  summary: PortfolioSummary;
}

// ── Prediction ────────────────────────────────────────────────────────────────

export interface PredictionResult {
  ticker: string;
  modelName: string;
  horizon: number;    // days forward
  dates: string[];    // YYYY-MM-DD, length = horizon
  mean: number[];
  upper: number[];    // upper confidence band
  lower: number[];    // lower confidence band
  confidence: number; // 0–1
  generatedAt: string;
}

// ── Signals ───────────────────────────────────────────────────────────────────

export type TradeSignal = 'BUY' | 'HOLD' | 'WATCH' | 'SELL';

export interface SignalResult {
  ticker: string;
  signal: TradeSignal;
  reason: string;
  strength: number; // 0–1
}

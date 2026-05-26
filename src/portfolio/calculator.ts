import type {
  Holding,
  HoldingSnapshot,
  PortfolioSummary,
  Quote,
  TradeSignal,
  SignalResult,
} from '../types.js';

/**
 * Pure calculation functions — no I/O, no side effects.
 * All inputs are plain data; outputs are plain data.
 */

export function computeHoldingSnapshot(
  holding: Holding,
  quote: Quote,
  portfolioTotalValue: number,
): HoldingSnapshot {
  const invested = holding.shares * holding.avgCost;
  const currentValue = holding.shares * quote.price;
  const pnl = currentValue - invested;

  return {
    ...holding,
    ltp: quote.price,
    currentValue,
    invested,
    pnl,
    pnlPct: invested > 0 ? (pnl / invested) * 100 : 0,
    weight: portfolioTotalValue > 0 ? (currentValue / portfolioTotalValue) * 100 : 0,
    dayChange: holding.shares * quote.change,
    dayChangePct: quote.changePct,
  };
}

export function computePortfolioTotalValue(holdings: Holding[], quotes: Map<string, Quote>): number {
  return holdings.reduce((sum, h) => {
    const quote = quotes.get(h.ticker);
    return sum + (quote ? h.shares * quote.price : h.shares * h.avgCost);
  }, 0);
}

export function computePortfolioSummary(snapshots: HoldingSnapshot[]): PortfolioSummary {
  const totalValue = snapshots.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested = snapshots.reduce((s, h) => s + h.invested, 0);
  const totalPnL = totalValue - totalInvested;
  const dayChange = snapshots.reduce((s, h) => s + h.dayChange, 0);

  return {
    totalValue,
    totalInvested,
    totalPnL,
    totalPnLPct: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
    dayChange,
    dayChangePct: totalValue > 0 ? (dayChange / totalValue) * 100 : 0,
    holdingCount: snapshots.length,
  };
}

/**
 * Derive a simple trade signal from a holding's P&L and momentum.
 *
 * This is intentionally basic — a real implementation would pull in
 * RSI, moving averages, or a prediction model. The function signature
 * is kept stable so callers don't need to change when the logic improves.
 */
export function computeSignal(snapshot: HoldingSnapshot, daysPnLPct?: number): SignalResult {
  const signal = deriveSignal(snapshot.pnlPct, snapshot.dayChangePct, daysPnLPct);
  return {
    ticker: snapshot.ticker,
    signal,
    reason: signalReason(signal, snapshot),
    strength: signalStrength(snapshot.pnlPct),
  };
}

// ── Internals ─────────────────────────────────────────────────────────────────

function deriveSignal(
  pnlPct: number,
  dayChangePct: number,
  daysPnLPct?: number,
): TradeSignal {
  if (pnlPct > 15 && dayChangePct > 0.5) return 'BUY';
  if (pnlPct > 8 && dayChangePct > 0) return 'BUY';
  if (pnlPct < -10) return 'SELL';
  if (pnlPct < -5 || (daysPnLPct !== undefined && daysPnLPct < -3)) return 'WATCH';
  return 'HOLD';
}

function signalReason(signal: TradeSignal, s: HoldingSnapshot): string {
  switch (signal) {
    case 'BUY':
      return `Strong returns (${s.pnlPct.toFixed(1)}%) with positive momentum`;
    case 'SELL':
      return `Portfolio down ${Math.abs(s.pnlPct).toFixed(1)}% — consider exiting`;
    case 'WATCH':
      return `Underperforming — monitor closely`;
    case 'HOLD':
      return `Stable — maintain position`;
  }
}

function signalStrength(pnlPct: number): number {
  return Math.min(1, Math.abs(pnlPct) / 20);
}

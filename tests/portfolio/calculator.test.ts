import { describe, it, expect } from 'vitest';
import type { Holding, Quote } from '../../src/types.js';
import {
  computeHoldingSnapshot,
  computePortfolioSummary,
  computePortfolioTotalValue,
  computeSignal,
} from '../../src/portfolio/calculator.js';

const makeQuote = (ticker: string, price: number, changePct = 0.5): Quote => ({
  ticker,
  price,
  open: price * 0.998,
  high: price * 1.01,
  low: price * 0.99,
  previousClose: price / (1 + changePct / 100),
  change: price - price / (1 + changePct / 100),
  changePct,
  volume: 100000,
  fetchedAt: new Date().toISOString(),
});

const makeHolding = (ticker: string, shares: number, avgCost: number): Holding => ({
  ticker,
  name: ticker,
  sector: 'IT',
  shares,
  avgCost,
  exchange: 'NSE',
});

describe('computeHoldingSnapshot', () => {
  it('computes current value and P&L correctly', () => {
    const holding = makeHolding('TCS.NS', 10, 3000);
    const quote = makeQuote('TCS.NS', 3300);
    const snapshot = computeHoldingSnapshot(holding, quote, 33000);

    expect(snapshot.currentValue).toBe(33000);
    expect(snapshot.invested).toBe(30000);
    expect(snapshot.pnl).toBe(3000);
    expect(snapshot.pnlPct).toBeCloseTo(10, 1);
  });

  it('computes weight as a percentage of portfolio total', () => {
    const holding = makeHolding('INFY.NS', 10, 1500);
    const quote = makeQuote('INFY.NS', 2000);
    const snapshot = computeHoldingSnapshot(holding, quote, 40000);

    expect(snapshot.weight).toBeCloseTo(50, 1); // 20000/40000 = 50%
  });

  it('returns zero P&L when price equals avgCost', () => {
    const holding = makeHolding('WIPRO.NS', 20, 500);
    const quote = makeQuote('WIPRO.NS', 500);
    const snapshot = computeHoldingSnapshot(holding, quote, 10000);

    expect(snapshot.pnl).toBe(0);
    expect(snapshot.pnlPct).toBe(0);
  });

  it('handles negative P&L (unrealised loss)', () => {
    const holding = makeHolding('XYZ.NS', 10, 1000);
    const quote = makeQuote('XYZ.NS', 800);
    const snapshot = computeHoldingSnapshot(holding, quote, 8000);

    expect(snapshot.pnl).toBe(-2000);
    expect(snapshot.pnlPct).toBeCloseTo(-20, 1);
  });
});

describe('computePortfolioTotalValue', () => {
  it('sums shares × ltp across all holdings', () => {
    const holdings = [makeHolding('A.NS', 10, 100), makeHolding('B.NS', 5, 200)];
    const quotes = new Map([
      ['A.NS', makeQuote('A.NS', 150)],
      ['B.NS', makeQuote('B.NS', 300)],
    ]);
    expect(computePortfolioTotalValue(holdings, quotes)).toBe(3000);
  });

  it('falls back to avgCost when quote is missing', () => {
    const holdings = [makeHolding('MISSING.NS', 10, 500)];
    const quotes = new Map<string, Quote>();
    expect(computePortfolioTotalValue(holdings, quotes)).toBe(5000);
  });
});

describe('computePortfolioSummary', () => {
  it('aggregates across all holdings correctly', () => {
    const h1 = computeHoldingSnapshot(makeHolding('A.NS', 10, 100), makeQuote('A.NS', 120), 2400);
    const h2 = computeHoldingSnapshot(makeHolding('B.NS', 10, 200), makeQuote('B.NS', 180), 2400);
    const summary = computePortfolioSummary([h1, h2]);

    expect(summary.totalValue).toBeCloseTo(3000, 0);
    expect(summary.totalInvested).toBe(3000);
    expect(summary.holdingCount).toBe(2);
    // h1 gained 200, h2 lost 200 → net pnl ≈ 0
    expect(summary.totalPnL).toBeCloseTo(0, 0);
  });

  it('computes totalPnLPct as fraction of invested', () => {
    const h = computeHoldingSnapshot(makeHolding('X.NS', 10, 1000), makeQuote('X.NS', 1100), 11000);
    const summary = computePortfolioSummary([h]);
    expect(summary.totalPnLPct).toBeCloseTo(10, 1);
  });
});

describe('computeSignal', () => {
  it('returns BUY when P&L is strong and momentum positive', () => {
    const h = computeHoldingSnapshot(makeHolding('A.NS', 1, 100), makeQuote('A.NS', 120, 1.2), 120);
    expect(computeSignal(h).signal).toBe('BUY');
  });

  it('returns SELL when holding is significantly down', () => {
    const h = computeHoldingSnapshot(makeHolding('A.NS', 1, 1000), makeQuote('A.NS', 850, -1), 850);
    expect(computeSignal(h).signal).toBe('SELL');
  });

  it('returns HOLD for a stable, mildly positive holding', () => {
    const h = computeHoldingSnapshot(makeHolding('A.NS', 1, 100), makeQuote('A.NS', 104, 0.1), 104);
    expect(computeSignal(h).signal).toBe('HOLD');
  });
});

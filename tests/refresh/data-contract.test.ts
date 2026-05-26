/**
 * Refresh pipeline data-contract tests.
 *
 * The Python refresh scripts output JSON that is consumed directly by canvas
 * frame HTML. This test suite validates that the API endpoints produce the
 * exact shape the frames expect — acting as a contract test between the
 * backend and the canvas layer.
 *
 * If a frame breaks after an API change, one of these tests will fail first.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/api/server.js';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  process.env['MEMORY_MODE'] = 'true';
  process.env['JWT_SECRET'] = 'refresh-contract-test-secret!!';
  process.env['MARKET_DATA_PROVIDER'] = 'mock';
  process.env['GUEST_SESSION_ID'] = 'refresh-test-guest';
  app = await createServer();
  await app.ready();

  const res = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
  token = res.json<{ token: string }>().token;
});

afterAll(() => app.close());

// ── Shape validators ─────────────────────────────────────────────────────────

function assertQuoteShape(quote: Record<string, unknown>, ticker: string) {
  expect(quote.ticker).toBe(ticker);
  expect(typeof quote.price).toBe('number');
  expect(typeof quote.open).toBe('number');
  expect(typeof quote.high).toBe('number');
  expect(typeof quote.low).toBe('number');
  expect(typeof quote.previousClose).toBe('number');
  expect(typeof quote.change).toBe('number');
  expect(typeof quote.changePct).toBe('number');
  expect(typeof quote.volume).toBe('number');
  expect(typeof quote.fetchedAt).toBe('string');
}

function assertHoldingShape(h: Record<string, unknown>) {
  expect(typeof h.ticker).toBe('string');
  expect(typeof h.name).toBe('string');
  expect(typeof h.sector).toBe('string');
  expect(typeof h.shares).toBe('number');
  expect(typeof h.avgCost).toBe('number');
  expect(typeof h.ltp).toBe('number');
  expect(typeof h.currentValue).toBe('number');
  expect(typeof h.pnl).toBe('number');
  expect(typeof h.pnlPct).toBe('number');
  expect(typeof h.weight).toBe('number');
  expect(h.weight).toBeGreaterThanOrEqual(0);
  expect(h.weight).toBeLessThanOrEqual(100);
}

function assertSummaryShape(s: Record<string, unknown>) {
  expect(typeof s.totalValue).toBe('number');
  expect(typeof s.totalInvested).toBe('number');
  expect(typeof s.totalPnL).toBe('number');
  expect(typeof s.totalPnLPct).toBe('number');
  expect(typeof s.dayChange).toBe('number');
  expect(typeof s.dayChangePct).toBe('number');
  expect(typeof s.holdingCount).toBe('number');
  expect(s.holdingCount).toBeGreaterThan(0);
}

// ── portfolio.py contract ─────────────────────────────────────────────────────
// Script output: { ok: true, snapshots: [{ id, name, exchange, holdings, summary }] }

describe('portfolio.py contract: /api/portfolios + /api/portfolios/:id/snapshot', () => {
  it('portfolios list has required fields', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/portfolios',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const portfolios = res.json<{ id: string; name: string; exchange: string }[]>();
    expect(portfolios.length).toBeGreaterThan(0);
    for (const p of portfolios) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(typeof p.exchange).toBe('string');
    }
  });

  it('snapshot matches shape consumed by portfolio-overview.html and portfolio-holdings.html', async () => {
    const list = await app.inject({
      method: 'GET', url: '/api/portfolios',
      headers: { authorization: `Bearer ${token}` },
    });
    const [first] = list.json<{ id: string }[]>();

    const res = await app.inject({
      method: 'GET', url: `/api/portfolios/${first!.id}/snapshot`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);

    const snap = res.json<{
      id: string; name: string; exchange: string;
      holdings: Record<string, unknown>[];
      summary: Record<string, unknown>;
    }>();

    expect(typeof snap.id).toBe('string');
    expect(typeof snap.name).toBe('string');
    expect(typeof snap.exchange).toBe('string');
    expect(Array.isArray(snap.holdings)).toBe(true);
    expect(snap.holdings.length).toBeGreaterThan(0);

    assertSummaryShape(snap.summary);
    for (const h of snap.holdings) assertHoldingShape(h);
  });

  it('weights across all holdings sum to ~100%', async () => {
    const list = await app.inject({
      method: 'GET', url: '/api/portfolios',
      headers: { authorization: `Bearer ${token}` },
    });
    for (const p of list.json<{ id: string }[]>()) {
      const snap = await app.inject({
        method: 'GET', url: `/api/portfolios/${p.id}/snapshot`,
        headers: { authorization: `Bearer ${token}` },
      });
      const { holdings } = snap.json<{ holdings: { weight: number }[] }>();
      const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
      expect(totalWeight).toBeCloseTo(100, 0);
    }
  });
});

// ── stocks.py contract ────────────────────────────────────────────────────────
// Script output: { ok: true, snapshots, stocks: { [ticker]: { quote, history, prediction, portfolioPresence } } }

describe('stocks.py contract: /api/market/stock/:ticker', () => {
  it('stock detail has quote, history, and prediction fields', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/market/stock/TCS.NS?days=60&horizon=14',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json<{
      ticker: string;
      quote: Record<string, unknown>;
      history: { date: string; close: number }[];
      prediction: { dates: string[]; mean: number[]; upper: number[]; lower: number[] } | null;
      portfolioPresence: unknown;
    }>();

    assertQuoteShape(body.quote, 'TCS.NS');

    expect(Array.isArray(body.history)).toBe(true);
    expect(body.history.length).toBeGreaterThan(0);
    for (const candle of body.history) {
      expect(typeof candle.date).toBe('string');
      expect(typeof candle.close).toBe('number');
    }

    expect(body.prediction).not.toBeNull();
    expect(body.prediction!.dates).toHaveLength(14);
    expect(body.prediction!.mean).toHaveLength(14);
    expect(body.prediction!.upper).toHaveLength(14);
    expect(body.prediction!.lower).toHaveLength(14);

    // Confidence band invariant: upper >= mean >= lower at every point
    for (let i = 0; i < 14; i++) {
      expect(body.prediction!.upper[i]).toBeGreaterThanOrEqual(body.prediction!.mean[i]!);
      expect(body.prediction!.mean[i]).toBeGreaterThanOrEqual(body.prediction!.lower[i]!);
    }
  });

  it('portfolioPresence is returned for authenticated users holding the stock', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/market/stock/TCS.NS?days=60&horizon=14',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = res.json<{
      portfolioPresence: Array<{
        portfolioId: string; portfolioName: string;
        shares: number; avgCost: number;
        currentValue: number; pnl: number; pnlPct: number;
      }> | undefined;
    }>();

    // TCS.NS is in the "Tech & Growth" seed portfolio
    expect(body.portfolioPresence).toBeDefined();
    expect(body.portfolioPresence!.length).toBeGreaterThan(0);
    const presence = body.portfolioPresence![0]!;
    expect(typeof presence.portfolioName).toBe('string');
    expect(typeof presence.shares).toBe('number');
    expect(typeof presence.avgCost).toBe('number');
    expect(typeof presence.pnl).toBe('number');
  });

  it('rejects days < horizon + 10', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/market/stock/TCS.NS?days=10&horizon=30',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── health.py contract ────────────────────────────────────────────────────────
// Script output: { ok: true, health: { status, uptime, components, checkedAt }, cache: { entries } }

describe('health.py contract: /api/health + /api/health/cache', () => {
  it('health response matches shape consumed by health-monitor.html', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);

    const h = res.json<{
      status: string; uptime: number; checkedAt: string;
      components: {
        database: { status: string; message?: string; latencyMs?: number };
        provider:  { status: string; message?: string; latencyMs?: number };
        cache:     { status: string; message?: string };
      };
    }>();

    expect(['healthy', 'degraded', 'down']).toContain(h.status);
    expect(typeof h.uptime).toBe('number');
    expect(typeof h.checkedAt).toBe('string');
    expect(['healthy', 'degraded', 'down']).toContain(h.components.database.status);
    expect(['healthy', 'degraded', 'down']).toContain(h.components.provider.status);
    expect(['healthy', 'degraded', 'down']).toContain(h.components.cache.status);
  });

  it('cache response matches shape consumed by health-monitor.html', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/cache' });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ entries: Array<{ ticker: string; ageSeconds: number; stale: boolean }> }>();
    expect(Array.isArray(body.entries)).toBe(true);
    for (const e of body.entries) {
      expect(typeof e.ticker).toBe('string');
      expect(typeof e.ageSeconds).toBe('number');
      expect(typeof e.stale).toBe('boolean');
    }
  });
});

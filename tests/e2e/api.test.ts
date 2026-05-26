/**
 * End-to-end API tests using Fastify's inject() — no running server required.
 *
 * MEMORY_MODE=true + MockProvider keeps these tests deterministic and offline-safe.
 * The full request lifecycle (auth middleware, route handler, error handler) is exercised.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/api/server.js';

let app: FastifyInstance;
let guestToken: string;

beforeAll(async () => {
  process.env['MEMORY_MODE'] = 'true';
  process.env['JWT_SECRET'] = 'e2e-test-secret-32-chars-minimum!!';
  process.env['MARKET_DATA_PROVIDER'] = 'mock';
  process.env['GUEST_SESSION_ID'] = 'e2e-guest-id';
  app = await createServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ── Dashboard ──────────────────────────────────────────────────────────────────

describe('GET /', () => {
  it('serves the web dashboard HTML', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.payload).toContain('Portfolio Tracker');
  });
});

// ── Auth ───────────────────────────────────────────────────────────────────────

describe('POST /api/auth/guest', () => {
  it('issues a guest JWT', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ token: string }>();
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    guestToken = body.token;
  });

  it('issuing a second guest token returns the same session identity', async () => {
    const res1 = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
    const res2 = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: {} });
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);
    // Both tokens should decode to the same GUEST_SESSION_ID sub
    const t1 = res1.json<{ token: string }>().token.split('.')[1];
    const t2 = res2.json<{ token: string }>().token.split('.')[1];
    const sub1 = JSON.parse(Buffer.from(t1, 'base64url').toString()).sub;
    const sub2 = JSON.parse(Buffer.from(t2, 'base64url').toString()).sub;
    expect(sub1).toBe(sub2);
  });
});

// ── Portfolios ─────────────────────────────────────────────────────────────────

describe('GET /api/portfolios', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/portfolios' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/portfolios',
      headers: { authorization: 'Bearer not.a.token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns the 3 pre-seeded demo portfolios for a guest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/portfolios',
      headers: { authorization: `Bearer ${guestToken}` },
    });
    expect(res.statusCode).toBe(200);
    const portfolios = res.json<{ name: string; exchange: string }[]>();
    expect(portfolios).toHaveLength(3);
    const names = portfolios.map((p) => p.name);
    expect(names).toContain('Tech & Growth');
    expect(names).toContain('Blue Chip Defensive');
    expect(names).toContain('Mid Cap Opportunities');
  });
});

describe('GET /api/portfolios/:id/snapshot', () => {
  it('returns a full snapshot with P&L for each holding', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/portfolios',
      headers: { authorization: `Bearer ${guestToken}` },
    });
    const [first] = list.json<{ id: string }[]>();

    const res = await app.inject({
      method: 'GET',
      url: `/api/portfolios/${first.id}/snapshot`,
      headers: { authorization: `Bearer ${guestToken}` },
    });
    expect(res.statusCode).toBe(200);

    const snap = res.json<{
      holdings: { ltp: number; pnl: number; pnlPct: number; currentValue: number }[];
      summary: { totalValue: number; totalInvested: number; totalPnLPct: number };
    }>();

    expect(snap.holdings.length).toBeGreaterThan(0);
    expect(snap.summary.totalValue).toBeGreaterThan(0);
    expect(snap.summary.totalInvested).toBeGreaterThan(0);

    for (const h of snap.holdings) {
      expect(typeof h.ltp).toBe('number');
      expect(typeof h.pnl).toBe('number');
      expect(typeof h.pnlPct).toBe('number');
      expect(h.currentValue).toBeGreaterThan(0);
    }
  });

  it('returns 404 for an unknown portfolio id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/portfolios/nonexistent-id-xyz/snapshot',
      headers: { authorization: `Bearer ${guestToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── Health ─────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns a valid health object', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);

    const body = res.json<{
      status: string;
      uptime: number;
      components: { database: { status: string }; provider: { status: string } };
    }>();

    expect(['healthy', 'degraded', 'down']).toContain(body.status);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.components).toHaveProperty('database');
    expect(body.components).toHaveProperty('provider');
  });
});

describe('GET /api/health/cache', () => {
  it('returns cache entries list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/cache' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ entries: unknown[] }>();
    expect(body).toHaveProperty('entries');
    expect(Array.isArray(body.entries)).toBe(true);
  });
});

// ── Market ─────────────────────────────────────────────────────────────────────

describe('GET /api/market/stock/:ticker', () => {
  it('returns quote, history, and prediction for a valid NSE ticker', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/market/stock/TCS.NS?days=30&horizon=14',
      headers: { authorization: `Bearer ${guestToken}` },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json<{
      quote: { price: number; ticker: string };
      history: { date: string; close: number }[];
      prediction: { dates: string[]; mean: number[] };
    }>();

    expect(body.quote.ticker).toBe('TCS.NS');
    expect(body.quote.price).toBeGreaterThan(0);
    expect(body.history.length).toBeGreaterThan(0);
    expect(body.prediction.dates.length).toBe(14);
    expect(body.prediction.mean.length).toBe(14);
  });
});

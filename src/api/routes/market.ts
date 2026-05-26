import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { optionalAuth } from '../../auth/middleware.js';
import { getDb } from '../../db/client.js';
import { PortfolioRepository } from '../../portfolio/repository.js';
import type { IPortfolioRepository } from '../../portfolio/irepository.js';
import { PredictionEngine } from '../../prediction/engine.js';
import { QuoteCache } from '../../market/cache.js';
import { createProviderWithFallback } from '../../providers/factory.js';

interface MarketRouteOpts extends FastifyPluginOptions {
  repo?: IPortfolioRepository;
}

const HistoryQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
  horizon: z.coerce.number().int().min(1).max(90).default(30),
}).refine((d) => d.days >= d.horizon + 10, {
  message: 'days must be at least horizon + 10 to fit the prediction model',
  path: ['days'],
});

export async function marketRoutes(app: FastifyInstance, opts: MarketRouteOpts): Promise<void> {
  const provider = await createProviderWithFallback(
    (process.env['MARKET_DATA_PROVIDER'] as 'yfinance') ?? 'mock',
  );
  const engine = new PredictionEngine(provider);
  const repo: IPortfolioRepository = opts.repo ?? new PortfolioRepository(getDb());

  /** GET /api/market/quote/:ticker */
  app.get('/quote/:ticker', async (req, reply) => {
    const { ticker } = req.params as { ticker: string };

    const cached = QuoteCache.get(ticker);
    if (cached) return reply.send(cached);

    const result = await provider.fetchQuote(ticker);
    if (!result.ok) return reply.code(502).send({ error: result.error.message });
    QuoteCache.set(ticker, result.value);
    return reply.send(result.value);
  });

  /** GET /api/market/bulk?tickers=A.NS,B.BO */
  app.get('/bulk', async (req, reply) => {
    const { tickers: raw } = req.query as { tickers?: string };
    if (!raw) return reply.code(400).send({ error: 'tickers query param required' });
    const tickers = raw.split(',').map((t) => t.trim()).filter(Boolean);
    if (tickers.length > 50) return reply.code(400).send({ error: 'Max 50 tickers per request' });

    const result = await provider.fetchBulkQuotes(tickers);
    if (!result.ok) return reply.code(502).send({ error: result.error.message });
    QuoteCache.setMany(result.value);
    return reply.send(Object.fromEntries(result.value));
  });

  /**
   * GET /api/market/stock/:ticker?days=90&horizon=30
   *
   * Full stock detail: quote + OHLCV history + 30-day prediction + (optional)
   * portfolio presence for the authenticated user.
   */
  app.get('/stock/:ticker', { preHandler: optionalAuth }, async (req, reply) => {
    const { ticker } = req.params as { ticker: string };
    const queryParsed = HistoryQuery.safeParse(req.query);
    if (!queryParsed.success) return reply.code(400).send({ error: queryParsed.error.flatten() });
    const { days, horizon } = queryParsed.data;

    // Fetch quote, history, and prediction in parallel
    const [quoteResult, historyResult, predResult] = await Promise.all([
      provider.fetchQuote(ticker),
      provider.fetchHistory(ticker, days),
      engine.predict(ticker, horizon, days),
    ]);

    if (!quoteResult.ok) return reply.code(502).send({ error: quoteResult.error.message });
    if (!historyResult.ok) return reply.code(502).send({ error: historyResult.error.message });

    QuoteCache.set(ticker, quoteResult.value);

    // If authenticated, find which portfolios hold this ticker
    let portfolioPresence: Array<{
      portfolioId: string;
      portfolioName: string;
      shares: number;
      avgCost: number;
      currentValue: number;
      pnl: number;
      pnlPct: number;
    }> | undefined;

    if (req.user) {
      const filter = req.user.kind === 'user'
        ? { userId: req.user.sub }
        : { guestSessionId: req.user.sub };

      const portfoliosResult = await repo.listByOwner(filter.userId, filter.guestSessionId);
      if (portfoliosResult.ok) {
        // Fetch all holdings in parallel rather than sequentially per portfolio
        const holdingResults = await Promise.all(
          portfoliosResult.value.map((p) => repo.listHoldings(p.id)),
        );
        const presence = [];
        for (let i = 0; i < portfoliosResult.value.length; i++) {
          const portfolio = portfoliosResult.value[i]!;
          const holdingsResult = holdingResults[i]!;
          if (!holdingsResult.ok) continue;
          const holding = holdingsResult.value.find((h) => h.ticker === ticker);
          if (holding) {
            const price = quoteResult.value.price;
            const currentValue = holding.shares * price;
            const invested = holding.shares * holding.avgCost;
            presence.push({
              portfolioId: portfolio.id,
              portfolioName: portfolio.name,
              shares: holding.shares,
              avgCost: holding.avgCost,
              currentValue,
              pnl: currentValue - invested,
              pnlPct: ((currentValue - invested) / invested) * 100,
            });
          }
        }
        if (presence.length > 0) portfolioPresence = presence;
      }
    }

    return reply.send({
      ticker,
      quote: quoteResult.value,
      history: historyResult.value,
      prediction: predResult.ok ? predResult.value : null,
      portfolioPresence,
    });
  });
}

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { requireAuth } from '../../auth/middleware.js';
import type { TokenPayload } from '../../auth/jwt.js';
import { getDb } from '../../db/client.js';
import { PortfolioRepository } from '../../portfolio/repository.js';
import type { IPortfolioRepository } from '../../portfolio/irepository.js';
import { CreatePortfolioDTO, RecordTransactionDTO } from '../../portfolio/dto.js';
import { PortfolioManager } from '../../portfolio/manager.js';
import { createProviderWithFallback } from '../../providers/factory.js';
import { TrackError } from '../../errors.js';
import type { Holding, Portfolio } from '../../types.js';
import type { PortfolioRow } from '../../db/types.js';

interface PortfolioRouteOpts extends FastifyPluginOptions {
  repo?: IPortfolioRepository;
}

function ownerFilter(user: TokenPayload): { userId?: string; guestSessionId?: string } {
  return user.kind === 'user'
    ? { userId: user.sub }
    : { guestSessionId: user.sub };
}

function ownsPortfolio(user: TokenPayload, portfolio: PortfolioRow): boolean {
  if (user.kind === 'user') return portfolio.userId === user.sub;
  return portfolio.guestSessionId === user.sub;
}

export async function portfolioRoutes(app: FastifyInstance, opts: PortfolioRouteOpts): Promise<void> {
  const repo: IPortfolioRepository = opts.repo ?? new PortfolioRepository(getDb());
  const provider = await createProviderWithFallback(
    (process.env['MARKET_DATA_PROVIDER'] as 'yfinance') ?? 'mock',
  );
  const manager = new PortfolioManager(provider);

  app.addHook('preHandler', requireAuth);

  /** GET /api/portfolios */
  app.get('/', async (req, reply) => {
    const filter = ownerFilter(req.user!);
    const result = await repo.listByOwner(filter.userId, filter.guestSessionId);
    if (!result.ok) return reply.code(500).send({ error: result.error.message });
    return reply.send(result.value);
  });

  /** POST /api/portfolios */
  app.post('/', async (req, reply) => {
    const parsed = CreatePortfolioDTO.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const filter = ownerFilter(req.user!);
    const result = await repo.create({ ...parsed.data, ...filter });
    if (!result.ok) return reply.code(500).send({ error: result.error.message });
    return reply.code(201).send(result.value);
  });

  /** GET /api/portfolios/:id */
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const portResult = await repo.findById(id);
    if (!portResult.ok) return reply.code(404).send({ error: portResult.error.message });
    if (!ownsPortfolio(req.user!, portResult.value))
      return reply.code(403).send({ error: 'Access denied' });

    const holdingsResult = await repo.listHoldings(id);
    if (!holdingsResult.ok) return reply.code(500).send({ error: holdingsResult.error.message });
    return reply.send({ ...portResult.value, holdings: holdingsResult.value });
  });

  /** GET /api/portfolios/:id/snapshot — live P&L enriched with market quotes */
  app.get('/:id/snapshot', async (req, reply) => {
    const { id } = req.params as { id: string };
    const portResult = await repo.findById(id);
    if (!portResult.ok) return reply.code(404).send({ error: portResult.error.message });
    if (!ownsPortfolio(req.user!, portResult.value))
      return reply.code(403).send({ error: 'Access denied' });

    const holdingsResult = await repo.listHoldings(id);
    if (!holdingsResult.ok) return reply.code(500).send({ error: holdingsResult.error.message });

    const portfolio: Portfolio = {
      id: portResult.value.id,
      name: portResult.value.name,
      exchange: portResult.value.exchange as Portfolio['exchange'],
      holdings: holdingsResult.value as Holding[],
      createdAt: portResult.value.createdAt.toISOString(),
      updatedAt: portResult.value.updatedAt.toISOString(),
    };

    const snapshot = await manager.snapshot(portfolio);
    if (!snapshot.ok) return reply.code(502).send({ error: snapshot.error.message });
    return reply.send(snapshot.value);
  });

  /** DELETE /api/portfolios/:id */
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const portResult = await repo.findById(id);
    if (!portResult.ok) return reply.code(404).send({ error: portResult.error.message });
    if (!ownsPortfolio(req.user!, portResult.value))
      return reply.code(403).send({ error: 'Access denied' });

    const result = await repo.delete(id);
    if (!result.ok) return reply.code(500).send({ error: result.error.message });
    return reply.code(204).send();
  });

  /** GET /api/portfolios/:id/transactions */
  app.get('/:id/transactions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const portResult = await repo.findById(id);
    if (!portResult.ok) return reply.code(404).send({ error: portResult.error.message });
    if (!ownsPortfolio(req.user!, portResult.value))
      return reply.code(403).send({ error: 'Access denied' });

    const result = await repo.listTransactions(id);
    if (!result.ok) return reply.code(500).send({ error: result.error.message });
    return reply.send(result.value);
  });

  /** POST /api/portfolios/:id/transactions — simulate BUY or SELL */
  app.post('/:id/transactions', async (req, reply) => {
    const { id } = req.params as { id: string };
    const portResult = await repo.findById(id);
    if (!portResult.ok) return reply.code(404).send({ error: portResult.error.message });
    if (!ownsPortfolio(req.user!, portResult.value))
      return reply.code(403).send({ error: 'Access denied' });

    const parsed = RecordTransactionDTO.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const input = parsed.data;
    const txResult = await repo.recordTransaction({
      portfolioId: id,
      ticker: input.ticker,
      type: input.type,
      shares: input.shares,
      price: input.price,
      name: input.type === 'BUY' ? input.name : '',
      sector: input.type === 'BUY' ? input.sector : '',
      exchange: input.type === 'BUY'
        ? input.exchange
        : portResult.value.exchange as Portfolio['exchange'],
      ...(input.note !== undefined ? { note: input.note } : {}),
    });

    if (!txResult.ok) {
      const e = txResult.error;
      const code = e instanceof TrackError && e.code === 'CONFLICT' ? 409
        : e instanceof TrackError && e.code === 'VALIDATION_ERROR' ? 400 : 500;
      return reply.code(code).send({ error: e.message });
    }
    return reply.code(201).send(txResult.value);
  });
}

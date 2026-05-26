import type { FastifyInstance } from 'fastify';
import { getDb } from '../../db/client.js';
import { HealthChecker } from '../../health/checker.js';
import { QuoteCache } from '../../market/cache.js';
import { createProviderWithFallback } from '../../providers/factory.js';

const MEMORY_MODE = process.env['MEMORY_MODE'] === 'true';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const provider = await createProviderWithFallback(
    (process.env['MARKET_DATA_PROVIDER'] as 'yfinance') ?? 'mock',
  );
  const checker = new HealthChecker(MEMORY_MODE ? null : getDb(), provider);

  /** GET /api/health — full health report */
  app.get('/', async (_req, reply) => {
    const report = await checker.check();
    // HTTP 200 regardless of status — callers should parse the body.
    // Use 503 only when the database itself is down (hard outage).
    const httpCode = !MEMORY_MODE && report.components.database.status === 'down' ? 503 : 200;
    return reply.code(httpCode).send(report);
  });

  /** GET /api/health/cache — quote cache details */
  app.get('/cache', (_req, reply) => {
    return reply.send({ entries: QuoteCache.status() });
  });
}

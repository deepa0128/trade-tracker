import type { FastifyInstance } from 'fastify';
import os from 'os';
import { getDb } from '../../db/client.js';
import { HealthChecker } from '../../health/checker.js';
import { QuoteCache } from '../../market/cache.js';
import { ExchangeRegistry } from '../../exchanges/registry.js';
import { createProviderWithFallback } from '../../providers/factory.js';

/**
 * Developer diagnostics API — only available when NODE_ENV !== 'production'.
 * Returns a single comprehensive snapshot of every system resource.
 *
 * GET /api/dev          — full diagnostic report
 * GET /api/dev/routes   — all registered Fastify routes
 * GET /api/dev/config   — sanitized environment config
 */

const SENSITIVE_KEYS = /secret|password|key|token|jwt/i;

function sanitizeEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([k]) => k.startsWith('DB_') || k.startsWith('JWT_') || ['PORT', 'HOST', 'NODE_ENV', 'MARKET_DATA_PROVIDER', 'PYTHON_BIN', 'LOG_LEVEL', 'CORS_ORIGIN', 'PROVIDER_TIMEOUT_MS', 'PROVIDER_RETRIES'].includes(k))
      .map(([k, v]) => [k, SENSITIVE_KEYS.test(k) ? '•••••••• (redacted)' : (v ?? '')]),
  );
}

async function getDbStats(sql: ReturnType<typeof getDb>) {
  try {
    const [migrationRows, tableStats] = await Promise.all([
      sql<Array<{ filename: string; appliedAt: Date }>>`
        SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at
      `.catch(() => []),
      sql<Array<{ tableName: string; rowCount: string }>>`
        SELECT relname AS table_name, n_live_tup AS row_count
        FROM pg_stat_user_tables
        ORDER BY relname
      `.catch(() => []),
    ]);
    return { migrations: migrationRows, tables: tableStats };
  } catch {
    return { migrations: [], tables: [] };
  }
}

const MEMORY_MODE = process.env['MEMORY_MODE'] === 'true';

export async function devRoutes(app: FastifyInstance): Promise<void> {
  // Guard: never expose in production
  app.addHook('onRequest', async (_req, reply) => {
    if (process.env['NODE_ENV'] === 'production') {
      return reply.code(404).send();
    }
  });

  const sql = MEMORY_MODE ? null : getDb();
  const provider = await createProviderWithFallback(
    (process.env['MARKET_DATA_PROVIDER'] as 'yfinance') ?? 'mock',
  );
  const checker = new HealthChecker(sql, provider);

  /** GET /api/dev — full diagnostic snapshot */
  app.get('/', async (_req, reply) => {
    const [health, dbStats] = await Promise.all([
      checker.check(),
      sql ? getDbStats(sql) : Promise.resolve({ migrations: [], tables: [] }),
    ]);

    const exchanges = ExchangeRegistry.list().map((id) => {
      const strategy = ExchangeRegistry.get(id);
      return {
        id,
        displayName: strategy.displayName,
        tickerSuffix: strategy.tickerSuffix,
        currency: strategy.currency,
        timezone: strategy.timezone,
        marketHours: strategy.getMarketHours(),
      };
    });

    const runtime = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      cpus: os.cpus().length,
      loadAvg: os.loadavg().map((n) => +n.toFixed(2)),
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
    };

    return reply.send({
      generatedAt: new Date().toISOString(),
      health,
      runtime,
      database: dbStats,
      exchanges,
      cache: { entries: QuoteCache.status() },
      config: sanitizeEnv(),
    });
  });

  /** GET /api/dev/routes — all registered endpoints */
  app.get('/routes', (_req, reply) => {
    const routes = app.printRoutes({ includeHooks: false });
    return reply.send({ routes });
  });

  /** GET /api/dev/config — sanitized environment */
  app.get('/config', (_req, reply) => {
    return reply.send({ config: sanitizeEnv(), environment: process.env['NODE_ENV'] ?? 'development' });
  });
}

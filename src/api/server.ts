import Fastify from 'fastify';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import corsPlugin from './plugins/cors.js';
import { authRoutes } from './routes/auth.js';
import { portfolioRoutes } from './routes/portfolios.js';
import { marketRoutes } from './routes/market.js';
import { healthRoutes } from './routes/health.js';
import { devRoutes } from './routes/dev.js';
import { InMemoryPortfolioRepository } from '../db/memory-repo.js';
import { logRequest } from '../dev/request-log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = readFileSync(join(__dirname, '../../public/index.html'), 'utf-8');
import {
  TrackError,
  AuthError,
  ForbiddenError,
  ConflictError,
  PortfolioNotFoundError,
  ValidationError,
} from '../errors.js';

const MEMORY_MODE = process.env['MEMORY_MODE'] === 'true';

export async function createServer() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  // ── Request log (dev ring buffer) ───────────────────────────────────────────
  app.addHook('onResponse', (req, reply, done) => {
    logRequest({
      method: req.method,
      url: req.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    });
    done();
  });

  // ── Plugins ─────────────────────────────────────────────────────────────────
  await app.register(corsPlugin);

  // ── Routes ──────────────────────────────────────────────────────────────────
  const repo = MEMORY_MODE ? new InMemoryPortfolioRepository() : undefined;

  await app.register(authRoutes,      { prefix: '/api/auth' });
  await app.register(portfolioRoutes, { prefix: '/api/portfolios', ...(repo ? { repo } : {}) });
  await app.register(marketRoutes,    { prefix: '/api/market',      ...(repo ? { repo } : {}) });
  await app.register(healthRoutes,    { prefix: '/api/health' });
  await app.register(devRoutes,       { prefix: '/api/dev' });

  // ── Dashboard (served at root) ───────────────────────────────────────────────
  app.get('/', (_req, reply) => reply.type('text/html').send(INDEX_HTML));

  // ── Centralised error handler ────────────────────────────────────────────────
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AuthError)              return reply.code(401).send({ error: error.message });
    if (error instanceof ForbiddenError)         return reply.code(403).send({ error: error.message });
    if (error instanceof PortfolioNotFoundError) return reply.code(404).send({ error: error.message });
    if (error instanceof ValidationError)        return reply.code(400).send({ error: error.message });
    if (error instanceof ConflictError)          return reply.code(409).send({ error: error.message });
    if (error instanceof TrackError)             return reply.code(500).send({ error: error.message });

    app.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  return app;
}

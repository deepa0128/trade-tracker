import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { RegisterDTO, LoginDTO, MigrateGuestDTO } from '../../auth/schema.js';
import { signUserToken, signGuestToken } from '../../auth/jwt.js';
import { requireAuth } from '../../auth/middleware.js';
import { getDb } from '../../db/client.js';
import type { UserRow, GuestSessionRow } from '../../db/types.js';
import { PortfolioRepository } from '../../portfolio/repository.js';
import { DEMO_GUEST_ID } from '../../db/memory-repo.js';

const MEMORY_MODE = process.env['MEMORY_MODE'] === 'true';

// Simple sliding-window rate limiter for guest token issuance
const GUEST_RATE_WINDOW_MS = 60_000;
const GUEST_RATE_LIMIT = 10;
const guestRateLimiter = new Map<string, number[]>();

function isGuestRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (guestRateLimiter.get(ip) ?? []).filter((t) => t > now - GUEST_RATE_WINDOW_MS);
  if (timestamps.length >= GUEST_RATE_LIMIT) return true;
  timestamps.push(now);
  guestRateLimiter.set(ip, timestamps);
  return false;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const sql = MEMORY_MODE ? null : getDb();
  const portfolioRepo = MEMORY_MODE ? null : new PortfolioRepository(sql!);

  /** POST /api/auth/guest — create a guest session */
  app.post('/guest', async (req, reply) => {
    const ip = req.ip ?? 'unknown';
    if (isGuestRateLimited(ip)) {
      return reply.code(429).send({ error: 'Too many guest token requests. Try again later.' });
    }
    if (MEMORY_MODE) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const token = signGuestToken(DEMO_GUEST_ID);
      return reply.code(201).send({ token, expiresAt, guestSessionId: DEMO_GUEST_ID });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [session] = await sql!<GuestSessionRow[]>`
      INSERT INTO guest_sessions (expires_at) VALUES (${expiresAt}) RETURNING *
    `;

    const msUntilExpiry = expiresAt.getTime() - Date.now();
    setTimeout(async () => {
      await sql!`DELETE FROM guest_sessions WHERE expires_at < now()`;
    }, msUntilExpiry + 1000);

    const token = signGuestToken(session!.id);
    return reply.code(201).send({ token, expiresAt, guestSessionId: session!.id });
  });

  /** POST /api/auth/register */
  app.post('/register', async (req, reply) => {
    if (MEMORY_MODE) return reply.code(503).send({ error: 'Registration unavailable in demo mode' });
    const parsed = RegisterDTO.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password, guestSessionId } = parsed.data;

    const existing = await sql!<UserRow[]>`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) return reply.code(409).send({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await sql!<UserRow[]>`
      INSERT INTO users (email, password_hash) VALUES (${email}, ${passwordHash}) RETURNING *
    `;

    let migratedPortfolios = 0;
    if (guestSessionId) {
      const result = await portfolioRepo!.migrateGuestPortfolios(guestSessionId, user!.id);
      if (result.ok) migratedPortfolios = result.value;
    }

    const token = signUserToken(user!.id, email);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return reply.code(201).send({
      token, expiresAt,
      user: { id: user!.id, email },
      migratedPortfolios,
    });
  });

  /** POST /api/auth/login */
  app.post('/login', async (req, reply) => {
    if (MEMORY_MODE) return reply.code(503).send({ error: 'Login unavailable in demo mode' });
    const parsed = LoginDTO.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;

    const [user] = await sql!<UserRow[]>`SELECT * FROM users WHERE email = ${email}`;
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });

    const token = signUserToken(user.id, email);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return reply.send({ token, expiresAt, user: { id: user.id, email } });
  });

  /** POST /api/auth/migrate-guest — attach guest portfolios to logged-in user */
  app.post('/migrate-guest', { preHandler: requireAuth }, async (req, reply) => {
    if (req.user?.kind !== 'user') return reply.code(403).send({ error: 'Guests cannot migrate' });
    const parsed = MigrateGuestDTO.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const result = await portfolioRepo!.migrateGuestPortfolios(
      parsed.data.guestSessionId,
      req.user.sub,
    );
    if (!result.ok) return reply.code(500).send({ error: result.error.message });
    return reply.send({ migratedPortfolios: result.value });
  });

  /** GET /api/auth/me */
  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    return reply.send({ user: req.user });
  });
}

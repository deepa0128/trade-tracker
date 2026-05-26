import type { FastifyRequest, FastifyReply } from 'fastify';
import { parseBearer, verifyToken, type TokenPayload } from './jwt.js';
import { AuthError } from '../errors.js';

// Augment Fastify's request type so req.user is typed everywhere.
declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

/**
 * Require a valid JWT — returns 401 if missing or invalid.
 * Attach as a preHandler on any route that needs authentication.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = parseBearer(req.headers.authorization);
  if (!token) {
    return reply.code(401).send({ error: 'Authorization header required' });
  }
  try {
    req.user = verifyToken(token);
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : 'Invalid token';
    return reply.code(401).send({ error: msg });
  }
}

/**
 * Attach user info when a JWT is present, but do NOT reject unauthenticated
 * requests. Use on routes that optionally enrich the response with user data
 * (e.g. /api/market/stock/:ticker shows portfolio presence if logged in).
 */
export async function optionalAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = parseBearer(req.headers.authorization);
  if (!token) return;
  try {
    req.user = verifyToken(token);
  } catch {
    // silently ignore — caller checks req.user !== undefined
  }
}

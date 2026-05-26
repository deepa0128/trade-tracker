import jwt from 'jsonwebtoken';
import { AuthError } from '../errors.js';

function loadSecret(): string {
  const s = process.env['JWT_SECRET'];
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET must be set and at least 16 characters long');
  }
  return s;
}
const SECRET = loadSecret();

export type TokenKind = 'user' | 'guest';

export interface UserTokenPayload {
  kind: 'user';
  sub: string;   // user.id
  email: string;
}

export interface GuestTokenPayload {
  kind: 'guest';
  sub: string;   // guest_session.id
}

export type TokenPayload = UserTokenPayload | GuestTokenPayload;

export function signUserToken(userId: string, email: string): string {
  const expiry = process.env['JWT_USER_EXPIRY'] ?? '7d';
  return jwt.sign(
    { kind: 'user', sub: userId, email } satisfies UserTokenPayload,
    SECRET,
    { expiresIn: expiry } as jwt.SignOptions,
  );
}

export function signGuestToken(guestSessionId: string): string {
  const expiry = process.env['JWT_GUEST_EXPIRY'] ?? '24h';
  return jwt.sign(
    { kind: 'guest', sub: guestSessionId } satisfies GuestTokenPayload,
    SECRET,
    { expiresIn: expiry } as jwt.SignOptions,
  );
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch (e) {
    const msg = e instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
    throw new AuthError(msg);
  }
}

export function parseBearer(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────

const ExchangeId = z.enum(['NSE', 'BSE', 'NSE_BSE']);

const positiveNumber = z.number().positive();

// ── Holding ───────────────────────────────────────────────────────────────────

export const HoldingSchema = z.object({
  ticker: z.string().min(2).max(20),
  name: z.string().min(1).max(100),
  sector: z.string().min(1).max(50),
  shares: positiveNumber,
  avgCost: positiveNumber,
  exchange: ExchangeId,
});

// ── Portfolio ─────────────────────────────────────────────────────────────────

export const PortfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  exchange: ExchangeId,
  holdings: z.array(HoldingSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PortfolioInput = z.infer<typeof PortfolioSchema>;

/**
 * Validate raw JSON (e.g. loaded from disk) against the Portfolio schema.
 * Returns a typed result so callers can handle partial/malformed files
 * gracefully without crashing the entire process.
 */
export function validatePortfolio(raw: unknown): z.SafeParseReturnType<unknown, PortfolioInput> {
  return PortfolioSchema.safeParse(raw);
}

// ── Quote (subset we trust from provider output) ──────────────────────────────

export const QuoteSchema = z.object({
  ticker: z.string(),
  price: positiveNumber,
  open: positiveNumber,
  high: positiveNumber,
  low: positiveNumber,
  previousClose: positiveNumber,
  change: z.number(),
  changePct: z.number(),
  volume: z.number().int().nonnegative(),
  marketCap: positiveNumber.optional(),
  fetchedAt: z.string().datetime(),
});

export const OHLCVSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  open: positiveNumber,
  high: positiveNumber,
  low: positiveNumber,
  close: positiveNumber,
  volume: z.number().int().nonnegative(),
});

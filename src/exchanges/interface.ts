import type { ExchangeId, MarketHours } from '../types.js';

/**
 * Strategy interface for a stock exchange.
 *
 * Each implementation encapsulates exchange-specific ticker formatting,
 * validation rules, and market hours. A MultiExchangeStrategy composes
 * two or more strategies so callers can treat NSE+BSE as a single source.
 *
 * To add a new exchange (e.g. MCX), implement this interface and register
 * it via ExchangeRegistry.register().
 */
export interface IExchangeStrategy {
  readonly id: ExchangeId;
  readonly displayName: string;
  /** Suffix appended to bare symbols: '.NS' for NSE, '.BO' for BSE */
  readonly tickerSuffix: string;
  readonly currency: string;
  readonly timezone: string;

  /** Append suffix to a bare symbol. Idempotent — won't double-suffix. */
  normalizeSymbol(symbol: string): string;

  /** Strip exchange suffix from a ticker, returning the bare symbol. */
  denormalizeSymbol(ticker: string): string;

  /** Returns true if the ticker string belongs to this exchange. */
  validateTicker(ticker: string): boolean;

  getMarketHours(): MarketHours;
}

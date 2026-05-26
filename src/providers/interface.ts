import type { Quote, OHLCV } from '../types.js';
import type { Result } from '../result.js';

export interface ProviderOptions {
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Plug-and-play market data provider interface.
 *
 * Swap the implementation by changing MARKET_DATA_PROVIDER env var
 * or calling createProvider() with the desired type.
 *
 * Current implementations: MockProvider, YFinanceProvider.
 * Future: FMPProvider (Financial Modeling Prep), AlphaVantageProvider, etc.
 */
export interface IMarketDataProvider {
  readonly name: string;

  /** Fetch the latest quote for a single ticker. */
  fetchQuote(ticker: string): Promise<Result<Quote>>;

  /** Fetch OHLCV history for the past `days` trading sessions. */
  fetchHistory(ticker: string, days: number): Promise<Result<OHLCV[]>>;

  /**
   * Fetch quotes for multiple tickers in a single round-trip where possible.
   * Falls back to sequential fetchQuote calls if the provider doesn't
   * support batch endpoints natively.
   */
  fetchBulkQuotes(tickers: string[]): Promise<Result<Map<string, Quote>>>;

  /** Returns false when the provider is unreachable or misconfigured. */
  isAvailable(): Promise<boolean>;
}

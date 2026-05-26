import type { MarketHours } from '../types.js';
import type { IExchangeStrategy } from './interface.js';

/**
 * Composite strategy that spans multiple exchanges.
 *
 * - normalizeSymbol delegates to the primary (first) strategy.
 * - validateTicker accepts tickers valid on ANY constituent exchange.
 * - getMarketHours returns the union of all constituent hours
 *   (in practice NSE and BSE share the same schedule).
 *
 * To add a third exchange later, pass its strategy in the constructor —
 * no changes needed in callers that depend on IExchangeStrategy.
 */
export class MultiExchangeStrategy implements IExchangeStrategy {
  readonly id = 'NSE_BSE' as const;
  readonly displayName: string;
  readonly tickerSuffix = '';
  readonly currency = 'INR';
  readonly timezone = 'Asia/Kolkata';

  constructor(private readonly strategies: [IExchangeStrategy, ...IExchangeStrategy[]]) {
    this.displayName = strategies.map((s) => s.id).join(' + ');
  }

  normalizeSymbol(symbol: string): string {
    return this.strategies[0].normalizeSymbol(symbol);
  }

  denormalizeSymbol(ticker: string): string {
    for (const s of this.strategies) {
      if (s.validateTicker(ticker)) return s.denormalizeSymbol(ticker);
    }
    return ticker;
  }

  validateTicker(ticker: string): boolean {
    return this.strategies.some((s) => s.validateTicker(ticker));
  }

  getMarketHours(): MarketHours {
    // All Indian exchanges share the same session times.
    return this.strategies[0].getMarketHours();
  }

  /** Resolve which constituent strategy owns this ticker. */
  resolveStrategy(ticker: string): IExchangeStrategy | undefined {
    return this.strategies.find((s) => s.validateTicker(ticker));
  }
}

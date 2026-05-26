import type { MarketHours } from '../types.js';
import type { IExchangeStrategy } from './interface.js';

const MARKET_HOURS: MarketHours = {
  timezone: 'Asia/Kolkata',
  open: '09:15',
  close: '15:30',
  weekdays: [1, 2, 3, 4, 5],
};

export class NSEStrategy implements IExchangeStrategy {
  readonly id = 'NSE' as const;
  readonly displayName = 'National Stock Exchange';
  readonly tickerSuffix = '.NS';
  readonly currency = 'INR';
  readonly timezone = 'Asia/Kolkata';

  normalizeSymbol(symbol: string): string {
    return symbol.endsWith(this.tickerSuffix) ? symbol : `${symbol}${this.tickerSuffix}`;
  }

  denormalizeSymbol(ticker: string): string {
    return ticker.endsWith(this.tickerSuffix)
      ? ticker.slice(0, -this.tickerSuffix.length)
      : ticker;
  }

  validateTicker(ticker: string): boolean {
    return ticker.endsWith(this.tickerSuffix) && ticker.length > this.tickerSuffix.length;
  }

  getMarketHours(): MarketHours {
    return MARKET_HOURS;
  }
}

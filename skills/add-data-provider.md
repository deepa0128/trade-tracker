# Skill: Add a New Market Data Provider

Use this skill when the user wants to wire in a new market data source (e.g. Financial Modeling Prep, Alpha Vantage, Upstox, Zerodha Kite).

## Steps

### 1. Implement the interface

Create `src/providers/<name>.provider.ts`:

```typescript
import type { IMarketDataProvider, ProviderOptions } from './interface.js';
import type { Quote, OHLCV } from '../types.js';
import { ok, err } from '../result.js';
import { ProviderError } from '../errors.js';

export class FMPProvider implements IMarketDataProvider {
  readonly name = 'fmp';
  private readonly apiKey: string;

  constructor(options: ProviderOptions = {}) {
    this.apiKey = process.env['FMP_API_KEY'] ?? '';
  }

  async fetchQuote(ticker: string): Promise<Result<Quote>> {
    try {
      const res = await fetch(`https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${this.apiKey}`);
      const [data] = await res.json();
      return ok({ ticker, price: data.price, ... });
    } catch (e) {
      return err(new ProviderError(`FMP fetch failed: ${e}`, this.name));
    }
  }

  async fetchHistory(ticker: string, days: number): Promise<Result<OHLCV[]>> { ... }
  async fetchBulkQuotes(tickers: string[]): Promise<Result<Map<string, Quote>>> { ... }
  async isAvailable(): Promise<boolean> { return !!this.apiKey; }
}
```

### 2. Register in the factory

In `src/providers/factory.ts`, add a case:

```typescript
case 'fmp':
  return new FMPProvider(options);
```

Export from `src/providers/index.ts`:

```typescript
export { FMPProvider } from './fmp.provider.js';
```

### 3. Configure environment

In `.env`:
```
MARKET_DATA_PROVIDER=fmp
FMP_API_KEY=your_key_here
```

### 4. Test it

```typescript
import { createProvider } from './src/providers/index.js';
const provider = createProvider('fmp');
const quote = await provider.fetchQuote('TCS.NS');
```

## Notes

- Return `ProviderUnavailableError` when credentials are missing — this triggers the mock fallback in `createProviderWithFallback`
- Indian tickers on FMP use the format `TCS.NSE` — normalise in the provider, not in the caller
- If the provider has rate limits, add a simple in-memory LRU cache in `src/market/cache.ts`

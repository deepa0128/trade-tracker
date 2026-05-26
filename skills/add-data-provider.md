# Skill: Add a New Market Data Provider

Use this skill when the user wants to wire in a new market data source (e.g. Financial Modeling Prep, Alpha Vantage, Upstox, Zerodha Kite).

This is a fully worked example using **Financial Modeling Prep (FMP)** as the new provider.

---

## Step 1 — Implement the interface

Create `src/providers/fmp.provider.ts`:

```typescript
import type { Quote, OHLCV } from '../types.js';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { ProviderError, ProviderUnavailableError } from '../errors.js';
import type { IMarketDataProvider, ProviderOptions } from './interface.js';

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

/**
 * FMP uses NSE format "TCS.NSE" — we normalise to "TCS.NS" at the boundary
 * so callers never see the FMP-specific suffix.
 */
function toFMPTicker(ticker: string): string {
  return ticker.replace(/\.NS$/, '.NSE').replace(/\.BO$/, '.BSE');
}

export class FMPProvider implements IMarketDataProvider {
  readonly name = 'fmp';
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: ProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env['FMP_API_KEY'] ?? '';
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  async fetchQuote(ticker: string): Promise<Result<Quote>> {
    const fmpTicker = toFMPTicker(ticker);
    const url = `${FMP_BASE}/quote/${fmpTicker}?apikey=${this.apiKey}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) return err(new ProviderError(`FMP HTTP ${res.status}`, this.name));
      const [data] = (await res.json()) as Array<Record<string, number | string>>;
      if (!data) return err(new ProviderError(`No data for ${ticker}`, this.name));
      return ok({
        ticker,
        price:         Number(data['price']),
        open:          Number(data['open']),
        high:          Number(data['dayHigh']),
        low:           Number(data['dayLow']),
        previousClose: Number(data['previousClose']),
        change:        Number(data['change']),
        changePct:     Number(data['changesPercentage']),
        volume:        Number(data['volume']),
        fetchedAt:     new Date().toISOString(),
      });
    } catch (e) {
      return err(new ProviderError(`FMP fetchQuote failed: ${e}`, this.name));
    }
  }

  async fetchHistory(ticker: string, days: number): Promise<Result<OHLCV[]>> {
    const fmpTicker = toFMPTicker(ticker);
    const url = `${FMP_BASE}/historical-price-full/${fmpTicker}?timeseries=${days}&apikey=${this.apiKey}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) return err(new ProviderError(`FMP HTTP ${res.status}`, this.name));
      const body = (await res.json()) as { historical?: Array<Record<string, number | string>> };
      const candles = body.historical ?? [];
      return ok(
        candles.map((c) => ({
          date:   String(c['date']),
          open:   Number(c['open']),
          high:   Number(c['high']),
          low:    Number(c['low']),
          close:  Number(c['close']),
          volume: Number(c['volume']),
        })).reverse(),  // FMP returns newest-first; we want oldest-first
      );
    } catch (e) {
      return err(new ProviderError(`FMP fetchHistory failed: ${e}`, this.name));
    }
  }

  async fetchBulkQuotes(tickers: string[]): Promise<Result<Map<string, Quote>>> {
    // FMP supports comma-separated batch quotes
    const fmpTickers = tickers.map(toFMPTicker).join(',');
    const url = `${FMP_BASE}/quote/${fmpTickers}?apikey=${this.apiKey}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) return err(new ProviderError(`FMP HTTP ${res.status}`, this.name));
      const items = (await res.json()) as Array<Record<string, number | string>>;
      const map = new Map<string, Quote>();
      for (const data of items) {
        const fmpSym = String(data['symbol'] ?? '');
        const ticker = fmpSym.replace(/\.NSE$/, '.NS').replace(/\.BSE$/, '.BO');
        map.set(ticker, {
          ticker,
          price:         Number(data['price']),
          open:          Number(data['open']),
          high:          Number(data['dayHigh']),
          low:           Number(data['dayLow']),
          previousClose: Number(data['previousClose']),
          change:        Number(data['change']),
          changePct:     Number(data['changesPercentage']),
          volume:        Number(data['volume']),
          fetchedAt:     new Date().toISOString(),
        });
      }
      return ok(map);
    } catch (e) {
      return err(new ProviderError(`FMP fetchBulkQuotes failed: ${e}`, this.name));
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${FMP_BASE}/quote/TCS.NSE?apikey=${this.apiKey}`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

---

## Step 2 — Register in the factory

In `src/providers/factory.ts`, add a case inside the switch:

```typescript
case 'fmp':
  return new FMPProvider(options);
```

In `src/providers/index.ts`, add the export:

```typescript
export { FMPProvider } from './fmp.provider.js';
export type { ProviderType } from './factory.js'; // add 'fmp' to the union
```

Update the `ProviderType` union in `factory.ts`:

```typescript
export type ProviderType = 'mock' | 'yfinance' | 'fmp';
```

---

## Step 3 — Configure environment

In `.env`:
```
MARKET_DATA_PROVIDER=fmp
FMP_API_KEY=your_key_here
```

FMP free tier: 250 requests/day. Sufficient for a small portfolio; upgrade for real-time or bulk.

---

## Step 4 — Add a unit test

Create `tests/providers/fmp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FMPProvider } from '../../src/providers/fmp.provider.js';

beforeEach(() => {
  process.env['FMP_API_KEY'] = 'test-key';
});

describe('FMPProvider.fetchQuote', () => {
  it('maps FMP response fields to Quote shape', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => [{
        symbol: 'TCS.NSE', price: 3950, open: 3920, dayHigh: 3980, dayLow: 3910,
        previousClose: 3900, change: 50, changesPercentage: 1.28, volume: 500000,
      }],
    }));

    const provider = new FMPProvider();
    const result = await provider.fetchQuote('TCS.NS');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ticker).toBe('TCS.NS');
    expect(result.value.price).toBe(3950);
    expect(result.value.changePct).toBe(1.28);
  });

  it('returns ProviderError on HTTP failure', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 429 }));
    const provider = new FMPProvider();
    const result = await provider.fetchQuote('TCS.NS');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('429');
  });
});
```

---

## Key Rules

- Return `ProviderUnavailableError` when credentials are missing — this triggers the mock fallback in `createProviderWithFallback`
- **Always normalise ticker suffixes** at the provider boundary. Callers use `.NS`/`.BO`; FMP uses `.NSE`/`.BSE`. Never let provider-specific formats leak into domain code.
- If the provider has rate limits, add a simple in-memory LRU cache in `src/market/cache.ts` — the TTL pattern is already there.
- `isAvailable()` must be cheap and timeout quickly (≤3 s) — it's called at server startup.

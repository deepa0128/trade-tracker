import type { Quote } from '../types.js';

interface CacheEntry {
  quote: Quote;
  fetchedAt: number; // epoch ms
}

const TTL_MS = 60_000; // 60-second quote cache

const store = new Map<string, CacheEntry>();

export const QuoteCache = {
  get(ticker: string): Quote | null {
    const entry = store.get(ticker);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > TTL_MS) {
      store.delete(ticker);
      return null;
    }
    return entry.quote;
  },

  set(ticker: string, quote: Quote): void {
    store.set(ticker, { quote, fetchedAt: Date.now() });
  },

  setMany(quotes: Map<string, Quote>): void {
    for (const [ticker, quote] of quotes) {
      QuoteCache.set(ticker, quote);
    }
  },

  /** Returns all tickers currently in cache with their age in seconds. */
  status(): Array<{ ticker: string; ageSeconds: number; stale: boolean }> {
    const now = Date.now();
    return [...store.entries()].map(([ticker, entry]) => {
      const ageMs = now - entry.fetchedAt;
      return { ticker, ageSeconds: Math.floor(ageMs / 1000), stale: ageMs > TTL_MS };
    });
  },

  clear(): void {
    store.clear();
  },
};

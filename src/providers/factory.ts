import type { IMarketDataProvider, ProviderOptions } from './interface.js';
import { MockProvider } from './mock.provider.js';
import { YFinanceProvider } from './yfinance.provider.js';

export type ProviderType = 'mock' | 'yfinance' | 'fmp';

/**
 * Factory that instantiates the appropriate provider from an env var or
 * explicit type parameter.
 *
 * Resolution order:
 *   1. `type` argument (explicit)
 *   2. MARKET_DATA_PROVIDER env var
 *   3. 'mock' fallback
 *
 * Adding a new provider (e.g. FMP):
 *   1. Implement IMarketDataProvider in `fmp.provider.ts`.
 *   2. Add a case below.
 *   3. Set MARKET_DATA_PROVIDER=fmp and FMP_API_KEY in .env.
 */
export function createProvider(
  type?: ProviderType | string,
  options?: ProviderOptions,
): IMarketDataProvider {
  const resolved = (type ?? process.env['MARKET_DATA_PROVIDER'] ?? 'mock') as ProviderType;

  switch (resolved) {
    case 'yfinance':
      return new YFinanceProvider(options);
    case 'mock':
      return new MockProvider();
    default:
      console.warn(`[trade-tracker] Unknown provider '${resolved}', falling back to mock.`);
      return new MockProvider();
  }
}

/**
 * Returns a live provider if available, silently degrades to mock otherwise.
 * Use this in Jetro refresh scripts where a missing dependency should
 * never crash the canvas render.
 */
export async function createProviderWithFallback(
  preferred: ProviderType,
  options?: ProviderOptions,
): Promise<IMarketDataProvider> {
  const provider = createProvider(preferred, options);
  if (await provider.isAvailable()) return provider;

  console.warn(
    `[trade-tracker] Provider '${preferred}' unavailable. Falling back to mock data.`,
  );
  return new MockProvider();
}

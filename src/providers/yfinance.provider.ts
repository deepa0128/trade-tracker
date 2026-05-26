import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Quote, OHLCV } from '../types.js';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { ProviderError, ProviderUnavailableError } from '../errors.js';
import type { IMarketDataProvider, ProviderOptions } from './interface.js';

const SCRIPT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../scripts/fetch_yfinance.py',
);

/**
 * Market data provider backed by the yfinance Python library.
 *
 * Communicates via a thin Python subprocess (scripts/fetch_yfinance.py).
 * This indirection means swapping to a paid REST API only requires
 * updating the script — the TypeScript interface stays unchanged.
 *
 * Falls back to ProviderUnavailableError when Python or yfinance
 * is absent, so callers can automatically degrade to MockProvider.
 */
export class YFinanceProvider implements IMarketDataProvider {
  readonly name = 'yfinance';

  private readonly python: string;
  private readonly timeoutMs: number;

  constructor(options: ProviderOptions = {}) {
    this.python = process.env['PYTHON_BIN'] ?? 'python3';
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async fetchQuote(ticker: string): Promise<Result<Quote>> {
    return this.run<Quote>('quote', ticker);
  }

  async fetchHistory(ticker: string, days: number): Promise<Result<OHLCV[]>> {
    return this.run<OHLCV[]>('history', ticker, String(days));
  }

  async fetchBulkQuotes(tickers: string[]): Promise<Result<Map<string, Quote>>> {
    const result = await this.run<Record<string, Quote>>('bulk-quotes', tickers.join(','));
    if (!result.ok) return result;
    return ok(new Map(Object.entries(result.value)));
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync(`${this.python} -c "import yfinance"`, { timeout: 3_000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async run<T>(...args: string[]): Promise<Result<T>> {
    try {
      const stdout = execSync(
        `${this.python} "${SCRIPT_PATH}" ${args.map((a) => `"${a}"`).join(' ')}`,
        { timeout: this.timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] },
      ).toString();
      return ok(JSON.parse(stdout) as T);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('No module named')) {
        return err(new ProviderUnavailableError(this.name));
      }
      return err(new ProviderError(`yfinance call failed: ${message}`, this.name));
    }
  }
}

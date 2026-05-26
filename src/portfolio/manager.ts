import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Portfolio, PortfolioSnapshot } from '../types.js';
import type { Result } from '../result.js';
import { ok, err, tryAsync } from '../result.js';
import { PortfolioNotFoundError, ValidationError } from '../errors.js';
import type { IMarketDataProvider } from '../providers/interface.js';
import { validatePortfolio } from './schema.js';
import {
  computePortfolioTotalValue,
  computeHoldingSnapshot,
  computePortfolioSummary,
} from './calculator.js';

const PROJECTS_DIR = new URL('../../../projects', import.meta.url).pathname;

/**
 * Manages portfolio persistence and live snapshot generation.
 *
 * Portfolios are stored as JSON under projects/<slug>/portfolio.json,
 * matching the Jetro project layout so the canvas frames can read them
 * directly via DuckDB or fetch.
 */
export class PortfolioManager {
  constructor(private readonly provider: IMarketDataProvider) {}

  async load(slug: string): Promise<Result<Portfolio>> {
    const path = join(PROJECTS_DIR, slug, 'portfolio.json');
    return tryAsync(async () => {
      const raw = JSON.parse(await readFile(path, 'utf-8'));
      const result = validatePortfolio(raw);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      return result.data as Portfolio;
    }, (e) => {
      if (e instanceof Error && e.message.includes('ENOENT')) {
        return new PortfolioNotFoundError(slug);
      }
      return e instanceof Error ? e : new Error(String(e));
    });
  }

  async save(slug: string, portfolio: Portfolio): Promise<Result<void>> {
    const dir = join(PROJECTS_DIR, slug);
    return tryAsync(async () => {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'portfolio.json'), JSON.stringify(portfolio, null, 2));
    }, (e) => (e instanceof Error ? e : new Error(String(e))));
  }

  /**
   * Enrich a portfolio with live quotes to produce a snapshot.
   * Uses the injected provider so mock/live data are interchangeable.
   */
  async snapshot(portfolio: Portfolio): Promise<Result<PortfolioSnapshot>> {
    const tickers = portfolio.holdings.map((h) => h.ticker);
    const quotesResult = await this.provider.fetchBulkQuotes(tickers);
    if (!quotesResult.ok) return quotesResult;

    const quotes = quotesResult.value;
    const totalValue = computePortfolioTotalValue(portfolio.holdings, quotes);

    const holdings = portfolio.holdings.map((h) => {
      const quote = quotes.get(h.ticker);
      if (!quote) {
        return computeHoldingSnapshot(
          h,
          { ticker: h.ticker, price: h.avgCost, open: h.avgCost, high: h.avgCost,
            low: h.avgCost, previousClose: h.avgCost, change: 0, changePct: 0,
            volume: 0, fetchedAt: new Date().toISOString() },
          totalValue,
        );
      }
      return computeHoldingSnapshot(h, quote, totalValue);
    });

    return ok({
      ...portfolio,
      holdings,
      summary: computePortfolioSummary(holdings),
    });
  }

  async listSlugs(): Promise<Result<string[]>> {
    return tryAsync(async () => {
      const { readdir } = await import('fs/promises');
      return readdir(PROJECTS_DIR);
    }, (e) => (e instanceof Error ? e : new Error(String(e))));
  }
}

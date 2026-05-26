import type { PredictionResult } from '../types.js';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { PredictionError } from '../errors.js';
import type { IMarketDataProvider } from '../providers/interface.js';
import type { IPredictionModel } from './interface.js';
import { MomentumModel } from './momentum.model.js';

/**
 * Orchestrates data fetching and model execution.
 *
 * The model is injected so tests can swap in a deterministic stub
 * without touching provider wiring. The default is MomentumModel.
 */
export class PredictionEngine {
  private readonly model: IPredictionModel;

  constructor(
    private readonly provider: IMarketDataProvider,
    model?: IPredictionModel,
  ) {
    this.model = model ?? new MomentumModel();
  }

  async predict(
    ticker: string,
    horizon = 30,
    historyDays = 90,
  ): Promise<Result<PredictionResult>> {
    const historyResult = await this.provider.fetchHistory(ticker, historyDays);
    if (!historyResult.ok) return historyResult;

    const series = historyResult.value;
    if (series.length < 2) {
      return err(
        new PredictionError(
          `Insufficient history for '${ticker}': got ${series.length} session(s), need ≥2`,
        ),
      );
    }

    try {
      return ok(this.model.predict(series, ticker, horizon));
    } catch (e) {
      return err(
        new PredictionError(e instanceof Error ? e.message : String(e)),
      );
    }
  }

  async predictBatch(
    tickers: string[],
    horizon = 30,
    historyDays = 90,
  ): Promise<Map<string, Result<PredictionResult>>> {
    const entries = await Promise.all(
      tickers.map(async (t) => [t, await this.predict(t, horizon, historyDays)] as const),
    );
    return new Map(entries);
  }
}

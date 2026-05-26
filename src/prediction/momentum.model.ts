import type { OHLCV, PredictionResult } from '../types.js';
import type { IPredictionModel } from './interface.js';

/**
 * Momentum model: geometric Brownian motion with drift estimated from
 * the trailing window of log returns.
 *
 * Not a financial forecast — for demonstration and Jetro canvas rendering.
 * The confidence band widens with √t (square-root-of-time rule).
 */
export class MomentumModel implements IPredictionModel {
  readonly name = 'momentum-gbm';

  constructor(
    /** Number of historical sessions used to estimate drift and volatility. */
    private readonly lookbackDays = 30,
  ) {}

  predict(series: OHLCV[], ticker: string, horizon: number): PredictionResult {
    if (series.length < 2) {
      throw new Error(`Not enough history to predict ${ticker}: need ≥2 sessions`);
    }

    const window = series.slice(-this.lookbackDays);
    const closes = window.map((d) => d.close);
    const { drift, volatility } = this.estimateParams(closes);

    const lastClose = closes.at(-1)!;
    const lastDate = new Date(series.at(-1)!.date);

    const mean: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];
    const dates: string[] = [];

    for (let t = 1; t <= horizon; t++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + t);
      dates.push(d.toISOString().slice(0, 10));

      const projected = lastClose * Math.exp((drift - 0.5 * volatility ** 2) * t);
      const band = lastClose * volatility * Math.sqrt(t) * 1.645; // 90% CI

      mean.push(round(projected));
      upper.push(round(projected + band));
      lower.push(round(Math.max(0, projected - band)));
    }

    return {
      ticker,
      modelName: this.name,
      horizon,
      dates,
      mean,
      upper,
      lower,
      confidence: this.computeConfidence(volatility, series.length),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Internals ─────────────────────────────────────────────────────────────────

  private estimateParams(closes: number[]): { drift: number; volatility: number } {
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const prev = closes[i - 1]!;
      const curr = closes[i]!;
      logReturns.push(Math.log(curr / prev));
    }
    const n = logReturns.length;
    const mean = logReturns.reduce((a, b) => a + b, 0) / n;
    const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    return { drift: mean, volatility: Math.sqrt(variance) };
  }

  private computeConfidence(volatility: number, sampleSize: number): number {
    // Lower volatility and more data → higher confidence, capped at 0.9.
    const volPenalty = Math.min(1, volatility * 50);
    const sampleBonus = Math.min(1, sampleSize / 90);
    return parseFloat(Math.min(0.9, (1 - volPenalty) * sampleBonus + 0.1).toFixed(2));
  }
}

function round(n: number): number {
  return parseFloat(n.toFixed(2));
}

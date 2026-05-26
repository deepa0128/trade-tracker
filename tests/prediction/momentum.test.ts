import { describe, it, expect } from 'vitest';
import { MomentumModel } from '../../src/prediction/momentum.model.js';
import type { OHLCV } from '../../src/types.js';

function makeSeries(startPrice: number, days: number, dailyReturn = 0.001): OHLCV[] {
  const base = new Date('2026-01-01');
  return Array.from({ length: days }, (_, i) => {
    const close = parseFloat((startPrice * (1 + dailyReturn) ** i).toFixed(2));
    return {
      date: new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10),
      open: close * 0.998,
      high: close * 1.005,
      low: close * 0.995,
      close,
      volume: 100000,
    };
  });
}

describe('MomentumModel', () => {
  const model = new MomentumModel(20);

  it('returns the correct number of prediction dates', () => {
    const series = makeSeries(1000, 30);
    const result = model.predict(series, 'TEST.NS', 10);
    expect(result.dates).toHaveLength(10);
    expect(result.mean).toHaveLength(10);
    expect(result.upper).toHaveLength(10);
    expect(result.lower).toHaveLength(10);
  });

  it('projected mean is positive for an upward trending series', () => {
    const series = makeSeries(1000, 60, 0.002);
    const result = model.predict(series, 'TEST.NS', 30);
    const lastPrice = series.at(-1)!.close;
    // All mean values should be above the last historical close
    // (positive drift expected from an uptrend)
    expect(result.mean.every((p) => p > 0)).toBe(true);
    expect(result.mean.at(-1)! > lastPrice).toBe(true);
  });

  it('upper band is always above mean and lower band', () => {
    const series = makeSeries(500, 60);
    const result = model.predict(series, 'TEST.NS', 20);
    result.mean.forEach((m, i) => {
      expect(result.upper[i]!).toBeGreaterThanOrEqual(m);
      expect(result.lower[i]!).toBeLessThanOrEqual(m);
    });
  });

  it('confidence is between 0 and 1', () => {
    const series = makeSeries(1000, 90);
    const result = model.predict(series, 'TEST.NS', 30);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('throws when series has fewer than 2 data points', () => {
    const shortSeries = makeSeries(1000, 1);
    expect(() => model.predict(shortSeries, 'TEST.NS', 10)).toThrow();
  });

  it('stores the ticker and model name in the result', () => {
    const series = makeSeries(1000, 30);
    const result = model.predict(series, 'TCS.NS', 5);
    expect(result.ticker).toBe('TCS.NS');
    expect(result.modelName).toBe('momentum-gbm');
  });

  it('prediction dates start after the last historical date', () => {
    const series = makeSeries(1000, 30);
    const lastHistDate = series.at(-1)!.date;
    const result = model.predict(series, 'TEST.NS', 5);
    expect(result.dates[0]! > lastHistDate).toBe(true);
  });
});

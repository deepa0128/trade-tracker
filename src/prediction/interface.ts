import type { OHLCV, PredictionResult } from '../types.js';

/**
 * Prediction model interface.
 *
 * Any model that implements this can be swapped into the PredictionEngine
 * without changes to callers. Current implementation: MomentumModel.
 * Future candidates: ARIMA, LSTM (via Python subprocess), external ML API.
 */
export interface IPredictionModel {
  readonly name: string;

  /**
   * Given a historical OHLCV series (oldest→newest), produce a forward
   * projection for `horizon` trading days.
   */
  predict(series: OHLCV[], ticker: string, horizon: number): PredictionResult;
}

/**
 * trade-tracker public API
 *
 * Usage:
 *   import { ExchangeRegistry, createProvider, PortfolioManager, PredictionEngine } from './src/index.js'
 */

// Domain types
export type {
  ExchangeId, MarketHours, Quote, OHLCV,
  Holding, HoldingSnapshot, PortfolioSummary, Portfolio, PortfolioSnapshot,
  PredictionResult, TradeSignal, SignalResult,
} from './types.js';

// Result monad
export { ok, err, unwrap, mapResult, tryAsync } from './result.js';
export type { Result } from './result.js';

// Errors
export {
  TrackError, ProviderError, ProviderUnavailableError,
  ExchangeError, ValidationError, PortfolioNotFoundError, PredictionError,
} from './errors.js';

// Exchange layer
export { ExchangeRegistry, NSEStrategy, BSEStrategy, MultiExchangeStrategy } from './exchanges/index.js';
export type { IExchangeStrategy } from './exchanges/index.js';

// Provider layer
export { createProvider, createProviderWithFallback, MockProvider, YFinanceProvider } from './providers/index.js';
export type { IMarketDataProvider, ProviderOptions, ProviderType } from './providers/index.js';

// Portfolio layer
export { PortfolioManager, computeHoldingSnapshot, computePortfolioSummary, computeSignal, validatePortfolio } from './portfolio/index.js';

// Prediction layer
export { PredictionEngine, MomentumModel } from './prediction/index.js';
export type { IPredictionModel } from './prediction/index.js';

// Seed data
export { SEED_PORTFOLIOS } from './seed/portfolios.js';

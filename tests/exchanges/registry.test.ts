import { describe, it, expect } from 'vitest';
import { ExchangeRegistry, NSEStrategy, BSEStrategy, MultiExchangeStrategy } from '../../src/exchanges/index.js';
import { ExchangeError } from '../../src/errors.js';

describe('NSEStrategy', () => {
  const nse = new NSEStrategy();

  it('normalizes bare symbol to .NS ticker', () => {
    expect(nse.normalizeSymbol('TCS')).toBe('TCS.NS');
  });

  it('is idempotent — does not double-suffix', () => {
    expect(nse.normalizeSymbol('TCS.NS')).toBe('TCS.NS');
  });

  it('strips .NS suffix in denormalize', () => {
    expect(nse.denormalizeSymbol('TCS.NS')).toBe('TCS');
  });

  it('validates tickers with .NS suffix', () => {
    expect(nse.validateTicker('TCS.NS')).toBe(true);
    expect(nse.validateTicker('TCS.BO')).toBe(false);
    expect(nse.validateTicker('.NS')).toBe(false); // empty prefix
  });
});

describe('BSEStrategy', () => {
  const bse = new BSEStrategy();

  it('normalizes bare symbol to .BO ticker', () => {
    expect(bse.normalizeSymbol('RELIANCE')).toBe('RELIANCE.BO');
  });

  it('validates tickers with .BO suffix', () => {
    expect(bse.validateTicker('RELIANCE.BO')).toBe(true);
    expect(bse.validateTicker('RELIANCE.NS')).toBe(false);
  });
});

describe('MultiExchangeStrategy', () => {
  const nse = new NSEStrategy();
  const bse = new BSEStrategy();
  const multi = new MultiExchangeStrategy([nse, bse]);

  it('accepts tickers from either exchange', () => {
    expect(multi.validateTicker('TCS.NS')).toBe(true);
    expect(multi.validateTicker('RELIANCE.BO')).toBe(true);
    expect(multi.validateTicker('UNKNOWN.XX')).toBe(false);
  });

  it('normalizes using primary (first) strategy', () => {
    expect(multi.normalizeSymbol('TCS')).toBe('TCS.NS');
  });

  it('denormalizes correctly regardless of suffix', () => {
    expect(multi.denormalizeSymbol('TCS.NS')).toBe('TCS');
    expect(multi.denormalizeSymbol('RELIANCE.BO')).toBe('RELIANCE');
  });

  it('resolves the owning strategy for a ticker', () => {
    expect(multi.resolveStrategy('INFY.NS')?.id).toBe('NSE');
    expect(multi.resolveStrategy('ITC.BO')?.id).toBe('BSE');
    expect(multi.resolveStrategy('UNKNOWN.XX')).toBeUndefined();
  });
});

describe('ExchangeRegistry', () => {
  it('returns pre-registered NSE, BSE, NSE_BSE strategies', () => {
    expect(ExchangeRegistry.get('NSE').id).toBe('NSE');
    expect(ExchangeRegistry.get('BSE').id).toBe('BSE');
    expect(ExchangeRegistry.get('NSE_BSE').id).toBe('NSE_BSE');
  });

  it('throws ExchangeError for unknown exchange id', () => {
    expect(() => ExchangeRegistry.get('MCX')).toThrow(ExchangeError);
  });

  it('allows registering a custom exchange', () => {
    const stub = new NSEStrategy(); // reuse for simplicity
    ExchangeRegistry.register('TEST_EXCHANGE', stub);
    expect(ExchangeRegistry.get('TEST_EXCHANGE')).toBe(stub);
  });

  it('lists all registered exchanges', () => {
    const list = ExchangeRegistry.list();
    expect(list).toContain('NSE');
    expect(list).toContain('BSE');
    expect(list).toContain('NSE_BSE');
  });
});

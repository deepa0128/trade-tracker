import type { ExchangeId } from '../types.js';
import { ExchangeError } from '../errors.js';
import type { IExchangeStrategy } from './interface.js';
import { NSEStrategy } from './nse.js';
import { BSEStrategy } from './bse.js';
import { MultiExchangeStrategy } from './multi.js';

/**
 * Central registry for exchange strategies.
 *
 * Pre-registered: NSE, BSE, NSE_BSE.
 * Extend at startup with ExchangeRegistry.register() for future exchanges
 * (e.g. MCX, SGX) without touching existing code.
 */
class ExchangeRegistryClass {
  private readonly strategies = new Map<ExchangeId | string, IExchangeStrategy>();

  constructor() {
    const nse = new NSEStrategy();
    const bse = new BSEStrategy();
    const multi = new MultiExchangeStrategy([nse, bse]);
    this.strategies.set('NSE', nse);
    this.strategies.set('BSE', bse);
    this.strategies.set('NSE_BSE', multi);
  }

  get(id: ExchangeId | string): IExchangeStrategy {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      throw new ExchangeError(
        `Exchange '${id}' is not registered. Call ExchangeRegistry.register() first.`,
        id,
      );
    }
    return strategy;
  }

  register(id: string, strategy: IExchangeStrategy): void {
    this.strategies.set(id, strategy);
  }

  list(): string[] {
    return [...this.strategies.keys()];
  }
}

export const ExchangeRegistry = new ExchangeRegistryClass();

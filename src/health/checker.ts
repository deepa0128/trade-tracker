import type { Sql } from '../db/client.js';
import type { IMarketDataProvider } from '../providers/interface.js';
import { QuoteCache } from '../market/cache.js';

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface ComponentHealth {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}

export interface HealthReport {
  status: HealthStatus;
  uptime: number; // seconds
  components: {
    database: ComponentHealth;
    provider: ComponentHealth;
    cache: ComponentHealth;
  };
  checkedAt: string;
}

const START_TIME = Date.now();
const COMPONENT_TIMEOUT_MS = 2_000;

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs),
    ),
  ]);
}

async function checkDatabase(sql: Sql | null): Promise<ComponentHealth> {
  const checkedAt = new Date().toISOString();
  if (!sql) return { status: 'healthy', message: 'Memory mode — no database', checkedAt };
  const t0 = Date.now();
  try {
    await withTimeout(() => sql`SELECT 1`, COMPONENT_TIMEOUT_MS);
    return { status: 'healthy', latencyMs: Date.now() - t0, checkedAt };
  } catch (e) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: e instanceof Error ? e.message : String(e),
      checkedAt,
    };
  }
}

async function checkProvider(provider: IMarketDataProvider): Promise<ComponentHealth> {
  const checkedAt = new Date().toISOString();
  const t0 = Date.now();
  try {
    const available = await withTimeout(() => provider.isAvailable(), COMPONENT_TIMEOUT_MS);
    return {
      status: available ? 'healthy' : 'degraded',
      latencyMs: Date.now() - t0,
      message: available ? `Provider: ${provider.name}` : `Provider '${provider.name}' unavailable`,
      checkedAt,
    };
  } catch (e) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      message: e instanceof Error ? e.message : String(e),
      checkedAt,
    };
  }
}

function checkCache(): ComponentHealth {
  const entries = QuoteCache.status();
  const staleCount = entries.filter((e) => e.stale).length;
  const status: HealthStatus =
    entries.length === 0 ? 'healthy' : staleCount === entries.length ? 'degraded' : 'healthy';
  return {
    status,
    message: `${entries.length} ticker(s) cached, ${staleCount} stale`,
    checkedAt: new Date().toISOString(),
  };
}

function aggregate(components: ComponentHealth[]): HealthStatus {
  if (components.some((c) => c.status === 'down')) return 'down';
  if (components.some((c) => c.status === 'degraded')) return 'degraded';
  return 'healthy';
}

export class HealthChecker {
  constructor(
    private readonly sql: Sql | null,
    private readonly provider: IMarketDataProvider,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, provider, cache] = await Promise.all([
      checkDatabase(this.sql),
      checkProvider(this.provider),
      Promise.resolve(checkCache()),
    ]);

    const components = { database, provider, cache };
    return {
      status: aggregate(Object.values(components)),
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      components,
      checkedAt: new Date().toISOString(),
    };
  }
}

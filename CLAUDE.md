# Trade Tracker — Agent Context

BSE/NSE portfolio tracker built on Jetro. Fastify + TypeScript backend, in-memory seeded data, live Jetro canvas dashboard.

## Quick Start

```bash
# Node is via Zed's bundled runtime — add it to PATH first
export PATH="/home/ani/.local/share/zed/node/node-v24.11.0-linux-x64/bin:$PATH"

npm install
set -a && source .env && set +a
tsx src/server.ts          # → http://localhost:3000
```

## Architecture at a Glance

| Layer | Location | Key abstraction |
|---|---|---|
| Exchange strategies | `src/exchanges/` | `IExchangeStrategy` — NSE / BSE / multi |
| Data providers | `src/providers/` | `IMarketDataProvider` — mock or yfinance |
| Portfolio engine | `src/portfolio/` | Pure-function P&L calculator |
| Prediction engine | `src/prediction/` | `IPredictionModel` — GBM by default |
| Auth | `src/auth/` | JWT — user tokens or guest tokens |
| Canvas frames | `.jetro/frames/` | HTML with `window.addEventListener('jet:refresh', ...)` |
| Refresh scripts | `.jetro/refresh/` | Python → stdout JSON → `jet:refresh` → frame |

## Critical: `jet:refresh` Event

Frames receive data via `window.addEventListener('jet:refresh', e => { const d = e.detail; ... })`.
**Never** `document.addEventListener` — events are dispatched on `window`.

## Key Environment Variables

| Var | Default | Notes |
|---|---|---|
| `MEMORY_MODE` | `true` | Skip Postgres; use seeded in-memory repo |
| `MARKET_DATA_PROVIDER` | `mock` | `mock` \| `yfinance` |
| `JWT_SECRET` | required | ≥ 16 chars |
| `GUEST_SESSION_ID` | `DEMO_GUEST_ID` | Stable guest token ID across restarts |

## Canvas Frames

| Frame | HTML file | Refresh script | Interval |
|---|---|---|---|
| Portfolio Overview | `portfolio-overview.html` | `portfolio.py` | 60 s |
| Portfolio Holdings | `portfolio-holdings.html` | `portfolio.py` | 60 s |
| Stock Deep Drill | `stock-drill.html` | `stocks.py` | 60 s |
| System Health | `health-monitor.html` | `health.py` | 30 s |

Bindings are **not** persisted across sessions. Re-attach with `jet_canvas bind` if frames go blank.

## Refresh Script Fallback

`stocks.py` falls back to `jet.market.Ticker` (Jetro's built-in NSE data, free, no quota) when the local server is unreachable. This keeps canvas frames live even when the backend is restarting.

## Tests

```bash
npm test                     # unit: calculator, registry, momentum (32 tests)
npm run test -- tests/e2e    # E2E: API flow via Fastify inject (no server needed)
npm run typecheck            # TypeScript strict mode
```

## Common Tasks

**Add a new data provider:**
1. Implement `IMarketDataProvider` in `src/providers/fmp.provider.ts`
2. Add `case 'fmp': return new FMPProvider()` in `src/providers/factory.ts`
3. Set `MARKET_DATA_PROVIDER=fmp` in `.env`

**Add a new exchange:**
1. Implement `IExchangeStrategy` in `src/exchanges/mcx.ts`
2. `ExchangeRegistry.register('MCX', new MCXStrategy())`

**Re-attach canvas bindings (after session restart):**
Use `jet_canvas bind` for each frame element — see `.jetro/refresh/` for script paths.

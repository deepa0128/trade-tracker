# trade-tracker

A BSE/NSE portfolio tracker built on [Jetro](https://jetro.ai) — an AI-native research workspace. Three demo portfolios, live market data via pluggable providers, 30-day GBM price predictions, and a dual-surface UI: Jetro canvas frames + a self-hosted web dashboard.

---

## Dashboard

Start the server (`npm start`) and open `http://localhost:3000`.

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Indian Markets Portfolio Tracker      [ Overview | Holdings │
│                                            Stock Drill | Health ]│
├─────────────────┬──────────────┬─────────────┬─────────────────┤
│ Total Value     │ Invested     │ Overall Ret │ Today's Change  │
│ ₹13,35,482      │ ₹12,95,950   │ +3.05%      │ +₹4,821 (+0.36%)│
├─────────────────┴──────────────┴─────────────┴─────────────────┤
│  Portfolios                                                      │
│  ┌──────────────────┐ ┌─────────────────────┐ ┌──────────────┐  │
│  │ Tech & Growth    │ │ Blue Chip Defensive │ │ Mid Cap Opp. │  │
│  │ ₹3.72L  +11.6%   │ │ ₹5.28L   +6.2%     │ │ ₹4.35L -6.5% │  │
│  └──────────────────┘ └─────────────────────┘ └──────────────┘  │
│                                                                  │
│  [Allocation Donut]              [Sector Breakdown Bar Chart]    │
└─────────────────────────────────────────────────────────────────┘
```

The Holdings tab shows a sortable table per portfolio with per-stock P&L, weight bars, and BUY/HOLD/WATCH/SELL signals.

The Stock Drill tab shows a price chart with 30-day GBM prediction and 90% confidence band, overlaid with your average cost line.

---

## Jetro Canvas

Open the project in Jetro to see six live frames auto-refreshing every 30–60 seconds:

| Frame | What it shows |
|---|---|
| **Portfolio Overview** | Total KPIs, value distribution donut, sector allocation |
| **Portfolio Holdings** | Tabbed holdings tables with signals |
| **Price Trends & Predictions** | 90-day history + 30-day GBM projection per stock |
| **Stock Deep Drill** | Full stock detail: quote, KPIs, chart, signal, position |
| **System Health Monitor** | DB / provider / cache status, latency sparkline |
| **Developer Options** | Raw health JSON for debugging |

Frames receive data via `jet:refresh` CustomEvent — the refresh pipeline runs Python scripts that call the local API and emit JSON to stdout.

**Fallback:** when the backend is restarting, `stocks.py` automatically switches to `jet.market.Ticker` — Jetro's built-in NSE/BSE data module — so the canvas stays live.

---

## Architecture

| Layer | Location | Key abstraction |
|---|---|---|
| Exchange strategies | `src/exchanges/` | `IExchangeStrategy` — NSE / BSE / multi |
| Data providers | `src/providers/` | `IMarketDataProvider` — mock or yfinance |
| Portfolio engine | `src/portfolio/` | Pure-function P&L calculator |
| Prediction engine | `src/prediction/` | GBM model via `IPredictionModel` |
| Auth | `src/auth/` | JWT — user or guest tokens |
| Canvas frames | `.jetro/frames/` | HTML listening for `jet:refresh` |
| Refresh scripts | `.jetro/refresh/` | Python → stdout JSON → frame |

See [design-spec.md](design-spec.md) for detailed decision rationale and trade-offs.

---

## Portfolios

| Portfolio | Exchange | Holdings | Invested |
|---|---|---|---|
| Tech & Growth | NSE | TCS, Infosys, HCL Tech, Wipro, Persistent, LTIMindtree | ₹3,32,800 |
| Blue Chip Defensive | BSE | Reliance, HDFC Bank, HUL, ITC, Nestle, Tata Motors | ₹4,97,950 |
| Mid Cap Opportunities | NSE/BSE | Zomato, IRCTC, Tata Elxsi, Dixon Tech, Polycab | ₹4,65,200 |

---

## Getting Started

```bash
# 1. Install dependencies (Node ≥ 22)
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET at minimum

# 3. Start the server (memory mode — no Postgres needed)
npm start
# → http://localhost:3000

# 4. Optional: live market data via yfinance
# pip install yfinance
# Set MARKET_DATA_PROVIDER=yfinance in .env
```

### With PostgreSQL

```bash
docker-compose up -d          # start Postgres
npm run migrate               # run migrations
MEMORY_MODE=false npm start   # use real DB
```

---

## Tests

### Unit Tests (32 tests, offline-safe)

```bash
npm test
```

```
 ✓ tests/portfolio/calculator.test.ts   (11 tests)
   - P&L computation, weight allocation, negative P&L, missing quotes
 ✓ tests/prediction/momentum.test.ts    (7 tests)
   - GBM drift/volatility, confidence band ordering, determinism
 ✓ tests/exchanges/registry.test.ts     (14 tests)
   - NSE/BSE normalisation, ticker validation, multi-exchange routing
```

### End-to-End API Tests (no running server needed)

```bash
npm run test -- tests/e2e
```

E2E tests use Fastify's `inject()` to exercise the full request lifecycle — auth middleware, route handlers, error handler — without binding to a port. `MEMORY_MODE=true` + `MockProvider` keeps them deterministic and CI-safe.

```
 ✓ GET /                             serves the web dashboard HTML
 ✓ POST /api/auth/guest              issues a JWT (201), stable guest identity
 ✓ GET  /api/portfolios              401 without token; 3 seeded portfolios with token
 ✓ GET  /api/portfolios/:id/snapshot live P&L, all numeric fields present
 ✓ GET  /api/portfolios/bad/snapshot 404 for unknown ID
 ✓ GET  /api/health                  valid status, components present
 ✓ GET  /api/health/cache            entries array
 ✓ GET  /api/market/stock/TCS.NS     quote + 30-day history + 14-day prediction
```

### Type checking

```bash
npm run typecheck
```

---

## Extending the System

### Add a new data provider

1. Implement `IMarketDataProvider` in `src/providers/<name>.provider.ts`
2. Add a `case` in `src/providers/factory.ts`
3. Set `MARKET_DATA_PROVIDER=<name>` in `.env`

See [skills/add-data-provider.md](skills/add-data-provider.md) for a full worked example.

### Add a new exchange

```typescript
import { ExchangeRegistry } from './src/exchanges/index.js';
ExchangeRegistry.register('MCX', new MCXStrategy());
```

### Swap the prediction model

Implement `IPredictionModel` and inject it into `PredictionEngine`. The GBM model is the default; ARIMA, Prophet, or an ML model slot in without changing any callers.

---

## Skills

Project-specific Jetro skills are in the [`skills/`](skills/) directory:

| Skill | Purpose |
|---|---|
| [add-data-provider.md](skills/add-data-provider.md) | Wire in a new market data source |
| [canvas-refresh-pipeline.md](skills/canvas-refresh-pipeline.md) | Debug frames, re-attach bindings, add new frames |

---

## Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | required | ≥ 16 chars |
| `MEMORY_MODE` | `true` | `false` to use PostgreSQL |
| `MARKET_DATA_PROVIDER` | `mock` | `mock` or `yfinance` |
| `GUEST_SESSION_ID` | `DEMO_GUEST_ID` | Stable guest token identity |
| `DATABASE_URL` | — | Required when `MEMORY_MODE=false` |
| `LOG_LEVEL` | `info` | Fastify log level |
| `PORT` | `3000` | Server port |

---

## License

MIT

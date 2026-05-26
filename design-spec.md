# Trade Tracker — Design Specification

## Overview

A BSE/NSE portfolio tracker demonstrating AI-native development on Jetro. The backend is a Fastify + TypeScript API; the frontend is both a self-hosted web dashboard (served by Fastify at `GET /`) and a live Jetro canvas with interactive frames.

---

## System Architecture

```
┌──────────────────────────────────────────────────┐
│                   Jetro Canvas                    │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │  Portfolio  │  │  Portfolio   │               │
│  │  Overview   │  │  Holdings    │               │
│  └──────┬──────┘  └──────┬───────┘               │
│         │                │  jet:refresh events    │
│  ┌──────┴──────┐  ┌──────┴───────┐               │
│  │ Stock Drill │  │ Sys Health   │               │
│  └─────────────┘  └──────────────┘               │
│                                                   │
│  Refresh scripts (.jetro/refresh/*.py)            │
│  → stdout JSON → jet:refresh → frame.detail       │
└──────────────────┬───────────────────────────────┘
                   │ HTTP
┌──────────────────▼───────────────────────────────┐
│            Fastify API  (localhost:3000)           │
│                                                   │
│  GET /           → Web dashboard (public/index)   │
│  POST /api/auth/guest  → JWT guest token          │
│  GET  /api/portfolios  → list portfolios          │
│  GET  /api/portfolios/:id/snapshot → live P&L     │
│  GET  /api/market/stock/:ticker    → quote+history│
│  GET  /api/health                  → system status│
│                                                   │
│  PortfolioManager ← IMarketDataProvider           │
│                        ↓                         │
│                   YFinanceProvider / MockProvider  │
│                        ↓ (fallback)               │
│                   jet.market.Ticker (Jetro NSE)   │
└──────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Result Monad Over Exceptions

All fallible operations return `Result<T, E>` (a discriminated union `{ ok: true; value: T } | { ok: false; error: E }`). No unchecked exceptions propagate through the domain layer. This pattern:
- Makes error paths explicit at every call site
- Prevents silent failures from cascading
- Allows route handlers to pattern-match on outcomes cleanly

**Trade-off:** More verbose than try/catch at call sites; worth it for a data-intensive app where provider failures are routine.

### 2. Strategy Pattern for Exchanges

`IExchangeStrategy` is a three-method interface: `normalizeSymbol`, `denormalizeSymbol`, `validateTicker`. NSE appends `.NS`, BSE appends `.BO`, and `MultiExchangeStrategy` delegates to both.

`ExchangeRegistry` is a plain Map — adding MCX or SGX is one `register()` call. No conditional chains, no config files.

**Trade-off:** A pure function `(symbol, exchange) => ticker` would be simpler for the current three-exchange case, but the registry scales to multi-exchange routing without a rewrite.

### 3. Pluggable Data Providers

`IMarketDataProvider` defines three methods: `fetchQuote`, `fetchHistory`, `fetchBulkQuotes`. Implementations:
- **MockProvider** — seeded deterministic data (offline, CI, testing)
- **YFinanceProvider** — thin subprocess wrapper around `scripts/fetch_yfinance.py`

`createProviderWithFallback('yfinance')` checks availability first and silently degrades to mock if Python or yfinance is absent. This means the server starts and serves data regardless of the Python environment.

**Trade-off:** Subprocess per fetch (yfinance) is slow (~500 ms). Acceptable for a demo; a production version would use a WebSocket-connected provider or an HTTP-based data service.

### 4. MEMORY_MODE — Postgres-Free Operation

`InMemoryPortfolioRepository` implements `IPortfolioRepository` identically to the Postgres-backed version. It pre-seeds three portfolios on construction. `MEMORY_MODE=true` routes all persistence through it.

Benefits: zero-dependency startup (no Docker, no DB migrations), works on any machine in 30 seconds.

**Trade-off:** Data doesn't survive restarts. Acceptable for a demo; swap `MEMORY_MODE` to `false` and run `npm run migrate` to use persistent Postgres.

### 5. Guest Auth Without User Accounts

`POST /api/auth/guest` issues a JWT whose `sub` is the stable `GUEST_SESSION_ID` env var (default: `DEMO_GUEST_ID`). Every guest hits the same seeded portfolios. No registration, no password, no session state.

**Trade-off:** No isolation between guests. The design was intentional — this is a read-only demo. Adding per-session isolation requires only changing `GUEST_SESSION_ID` to a per-request UUID and persisting the seed per session.

### 6. Jetro Canvas as the Primary UI

Canvas frames are HTML files that listen for `window.addEventListener('jet:refresh', ...)`. Python refresh scripts run on a timer, call the local API, and emit JSON to stdout. Jetro's runtime fires `jet:refresh` with `e.detail = parsed_json`.

This architecture separates concerns cleanly:
- Backend: stateless JSON API, unaware of canvas
- Refresh scripts: lightweight glue (urllib only, no deps)
- Frames: pure HTML/JS renderers, no server coupling

**Fallback:** `stocks.py` catches server connection failures and switches to `jet.market.Ticker` — Jetro's built-in NSE/BSE data module — so the canvas stays live even when the backend is restarting.

### 7. GBM Prediction Model

The 30-day price prediction uses Geometric Brownian Motion: drift is estimated from trailing momentum (recent returns minus a mean-reversion pull), and volatility from the standard deviation of log-returns over a configurable window.

The model is injected via `IPredictionModel` — swapping to ARIMA or an ML model requires only implementing the interface and passing the instance to `PredictionEngine`.

**Trade-off:** GBM assumes log-normal returns and constant volatility, which Indian equities violate during events (earnings, results). The 90% confidence bands are wide enough to be honest about this uncertainty.

---

## Data Flow

### Canvas Refresh (every 60 s)

```
.jetro/refresh/portfolio.py
  → POST /api/auth/guest → JWT
  → GET /api/portfolios → [{ id, name, ... }]
  → GET /api/portfolios/:id/snapshot (×3)
  → stdout: { ok, snapshots }
  → jet:refresh → portfolio-overview.html + portfolio-holdings.html
```

### Stock Drill with Fallback

```
.jetro/refresh/stocks.py (primary)
  → same auth flow
  → GET /api/market/stock/:ticker?days=90&horizon=30 (per ticker)
  → stdout: { ok, snapshots, stocks }

.jetro/refresh/stocks.py (fallback, server unreachable)
  → from jet.market import Ticker
  → Ticker(ticker).fast_info → { last_price, previous_close }
  → reconstruct snapshot from SEED_PORTFOLIOS
  → stdout: { ok, snapshots, stocks, _source: "jet.market" }
```

---

## Extension Points

| What to extend | Interface | Where |
|---|---|---|
| New data source | `IMarketDataProvider` | `src/providers/` |
| New exchange | `IExchangeStrategy` | `src/exchanges/` |
| New prediction model | `IPredictionModel` | `src/prediction/` |
| Persistent storage | `IPortfolioRepository` | `src/db/` |
| New canvas frame | HTML + `.py` script | `.jetro/frames/` + `.jetro/refresh/` |

---

## Trade-offs Summary

| Decision | Why | Cost |
|---|---|---|
| Result monad | Explicit error paths, no silent failures | Verbose call sites |
| Subprocess for yfinance | Zero TypeScript/Python coupling | ~500 ms latency per fetch |
| Memory mode | Zero-dependency startup | No persistence across restarts |
| Guest JWT (stable sub) | Instant onboarding | No per-session isolation |
| GBM prediction | Simple, interpretable, fast | Violates fat-tail reality |
| Canvas-first UI | AI-native workspace integration | Requires Jetro to view |
| Web dashboard fallback | Works in any browser at localhost:3000 | Duplicate UI surface |

# Trade Tracker — AI Agent Instructions

You are working on a BSE/NSE portfolio tracker. This is an AI-first project built with Jetro as the primary workspace.

## What This Project Does

- Tracks 3 demo portfolios (Tech & Growth / Blue Chip Defensive / Mid Cap Opportunities) across NSE and BSE
- Serves a web dashboard at `GET /` (http://localhost:3000) and REST API at `/api/*`
- Renders live Jetro canvas frames with portfolio KPIs, holdings tables, stock drill-down, and system health
- Predicts 30-day price paths using Geometric Brownian Motion

## Running the Project

```bash
export PATH="/home/ani/.local/share/zed/node/node-v24.11.0-linux-x64/bin:$PATH"
set -a && source .env && set +a
tsx src/server.ts
```

The server reads `.env` at startup. `MEMORY_MODE=true` skips PostgreSQL entirely.

## What to Do When Frames Show a Spinner

1. Check the server is running: `curl http://localhost:3000/api/health`
2. Re-attach bindings: use `jet_canvas bind` for each frame with its script in `.jetro/refresh/`
3. Trigger manually: use `jet_canvas trigger` for each element ID
4. Inspect: check `jet:refresh` listener is on `window` not `document`

## Extending the System

- **New exchange**: implement `IExchangeStrategy`, register in `ExchangeRegistry`
- **New data provider**: implement `IMarketDataProvider`, add case in `factory.ts`
- **New prediction model**: implement `IPredictionModel`, inject into `PredictionEngine`
- **New canvas frame**: write HTML to `.jetro/frames/`, create refresh script in `.jetro/refresh/`

## Design Principles

- **Result monad over exceptions** — all fallible ops return `Result<T, E>`, never throw
- **Pure functions for calculations** — `calculator.ts` has zero side-effects, fully testable
- **Graceful degradation** — yfinance → mock fallback; server down → jet.market fallback in scripts
- **No magic** — every interface is explicit, every extension point is documented

## Data Flow

```
Python refresh script (.jetro/refresh/*.py)
  → stdout JSON
  → Jetro runtime fires window.dispatchEvent(new CustomEvent('jet:refresh', { detail: data }))
  → Frame HTML listens: window.addEventListener('jet:refresh', e => render(e.detail))
```

## Key Files

| File | Purpose |
|---|---|
| `src/api/server.ts` | Fastify app factory |
| `src/db/memory-repo.ts` | In-memory portfolio store (pre-seeded) |
| `src/seed/portfolios.ts` | Canonical portfolio definitions |
| `src/portfolio/calculator.ts` | Pure P&L functions |
| `src/prediction/momentum.model.ts` | GBM prediction model |
| `.jetro/refresh/stocks.py` | Main canvas data feed — with jet.market fallback |
| `public/index.html` | Full web dashboard SPA |

---
trigger: always_on
---

# Trade Tracker — Project Agent Rules

You are working on a BSE/NSE portfolio tracker built with Fastify + TypeScript, running in a Jetro AI-native workspace.

## Project Identity
- Backend: Fastify + TypeScript, `src/` directory
- Canvas: 6 live Jetro frames in `.jetro/frames/`, refresh scripts in `.jetro/refresh/`
- Web dashboard: `public/index.html` served by Fastify at `GET /`
- In-memory mode (`MEMORY_MODE=true`): no Postgres, 3 seeded demo portfolios

## Non-Negotiables
- All fallible operations return `Result<T, E>` — never throw domain errors
- Canvas frames use `window.addEventListener('jet:refresh', ...)` — never `document`
- Refresh scripts always `print(json.dumps(...))` — never exit silently
- JWT_SECRET validated at startup — fail fast, not at request time
- Holdings queries in market.ts are parallel — no sequential `await` in a `for` loop

## When Something Breaks
1. Check server: `curl http://localhost:3000/api/health`
2. Frames blank? Re-attach bindings with `jet_canvas bind`, then `jet_canvas trigger`
3. Script failing? Run it in `jet_exec` to see stderr output
4. Type errors? Run `npm run typecheck` — strict mode is enabled

## Extending the System
- New exchange → implement `IExchangeStrategy`, register in `ExchangeRegistry`
- New data provider → implement `IMarketDataProvider`, add case in `factory.ts`
- New prediction model → implement `IPredictionModel`, inject into `PredictionEngine`
- New canvas frame → write HTML to `.jetro/frames/`, script to `.jetro/refresh/`, bind and trigger

## Testing Philosophy
- Unit tests: pure functions only (calculator, jwt, exchanges, prediction)
- E2E tests: full request lifecycle via `app.inject()` in `tests/e2e/`
- Never hit live APIs in tests — `MARKET_DATA_PROVIDER=mock` always

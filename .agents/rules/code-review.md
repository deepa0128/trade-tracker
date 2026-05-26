---
trigger: glob
glob: "src/**/*.ts"
---

# Code Review Rules — Trade Tracker

When reviewing or writing TypeScript in this project, enforce these standards:

## Error Handling
- All fallible operations MUST return `Result<T, E>` (from `src/result.ts`). Never throw domain errors.
- Route handlers MUST check `result.ok` before accessing `result.value`.
- The centralised error handler in `server.ts` is the only place that maps domain errors to HTTP codes.
- Never swallow errors silently (`catch {}`). At minimum, log them.

## Type Safety
- TypeScript strict mode is enabled. No `any` escapes.
- Use `satisfies` for type-narrowed literals (see `jwt.ts` for the pattern).
- Always use the `!` non-null assertion only when you can prove the value exists — prefer optional chaining.

## Performance
- Never `await` inside a `for` loop when operations are independent. Use `Promise.all`.
- Quote cache (`src/market/cache.ts`) should be checked before hitting the provider.
- Health checks should not trigger slow I/O on every call — cache status for ≥5 s.

## Security
- `JWT_SECRET` is validated at module load in `src/auth/jwt.ts`. Do not add lazy loading.
- All portfolio routes must pass through `requireAuth`. Market routes use `optionalAuth` by design.
- `ownsPortfolio()` must be called before any mutation or sensitive read on a portfolio.
- Input validation via Zod at every route boundary. Never trust `req.params` or `req.query` directly.
- Guest auth is rate-limited to 10 requests/minute per IP. Do not raise this limit without discussion.

## Testing
- Unit tests cover: calculator functions, exchange strategies, prediction model, JWT sign/verify.
- E2E tests cover the full HTTP lifecycle via `app.inject()` — no running server needed.
- All new routes need at least: happy path, auth failure (401), not-found (404 where applicable).
- `MEMORY_MODE=true` + `MARKET_DATA_PROVIDER=mock` for all tests — never hit live APIs in tests.

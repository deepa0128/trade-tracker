---
trigger: glob
glob: ".jetro/refresh/**/*.py"
---

# Refresh Script Rules — Trade Tracker

Rules for Python refresh scripts in `.jetro/refresh/`:

## Output Contract
Scripts MUST always print valid JSON to stdout. A silent exit or non-JSON output kills the refresh pipeline:

```python
try:
    result = fetch_data()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))  # always print something
```

## Dependencies
Use stdlib only (`json`, `urllib.request`, `urllib.parse`). Do NOT import third-party packages — the Jetro sandbox may not have them.

Exception: `jet.market` is always available (import from Jetro's built-in lib path).

## Two-Tier Fallback Pattern (stocks.py)
```python
try:
    print(json.dumps(primary_path()))   # hits localhost:3000
except Exception as primary_err:
    try:
        result = fallback_path()        # uses jet.market.Ticker directly
        result["_fallback_reason"] = str(primary_err)
        print(json.dumps(result))
    except Exception as fallback_err:
        print(json.dumps({"ok": False, "error": str(primary_err)}))
```

## API Quota
- `jet.market.Ticker` is free — use it in high-frequency scripts (< 5 min interval).
- `jet_api()` consumes paid quota — only in scripts with interval ≥ 5 min.
- `http://localhost:3000` is the local backend — no quota, no auth complexity (guest token auto-issued).

## Idempotency
Scripts run repeatedly on a timer. They must NOT:
- Accumulate state between runs (no module-level lists that grow)
- Append to files
- Modify the database (read-only from the canvas side)

## Auth Pattern (for local API calls)
```python
token = post("/api/auth/guest")["token"]   # fresh token each run — stable identity
result = get("/api/portfolios", token)
```
The DEMO_GUEST_ID sub is stable, so guest tokens issued on every run see the same portfolios.

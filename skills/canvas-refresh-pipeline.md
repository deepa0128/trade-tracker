# Skill: Jetro Canvas Refresh Pipeline

Use this skill when debugging why a canvas frame shows a spinner, or when adding a new live frame.

## How the Pipeline Works

```
Timer (intervalMs)
  → Jetro runtime executes: python3 .jetro/refresh/script.py
  → Script prints JSON to stdout
  → Runtime parses JSON → element.data
  → Runtime dispatches: window.dispatchEvent(new CustomEvent('jet:refresh', { detail: data }))
  → Frame HTML: window.addEventListener('jet:refresh', e => render(e.detail))
```

## Common Failure Points

| Symptom | Cause | Fix |
|---|---|---|
| Spinner forever | `document.addEventListener` instead of `window` | Change to `window.addEventListener` |
| Spinner forever | Binding not attached | `jet_canvas bind` for the element |
| Spinner forever | Script crashes silently | Run script manually in `jet_exec`, check stderr |
| Stale data | Script exits 0 but prints nothing | Add `print(json.dumps({...}))` |
| Stale data | Script prints non-JSON | Wrap in try/except, always print valid JSON |

## Attaching a Binding

```python
jet_canvas({
  action: 'bind',
  elementId: 'mcp-xxxx',
  refreshBinding: {
    scriptPath: '.jetro/refresh/portfolio.py',
    intervalMs: 60000,
  }
})
```

**Bindings are not persisted across Jetro sessions.** Re-attach after restart.

## Re-attaching All Bindings (Trade Tracker)

| Element ID | Script | Interval |
|---|---|---|
| `mcp-1779767635559-1` (Portfolio Overview) | `.jetro/refresh/portfolio.py` | 60 000 ms |
| `mcp-1779767702829-2` (Portfolio Holdings) | `.jetro/refresh/portfolio.py` | 60 000 ms |
| `mcp-1779767767534-3` (Price Trends) | `.jetro/refresh/stocks.py` | 60 000 ms |
| `mcp-1779770681576-5` (System Health) | `.jetro/refresh/health.py` | 30 000 ms |
| `mcp-1779770681983-6` (Stock Drill) | `.jetro/refresh/stocks.py` | 60 000 ms |
| `mcp-1779771374389-8` (Developer Options) | `.jetro/refresh/health.py` | 30 000 ms |

After binding, call `jet_canvas trigger` for each element to push data immediately without waiting for the timer.

## Adding a New Frame

1. Write HTML to `.jetro/frames/my-frame.html` — use `window.addEventListener('jet:refresh', ...)`
2. Write script to `.jetro/refresh/my-script.py` — `print(json.dumps({...}))`
3. Render: `jet_render({ type: 'frame', data: { title: '...', file: '.jetro/frames/my-frame.html' } })`
4. Bind: `jet_canvas bind` with the returned element ID
5. Trigger immediately: `jet_canvas trigger`

## Fallback Pattern (stocks.py)

`stocks.py` demonstrates a two-tier fallback:
- Tier 1: local Fastify API (full data — history, predictions, portfolio presence)
- Tier 2: `jet.market.Ticker` — Jetro's built-in NSE/BSE feed (live quotes only, no history)

The output JSON shape is identical in both tiers so the frame doesn't know which tier ran.

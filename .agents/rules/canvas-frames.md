---
trigger: glob
glob: ".jetro/frames/**/*.html"
---

# Canvas Frame Rules — Trade Tracker

When writing or modifying Jetro canvas frames for this project:

## Critical: Event Listener Target
```js
// CORRECT — events are dispatched on window
window.addEventListener('jet:refresh', e => {
  const d = e.detail;  // NOT e.data, NOT e.data.payload
  render(d);
});

// WRONG — will silently receive no events
document.addEventListener('jet:refresh', ...);
```

## Data Contract
The `jet:refresh` event `detail` for each frame:

| Frame | Script | Root shape |
|---|---|---|
| portfolio-overview, portfolio-holdings | `portfolio.py` | `{ ok, snapshots }` |
| stock-drill, price-predictions | `stocks.py` | `{ ok, snapshots, stocks, _source? }` |
| health-monitor, developer-options | `health.py` | `{ ok, health, cache }` |

Always check `if (!d?.ok) return;` before rendering.

## Fallback Awareness
`stocks.py` may set `_source: "jet.market"` when the backend is unreachable. In that case:
- `stocks[ticker].history` will be `[]` (no history available)
- `stocks[ticker].prediction` will be `null`
- `stocks[ticker]._fallback: true` signals reduced data

Show a subtle indicator ("Live data — market mode") when `_source === "jet.market"`.

## Plotly Usage
- CDN `<script src>` tags are auto-shimmed to local Plotly — always use CDN form.
- Use `Plotly.react()` (not `newPlot`) for updates to avoid DOM thrashing.
- Set `paper_bgcolor` and `plot_bgcolor` to `'transparent'` for dark-mode consistency.

## Re-binding After Session Restart
Canvas bindings are NOT persisted across Jetro sessions. After a restart:
1. `jet_canvas bind` each element with its script path
2. `jet_canvas trigger` each element to push data immediately
See `skills/canvas-refresh-pipeline.md` for element IDs and scripts.

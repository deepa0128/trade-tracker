#!/usr/bin/env python3
"""
YFinance data fetcher CLI — called by YFinanceProvider in TypeScript.

Usage:
  python3 scripts/fetch_yfinance.py quote        <ticker>
  python3 scripts/fetch_yfinance.py history      <ticker> <days>
  python3 scripts/fetch_yfinance.py bulk-quotes  <ticker1,ticker2,...>

Outputs JSON to stdout. Any error writes JSON to stderr and exits 1.
"""
from __future__ import annotations

import sys
import json
from datetime import datetime, timezone


def fetch_quote(ticker: str) -> dict:
    import yfinance as yf

    t = yf.Ticker(ticker)
    info = t.fast_info
    hist = t.history(period="2d")

    price = float(info.last_price)
    prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price

    return {
        "ticker": ticker,
        "price": round(price, 2),
        "open": round(float(info.open or price), 2),
        "high": round(float(info.day_high or price), 2),
        "low": round(float(info.day_low or price), 2),
        "previousClose": round(prev_close, 2),
        "change": round(price - prev_close, 2),
        "changePct": round((price - prev_close) / prev_close * 100 if prev_close else 0, 2),
        "volume": int(info.volume or 0),
        "marketCap": float(info.market_cap) if info.market_cap else None,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }


def fetch_history(ticker: str, days: int) -> list[dict]:
    import yfinance as yf

    t = yf.Ticker(ticker)
    hist = t.history(period=f"{days + 10}d")  # fetch a little extra for weekends

    rows = []
    for idx, row in hist.iterrows():
        rows.append(
            {
                "date": str(idx.date()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            }
        )

    return rows[-days:]


def fetch_bulk_quotes(tickers: list[str]) -> dict[str, dict]:
    return {ticker: fetch_quote(ticker) for ticker in tickers}


def main() -> None:
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: fetch_yfinance.py <command> <args...>"}), file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]

    try:
        if cmd == "quote":
            result = fetch_quote(sys.argv[2])
        elif cmd == "history":
            result = fetch_history(sys.argv[2], int(sys.argv[3]))
        elif cmd == "bulk-quotes":
            result = fetch_bulk_quotes(sys.argv[2].split(","))
        else:
            raise ValueError(f"Unknown command: {cmd!r}")

        print(json.dumps(result))

    except Exception as exc:  # noqa: BLE001
        print(
            json.dumps({"error": str(exc), "type": type(exc).__name__}),
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()

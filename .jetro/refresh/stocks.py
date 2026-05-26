"""
Canvas refresh script: Stock Deep Drill + Price Trends frames.

Primary path: fetches data from the local Fastify server (localhost:3000).
Fallback path: when the server is unreachable, uses jet.market.Ticker —
  Jetro's built-in NSE data module (free, no quota, no API key) — to serve
  live quotes directly. Portfolio holdings are reconstructed from the seed
  definitions so the frames stay useful even when the backend is restarting.
"""
import json, urllib.request, urllib.parse

BASE = "http://localhost:3000"

# Seed portfolio definitions mirrored here for fallback mode
SEED_PORTFOLIOS = [
    {
        "id": "tech_growth", "name": "Tech & Growth", "exchange": "NSE",
        "holdings": [
            {"ticker": "TCS.NS",         "name": "TCS",             "sector": "IT",          "shares": 10, "avgCost": 3950},
            {"ticker": "INFY.NS",         "name": "Infosys",         "sector": "IT",          "shares": 20, "avgCost": 1720},
            {"ticker": "HCLTECH.NS",      "name": "HCL Technologies", "sector": "IT",         "shares": 45, "avgCost": 1380},
            {"ticker": "WIPRO.NS",        "name": "Wipro",           "sector": "IT",          "shares": 50, "avgCost": 480},
            {"ticker": "PERSISTENT.NS",   "name": "Persistent",      "sector": "IT",          "shares": 8,  "avgCost": 4800},
            {"ticker": "LTIM.NS",         "name": "LTIMindtree",     "sector": "IT",          "shares": 12, "avgCost": 5200},
        ],
    },
    {
        "id": "blue_chip", "name": "Blue Chip Defensive", "exchange": "BSE",
        "holdings": [
            {"ticker": "RELIANCE.BO",    "name": "Reliance",        "sector": "Energy",      "shares": 15, "avgCost": 2800},
            {"ticker": "HDFCBANK.BO",    "name": "HDFC Bank",       "sector": "Banking",     "shares": 25, "avgCost": 1650},
            {"ticker": "HINDUNILVR.BO",  "name": "HUL",             "sector": "FMCG",        "shares": 18, "avgCost": 2400},
            {"ticker": "ITC.BO",         "name": "ITC",             "sector": "FMCG",        "shares": 80, "avgCost": 420},
            {"ticker": "NESTLEIND.BO",   "name": "Nestle India",    "sector": "FMCG",        "shares": 3,  "avgCost": 22000},
            {"ticker": "TATAMOTORS.BO",  "name": "Tata Motors",     "sector": "Auto",        "shares": 30, "avgCost": 750},
        ],
    },
    {
        "id": "mid_cap", "name": "Mid Cap Opportunities", "exchange": "NSE/BSE",
        "holdings": [
            {"ticker": "ZOMATO.NS",      "name": "Zomato",          "sector": "Consumer Tech", "shares": 200, "avgCost": 185},
            {"ticker": "IRCTC.NS",       "name": "IRCTC",           "sector": "Travel",        "shares": 25,  "avgCost": 780},
            {"ticker": "TATAELXSI.NS",   "name": "Tata Elxsi",      "sector": "IT",            "shares": 10,  "avgCost": 6800},
            {"ticker": "DIXON.NS",       "name": "Dixon Tech",      "sector": "Electronics",   "shares": 8,   "avgCost": 9500},
            {"ticker": "POLYCAB.NS",     "name": "Polycab",         "sector": "Industrials",   "shares": 20,  "avgCost": 5200},
        ],
    },
]


def get(path, token=None):
    req = urllib.request.Request(f"{BASE}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def post(path):
    req = urllib.request.Request(f"{BASE}{path}", data=b"{}", method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read())


def primary_path():
    """Fetch all data from the Fastify backend."""
    token = post("/api/auth/guest")["token"]
    portfolios = get("/api/portfolios", token)
    snapshots  = [get(f"/api/portfolios/{p['id']}/snapshot", token) for p in portfolios]

    tickers = {}
    for snap in snapshots:
        for h in snap["holdings"]:
            if h["ticker"] not in tickers:
                tickers[h["ticker"]] = h["ticker"]

    stocks = {}
    for ticker in tickers:
        try:
            detail = get(f"/api/market/stock/{urllib.parse.quote(ticker)}?days=90&horizon=30", token)
            stocks[ticker] = detail
        except Exception:
            pass

    return {"ok": True, "snapshots": snapshots, "stocks": stocks}


def fallback_path():
    """
    Fallback: use jet.market.Ticker (Jetro's built-in NSE/BSE data) to serve
    live quotes when the local backend is unreachable. Reconstructs snapshots
    from seed portfolio definitions so the canvas frames stay useful.
    """
    from jet.market import Ticker

    snapshots = []
    stocks = {}

    for portfolio in SEED_PORTFOLIOS:
        holdings_out = []
        total_value = 0.0
        total_invested = 0.0
        day_change = 0.0

        for h in portfolio["holdings"]:
            ticker = h["ticker"]
            try:
                t = Ticker(ticker)
                fi = t.fast_info
                ltp   = float(fi.last_price or h["avgCost"])
                prev  = float(fi.previous_close or ltp)
                chg   = ltp - prev
                chg_pct = (chg / prev * 100) if prev else 0.0
            except Exception:
                ltp = float(h["avgCost"])
                chg = 0.0
                chg_pct = 0.0

            current_value  = ltp * h["shares"]
            invested       = h["avgCost"] * h["shares"]
            pnl            = current_value - invested
            pnl_pct        = (pnl / invested * 100) if invested else 0.0
            day_chg_amt    = chg * h["shares"]

            total_value    += current_value
            total_invested += invested
            day_change     += day_chg_amt

            holdings_out.append({
                "ticker":       ticker,
                "name":         h["name"],
                "sector":       h["sector"],
                "shares":       h["shares"],
                "avgCost":      h["avgCost"],
                "ltp":          round(ltp, 2),
                "currentValue": round(current_value, 2),
                "invested":     round(invested, 2),
                "pnl":          round(pnl, 2),
                "pnlPct":       round(pnl_pct, 2),
                "weight":       0.0,  # patched below
                "dayChange":    round(day_chg_amt, 2),
                "dayChangePct": round(chg_pct, 2),
            })

            stocks[ticker] = {
                "quote": {
                    "ticker": ticker, "price": round(ltp, 2),
                    "open": ltp, "high": ltp, "low": ltp,
                    "previousClose": round(prev, 2) if "prev" in dir() else ltp,
                    "change": round(chg, 2), "changePct": round(chg_pct, 2),
                    "volume": 0, "fetchedAt": "",
                },
                "history": [], "prediction": None, "portfolioPresence": None,
                "_fallback": True,
            }

        # patch weights
        for h in holdings_out:
            h["weight"] = round(h["currentValue"] / total_value * 100, 2) if total_value else 0.0

        total_pnl     = total_value - total_invested
        total_pnl_pct = (total_pnl / total_invested * 100) if total_invested else 0.0
        day_chg_pct   = (day_change / (total_value - day_change) * 100) if (total_value - day_change) else 0.0

        snapshots.append({
            "id":       portfolio["id"],
            "name":     portfolio["name"],
            "exchange": portfolio["exchange"],
            "holdings": holdings_out,
            "summary": {
                "holdingCount":  len(holdings_out),
                "totalValue":    round(total_value, 2),
                "totalInvested": round(total_invested, 2),
                "totalPnL":      round(total_pnl, 2),
                "totalPnLPct":   round(total_pnl_pct, 2),
                "dayChange":     round(day_change, 2),
                "dayChangePct":  round(day_chg_pct, 2),
            },
        })

    return {"ok": True, "snapshots": snapshots, "stocks": stocks, "_source": "jet.market"}


try:
    print(json.dumps(primary_path()))
except Exception as primary_err:
    try:
        result = fallback_path()
        result["_fallback_reason"] = str(primary_err)
        print(json.dumps(result))
    except Exception as fallback_err:
        print(json.dumps({"ok": False, "error": str(primary_err), "fallback_error": str(fallback_err)}))

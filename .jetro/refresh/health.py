"""
Canvas refresh script: System Health Monitor frame.

Primary path: fetches /api/health and /api/health/cache from the local server.
Fallback path: when the server is unreachable, emits a structured health response
  with all components marked "down" so the frame renders a clear offline state
  instead of showing raw error text. Includes _offline flag for the UI indicator.
"""
import json, urllib.request
from datetime import datetime, timezone

BASE = "http://localhost:3000"


def get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=3) as r:
        return json.loads(r.read())


def primary_path():
    health = get("/api/health")
    cache  = get("/api/health/cache")
    return {"ok": True, "health": health, "cache": cache}


def offline_state(reason):
    """Structured 'all-down' health response so the frame renders cleanly."""
    return {
        "ok": True,
        "health": {
            "status":    "down",
            "uptime":    0,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "components": {
                "database": {"status": "down", "message": "server offline", "latencyMs": None},
                "provider": {"status": "down", "message": "server offline", "latencyMs": None},
                "cache":    {"status": "down", "message": "server offline"},
            },
        },
        "cache": {"entries": []},
        "_offline": True,
        "_offline_reason": reason,
    }


try:
    print(json.dumps(primary_path()))
except Exception as e:
    print(json.dumps(offline_state(str(e))))

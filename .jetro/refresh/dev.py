"""
Canvas refresh script: Developer Options frame.

Fetches the full diagnostic snapshot from the local Fastify backend and
packages it into a single payload for the jet:refresh event.
Fallback: emits a minimal offline payload so the frame renders cleanly.
"""
import json, urllib.request

BASE = "http://localhost:3000"


def get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=3) as r:
        return json.loads(r.read())


try:
    dev    = get("/api/dev")
    logs   = get("/api/dev/logs")
    prov   = get("/api/dev/provider")
    routes = get("/api/dev/routes")
    print(json.dumps({
        "ok":        True,
        "dev":       dev,
        "logs":      logs.get("logs", []),
        "provider":  prov,
        "rawRoutes": routes.get("routes", ""),
    }))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))

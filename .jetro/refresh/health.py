import json, urllib.request

BASE = "http://localhost:3000"

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=8) as r:
        return json.loads(r.read())

try:
    health = get("/api/health")
    cache  = get("/api/health/cache")
    print(json.dumps({"ok": True, "health": health, "cache": cache}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))

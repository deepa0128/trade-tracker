import json, urllib.request, urllib.error

BASE = "http://localhost:3000"

def get(path, token=None):
    req = urllib.request.Request(f"{BASE}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read())

def post(path):
    req = urllib.request.Request(f"{BASE}{path}", data=b"{}", method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read())

try:
    token = post("/api/auth/guest")["token"]
    portfolios = get("/api/portfolios", token)
    snapshots = [get(f"/api/portfolios/{p['id']}/snapshot", token) for p in portfolios]
    print(json.dumps({"ok": True, "snapshots": snapshots}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))

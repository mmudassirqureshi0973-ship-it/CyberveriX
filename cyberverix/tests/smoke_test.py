"""
CyberVeriX end to end smoke test.

Start the server first, then run this file:

    python backend/app.py --reset --port 8000
    python tests/smoke_test.py

It registers throwaway accounts, so run it against a scratch database.
"""
import json, urllib.request, urllib.error, sys, time
import os
BASE = os.environ.get("CVX_BASE", "http://127.0.0.1:8000")
def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw[:200]

fails = []
def check(label, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + label + ("" if cond else "  -> " + str(extra)[:400]))
    if not cond: fails.append(label)

s, r = call("GET", "/api/health"); check("health", s == 200 and r["challenges"] == 7, r)
s, r = call("GET", "/api/profile"); check("profile requires auth", s == 401, (s, r))
s, r = call("POST", "/api/register", {"full_name": "A", "email": "bad", "password": "abc"})
check("register validation", s == 400 and len(r["details"]) >= 3, r)
s, r = call("POST", "/api/register", {"full_name": "Test Student", "email": "t1@lab.local", "password": "Passw0rd!"})
check("register ok", s == 201 and r["token"], r)
tok = r.get("token")
s, r = call("POST", "/api/register", {"full_name": "Test Student", "email": "t1@lab.local", "password": "Passw0rd!"})
check("duplicate email blocked", s == 409, r)
s, r = call("POST", "/api/login", {"email": "t1@lab.local", "password": "wrong"}); check("bad login rejected", s == 401, r)
s, r = call("POST", "/api/login", {"email": "T1@LAB.LOCAL", "password": "Passw0rd!"}); check("login case-insensitive", s == 200, r)
tok = r["token"]
s, r = call("GET", "/api/me", token=tok); check("me", s == 200 and r["user"]["email"] == "t1@lab.local", r)
s, r = call("GET", "/api/challenges", token=tok)
check("challenge list", s == 200 and len(r["challenges"]) == 7, r)
check("recommended present", bool(r.get("recommended")), r.get("recommended"))
cats = {c["category"] for c in r["challenges"]}
check("all 6 categories covered", cats == {"network","web","soc","windows","incident","fundamentals"}, cats)
s, r = call("GET", "/api/challenges/net-recon-01", token=tok)
check("challenge detail", s == 200 and len(r["challenge"]["questions"]) == 5, r)
blob = json.dumps(r["challenge"])
check("no answer keys leaked", '"correct"' not in blob and '"concepts"' not in blob and '"explanation"' not in blob, blob[:200])
s, r = call("GET", "/api/challenges/nope", token=tok); check("unknown challenge 404", s == 404, r)
s, r = call("POST", "/api/challenges/net-recon-01/submit", {"answers": {}}, token=tok)
check("empty submit rejected", s == 400, r)
# perfect submission
perfect = {"q1": ["o22","o23","o80","o445","o3306"], "q2": "a23",
 "q3": "Telnet is cleartext so an attacker can sniff the password credentials, we should disable it and use ssh",
 "q4": "b2", "q5": "Check each version for known CVE entries then patch and upgrade the packages"}
s, r = call("POST", "/api/challenges/net-recon-01/submit", {"answers": perfect}, token=tok)
check("perfect submit = 100%", s == 201 and r["result"]["percent"] == 100.0, r.get("result", r))
check("feedback generated", len(r["result"]["feedback"]) > 40, r["result"].get("feedback"))
check("next challenge suggested", r["result"]["next_challenge"]["id"] != "net-recon-01", r["result"]["next_challenge"])
aid = r["result"]["attempt_id"]
# partial submission
partial = {"q1": ["o22","o23","o21"], "q2": "a80", "q3": "telnet bad", "q5": "patch it"}
s, r = call("POST", "/api/challenges/net-recon-01/submit", {"answers": partial}, token=tok)
check("partial credit works", s == 201 and 0 < r["result"]["percent"] < 100, r.get("result", r))
s, r = call("GET", "/api/profile", token=tok)
p = r["profile"]
check("best attempt kept after worse retry", p["categories"][0]["percent"] == 100.0, p["categories"][0])
check("attempts logged = 2", p["attempts_logged"] == 2, p["attempts_logged"])
check("readiness gated", p["readiness"]["eligible"] is False, p["readiness"])
# classify + injection-ish payloads
s, r = call("GET", "/api/challenges/soc-triage-01", token=tok)
q = r["challenge"]["questions"][0]
cls = {"a1": "benign", "a2": "incident", "a3": "suspicious", "a4": "suspicious", "a5": "suspicious", "a6": "incident"}
s, r = call("POST", "/api/challenges/soc-triage-01/submit", {"answers": {"q1": cls, "q2": "'; DROP TABLE users; --", "q4": "impact and asset criticality plus detection confidence matter here"}}, token=tok)
check("classify partial credit", s == 201 and 0 < r["result"]["questions"][0]["earned"] < 12, r["result"]["questions"][0] if s == 201 else r)
check("sql-ish text answer stored safely", s == 201, r)
s, r = call("GET", "/api/health"); check("db intact after payload", s == 200 and r["challenges"] == 7, r)
# junk / hostile input
s, r = call("POST", "/api/challenges/net-recon-01/submit", {"answers": {"q1": "not-a-list", "q2": ["x"], "q3": 12345, "q4": "b2"}}, token=tok)
check("malformed answer types survive", s == 201, r)
s, r = call("GET", "/api/attempts/%d" % aid, token=tok); check("attempt replay", s == 200 and r["result"]["percent"] == 100.0, r)
s, r = call("GET", "/api/attempts/999999", token=tok); check("other attempt 404", s == 404, r)
s, r = call("GET", "/api/report", token=tok); check("report", s == 200 and r["report"]["disclaimer"], r)
s, r = call("POST", "/api/logout", token=tok); check("logout", s == 200, r)
s, r = call("GET", "/api/me", token=tok); check("token dead after logout", s == 401, r)
# demo account
s, r = call("POST", "/api/login", {"email": "student@cyberverix.local", "password": "Cyber@1234"})
check("demo login", s == 200, r)
dtok = r.get("token")
s, r = call("GET", "/api/profile", token=dtok)
check("demo has seeded attempts", s == 200 and r["profile"]["challenges_completed"] == 3, r.get("profile", {}).get("challenges_completed"))
print("\nDEMO overall:", r["profile"]["overall_score"], r["profile"]["overall_level"], "| readiness:", r["profile"]["readiness"]["band"])
print("DEMO feedback:", r["profile"]["feedback"])
print("\n%d failures" % len(fails))
sys.exit(1 if fails else 0)

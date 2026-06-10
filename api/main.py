#!/usr/bin/env python3
"""
Team Behavior Ranking API — serves the dashboard's data live from PostgreSQL.

Reuses scripts/agg_core.py (the exact, validated aggregation), so the numbers match the
Excel pipeline. The PostgreSQL table mirrors the MATELINE export (same column names).

Endpoints:
  GET  /healthz               liveness + DB check
  GET  /api/data              {months, records, behaviors, dims, meta}  (same shape as data.json)
  GET  /api/detail/{month}    dictionary-encoded per-WO rows for that month
  POST /api/refresh           force a cache rebuild

Config via env: PG_HOST PG_PORT PG_DB PG_USER PG_PASSWORD PG_TABLE MONTH_SQL CACHE_TTL
"""

import datetime
import json
import os
import sys
import threading
import time

import io

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import psycopg
from psycopg.rows import dict_row

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts"))
sys.path.insert(0, "/app/scripts")
import agg_core  # noqa: E402
import import_spec  # noqa: E402

# Map the MATELINE names agg_core expects -> the actual DB columns (snake_case here).
# The SQL aliases each DB column back to the expected name, so agg_core is unchanged.
# Override via COLMAP_JSON env if any column name differs from these guesses.
DEFAULT_COLMAP = {
    "Team": "team", "Source Ticket ID": "source_ticket_id", "Province": "province",
    "Region": "region", "Skill": "skill", "Status": "status", "WO Creator": "wo_creator",
    "Complete Solution": "complete_solution", "Severity": "severity", "Work Type": "work_type",
    "Root Cause": "root_cause", "SLA": "sla", "Site ID": "site_id",
}
try:
    COLMAP = json.loads(os.environ["COLMAP_JSON"]) if os.environ.get("COLMAP_JSON") else DEFAULT_COLMAP
except Exception:
    COLMAP = DEFAULT_COLMAP

PG = dict(
    host=os.environ.get("PG_HOST", "localhost"),
    port=os.environ.get("PG_PORT", "5432"),
    dbname=os.environ.get("PG_DB", "postgres"),
    user=os.environ.get("PG_USER", "postgres"),
    password=os.environ.get("PG_PASSWORD", ""),
)
TABLE = os.environ.get("PG_TABLE", "mateline")
# How to derive the YYYY-MM bucket for each row. Override if the month lives in another
# column (e.g. left("Closed",7), or to_char("Created Time",'YYYY-MM')).
MONTH_SQL = os.environ.get("MONTH_SQL", "to_char(closed, 'YYYY-MM')")
TTL = float(os.environ.get("CACHE_TTL", "600"))

app = FastAPI(title="Team Behavior Ranking API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ============================================================ Auth (login + roles)
import hashlib
import hmac
import base64

AUTH_SECRET = os.environ.get("AUTH_SECRET", "tt-dashboard-dev-secret-change-me").encode()
TOKEN_TTL = int(os.environ.get("AUTH_TTL", str(8 * 3600)))   # 8 hours
USERS_TABLE = "app_users"
ROLES = ("admin", "viewer")
# anything under /api/ needs a valid token except these; these prefixes additionally need role=admin
_PUBLIC_PATHS = {"/healthz", "/api/auth/login"}
_ADMIN_PREFIXES = ("/api/import", "/api/refresh", "/api/users")


def _b64(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _ub64(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_pw(pw, salt=None):
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
    return salt.hex(), dk.hex()


def verify_pw(pw, salt_hex, hash_hex):
    try:
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt_hex), 200_000)
    except ValueError:
        return False
    return hmac.compare_digest(dk.hex(), hash_hex)


def make_token(username, role, ttl=TOKEN_TTL):
    payload = {"sub": username, "role": role, "exp": int(time.time()) + ttl}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(AUTH_SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_token(tok):
    try:
        body, sig = tok.split(".", 1)
        expect = _b64(hmac.new(AUTH_SECRET, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expect):
            return None
        payload = json.loads(_ub64(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def _bearer(request):
    h = request.headers.get("authorization", "")
    return h[7:].strip() if h.lower().startswith("bearer ") else ""


def _ensure_users():
    """Create the users table and seed the default admin + viewer accounts (once)."""
    admin_pw = os.environ.get("AUTH_ADMIN_PW", "admin1234")
    viewer_pw = os.environ.get("AUTH_VIEWER_PW", "viewer1234")
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(f"CREATE TABLE IF NOT EXISTS {USERS_TABLE} "
                    "(username text PRIMARY KEY, salt text, pw_hash text, role text, created_at timestamptz DEFAULT now())")
        cur.execute(f"SELECT count(*) n FROM {USERS_TABLE}")
        if cur.fetchone()["n"] == 0:
            for uname, pw, role in (("admin", admin_pw, "admin"), ("viewer", viewer_pw, "viewer")):
                s, h = hash_pw(pw)
                cur.execute(f"INSERT INTO {USERS_TABLE} (username, salt, pw_hash, role) VALUES (%s,%s,%s,%s)", (uname, s, h, role))
        conn.commit()


@app.middleware("http")
async def auth_and_no_store(request, call_next):
    path = request.url.path
    if request.method != "OPTIONS" and path.startswith("/api/") and path not in _PUBLIC_PATHS:
        claims = verify_token(_bearer(request))
        if not claims:
            return JSONResponse({"detail": "unauthorized"}, status_code=401)
        if any(path.startswith(p) for p in _ADMIN_PREFIXES) and claims.get("role") != "admin":
            return JSONResponse({"detail": "forbidden — admin only"}, status_code=403)
        request.state.user = claims
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store"   # live data must never be browser-cached
    return resp


@app.on_event("startup")
def _startup():
    try:
        _ensure_users()
    except Exception as e:  # DB may briefly be unready; login will seed on first use
        print(f"user seed deferred: {e}", flush=True)


@app.post("/api/auth/login")
async def auth_login(payload: dict):
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    if not username or not password:
        raise HTTPException(400, "กรอกชื่อผู้ใช้และรหัสผ่าน")
    try:
        _ensure_users()
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT username, salt, pw_hash, role FROM {USERS_TABLE} WHERE username=%s", (username,))
            u = cur.fetchone()
    except Exception as e:
        raise HTTPException(503, f"login failed: {e}")
    if not u or not verify_pw(password, u["salt"], u["pw_hash"]):
        raise HTTPException(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
    return {"token": make_token(u["username"], u["role"]), "user": {"username": u["username"], "role": u["role"]}}


@app.get("/api/auth/me")
async def auth_me(request: Request):
    u = getattr(request.state, "user", None)
    if not u:
        raise HTTPException(401, "unauthorized")
    return {"username": u["sub"], "role": u["role"]}


# ---- user management (admin only; guarded by the middleware prefix) ----
@app.get("/api/users")
def users_list():
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT username, role, created_at FROM {USERS_TABLE} ORDER BY role, username")
        return {"users": [{"username": r["username"], "role": r["role"],
                           "created_at": r["created_at"].isoformat() if r["created_at"] else None} for r in cur.fetchall()]}


@app.post("/api/users")
def users_create(payload: dict):
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    role = payload.get("role") or "viewer"
    if not username or not password:
        raise HTTPException(400, "กรอกชื่อผู้ใช้และรหัสผ่าน")
    if role not in ROLES:
        raise HTTPException(400, "role ไม่ถูกต้อง")
    s, h = hash_pw(password)
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(f"INSERT INTO {USERS_TABLE} (username, salt, pw_hash, role) VALUES (%s,%s,%s,%s)", (username, s, h, role))
            conn.commit()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "มีชื่อผู้ใช้นี้แล้ว")
    return {"ok": True, "username": username, "role": role}


@app.patch("/api/users/{username}")
def users_update(username: str, payload: dict):
    role = payload.get("role")
    password = payload.get("password")
    if role is not None and role not in ROLES:
        raise HTTPException(400, "role ไม่ถูกต้อง")
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT role FROM {USERS_TABLE} WHERE username=%s", (username,))
        cur_row = cur.fetchone()
        if not cur_row:
            raise HTTPException(404, "ไม่พบผู้ใช้")
        # never demote the last admin
        if role == "viewer" and cur_row["role"] == "admin":
            cur.execute(f"SELECT count(*) n FROM {USERS_TABLE} WHERE role='admin'")
            if cur.fetchone()["n"] <= 1:
                raise HTTPException(400, "ต้องมี admin อย่างน้อย 1 คน")
        if role is not None:
            cur.execute(f"UPDATE {USERS_TABLE} SET role=%s WHERE username=%s", (role, username))
        if password:
            s, h = hash_pw(password)
            cur.execute(f"UPDATE {USERS_TABLE} SET salt=%s, pw_hash=%s WHERE username=%s", (s, h, username))
        conn.commit()
    return {"ok": True}


@app.delete("/api/users/{username}")
def users_delete(username: str, request: Request):
    me = getattr(request.state, "user", {}).get("sub")
    if username == me:
        raise HTTPException(400, "ลบบัญชีตัวเองไม่ได้")
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT role FROM {USERS_TABLE} WHERE username=%s", (username,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "ไม่พบผู้ใช้")
        if row["role"] == "admin":
            cur.execute(f"SELECT count(*) n FROM {USERS_TABLE} WHERE role='admin'")
            if cur.fetchone()["n"] <= 1:
                raise HTTPException(400, "ต้องมี admin อย่างน้อย 1 คน")
        cur.execute(f"DELETE FROM {USERS_TABLE} WHERE username=%s", (username,))
        conn.commit()
    return {"ok": True}


_lock = threading.Lock()
_cache = {"built_at": 0.0, "data": None, "detail": {}}


def _connect():
    return psycopg.connect(**PG, connect_timeout=10, row_factory=dict_row)


def _rebuild():
    sel = ", ".join(f'{db} AS "{name}"' for name, db in COLMAP.items())
    sql = f'SELECT {sel}, ({MONTH_SQL}) AS "_month" FROM {TABLE} ORDER BY ({MONTH_SQL})'
    all_records, months, detail, sources, total_wo = [], [], {}, [], 0

    def flush(month, rows):
        nonlocal total_wo
        recs, det = agg_core.aggregate_month(rows, month, has_site=True)
        all_records.extend(recs)
        months.append(month)
        detail[month] = agg_core.encode_detail(month, det)
        wo = sum(r["wo"] for r in recs)
        total_wo += wo
        sources.append({"file": month, "month": month, "teams": len(recs),
                        "wo": wo, "tickets": sum(r["tickets"] for r in recs)})

    with _connect() as conn:
        with conn.cursor(name="ttstream") as cur:   # server-side cursor: stream, don't buffer 800k rows
            cur.itersize = 20000
            cur.execute(sql)
            cur_month, buf = None, []
            for row in cur:
                m = row.get("_month")
                if m is None:
                    continue
                if m != cur_month:
                    if buf:
                        flush(cur_month, buf)
                        buf = []
                    cur_month = m
                buf.append(row)
            if buf:
                flush(cur_month, buf)

    months = sorted(set(months))
    sources.sort(key=lambda s: s["month"])
    data = {
        "months": months, "records": all_records, "behaviors": agg_core.BEHAVIORS,
        "dims": agg_core.build_dims(all_records),
        "meta": {
            "generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source_system": "PostgreSQL (live query)", "src": TABLE,
            "total_files": len(months), "total_records": len(all_records),
            "total_wo": total_wo, "sources": sources,
        },
    }
    _cache.update(built_at=time.monotonic(), data=data, detail=detail)


def _ensure():
    if _cache["data"] is not None and time.monotonic() - _cache["built_at"] <= TTL:
        return
    with _lock:
        if _cache["data"] is not None and time.monotonic() - _cache["built_at"] <= TTL:
            return
        _rebuild()


@app.get("/healthz")
def healthz():
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(503, f"db unavailable: {e}")


@app.get("/api/data")
def api_data():
    try:
        _ensure()
    except Exception as e:
        raise HTTPException(503, f"build failed: {e}")
    return JSONResponse(_cache["data"])


@app.get("/api/detail/{month}")
def api_detail(month: str):
    try:
        _ensure()
    except Exception as e:
        raise HTTPException(503, f"build failed: {e}")
    d = _cache["detail"].get(month)
    if not d:
        raise HTTPException(404, f"no detail for month {month}")
    return JSONResponse(d)


@app.post("/api/refresh")
def api_refresh():
    with _lock:
        _rebuild()
    return {"ok": True, "months": _cache["data"]["months"], "records": len(_cache["data"]["records"])}


@app.get("/api/pdtpoint")
def pdtpoint(months: str = "", weeks: str = "", status: str = "", region: str = "", skill: str = "", province: str = ""):
    """PDT & Point detection. Panels 1-2 from work_load; panels 3-4 from mateline_ticket_closed.
    Thresholds: PDT/Day(AVG) fail = OFC<2.7, NODE<3.5 (OFC-L2 excluded); Man Hour/Day fail = <9;
    Point/Day over standard = >13. Everything ranked worst-first."""
    nm = agg_core.parse_name
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT DISTINCT source_month m FROM work_load WHERE source_month IS NOT NULL ORDER BY 1")
            allmonths = [r["m"] for r in cur.fetchall()]
            sel = [m for m in months.split(",") if m in allmonths]
            if not sel:
                sel = allmonths[-1:]
            cur.execute("SELECT w FROM (SELECT DISTINCT flag_wk w FROM work_load "
                        "WHERE source_month = ANY(%s) AND flag_wk IS NOT NULL) t "
                        "ORDER BY nullif(regexp_replace(w, '\\D', '', 'g'), '')::int", (sel,))
            allweeks = [r["w"] for r in cur.fetchall()]
            wsel = [w for w in weeks.split(",") if w in allweeks]

            def dist(col):
                cur.execute(f"SELECT DISTINCT {col} c FROM work_load WHERE {col} IS NOT NULL ORDER BY 1")
                return [r["c"] for r in cur.fetchall()]
            opts = {"months": allmonths, "weeks": allweeks, "statuses": dist("status_team"),
                    "regions": dist("region"), "skills": dist("skill"), "provinces": dist("province")}

            params = {"ms": sel, "wl": wsel, "wlen": len(wsel), "s": status, "r": region, "k": skill, "p": province}
            cur.execute("""
                SELECT team, max(region) region, max(province) province, max(skill) skill, max(manager) manager,
                       avg(pdt_day_avg) pdt, avg(man_hour_day) mhd, count(*) days
                FROM work_load
                WHERE source_month = ANY(%(ms)s)
                  AND (%(wlen)s = 0 OR flag_wk = ANY(%(wl)s)) AND (%(s)s='' OR status_team=%(s)s)
                  AND (%(r)s='' OR region=%(r)s) AND (%(k)s='' OR skill=%(k)s)
                  AND (%(p)s='' OR province=%(p)s) AND skill IN ('OFC','NODE')
                GROUP BY team
            """, params)
            wl = cur.fetchall()
            wlmap = {r["team"]: r for r in wl}
            thr = lambda sk: 2.7 if sk == "OFC" else 3.5

            def base(r):
                return {"team": r["team"], "name": nm(r["team"]), "region": r["region"],
                        "province": r["province"], "skill": r["skill"], "manager": r["manager"], "days": r["days"]}
            panel1 = sorted([{**base(r), "pdt": round(r["pdt"], 3), "threshold": thr(r["skill"])}
                             for r in wl if r["pdt"] is not None and r["pdt"] < thr(r["skill"])], key=lambda x: x["pdt"])
            panel2 = sorted([{**base(r), "mhd": round(r["mhd"], 3)}
                             for r in wl if r["mhd"] is not None and r["mhd"] < 9], key=lambda x: x["mhd"])
            both = list(set(x["team"] for x in panel1) & set(x["team"] for x in panel2))

            # per-team weekly series for the row sparklines (panels 1 & 2)
            sp_pdt, sp_mhd = {}, {}
            cur.execute("""SELECT team, source_month, flag_wk, avg(pdt_day_avg) pdt, avg(man_hour_day) mhd
                FROM work_load
                WHERE source_month = ANY(%(ms)s)
                  AND (%(wlen)s = 0 OR flag_wk = ANY(%(wl)s)) AND (%(s)s='' OR status_team=%(s)s)
                  AND (%(r)s='' OR region=%(r)s) AND (%(k)s='' OR skill=%(k)s)
                  AND (%(p)s='' OR province=%(p)s) AND skill IN ('OFC','NODE')
                GROUP BY team, source_month, flag_wk
                ORDER BY team, source_month, nullif(regexp_replace(flag_wk, '\\D', '', 'g'), '')::int""", params)
            for r in cur.fetchall():
                sp_pdt.setdefault(r["team"], []).append(round(r["pdt"], 3) if r["pdt"] is not None else None)
                sp_mhd.setdefault(r["team"], []).append(round(r["mhd"], 3) if r["mhd"] is not None else None)
            for row in panel1:
                row["spark"] = sp_pdt.get(row["team"], [])
            for row in panel2:
                row["spark"] = sp_mhd.get(row["team"], [])

            panel3, panel4 = [], []
            yrs = sorted({int(m[:4]) for m in sel if m[:4].isdigit()})
            wknums = sorted({int(w[2:]) for w in wsel if w.upper().startswith("WK") and w[2:].isdigit()})
            if wknums and yrs:
                if both:
                    cur.execute("""SELECT team, avg(t) fa, count(*) days FROM (
                        SELECT team, extract(epoch from min(arrived)::time) t FROM mateline_ticket_closed
                        WHERE team = ANY(%(t)s) AND arrived IS NOT NULL
                          AND extract(week from arrived)=ANY(%(wks)s) AND extract(isoyear from arrived)=ANY(%(yrs)s)
                        GROUP BY team, date(arrived)) x GROUP BY team""", {"t": both, "wks": wknums, "yrs": yrs})
                    arr = {r["team"]: r for r in cur.fetchall()}
                    cur.execute("""SELECT team, avg(t) lc FROM (
                        SELECT team, extract(epoch from max(completed)::time) t FROM mateline_ticket_closed
                        WHERE team = ANY(%(t)s) AND completed IS NOT NULL
                          AND extract(week from completed)=ANY(%(wks)s) AND extract(isoyear from completed)=ANY(%(yrs)s)
                        GROUP BY team, date(completed)) y GROUP BY team""", {"t": both, "wks": wknums, "yrs": yrs})
                    comp = {r["team"]: r for r in cur.fetchall()}

                    # per-team weekly working-span series (panel 3 sparkline)
                    cur.execute("""SELECT team, yr, wk, avg(span) span FROM (
                        SELECT team, extract(isoyear from arrived) yr, extract(week from arrived) wk, date(arrived) d,
                               extract(epoch from (max(completed) - min(arrived)))/3600 span
                        FROM mateline_ticket_closed
                        WHERE team = ANY(%(t)s) AND arrived IS NOT NULL AND completed IS NOT NULL
                          AND extract(week from arrived)=ANY(%(wks)s) AND extract(isoyear from arrived)=ANY(%(yrs)s)
                        GROUP BY team, yr, wk, date(arrived)) x
                        GROUP BY team, yr, wk ORDER BY team, yr, wk""", {"t": both, "wks": wknums, "yrs": yrs})
                    sp_hrs = {}
                    for r in cur.fetchall():
                        sp_hrs.setdefault(r["team"], []).append(round(r["span"], 2) if r["span"] is not None else None)

                    def hhmm(sec):
                        if sec is None:
                            return None
                        sec = int(sec)
                        return f"{sec // 3600:02d}:{(sec % 3600) // 60:02d}"
                    for t in both:
                        a, c = arr.get(t), comp.get(t)
                        fa = a["fa"] if a else None
                        lc = c["lc"] if c else None
                        hrs = round((lc - fa) / 3600, 2) if (fa is not None and lc is not None) else None
                        w = wlmap[t]
                        panel3.append({"team": t, "name": nm(t), "skill": w["skill"], "region": w["region"], "province": w["province"],
                                       "first_arrive": hhmm(fa), "last_complete": hhmm(lc), "hours": hrs, "days": a["days"] if a else 0,
                                       "spark": sp_hrs.get(t, [])})
                    panel3.sort(key=lambda x: (x["hours"] is None, -(x["hours"] or 0)))

                fteams = list(wlmap.keys())
                if fteams:
                    cur.execute("""SELECT team, sum(point) pts, count(distinct date(completed)) days,
                          mode() WITHIN GROUP (ORDER BY work_type) top_work
                        FROM mateline_ticket_closed
                        WHERE team = ANY(%(t)s) AND completed IS NOT NULL AND point IS NOT NULL
                          AND extract(week from completed)=ANY(%(wks)s) AND extract(isoyear from completed)=ANY(%(yrs)s)
                        GROUP BY team""", {"t": fteams, "wks": wknums, "yrs": yrs})
                    p4rows = cur.fetchall()
                    # per-team weekly point/day series (panel 4 sparkline)
                    cur.execute("""SELECT team, yr, wk, sum(point)/nullif(count(DISTINCT d), 0) ppd FROM (
                        SELECT team, extract(isoyear from completed) yr, extract(week from completed) wk, date(completed) d, point
                        FROM mateline_ticket_closed
                        WHERE team = ANY(%(t)s) AND completed IS NOT NULL AND point IS NOT NULL
                          AND extract(week from completed)=ANY(%(wks)s) AND extract(isoyear from completed)=ANY(%(yrs)s)) z
                        GROUP BY team, yr, wk ORDER BY team, yr, wk""", {"t": fteams, "wks": wknums, "yrs": yrs})
                    sp_ppd = {}
                    for r in cur.fetchall():
                        sp_ppd.setdefault(r["team"], []).append(round(r["ppd"], 2) if r["ppd"] is not None else None)
                    for r in p4rows:
                        days = r["days"] or 0
                        ppd = (r["pts"] / days) if (days and r["pts"] is not None) else None
                        if ppd is not None and ppd > 13:
                            w = wlmap[r["team"]]
                            panel4.append({"team": r["team"], "name": nm(r["team"]), "skill": w["skill"], "region": w["region"],
                                           "province": w["province"], "point_per_day": round(ppd, 2), "days": days, "top_work": r["top_work"],
                                           "spark": sp_ppd.get(r["team"], [])})
                    panel4.sort(key=lambda x: -x["point_per_day"])

            # weekly trend across the selected months (ignores the week filter) — past -> present
            cur.execute("""SELECT source_month, flag_wk, avg(pdt_day_avg) pdt, avg(man_hour_day) mhd, count(DISTINCT team) teams
                FROM work_load
                WHERE source_month = ANY(%(ms)s) AND skill IN ('OFC','NODE')
                  AND (%(s)s='' OR status_team=%(s)s) AND (%(r)s='' OR region=%(r)s)
                  AND (%(k)s='' OR skill=%(k)s) AND (%(p)s='' OR province=%(p)s)
                GROUP BY source_month, flag_wk
                ORDER BY source_month, nullif(regexp_replace(flag_wk, '\\D', '', 'g'), '')::int""", params)
            trend = [{"month": r["source_month"], "wk": r["flag_wk"], "label": f'{r["source_month"][2:]} {r["flag_wk"]}',
                      "pdt": round(r["pdt"], 2) if r["pdt"] is not None else None,
                      "mhd": round(r["mhd"], 2) if r["mhd"] is not None else None, "teams": r["teams"]}
                     for r in cur.fetchall()]

        return {"selected": {"months": sel, "weeks": wsel, "status": status, "region": region, "skill": skill, "province": province},
                "options": opts, "panel1": panel1, "panel2": panel2, "panel3": panel3, "panel4": panel4, "trend": trend,
                "counts": {"teams": len(wl), "p1": len(panel1), "p2": len(panel2), "both": len(both), "p4": len(panel4)}}
    except Exception as e:
        raise HTTPException(503, f"pdtpoint failed: {e}")


@app.get("/api/pdtdetail")
def pdtdetail(team: str, panel: int, months: str = "", weeks: str = ""):
    """Why did this team fail the chosen PDT & Point condition? Returns the team's averages
    vs thresholds plus the day-by-day evidence behind the verdict.
    panel 1=PDT/Day baseline, 2=Man Hour/Day<9, 3=working hours (both), 4=Point/Day>13."""
    nm = agg_core.parse_name
    rnd = lambda v, n=2: round(v, n) if v is not None else None
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT DISTINCT source_month m FROM work_load WHERE source_month IS NOT NULL ORDER BY 1")
            allmonths = [r["m"] for r in cur.fetchall()]
            sel = [m for m in months.split(",") if m in allmonths] or allmonths[-1:]
            cur.execute("SELECT w FROM (SELECT DISTINCT flag_wk w FROM work_load "
                        "WHERE source_month = ANY(%s) AND flag_wk IS NOT NULL) t "
                        "ORDER BY nullif(regexp_replace(w, '\\D', '', 'g'), '')::int", (sel,))
            allweeks = [r["w"] for r in cur.fetchall()]
            wsel = [w for w in weeks.split(",") if w in allweeks]
            wknums = sorted({int(w[2:]) for w in wsel if w.upper().startswith("WK") and w[2:].isdigit()})
            yrs = sorted({int(m[:4]) for m in sel if m[:4].isdigit()})

            wp = {"t": team, "ms": sel, "wl": wsel, "wlen": len(wsel)}
            cur.execute("""SELECT max(region) region, max(province) province, max(skill) skill, max(manager) manager,
                              avg(pdt_day_avg) pdt, avg(man_hour_day) mhd, sum(man_hour) man_hour,
                              avg(work_days) work_days, count(*) days
                           FROM work_load
                           WHERE team=%(t)s AND source_month=ANY(%(ms)s)
                             AND (%(wlen)s=0 OR flag_wk=ANY(%(wl)s)) AND skill IN ('OFC','NODE')""", wp)
            m = cur.fetchone() or {}
            sk = m.get("skill")
            pdt_thr = 2.7 if sk == "OFC" else 3.5
            meta = {"team": team, "name": nm(team), "skill": sk,
                    "region": m.get("region"), "province": m.get("province"), "manager": m.get("manager"),
                    "pdt": rnd(m.get("pdt"), 3), "mhd": rnd(m.get("mhd"), 3),
                    "man_hour": rnd(m.get("man_hour")), "work_days": rnd(m.get("work_days")),
                    "days": m.get("days") or 0, "pdt_threshold": pdt_thr, "mhd_threshold": 9, "point_std": 13,
                    "months": sel, "weeks": wsel}

            daily_wl = []
            if panel in (1, 2, 3):
                cur.execute("""SELECT date, flag_wk, pdt_day_avg, man_hour, man_hour_day, work_days,
                                  dispatched, completed, closed_leaved, pct_closed
                               FROM work_load
                               WHERE team=%(t)s AND source_month=ANY(%(ms)s)
                                 AND (%(wlen)s=0 OR flag_wk=ANY(%(wl)s)) AND skill IN ('OFC','NODE')
                               ORDER BY date""", wp)
                for r in cur.fetchall():
                    daily_wl.append({
                        "date": r["date"].strftime("%Y-%m-%d") if r["date"] else None, "wk": r["flag_wk"],
                        "pdt": rnd(r["pdt_day_avg"]), "man_hour": rnd(r["man_hour"]), "mhd": rnd(r["man_hour_day"]),
                        "work_days": rnd(r["work_days"]), "dispatched": rnd(r["dispatched"]),
                        "completed": rnd(r["completed"]), "closed": rnd(r["closed_leaved"]), "pct_closed": rnd(r["pct_closed"])})

            daily_ml, worktypes, ml = [], [], {}
            if panel in (3, 4) and wknums and yrs:
                mp = {"t": team, "wks": wknums, "yrs": yrs}
                if panel == 3:
                    cur.execute("""SELECT date(arrived) d, min(arrived) fa, max(completed) lc, count(*) wo
                                   FROM mateline_ticket_closed
                                   WHERE team=%(t)s AND arrived IS NOT NULL
                                     AND extract(week from arrived)=ANY(%(wks)s) AND extract(isoyear from arrived)=ANY(%(yrs)s)
                                   GROUP BY date(arrived) ORDER BY d""", mp)
                    for r in cur.fetchall():
                        fa, lc = r["fa"], r["lc"]
                        span = rnd((lc - fa).total_seconds() / 3600) if (fa and lc) else None
                        daily_ml.append({"date": r["d"].strftime("%Y-%m-%d") if r["d"] else None,
                                         "first_arrive": fa.strftime("%H:%M") if fa else None,
                                         "last_complete": lc.strftime("%H:%M") if lc else None,
                                         "span": span, "wo": r["wo"]})
                    spans = [x["span"] for x in daily_ml if x["span"] is not None]
                    ml = {"avg_span": rnd(sum(spans) / len(spans)) if spans else None, "day_count": len(daily_ml)}
                elif panel == 4:
                    cur.execute("""SELECT date(completed) d, count(*) wo, sum(point) pts
                                   FROM mateline_ticket_closed
                                   WHERE team=%(t)s AND completed IS NOT NULL AND point IS NOT NULL
                                     AND extract(week from completed)=ANY(%(wks)s) AND extract(isoyear from completed)=ANY(%(yrs)s)
                                   GROUP BY date(completed) ORDER BY d""", mp)
                    for r in cur.fetchall():
                        daily_ml.append({"date": r["d"].strftime("%Y-%m-%d") if r["d"] else None,
                                         "wo": r["wo"], "points": rnd(r["pts"])})
                    cur.execute("""SELECT coalesce(work_type,'—') work_type, count(*) n, sum(point) pts
                                   FROM mateline_ticket_closed
                                   WHERE team=%(t)s AND completed IS NOT NULL AND point IS NOT NULL
                                     AND extract(week from completed)=ANY(%(wks)s) AND extract(isoyear from completed)=ANY(%(yrs)s)
                                   GROUP BY work_type ORDER BY sum(point) DESC NULLS LAST""", mp)
                    worktypes = [{"work_type": r["work_type"], "n": r["n"], "points": rnd(r["pts"])} for r in cur.fetchall()]
                    tp = sum((w["points"] or 0) for w in worktypes)
                    pdays = len(daily_ml)
                    ml = {"total_points": rnd(tp), "point_days": pdays,
                          "point_per_day": rnd(tp / pdays) if pdays else None}

        return {"meta": meta, "panel": panel, "daily_wl": daily_wl, "daily_ml": daily_ml, "worktypes": worktypes, "ml": ml}
    except Exception as e:
        raise HTTPException(503, f"pdtdetail failed: {e}")


# ============================================================ Import (template + validate + commit)
def _spec(dataset):
    spec = import_spec.DATASETS.get(dataset)
    if not spec:
        raise HTTPException(400, f"unknown dataset '{dataset}' (use mateline or work_load)")
    return spec


@app.get("/api/import/flow")
def import_flow():
    """Live counts for the two source tables — drives the data-flow view in the Import tab."""
    out = {}
    with _connect() as conn, conn.cursor() as cur:
        def stat(table, month_expr):
            try:
                cur.execute(f"SELECT count(*) rows, count(DISTINCT {month_expr}) months, max({month_expr}) latest FROM {table}")
                r = cur.fetchone()
                return {"rows": r["rows"] or 0, "months": r["months"] or 0, "latest": r["latest"]}
            except Exception:
                conn.rollback()
                return {"rows": 0, "months": 0, "latest": None}
        out["mateline"] = {"table": "mateline_ticket_closed", **stat("mateline_ticket_closed", MONTH_SQL)}
        out["work_load"] = {"table": "work_load", **stat("work_load", "source_month")}
    return out


@app.get("/api/import/spec")
def import_spec_info():
    """Describe the importable datasets (labels, columns, key columns) for the UI."""
    out = {}
    for key, spec in import_spec.DATASETS.items():
        out[key] = {"table": spec["table"], "label": spec["label"], "sheet": spec["sheet"] or "Sheet1",
                    "key_cols": spec["key_cols"],
                    "cols": [{"header": h, "col": snk, "kind": kind} for (h, snk, kind) in spec["cols"]]}
    return out


@app.get("/api/import/template")
def import_template(dataset: str):
    """Download a ready-to-fill .xlsx whose headers match the dataset exactly."""
    import openpyxl
    spec = _spec(dataset)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = spec["sheet"] or "Data"
    headers = [c[0] for c in spec["cols"]]
    ws.append(headers)
    from openpyxl.styles import Font, PatternFill
    fill = PatternFill("solid", fgColor="1F2A44")
    for i, (h, snk, kind) in enumerate(spec["cols"], start=1):
        cell = ws.cell(row=1, column=i)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = fill
        ws.column_dimensions[cell.column_letter].width = max(12, min(28, len(h) + 3))
    ws.freeze_panes = "A2"
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fn = f"template_{dataset}.xlsx"
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f'attachment; filename="{fn}"', "Cache-Control": "no-store"})


def _read_upload(spec, raw):
    """Parse the uploaded workbook into (header_map, data_rows). header_map: snake -> (col_index, kind)."""
    import openpyxl
    try:
        wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(400, f"อ่านไฟล์ Excel ไม่ได้: {e}")
    sheet = spec["sheet"]
    if sheet and sheet in wb.sheetnames:
        ws = wb[sheet]
    else:
        ws = wb[wb.sheetnames[0]]
    it = ws.iter_rows(values_only=True)
    try:
        header = list(next(it))
    except StopIteration:
        wb.close()
        raise HTTPException(400, "ไฟล์ว่าง ไม่มีหัวตาราง")
    want = {import_spec.norm(h): (snk, kind) for h, snk, kind in spec["cols"]}
    pos = {}
    for i, h in enumerate(header):
        k = import_spec.norm(h)
        if k in want and want[k][0] not in pos:
            pos[want[k][0]] = (i, want[k][1])
    rows = [list(r) for r in it]
    wb.close()
    return pos, rows


def _validate(spec, pos, rows, issue_cap=50):
    cols = spec["cols"]
    found = set(pos)
    missing_headers = [lbl for (lbl, snk, kind) in cols if snk not in found]
    key_missing = [k for k in spec["key_cols"] if k not in pos]
    issues, valid, skipped = [], 0, 0
    kindlbl = {"ts": "วันที่/เวลา", "num": "ตัวเลข", "txt": "ข้อความ"}
    primary = spec["key_cols"][0]   # row is real only when the primary key (team) has a value
    def _has_key(row):
        if primary not in pos:
            return False
        v = row[pos[primary][0]] if pos[primary][0] < len(row) else None
        return v is not None and not (isinstance(v, str) and v.strip() == "")
    for ri, row in enumerate(rows, start=2):  # row 1 is the header
        if not _has_key(row):
            skipped += 1
            continue
        valid += 1
        for snk, (idx, kind) in pos.items():
            v = row[idx] if idx < len(row) else None
            if not import_spec.coercible(kind, v) and len(issues) < issue_cap:
                issues.append({"row": ri, "column": snk, "value": str(v)[:40],
                               "reason": f"แปลงเป็น{kindlbl[kind]}ไม่ได้"})
    # build a small preview of the first valid rows (mapped, coerced for display)
    preview_cols = [snk for (_, snk, _) in cols if snk in pos]
    preview = []
    for row in rows:
        if len(preview) >= 8:
            break
        if not _has_key(row):
            continue
        preview.append([("" if (row[pos[c][0]] if pos[c][0] < len(row) else None) is None else str(row[pos[c][0]])[:30]) for c in preview_cols])
    ok = (not key_missing) and valid > 0
    return {"ok": ok, "total_rows": len(rows), "valid_rows": valid, "skipped_rows": skipped,
            "missing_headers": missing_headers, "key_missing": key_missing,
            "issue_count": sum(1 for _ in issues), "issues": issues,
            "preview_cols": preview_cols, "preview": preview}


@app.post("/api/import")
async def import_data(dataset: str = Form(...), commit: bool = Form(False),
                      mode: str = Form("append"), file: UploadFile = File(...)):
    """Validate an uploaded workbook (always), and insert it when commit=true.
    mode: append = add rows · replace = empty the table first. The dataset's source_month
    is derived on the server so the monthly views line up with the bulk loader."""
    spec = _spec(dataset)
    if mode not in ("append", "replace"):
        raise HTTPException(400, "mode ต้องเป็น append หรือ replace")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "ไม่พบไฟล์")
    pos, rows = _read_upload(spec, raw)
    report = _validate(spec, pos, rows)
    report.update(dataset=dataset, mode=mode, committed=False, inserted=0)
    if not commit:
        return report
    if not report["ok"]:
        report["error"] = "ข้อมูลไม่ผ่านการตรวจ จึงไม่นำเข้า"
        return report

    cols = spec["cols"]
    snake = [c[1] for c in cols]
    has_sm = spec["source_month"] is not None
    coldefs = ", ".join(f"{c[1]} {import_spec.SQLTYPE[c[2]]}" for c in cols) + (", source_month text" if has_sm else "")
    insert_cols = snake + (["source_month"] if has_sm else [])
    sm_idx = pos.get(spec["source_month"]) if has_sm else None
    primary = spec["key_cols"][0]
    pk = pos.get(primary)

    def _has_key(row):
        if not pk:
            return False
        v = row[pk[0]] if pk[0] < len(row) else None
        return v is not None and not (isinstance(v, str) and v.strip() == "")

    inserted = 0
    with _lock, _connect() as conn, conn.cursor() as cur:
        cur.execute(f"CREATE TABLE IF NOT EXISTS {spec['table']} ({coldefs})")
        # add source_month column on a pre-existing table that may lack it (defensive)
        if has_sm:
            cur.execute(f"ALTER TABLE {spec['table']} ADD COLUMN IF NOT EXISTS source_month text")
        if mode == "replace":
            cur.execute(f"TRUNCATE {spec['table']}")
        with cur.copy(f"COPY {spec['table']} ({', '.join(insert_cols)}) FROM STDIN") as cp:
            for row in rows:
                if not _has_key(row):
                    continue
                out = []
                for c in cols:
                    if c[1] in pos:
                        idx, kind = pos[c[1]]
                        out.append(import_spec.coerce(kind, row[idx] if idx < len(row) else None))
                    else:
                        out.append(None)
                if has_sm:
                    sm = None
                    if sm_idx is not None:
                        dt = import_spec.coerce("ts", row[sm_idx[0]] if sm_idx[0] < len(row) else None)
                        sm = dt.strftime("%Y-%m") if dt else None
                    out.append(sm)
                cp.write_row(out)
                inserted += 1
        for ix, col in spec["indexes"]:
            cur.execute(f"CREATE INDEX IF NOT EXISTS {ix} ON {spec['table']} ({col})")
        conn.commit()
    _cache["built_at"] = 0.0   # force the dup-view cache to rebuild on next request
    report.update(committed=True, inserted=inserted)
    return report


@app.get("/api/diag")
def diag():
    """Verify the table is reachable, column names match, and the month split works —
    hit this first when pointing at a new database."""
    try:
        with _connect() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT * FROM {TABLE} LIMIT 1")
            cols = [d.name for d in cur.description]
            cur.fetchall()
            cur.execute(f'SELECT ({MONTH_SQL}) AS m, count(*)::int AS n FROM {TABLE} GROUP BY 1 ORDER BY 1')
            months = [{"month": str(r["m"]), "rows": r["n"]} for r in cur.fetchall()]
        needed = {db: (db in cols) for db in COLMAP.values()}
        return {
            "table": TABLE, "month_sql": MONTH_SQL, "colmap": COLMAP,
            "columns": cols, "column_count": len(cols),
            "mapped_columns_present": needed, "all_mapped_present": all(needed.values()),
            "missing": [db for db, ok in needed.items() if not ok],
            "month_count": len(months), "months": months,
        }
    except Exception as e:
        raise HTTPException(503, f"diag failed: {e}")

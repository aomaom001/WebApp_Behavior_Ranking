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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import psycopg
from psycopg.rows import dict_row

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts"))
sys.path.insert(0, "/app/scripts")
import agg_core  # noqa: E402

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


@app.middleware("http")
async def no_store(request, call_next):
    # Live data must never be cached by the browser — otherwise a redeploy keeps showing stale results.
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-store"
    return resp

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
                                       "first_arrive": hhmm(fa), "last_complete": hhmm(lc), "hours": hrs, "days": a["days"] if a else 0})
                    panel3.sort(key=lambda x: (x["hours"] is None, -(x["hours"] or 0)))

                fteams = list(wlmap.keys())
                if fteams:
                    cur.execute("""SELECT team, sum(point) pts, count(distinct date(completed)) days,
                          mode() WITHIN GROUP (ORDER BY work_type) top_work
                        FROM mateline_ticket_closed
                        WHERE team = ANY(%(t)s) AND completed IS NOT NULL AND point IS NOT NULL
                          AND extract(week from completed)=ANY(%(wks)s) AND extract(isoyear from completed)=ANY(%(yrs)s)
                        GROUP BY team""", {"t": fteams, "wks": wknums, "yrs": yrs})
                    for r in cur.fetchall():
                        days = r["days"] or 0
                        ppd = (r["pts"] / days) if (days and r["pts"] is not None) else None
                        if ppd is not None and ppd > 13:
                            w = wlmap[r["team"]]
                            panel4.append({"team": r["team"], "name": nm(r["team"]), "skill": w["skill"], "region": w["region"],
                                           "province": w["province"], "point_per_day": round(ppd, 2), "days": days, "top_work": r["top_work"]})
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

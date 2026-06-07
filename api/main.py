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

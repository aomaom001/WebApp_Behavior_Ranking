#!/usr/bin/env python3
"""
import_spec.py — single source of truth for the two importable datasets.

Both the bulk loaders (load_pg.py / load_work_load.py) and the live API's "Import" tab
read the column definitions, coercion and validation from here, so the Excel template the
user fills in, the validation rules, and the database schema can never drift apart.

  kind:  ts = timestamp · num = numeric · txt = text
"""

import datetime
import re

SQLTYPE = {"ts": "timestamp", "num": "double precision", "txt": "text"}

# (Excel header shown in the template, snake_case db column, kind)
MATELINE_COLS = [
    ("Work Order ID", "work_order_id", "txt"), ("Team", "team", "txt"),
    ("Source Ticket ID", "source_ticket_id", "txt"), ("Province", "province", "txt"),
    ("Region", "region", "txt"), ("Skill", "skill", "txt"), ("Status", "status", "txt"),
    ("WO Creator", "wo_creator", "txt"), ("Complete Solution", "complete_solution", "txt"),
    ("Severity", "severity", "txt"), ("Work Type", "work_type", "txt"),
    ("Root Cause", "root_cause", "txt"), ("SLA", "sla", "txt"), ("Site ID", "site_id", "txt"),
    ("Created Time", "created_time", "ts"), ("Arrived", "arrived", "ts"),
    ("Completed", "completed", "ts"), ("Closed", "closed", "ts"), ("Point", "point", "num"),
]

WORKLOAD_COLS = [
    ("Flag Month", "flag_month", "ts"), ("Flag WK", "flag_wk", "txt"),
    ("Flag Date final", "flag_date_final", "ts"), ("Flag Date1", "flag_date1", "ts"),
    ("Status Team", "status_team", "txt"), ("Region", "region", "txt"),
    ("Date", "date", "ts"), ("Team", "team", "txt"), ("Skill", "skill", "txt"),
    ("Manager", "manager", "txt"), ("Province", "province", "txt"), ("Suspend", "suspend", "txt"),
    ("Team Count", "team_count", "num"), ("Dispatched", "dispatched", "num"),
    ("Accepted", "accepted", "num"), ("Departed", "departed", "num"), ("Arrived", "arrived", "num"),
    ("Completed", "completed", "num"), ("Closed (Leaved)", "closed_leaved", "num"),
    ("% Closed", "pct_closed", "num"), ("Work Days", "work_days", "num"),
    ("PDT / Day (AVG)", "pdt_day_avg", "num"), ("PDT / Day (MEAN)", "pdt_day_mean", "num"),
    ("Total Team PDT>= 2.5", "total_team_pdt_ge25", "num"), ("Total Team PDT < 2.5", "total_team_pdt_lt25", "num"),
    ("% SLA", "pct_sla", "num"), ("Man Hour", "man_hour", "num"), ("Man Hour / Day", "man_hour_day", "num"),
]

DATASETS = {
    "mateline": {
        "table": "mateline_ticket_closed",
        "label": "MATELINE TICKET CLOSED",
        "sheet": "RAW Data",
        "cols": MATELINE_COLS,
        "key_cols": ["team"],          # a row with no team is skipped
        "source_month": None,          # month derived from `closed` at query time, not stored
        "indexes": [("ix_mtc_closed", "closed"), ("ix_mtc_team", "team")],
    },
    "work_load": {
        "table": "work_load",
        "label": "Work Load Per Days",
        "sheet": None,                 # first sheet
        "cols": WORKLOAD_COLS,
        "key_cols": ["team", "flag_month"],
        "source_month": "flag_month",  # YYYY-MM derived from flag_month, stored in source_month
        "indexes": [("ix_wl_month", "source_month"), ("ix_wl_team", "team")],
    },
}


def norm(s):
    return re.sub(r"\s+", " ", str(s)).strip().lower()


def coerce(kind, v):
    """Return the typed value, or None when blank/unparseable. Strings are parsed for ts/num
    so pasted data (where Excel keeps the cell as text) still lands correctly."""
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    if kind == "ts":
        if isinstance(v, (datetime.datetime, datetime.date)):
            return v
        s = str(v).strip()
        for fmt in (None, "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
            try:
                return datetime.datetime.fromisoformat(s) if fmt is None else datetime.datetime.strptime(s, fmt)
            except ValueError:
                continue
        return None
    if kind == "num":
        try:
            return float(str(v).replace(",", "").strip())
        except (TypeError, ValueError):
            return None
    return str(v)


def coercible(kind, v):
    """True when a non-empty value parses cleanly for its kind (used by validation)."""
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return True            # blank is allowed -> NULL
    return coerce(kind, v) is not None

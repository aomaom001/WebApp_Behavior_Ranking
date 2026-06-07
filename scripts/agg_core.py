#!/usr/bin/env python3
"""
agg_core.py — the canonical aggregation logic for the Team Behavior Ranking dashboard.

One source of truth, shared by:
  - scripts/build_data.py  (reads MATELINE Excel exports)
  - api/main.py            (reads the same data from PostgreSQL)

Rows are passed in as a list of dicts keyed by the original MATELINE column names
("Team", "Source Ticket ID", "Severity", ...), so the Excel reader and the SQL reader
produce byte-identical numbers. build_data.py validates this against the committed
data.json (all 8 metrics match 100%).

Behaviour metrics (lower = better):
  dup    = wo - tickets
  nowork = WOs Canceled, OR with an empty "Complete Solution", OR a "No-Visit" work type
  cross  = WOs whose Province differs from the ticket's MAIN province (most common per ticket)
  sys    = WOs whose "WO Creator" is "System"
  man    = wo - sys
"""

import re
from collections import Counter, defaultdict

# Columns the aggregation reads. The source (Excel sheet or SQL SELECT) must provide these.
NEEDED = [
    "Team", "Source Ticket ID", "Province", "Region", "Skill",
    "Status", "WO Creator", "Complete Solution",
    "Severity", "Work Type", "Root Cause", "SLA",
]
OPT_SITE = "Site ID"   # used only for the drill-down detail (optional)

NONE_LABEL = "ไม่ระบุ"

BEHAVIORS = {
    "dup": "WO ซ้ำ Ticket เดิม (Duplicate WO/Ticket)",
    "nowork": "เปิด WO ไม่ทำงานจริง (No real work)",
    "cross": "ช่วยข้าม Province (Cross-province)",
    "sys": "System WO ผิดปกติ (System ratio)",
}

# Drill-down dimensions (Classification / Target Onsite / Suspend were all-empty -> excluded).
DIM_META = {
    "sevT":   {"col": "Severity",   "label_th": "ระดับความรุนแรง (Severity)", "label_en": "Severity",   "unit": "ticket"},
    "status": {"col": "Status",     "label_th": "สถานะงาน (Status)",          "label_en": "Status",     "unit": "wo"},
    "wtype":  {"col": "Work Type",  "label_th": "ประเภทงาน (Work Type)",      "label_en": "Work Type",  "unit": "wo"},
    "root":   {"col": "Root Cause", "label_th": "สาเหตุหลัก (Root Cause)",    "label_en": "Root Cause", "unit": "wo"},
    "sla":    {"col": "SLA",        "label_th": "สถานะ SLA",                 "label_en": "SLA status", "unit": "wo"},
}

# Dictionary-encoded fields in each detail payload (keeps it ~5x smaller).
DETAIL_DICT_FIELDS = ["team", "name", "region", "prov", "skill", "tsev", "sev", "status", "wtype", "root", "sla", "site"]


def is_empty(v):
    return v is None or (isinstance(v, str) and v.strip() == "")


def sev_group(v):
    """'SA4-24H' -> 'SA4', 'NSA3-24H' -> 'NSA3', empty/other -> 'OTHER'."""
    if is_empty(v):
        return "OTHER"
    m = re.match(r"\s*(N?SA)\s*(\d)", str(v))
    return (m.group(1) + m.group(2)) if m else "OTHER"


def cat_label(v):
    return NONE_LABEL if is_empty(v) else str(v).strip()


def parse_name(team):
    """'MT-CW-NKW-OFC-003 ( Natthawut_OF_NKW  Tel... )' -> 'Natthawut_OF_NKW'."""
    if not team:
        return ""
    m = re.search(r"\(([^)]*)\)", str(team))
    if not m:
        return str(team)
    inside = re.split(r"\bTel", m.group(1))[0].strip()
    toks = inside.split()
    return toks[0] if toks else str(team)


def ticket_main_province(rows):
    by = defaultdict(Counter)
    for r in rows:
        tid = r.get("Source Ticket ID")
        if is_empty(tid):
            continue
        by[tid][r.get("Province")] += 1
    return {tid: c.most_common(1)[0][0] for tid, c in by.items()}


def ticket_main_sev(rows):
    by = defaultdict(Counter)
    for r in rows:
        tid = r.get("Source Ticket ID")
        if is_empty(tid):
            continue
        by[tid][sev_group(r.get("Severity"))] += 1
    return {tid: c.most_common(1)[0][0] for tid, c in by.items()}


def aggregate_month(rows, month, has_site=True):
    """rows: list of dicts keyed by MATELINE column names. Returns (records, detail_rows)."""
    main_prov = ticket_main_province(rows)
    main_sev = ticket_main_sev(rows)

    agg = defaultdict(lambda: {
        "tickets": set(), "wo": 0, "sys": 0, "cancel": 0, "nowork": 0, "cross": 0,
        "meta": Counter(),
        "status": Counter(), "wtype": Counter(), "root": Counter(), "sla": Counter(),
    })
    detail = []
    name_cache = {}
    for r in rows:
        team = r.get("Team")
        if is_empty(team):
            continue
        a = agg[team]
        a["wo"] += 1
        tid = r.get("Source Ticket ID")
        if not is_empty(tid):
            a["tickets"].add(tid)
        if r.get("WO Creator") == "System":
            a["sys"] += 1
        status = r.get("Status")
        canceled = status == "Canceled"
        if canceled:
            a["cancel"] += 1
        wtype_raw = r.get("Work Type")
        if canceled or is_empty(r.get("Complete Solution")) or wtype_raw == "No-Visit":
            a["nowork"] += 1
        prov = r.get("Province")
        if not is_empty(tid) and prov != main_prov.get(tid, prov):
            a["cross"] += 1
        a["meta"][(r.get("Region"), prov, r.get("Skill"))] += 1
        a["status"][cat_label(status)] += 1
        a["wtype"][cat_label(wtype_raw)] += 1
        a["root"][cat_label(r.get("Root Cause"))] += 1
        a["sla"][cat_label(r.get("SLA"))] += 1

        if team not in name_cache:
            name_cache[team] = parse_name(team)
        tid_s = "" if is_empty(tid) else str(tid)
        detail.append({
            "team": team, "name": name_cache[team],
            "region": r.get("Region"), "prov": prov, "skill": r.get("Skill"),
            "tsev": main_sev.get(tid_s, "OTHER") if tid_s else "OTHER",
            "sev": sev_group(r.get("Severity")),
            "status": cat_label(status), "wtype": cat_label(wtype_raw),
            "root": cat_label(r.get("Root Cause")), "sla": cat_label(r.get("SLA")),
            "site": cat_label(r.get(OPT_SITE)) if has_site else NONE_LABEL,
            "tid": tid_s,
        })

    records = []
    for team, a in agg.items():
        region, prov, skill = a["meta"].most_common(1)[0][0]
        wo = a["wo"]
        tickets = len(a["tickets"])
        sevT = Counter()
        for tid in a["tickets"]:
            sevT[main_sev.get(tid, "OTHER")] += 1
        records.append({
            "team": team, "name": name_cache.get(team, parse_name(team)),
            "region": region, "prov": prov, "skill": skill, "m": month,
            "wo": wo, "tickets": tickets, "dup": wo - tickets,
            "nowork": a["nowork"], "cancel": a["cancel"], "cross": a["cross"],
            "sys": a["sys"], "man": wo - a["sys"],
            "bd": {
                "sevT": dict(sevT), "status": dict(a["status"]), "wtype": dict(a["wtype"]),
                "root": dict(a["root"]), "sla": dict(a["sla"]),
            },
        })
    return records, detail


def build_dims(all_records):
    """Drill-down catalog: global category order + totals per dimension."""
    dim_totals = {d: Counter() for d in DIM_META}
    for r in all_records:
        for d in DIM_META:
            dim_totals[d].update(r["bd"][d])
    dims = {}
    for d, m in DIM_META.items():
        dims[d] = {
            "label_th": m["label_th"], "label_en": m["label_en"], "unit": m["unit"],
            "cats": [{"key": k, "total": v} for k, v in dim_totals[d].most_common()],
        }
    return dims


def encode_detail(month, detail_rows):
    """Dictionary-encode one month's per-WO rows for a compact detail payload."""
    dmap = {f: {} for f in DETAIL_DICT_FIELDS}
    darr = {f: [] for f in DETAIL_DICT_FIELDS}

    def idx(f, v):
        m = dmap[f]
        if v not in m:
            m[v] = len(darr[f])
            darr[f].append(v)
        return m[v]

    out_rows = [[idx(f, r[f]) for f in DETAIL_DICT_FIELDS] + [r["tid"]] for r in detail_rows]
    return {"month": month, "fields": DETAIL_DICT_FIELDS + ["tid"], "dict": darr, "rows": out_rows}

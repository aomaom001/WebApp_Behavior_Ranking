#!/usr/bin/env python3
"""
build_data.py — generate data/data.json from the MATELINE "TICKET CLOSED" Excel exports.

This is the data pipeline for the dashboard. Each Excel file is one month of closed
Work Orders (WO); the script aggregates them per team-per-month into the compact JSON
the dashboard reads.

Usage:
    python scripts/build_data.py --src "C:/path/to/excel/folder" --out data/data.json
    python scripts/build_data.py --src .. --validate data/data.json   # dry-run + compare

Requires: pandas-free, only openpyxl (pip install openpyxl).

Input  : files named "..._YYYYMM.xlsx", sheet "RAW Data", one row per WO.
Output : { "months": [...],
           "records": [ {team,name,region,prov,skill,m, wo,tickets,dup,nowork,cancel,cross,sys,man,
                         bd:{ sevT:{}, status:{}, wtype:{}, root:{}, sla:{} }}, ... ],
           "behaviors": { metric -> label },
           "dims":      { dim -> {label_th,label_en,unit,cats:[{key,total},...]} },  # drill-down catalog
           "meta":      { generated_at, src, source_system, total_files, total_records, total_wo,
                          sources: [ {file,month,teams,wo,tickets,size_kb,modified}, ... ] } }   # provenance

Behaviour metrics (lower = better; see README):
  dup    = wo - tickets            (extra WOs opened against the same ticket)
  nowork = WOs Canceled OR with an empty "Complete Solution"
  cross  = WOs whose Province differs from the ticket's MAIN province
           (main = the most common province among that ticket's WOs)
  sys    = WOs whose "WO Creator" is "System"
  man    = wo - sys

Drill-down breakdowns (bd): per team-per-month category counts, stored sparse so they
sum cleanly up to province / region. `sevT` counts distinct TICKETS by severity class
(SA1-5 / NSA1-5 / OTHER); the rest count WOs. Summing tickets across teams shares the
same cross-team caveat as the `tickets` field (a ticket worked by two teams counts in
both) — acceptable and consistent with the existing model.

NOTE ON `cross`: the original (pre-pipeline) numbers were produced by a tool we no
longer have. The definition above ("main province = most frequent province of the
ticket") matches the README and reproduces the legacy figures for the large majority
of teams, but not all — the legacy tool likely used an extra site->province lookup.
If you recover that rule, edit `ticket_main_province()` only; everything else is exact.
"""

import argparse
import datetime
import glob
import json
import os
import re
import sys
from collections import Counter, defaultdict

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required:  pip install openpyxl")

SHEET = "RAW Data"
NEEDED = [
    "Team", "Source Ticket ID", "Province", "Region", "Skill",
    "Status", "WO Creator", "Complete Solution",
    "Severity", "Work Type", "Root Cause", "SLA",
]

# Human-readable behaviour labels embedded in the output for the dashboard.
BEHAVIORS = {
    "dup": "WO ซ้ำ Ticket เดิม (Duplicate WO/Ticket)",
    "nowork": "เปิด WO ไม่ทำงานจริง (No real work)",
    "cross": "ช่วยข้าม Province (Cross-province)",
    "sys": "System WO ผิดปกติ (System ratio)",
}

NONE_LABEL = "ไม่ระบุ"

# Optional columns used only for the drill-down detail files (skipped if absent).
OPT_SITE = "Site ID"
OPT_SUBJ = "Subject"
# Dictionary-encoded fields in each data/detail/<month>.json (cuts file size ~5x).
DETAIL_DICT_FIELDS = ["team", "name", "region", "prov", "skill", "tsev", "sev", "status", "wtype", "root", "sla", "site"]

# Drill-down dimensions surfaced for deeper analysis. Classification, Target Onsite Status
# and Suspend Status were all-empty in the source data, so they are intentionally excluded.
DIM_META = {
    "sevT":   {"col": "Severity",   "label_th": "ระดับความรุนแรง (Severity)", "label_en": "Severity",   "unit": "ticket"},
    "status": {"col": "Status",     "label_th": "สถานะงาน (Status)",          "label_en": "Status",     "unit": "wo"},
    "wtype":  {"col": "Work Type",  "label_th": "ประเภทงาน (Work Type)",      "label_en": "Work Type",  "unit": "wo"},
    "root":   {"col": "Root Cause", "label_th": "สาเหตุหลัก (Root Cause)",    "label_en": "Root Cause", "unit": "wo"},
    "sla":    {"col": "SLA",        "label_th": "สถานะ SLA",                 "label_en": "SLA status", "unit": "wo"},
}


def month_from_filename(path):
    """'MATELINE TICKET CLOSED_202507.xlsx' -> '2025-07'."""
    m = re.search(r"(\d{4})(\d{2})", os.path.basename(path))
    if not m:
        raise ValueError(f"cannot find YYYYMM in filename: {path}")
    return f"{m.group(1)}-{m.group(2)}"


def parse_name(team):
    """Extract the person name embedded in the team label.

    'MT-CW-NKW-OFC-003 ( Natthawut_OF_NKW  Tel.0930804435_C06 )' -> 'Natthawut_OF_NKW'
    """
    if not team:
        return ""
    m = re.search(r"\(([^)]*)\)", team)
    if not m:
        return team
    inside = re.split(r"\bTel", m.group(1))[0].strip()
    toks = inside.split()
    return toks[0] if toks else team


def is_empty(v):
    return v is None or (isinstance(v, str) and v.strip() == "")


def sev_group(v):
    """'SA4-24H' -> 'SA4', 'NSA3-24H' -> 'NSA3', empty/other -> 'OTHER'."""
    if is_empty(v):
        return "OTHER"
    m = re.match(r"\s*(N?SA)\s*(\d)", str(v))
    return (m.group(1) + m.group(2)) if m else "OTHER"


def cat_label(v):
    """Normalise a raw cell to a display category; blanks collapse to NONE_LABEL."""
    return NONE_LABEL if is_empty(v) else str(v).strip()


def ticket_main_province(rows, col):
    """Most common Province per Source Ticket ID (the ticket's 'home' province)."""
    by_ticket = defaultdict(Counter)
    for r in rows:
        tid = r[col["Source Ticket ID"]]
        if is_empty(tid):
            continue
        by_ticket[tid][r[col["Province"]]] += 1
    return {tid: c.most_common(1)[0][0] for tid, c in by_ticket.items()}


def ticket_main_sev(rows, col):
    """Most common severity-group per Source Ticket ID."""
    by_ticket = defaultdict(Counter)
    for r in rows:
        tid = r[col["Source Ticket ID"]]
        if is_empty(tid):
            continue
        by_ticket[tid][sev_group(r[col["Severity"]])] += 1
    return {tid: c.most_common(1)[0][0] for tid, c in by_ticket.items()}


def process_file(path, month):
    """Read one monthly Excel export -> list of per-team aggregate records."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if SHEET not in wb.sheetnames:
        wb.close()
        raise ValueError(f"sheet '{SHEET}' not found in {path}; has {wb.sheetnames}")
    ws = wb[SHEET]
    it = ws.iter_rows(values_only=True)
    header = list(next(it))
    col = {h: i for i, h in enumerate(header)}
    missing = [c for c in NEEDED if c not in col]
    if missing:
        wb.close()
        raise ValueError(f"{path} missing columns: {missing}")

    rows = list(it)
    wb.close()

    main_prov = ticket_main_province(rows, col)
    main_sev = ticket_main_sev(rows, col)
    has_site, has_subj = OPT_SITE in col, OPT_SUBJ in col

    agg = defaultdict(lambda: {
        "tickets": set(), "wo": 0, "sys": 0, "cancel": 0, "nowork": 0, "cross": 0,
        "meta": Counter(),
        "status": Counter(), "wtype": Counter(), "root": Counter(), "sla": Counter(),
    })
    detail = []        # per-WO rows for the drill-down detail file
    name_cache = {}
    for r in rows:
        team = r[col["Team"]]
        if is_empty(team):
            continue
        a = agg[team]
        a["wo"] += 1
        tid = r[col["Source Ticket ID"]]
        if not is_empty(tid):
            a["tickets"].add(tid)
        if r[col["WO Creator"]] == "System":
            a["sys"] += 1
        status = r[col["Status"]]
        canceled = status == "Canceled"
        if canceled:
            a["cancel"] += 1
        wtype_raw = r[col["Work Type"]]
        # "ไม่ทำงานจริง": Canceled, OR no Complete Solution, OR a No-Visit work type (per README).
        if canceled or is_empty(r[col["Complete Solution"]]) or wtype_raw == "No-Visit":
            a["nowork"] += 1
        prov = r[col["Province"]]
        if not is_empty(tid) and prov != main_prov.get(tid, prov):
            a["cross"] += 1
        a["meta"][(r[col["Region"]], prov, r[col["Skill"]])] += 1
        # drill-down breakdowns (WO-level)
        a["status"][cat_label(status)] += 1
        a["wtype"][cat_label(wtype_raw)] += 1
        a["root"][cat_label(r[col["Root Cause"]])] += 1
        a["sla"][cat_label(r[col["SLA"]])] += 1

        # per-WO row for the drill-down detail file
        if team not in name_cache:
            name_cache[team] = parse_name(team)
        tid_s = "" if is_empty(tid) else str(tid)
        detail.append({
            "team": team, "name": name_cache[team],
            "region": r[col["Region"]], "prov": prov, "skill": r[col["Skill"]],
            "tsev": main_sev.get(tid_s, "OTHER") if tid_s else "OTHER",
            "sev": sev_group(r[col["Severity"]]),
            "status": cat_label(status), "wtype": cat_label(wtype_raw),
            "root": cat_label(r[col["Root Cause"]]), "sla": cat_label(r[col["SLA"]]),
            "site": cat_label(r[col[OPT_SITE]]) if has_site else NONE_LABEL,
            "tid": tid_s,
        })

    records = []
    for team, a in agg.items():
        region, prov, skill = a["meta"].most_common(1)[0][0]
        wo = a["wo"]
        tickets = len(a["tickets"])
        # tickets-by-severity for this team
        sevT = Counter()
        for tid in a["tickets"]:
            sevT[main_sev.get(tid, "OTHER")] += 1
        records.append({
            "team": team,
            "name": parse_name(team),
            "region": region,
            "prov": prov,
            "skill": skill,
            "m": month,
            "wo": wo,
            "tickets": tickets,
            "dup": wo - tickets,
            "nowork": a["nowork"],
            "cancel": a["cancel"],
            "cross": a["cross"],
            "sys": a["sys"],
            "man": wo - a["sys"],
            "bd": {
                "sevT": dict(sevT),
                "status": dict(a["status"]),
                "wtype": dict(a["wtype"]),
                "root": dict(a["root"]),
                "sla": dict(a["sla"]),
            },
        })
    return records, detail


def write_detail(path, month, detail_rows):
    """Write one month's per-WO drill-down file, dictionary-encoded to keep it small."""
    dmap = {f: {} for f in DETAIL_DICT_FIELDS}
    darr = {f: [] for f in DETAIL_DICT_FIELDS}

    def idx(f, v):
        m = dmap[f]
        if v not in m:
            m[v] = len(darr[f])
            darr[f].append(v)
        return m[v]

    out_rows = []
    for r in detail_rows:
        out_rows.append([idx(f, r[f]) for f in DETAIL_DICT_FIELDS] + [r["tid"]])
    obj = {"month": month, "fields": DETAIL_DICT_FIELDS + ["tid"], "dict": darr, "rows": out_rows}
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


def build(src_dir, detail_dir=None):
    files = sorted(glob.glob(os.path.join(src_dir, "*.xlsx")))
    files = [f for f in files
             if not os.path.basename(f).startswith("~$")        # skip Excel lock files
             and re.search(r"\d{6}", os.path.basename(f))]
    if not files:
        sys.exit(f"no '*YYYYMM*.xlsx' files found in {src_dir}")
    all_records = []
    months = []
    sources = []
    total_wo = 0
    for f in files:
        month = month_from_filename(f)
        print(f"  reading {os.path.basename(f)}  ->  {month}", flush=True)
        recs, detail = process_file(f, month)
        teams = len(recs)
        wo = sum(r["wo"] for r in recs)
        tickets = sum(r["tickets"] for r in recs)
        if detail_dir:
            kb = write_detail(os.path.join(detail_dir, month + ".json"), month, detail) / 1024
            print(f"    detail: {len(detail)} WO -> {month}.json ({kb:.0f} KB)", flush=True)
        st = os.stat(f)
        sources.append({
            "file": os.path.basename(f),
            "month": month,
            "teams": teams,
            "wo": wo,
            "tickets": tickets,
            "size_kb": round(st.st_size / 1024),
            "modified": datetime.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d"),
        })
        total_wo += wo
        all_records.extend(recs)
        months.append(month)
        print(f"    {teams} teams, {wo} WO", flush=True)
    months = sorted(set(months))

    # drill-down catalog: global category order + totals per dimension
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

    meta = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "src": os.path.abspath(src_dir),
        "source_system": "ระบบ MATELINE — รายงาน Ticket Closed (.xlsx) รายเดือน",
        "total_files": len(files),
        "total_records": len(all_records),
        "total_wo": total_wo,
        "sources": sources,
    }
    return {"months": months, "records": all_records, "behaviors": BEHAVIORS, "dims": dims, "meta": meta}


def validate(generated, ref_path):
    """Compare generated records against an existing data.json, field by field."""
    ref = json.load(open(ref_path, encoding="utf-8"))
    ref_by = {(r["team"], r["m"]): r for r in ref["records"]}
    gen_by = {(r["team"], r["m"]): r for r in generated["records"]}
    common = set(ref_by) & set(gen_by)
    print(f"\nVALIDATION vs {ref_path}")
    print(f"  reference records: {len(ref['records'])} | generated: {len(generated['records'])} | common keys: {len(common)}")
    fields = ["wo", "tickets", "dup", "nowork", "cancel", "sys", "man", "cross",
              "name", "region", "prov", "skill"]
    for fld in fields:
        ok = sum(1 for k in common if ref_by[k].get(fld) == gen_by[k].get(fld))
        pct = ok / len(common) * 100 if common else 0
        flag = "OK " if ok == len(common) else "~~ "
        print(f"  {flag}{fld:8} {ok}/{len(common)}  ({pct:.1f}%)")


def main():
    ap = argparse.ArgumentParser(description="Build data/data.json from MATELINE Excel exports.")
    ap.add_argument("--src", required=True, help="folder containing the *_YYYYMM.xlsx files")
    ap.add_argument("--out", help="output JSON path (omit when only --validate)")
    ap.add_argument("--validate", metavar="REF.json", help="compare result to an existing data.json (no write unless --out given)")
    args = ap.parse_args()

    print(f"Building from: {os.path.abspath(args.src)}")
    # When writing output, also emit per-month drill-down files next to it in detail/.
    detail_dir = os.path.join(os.path.dirname(args.out) or ".", "detail") if args.out else None
    data = build(args.src, detail_dir)
    print(f"\nTotal: {len(data['records'])} records across {len(data['months'])} months")

    if args.validate:
        validate(data, args.validate)

    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"\nWrote {args.out}  ({os.path.getsize(args.out)/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()

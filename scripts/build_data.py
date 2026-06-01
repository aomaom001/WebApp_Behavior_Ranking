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
Output : { "months": [...], "records": [ {team,name,region,prov,skill,m, wo,tickets,dup,nowork,cancel,cross,sys,man}, ... ] }

Behaviour metrics (lower = better; see README):
  dup    = wo - tickets            (extra WOs opened against the same ticket)
  nowork = WOs Canceled OR with an empty "Complete Solution"
  cross  = WOs whose Province differs from the ticket's MAIN province
           (main = the most common province among that ticket's WOs)
  sys    = WOs whose "WO Creator" is "System"
  man    = wo - sys

NOTE ON `cross`: the original (pre-pipeline) numbers were produced by a tool we no
longer have. The definition above ("main province = most frequent province of the
ticket") matches the README and reproduces the legacy figures for the large majority
of teams, but not all — the legacy tool likely used an extra site→province lookup.
If you recover that rule, edit `ticket_main_province()` only; everything else is exact.
"""

import argparse
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
]


def month_from_filename(path):
    """'MATELINE TICKET CLOSED_202507.xlsx' -> '2025-07'."""
    m = re.search(r"(\d{4})(\d{2})", os.path.basename(path))
    if not m:
        raise ValueError(f"cannot find YYYYMM in filename: {path}")
    return f"{m.group(1)}-{m.group(2)}"


def parse_name(team):
    """Extract the person name embedded in the team label.

    'MT-CW-NKW-OFC-003 ( Natthawut_OF_NKW  Tel.0930804435_C06 )' -> 'Natthawut_OF_NKW'
    'EX-EA-PCR-OFC-016 ( Jakrin _OF_PCR  Tel... )'               -> 'Jakrin'
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


def ticket_main_province(rows, col):
    """Most common Province per Source Ticket ID (the ticket's 'home' province)."""
    by_ticket = defaultdict(Counter)
    for r in rows:
        tid = r[col["Source Ticket ID"]]
        if is_empty(tid):
            continue
        by_ticket[tid][r[col["Province"]]] += 1
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

    # Per-team accumulators
    agg = defaultdict(lambda: {
        "tickets": set(), "wo": 0, "sys": 0, "cancel": 0, "nowork": 0, "cross": 0,
        "meta": Counter(),  # vote region/prov/skill in case of stray values
    })
    for r in rows:
        team = r[col["Team"]]
        if is_empty(team):
            continue
        a = agg[team]
        a["wo"] += 1
        tid = r[col["Source Ticket ID"]]
        if not is_empty(tid):
            a["tickets"].add(tid)
        creator = r[col["WO Creator"]]
        if creator == "System":
            a["sys"] += 1
        status = r[col["Status"]]
        canceled = status == "Canceled"
        if canceled:
            a["cancel"] += 1
        if canceled or is_empty(r[col["Complete Solution"]]):
            a["nowork"] += 1
        prov = r[col["Province"]]
        if not is_empty(tid) and prov != main_prov.get(tid, prov):
            a["cross"] += 1
        a["meta"][(r[col["Region"]], prov, r[col["Skill"]])] += 1

    records = []
    for team, a in agg.items():
        region, prov, skill = a["meta"].most_common(1)[0][0]
        wo = a["wo"]
        tickets = len(a["tickets"])
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
        })
    return records


def build(src_dir):
    files = sorted(glob.glob(os.path.join(src_dir, "*.xlsx")))
    files = [f for f in files if re.search(r"\d{6}", os.path.basename(f))]
    if not files:
        sys.exit(f"no '*YYYYMM*.xlsx' files found in {src_dir}")
    all_records = []
    months = []
    for f in files:
        month = month_from_filename(f)
        print(f"  reading {os.path.basename(f)}  ->  {month}", flush=True)
        recs = process_file(f, month)
        all_records.extend(recs)
        months.append(month)
        print(f"    {len(recs)} teams", flush=True)
    months = sorted(set(months))
    return {"months": months, "records": all_records}


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
    data = build(args.src)
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

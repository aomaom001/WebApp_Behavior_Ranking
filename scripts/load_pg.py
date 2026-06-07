#!/usr/bin/env python3
"""
load_pg.py — load the MATELINE "TICKET CLOSED" Excel exports into PostgreSQL.

Creates table `mateline_ticket_closed` (snake_case columns) and bulk-COPYs every WO row,
so the live API (api/main.py) can query it. Run once when seeding the bundled database;
re-run when new monthly files arrive.

Usage:
    PG_HOST=localhost PG_PORT=5433 PG_DB=tt PG_USER=postgres PG_PASSWORD=... \
        python scripts/load_pg.py --src "C:/path/to/excel/folder"

Requires: openpyxl, psycopg  (pip install openpyxl "psycopg[binary]")
"""

import argparse
import glob
import os
import re
import sys

try:
    import openpyxl
    import psycopg
except ImportError as e:
    sys.exit(f"missing dependency: {e}.  pip install openpyxl \"psycopg[binary]\"")

SHEET = "RAW Data"
# Excel header -> snake_case DB column (matches api COLMAP). "closed" is the month source.
COLS = [
    ("Work Order ID", "work_order_id"), ("Team", "team"), ("Source Ticket ID", "source_ticket_id"),
    ("Province", "province"), ("Region", "region"), ("Skill", "skill"), ("Status", "status"),
    ("WO Creator", "wo_creator"), ("Complete Solution", "complete_solution"), ("Severity", "severity"),
    ("Work Type", "work_type"), ("Root Cause", "root_cause"), ("SLA", "sla"), ("Site ID", "site_id"),
    ("Closed", "closed"),
]


def conninfo():
    return (f"host={os.environ.get('PG_HOST', 'localhost')} port={os.environ.get('PG_PORT', '5432')} "
            f"dbname={os.environ.get('PG_DB', 'postgres')} user={os.environ.get('PG_USER', 'postgres')} "
            f"password={os.environ.get('PG_PASSWORD', '')}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="folder with the *_YYYYMM.xlsx files")
    args = ap.parse_args()
    files = [f for f in sorted(glob.glob(os.path.join(args.src, "*.xlsx")))
             if not os.path.basename(f).startswith("~$") and re.search(r"\d{6}", os.path.basename(f))]
    if not files:
        sys.exit(f"no '*YYYYMM*.xlsx' files in {args.src}")

    snake = [c[1] for c in COLS]
    coldefs = ", ".join(("closed timestamp" if s == "closed" else f"{s} text") for s in snake)
    print(f"Loading {len(files)} files into mateline_ticket_closed ...", flush=True)
    with psycopg.connect(conninfo()) as conn, conn.cursor() as cur:
        cur.execute("DROP TABLE IF EXISTS mateline_ticket_closed")
        cur.execute(f"CREATE TABLE mateline_ticket_closed ({coldefs})")
        conn.commit()
        total = 0
        for f in files:
            wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
            if SHEET not in wb.sheetnames:
                wb.close(); print(f"  SKIP {os.path.basename(f)} (no '{SHEET}' sheet)"); continue
            it = wb[SHEET].iter_rows(values_only=True)
            header = list(next(it))
            idx = {h: i for i, h in enumerate(header)}
            src = [idx.get(x[0]) for x in COLS]            # column position in this sheet (None if absent)
            n = 0
            with cur.copy(f"COPY mateline_ticket_closed ({', '.join(snake)}) FROM STDIN") as cp:
                for row in it:
                    cp.write_row([(row[i] if i is not None else None) for i in src])
                    n += 1
            wb.close()
            conn.commit()
            total += n
            print(f"  {os.path.basename(f)}: {n} rows", flush=True)
        cur.execute("CREATE INDEX IF NOT EXISTS ix_mtc_closed ON mateline_ticket_closed (closed)")
        conn.commit()
    print(f"DONE — {total} rows in mateline_ticket_closed", flush=True)


if __name__ == "__main__":
    main()

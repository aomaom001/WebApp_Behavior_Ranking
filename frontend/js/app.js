/**
 * Team Behavior Ranking Dashboard
 * Static, no build step. Loads data/data.json (served over HTTP) then boots the UI.
 * Features: multi-month comparison, per-dimension drill-down (Severity/Status/Work Type/
 * Root Cause/SLA), Thai/English i18n, sortable ranking, accessible chart + data tables.
 */
"use strict";

const icon = (id, cls) => `<svg class="ico ${cls || ""}" aria-hidden="true"><use href="#${id}"/></svg>`;

/* ---------------- i18n ---------------- */
let LANG = (function () { try { return localStorage.getItem("lang") === "en" ? "en" : "th"; } catch (e) { return "th"; } })();
const I18N = {
  th: {
    skip: "ข้ามไปยังเนื้อหาหลัก", loading: "กำลังโหลดข้อมูล…",
    subtitle: "แดชบอร์ดกำกับดูแลทีมช่างภาคสนาม · หลายเงื่อนไขตรวจจับ · MATELINE + Work Load",
    copy: "คัดลอกลิงก์", copied: "คัดลอกแล้ว", src_btn: "ที่มาข้อมูล", files: "ไฟล์",
    theme_dark: "สลับเป็นธีมมืด", theme_light: "สลับเป็นธีมสว่าง",
    nav_conditions: "เงื่อนไขจับผิด",
    skill_all: "ทุก Skill", ctl_level: "จัดอันดับราย", lvl_region: "ภาค", lvl_prov: "จังหวัด", lvl_team: "ทีม",
    ctl_months: "เลือกเดือนที่เปรียบเทียบ", q_all: "ทั้งหมด", q_last3: "3 ล่าสุด", q_last6: "6 ล่าสุด",
    ctl_filter: "กรองผล", search_ph: "ค้นหา ชื่อ / ภาค / จังหวัด…", search_al: "ค้นหาชื่อ ภาค หรือจังหวัด", clear: "ล้างตัวกรอง",
    region_all: "ทุกภาค", prov_all: "ทุกจังหวัด",
    signal_note: "อันดับสูง = <b>สัญญาณให้เข้าไปตรวจสอบ</b> ไม่ใช่ข้อสรุปว่าทำผิด",
    lg_lower: "ค่าต่ำ = ดีกว่า · อันดับ 1 = แย่ที่สุด", lg_down: "ลดลง = ดีขึ้น", lg_up: "เพิ่มขึ้น = แย่ลง", lg_flat: "|Δ| < 0.05 pt = ทรงตัว",
    th_name: "ชื่อ", th_delta: "Δ เปลี่ยนแปลง", th_trend: "แนวโน้ม", th_wo: "WO",
    rank_by: "จัดอันดับด้วยเดือน", ranktag: "เกณฑ์อันดับ", cmp: "เทียบ",
    showing: "แสดง", of: "จาก", units: "หน่วย", hidden: "ซ่อน", wo_lt: "WO <",
    pick_months: "เลือกอย่างน้อย 1 เดือนเพื่อเปรียบเทียบ",
    no_match: "ไม่พบหน่วยที่ตรงกับคำค้น", no_data: "ไม่มีข้อมูลตามเงื่อนไข ลองลดค่า “WO ≥” หรือกดล้างตัวกรอง",
    render_err: "เกิดข้อผิดพลาดในการแสดงผล ลองกดล้างตัวกรอง",
    rank_title: "อันดับ {beh} · ราย{lvl}", detail_title: "รายละเอียดหน่วยที่เลือก", trend_title: "แนวโน้มรายเดือน: {beh}",
    hint_click: "คลิกแถวในตารางเพื่อดูค่าพฤติกรรม จำนวนดิบ และการกระจายตัวของหน่วยนั้น",
    detail_no_b: "หน่วยที่เลือกไม่มีข้อมูลในเดือนล่าสุดที่เลือก ลองเปลี่ยนไปเดือนอื่น",
    behavior: "พฤติกรรม", overview: "ภาพรวม (ตามตัวกรอง)",
    bd_title: "เจาะลึกการกระจายตัว", bd_scope: "ขอบเขต", bd_all: "ทั้งหมดตามตัวกรอง",
    bd_empty: "ไม่มีข้อมูลในมิตินี้สำหรับขอบเขต/เดือนที่เลือก", bd_total: "รวม",
    other: "อื่นๆ", none: "ไม่ระบุ", sev_other: "ไม่ระบุระดับ", unit_ticket: "ใบ", unit_wo: "WO",
    cards_imp: "หน่วยที่ดีขึ้น", cards_wor: "หน่วยที่แย่ลง", cards_flat: "ทรงตัว", cards_from: "จาก",
    card_overview: "ภาพรวม", card_base: "เดือนแรกอยู่ที่",
    foot_def: "นิยามตัวชี้วัด", foot_sub: "(ค่าต่ำ = ดีกว่า · อันดับ 1 = แย่ที่สุด · Δ ลดลง = ดีขึ้น · |Δ| < 0.05 pt = ทรงตัว)",
    foot_help: "ดูสูตรการคำนวณทั้ง 4 พฤติกรรม", range_all: "ทั้งช่วง",
    src_title: "ที่มาของข้อมูล", src_from: "ดึงข้อมูลจาก", src_range: "ช่วง", src_unitmonths: "หน่วย-เดือน",
    src_source: "แหล่งที่มา", src_proc: "ประมวลผลเป็น <code>data/data.json</code> ด้วยสคริปต์ <code>scripts/build_data.py</code>",
    src_folder: "โฟลเดอร์ต้นทาง", src_gen: "สร้างไฟล์ข้อมูลเมื่อ",
    src_livequery: "คิวรีสดจากตาราง", src_queried: "ดึงข้อมูลเมื่อ",
    src_derived: "* รายชื่อไฟล์อนุมานจากเดือนในข้อมูล (รัน build_data.py ใหม่เพื่อฝังชื่อไฟล์และวันที่จริงลงในไฟล์)",
    src_thfile: "ไฟล์ต้นทาง", src_thmonth: "เดือน", src_thteams: "หน่วย (ทีม)",
    formulas: "<b>WO ซ้ำ Ticket</b> = (จำนวน WO − Ticket ไม่ซ้ำ) ÷ WO<br><b>ไม่ทำงานจริง</b> = WO ที่ Canceled หรือไม่มี Complete Solution หรือเป็น No-Visit ÷ WO<br><b>ข้าม Province</b> = WO ที่ Province ≠ Province หลักของ Ticket ÷ WO<br><b>System ผิดปกติ</b> = WO ที่ Creator = System ÷ WO<br>หน่วยที่มี WO ในเดือนล่าสุดน้อยกว่าค่า “WO ≥” จะถูกตัดออกจากการจัดอันดับ",
  },
  en: {
    skip: "Skip to main content", loading: "Loading data…",
    subtitle: "Field-team oversight dashboard · multiple detection conditions · MATELINE + Work Load",
    copy: "Copy link", copied: "Copied", src_btn: "Data source", files: "files",
    theme_dark: "Switch to dark theme", theme_light: "Switch to light theme",
    nav_conditions: "Detection conditions",
    skill_all: "All skills", ctl_level: "Rank by", lvl_region: "Region", lvl_prov: "Province", lvl_team: "Team",
    ctl_months: "Months to compare", q_all: "All", q_last3: "Last 3", q_last6: "Last 6",
    ctl_filter: "Filter", search_ph: "Search name / region / province…", search_al: "Search name, region or province", clear: "Reset filters",
    region_all: "All regions", prov_all: "All provinces",
    signal_note: "High rank = <b>a signal to investigate</b>, not a verdict",
    lg_lower: "Lower = better · Rank 1 = worst", lg_down: "Down = improved", lg_up: "Up = worsened", lg_flat: "|Δ| < 0.05 pt = flat",
    th_name: "Name", th_delta: "Δ change", th_trend: "Trend", th_wo: "WO",
    rank_by: "Ranked by", ranktag: "ranks", cmp: "Compare",
    showing: "Showing", of: "of", units: "units", hidden: "hidden", wo_lt: "WO <",
    pick_months: "Select at least one month to compare",
    no_match: "No units match your search", no_data: "No data for these filters. Lower “WO ≥” or reset filters.",
    render_err: "Something went wrong rendering. Try resetting the filters.",
    rank_title: "Ranking {beh} · by {lvl}", detail_title: "Selected unit detail", trend_title: "Monthly trend: {beh}",
    hint_click: "Click a row to see the behaviour, raw counts and the unit's breakdown",
    detail_no_b: "Selected unit has no data in the latest selected month. Try another month.",
    behavior: "Behaviour", overview: "Overview (current filter)",
    bd_title: "Breakdown drill-down", bd_scope: "Scope", bd_all: "all (current filter)",
    bd_empty: "No data for this dimension in the selected scope/month", bd_total: "total",
    other: "Other", none: "N/A", sev_other: "Unspecified", unit_ticket: "tickets", unit_wo: "WO",
    cards_imp: "improved", cards_wor: "worsened", cards_flat: "flat", cards_from: "of",
    card_overview: "Overview", card_base: "first month at",
    foot_def: "Metric definitions", foot_sub: "(lower = better · rank 1 = worst · Δ down = improved · |Δ| < 0.05 pt = flat)",
    foot_help: "Show how the 4 behaviours are computed", range_all: "Full range",
    src_title: "Data source", src_from: "Built from", src_range: "range", src_unitmonths: "unit-months",
    src_source: "Source", src_proc: "Processed into <code>data/data.json</code> by <code>scripts/build_data.py</code>",
    src_folder: "Source folder", src_gen: "Data generated at",
    src_livequery: "Live query from table", src_queried: "Queried at",
    src_derived: "* Filenames inferred from months in the data (re-run build_data.py to embed real filenames and dates).",
    src_thfile: "Source file", src_thmonth: "Month", src_thteams: "Units (teams)",
    formulas: "<b>Duplicate WO/Ticket</b> = (WO − distinct tickets) ÷ WO<br><b>No real work</b> = WOs Canceled, with no Complete Solution, or No-Visit ÷ WO<br><b>Cross-province</b> = WOs whose province ≠ ticket's main province ÷ WO<br><b>Abnormal System WO</b> = WOs created by System ÷ WO<br>Units with fewer than “WO ≥” WOs in the latest month are excluded from ranking",
  },
};
Object.assign(I18N.th, {
  drill_hint: "คลิกเพื่อดูรายการ", drill_title: "รายการที่เจาะลึก", drill_loading: "กำลังโหลดรายละเอียด…",
  drill_empty: "ไม่พบรายการตามเงื่อนไข", drill_tickets: "ใบ (Ticket)", drill_distinct: "Ticket ไม่ซ้ำ",
  drill_first: "แสดง {n} แรก จาก", drill_more: "รายการ ใช้ช่องค้นหาเพื่อกรองให้แคบลง", drill_search: "ค้นหาในรายการ…",
  col_team: "ทีม", col_loc: "ภาค · จังหวัด", col_sev: "Severity", col_status: "Status",
  col_wtype: "Work Type", col_root: "Root Cause", col_sla: "SLA", col_site: "Site",
  err_title: "โหลดข้อมูลไม่สำเร็จ", err_body: "ต้องเปิดผ่าน web server ไม่ใช่เปิดไฟล์ตรง ๆ ดูวิธีรันในไฟล์ README (เช่น npm run dev)",
  pdt_nav: "PDT & Point", pdt_nav_d: "PDT/Day · Man Hour/Day · Point",
  pdt_month: "เดือน", pdt_week: "Week", pdt_allweeks: "ทุก Week",
  pdt_t1: "PDT/Day ไม่ผ่านเกณฑ์ (OFC<2.7 · NODE<3.5)", pdt_t2: "Man Hour/Day ไม่ผ่าน (<9)",
  pdt_t3: "เวลาทำงาน — ทีมไม่ผ่านทั้ง 2 เงื่อนไข", pdt_t4: "Point/Day เกินมาตรฐาน (>13)",
  pdt_pickweek: "เลือก Week ก่อน เพื่อดูแผงนี้", pdt_none: "ไม่มีทีมที่เข้าเงื่อนไข",
  pdt_th_pdt: "PDT/Day", pdt_th_mhd: "MH/Day", pdt_th_first: "Arrived แรก", pdt_th_last: "Completed สุด",
  pdt_th_hours: "ชม.ทำงาน", pdt_th_ptday: "Point/วัน", pdt_th_days: "วัน", pdt_th_work: "งานหลัก",
  pdt_trend: "แนวโน้มรายสัปดาห์ (อดีต → ปัจจุบัน)",
  pdtd_hint: "คลิกเพื่อดูเหตุผลเชิงลึก",
  pdtd_verdict: "ผลตรวจ", pdtd_reasons: "ทำไมทีมนี้ถึงถูกชี้เป้า", pdtd_evidence: "หลักฐานรายวัน",
  pdtd_worktypes: "ประเภทงานที่ดัน Point", pdtd_baseline: "เกณฑ์", pdtd_avg: "ค่าเฉลี่ย",
  pdtd_gap: "ห่างจากเกณฑ์", pdtd_below_n: "{n} วันต่ำกว่าเกณฑ์", pdtd_over_n: "{n} วันเกินเกณฑ์",
  pdtd_fail: "ไม่ผ่าน", pdtd_pass: "ผ่าน", pdtd_flag: "ถูกชี้เป้า", pdtd_th_date: "วันที่", pdtd_th_wk: "Week",
  pdtd_th_wd: "วันทำงาน", pdtd_th_disp: "จ่ายงาน", pdtd_th_comp: "ปิดงาน", pdtd_th_span: "ช่วงเวลาทำงาน",
  pdtd_th_wo: "ใบงาน", pdtd_th_pts: "Point", pdtd_th_share: "สัดส่วน", pdtd_th_mh: "Man Hour",
  pdtd_noml: "ต้องเลือก Week จึงจะดูหลักฐานจากข้อมูล MATELINE ได้",
  pdtd_r_pdt: "PDT/Day เฉลี่ย {v} ต่ำกว่าเกณฑ์ {sk} ที่ {thr} อยู่ {gap} ตลอด {days} วันทำงาน",
  pdtd_r_mhd: "Man Hour/Day เฉลี่ย {v} ต่ำกว่าเกณฑ์ขั้นต่ำ 9 อยู่ {gap} ตลอด {days} วันทำงาน",
  pdtd_r_both: "ไม่ผ่านทั้ง PDT/Day ({pdt}) และ Man Hour/Day ({mhd}) จึงถูกดึงมาดูรูปแบบเวลาทำงาน",
  pdtd_r_span: "ช่วงเวลาทำงานเฉลี่ย {span} ชม./วัน (Arrived แรก → Completed สุด) จาก {days} วัน",
  pdtd_r_ppd: "Point/Day เฉลี่ย {v} สูงกว่ามาตรฐาน 13 อยู่ {gap} จาก {pts} point ใน {days} วัน",
  pdtd_r_topwork: "งาน \"{w}\" คิดเป็น {share} ของ point ทั้งหมด",
  pdtd_summary: "สรุปช่วงที่เลือก", pdtd_s_worked: "ทำงานจริง", pdtd_s_wo: "ใบงานทั้งหมด",
  pdtd_s_travel: "เวลาเดินทางเฉลี่ย", pdtd_s_onsite: "เวลาหน้างานเฉลี่ย", pdtd_s_points: "Point รวม",
  pdtd_worktypes2: "ทำงานอะไรบ้าง (แยกตามประเภทงาน)", pdtd_worklog: "บันทึกการทำงาน รายใบงาน",
  pdtd_th_sev: "ระดับ", pdtd_th_depart: "ออกเดินทาง", pdtd_th_arrive: "ถึงหน้างาน", pdtd_th_travel: "เดินทาง",
  pdtd_th_done: "ปิดงาน", pdtd_th_onsite: "หน้างาน", pdtd_th_detail: "รายละเอียดงาน", pdtd_th_travelavg: "เดินทางเฉลี่ย",
  pdtd_unit_day: "วัน", pdtd_nowork: "ไม่มีใบงานในช่วงเวลาที่เลือก", pdtd_capped: "(แสดง {n} ใบล่าสุด)", pdtd_min: "นาที",
  dur_hr: "ชม.", dur_min: "น.",
});
Object.assign(I18N.en, {
  drill_hint: "Click to list records", drill_title: "Drill-down records", drill_loading: "Loading detail…",
  drill_empty: "No records match", drill_tickets: "tickets", drill_distinct: "distinct tickets",
  drill_first: "Showing first {n} of", drill_more: "records. Use search to narrow it down.", drill_search: "Search list…",
  col_team: "Team", col_loc: "Region · Province", col_sev: "Severity", col_status: "Status",
  col_wtype: "Work Type", col_root: "Root Cause", col_sla: "SLA", col_site: "Site",
  err_title: "Couldn't load data", err_body: "Open it through a web server, not by opening the file directly. See the README (e.g. npm run dev).",
  pdt_nav: "PDT & Point", pdt_nav_d: "PDT/Day · Man Hour/Day · Point",
  pdt_month: "Month", pdt_week: "Week", pdt_allweeks: "All weeks",
  pdt_t1: "PDT/Day below baseline (OFC<2.7 · NODE<3.5)", pdt_t2: "Man Hour/Day below 9",
  pdt_t3: "Working hours — teams failing both", pdt_t4: "Point/Day over standard (>13)",
  pdt_pickweek: "Pick a Week to see this panel", pdt_none: "No teams match",
  pdt_th_pdt: "PDT/Day", pdt_th_mhd: "MH/Day", pdt_th_first: "First arrived", pdt_th_last: "Last completed",
  pdt_th_hours: "Work hrs", pdt_th_ptday: "Point/day", pdt_th_days: "Days", pdt_th_work: "Top work",
  pdt_trend: "Weekly trend (past → present)",
  pdtd_hint: "Click for the full reason",
  pdtd_verdict: "Verdict", pdtd_reasons: "Why this team is flagged", pdtd_evidence: "Daily evidence",
  pdtd_worktypes: "Work types driving the points", pdtd_baseline: "Baseline", pdtd_avg: "Average",
  pdtd_gap: "Gap to baseline", pdtd_below_n: "{n} days below baseline", pdtd_over_n: "{n} days over standard",
  pdtd_fail: "Fail", pdtd_pass: "Pass", pdtd_flag: "Flagged", pdtd_th_date: "Date", pdtd_th_wk: "Week",
  pdtd_th_wd: "Work days", pdtd_th_disp: "Dispatched", pdtd_th_comp: "Completed", pdtd_th_span: "Working span",
  pdtd_th_wo: "WOs", pdtd_th_pts: "Point", pdtd_th_share: "Share", pdtd_th_mh: "Man Hour",
  pdtd_noml: "Pick a Week to load the MATELINE evidence for this team",
  pdtd_r_pdt: "Average PDT/Day {v} is {gap} below the {sk} baseline of {thr}, across {days} work days",
  pdtd_r_mhd: "Average Man Hour/Day {v} is {gap} below the minimum of 9, across {days} work days",
  pdtd_r_both: "Fails both PDT/Day ({pdt}) and Man Hour/Day ({mhd}), so its working-hours pattern is examined",
  pdtd_r_span: "Working span averages {span} hrs/day (first arrived → last completed) over {days} days",
  pdtd_r_ppd: "Average Point/Day {v} is {gap} above the standard of 13, from {pts} points over {days} days",
  pdtd_r_topwork: "Work type \"{w}\" accounts for {share} of all points",
  pdtd_summary: "Selected-period summary", pdtd_s_worked: "Days worked", pdtd_s_wo: "Work orders",
  pdtd_s_travel: "Avg travel", pdtd_s_onsite: "Avg on-site", pdtd_s_points: "Total points",
  pdtd_worktypes2: "What they did (by work type)", pdtd_worklog: "Work log (per WO)",
  pdtd_th_sev: "Severity", pdtd_th_depart: "Departed", pdtd_th_arrive: "Arrived", pdtd_th_travel: "Travel",
  pdtd_th_done: "Completed", pdtd_th_onsite: "On-site", pdtd_th_detail: "Work detail", pdtd_th_travelavg: "Avg travel",
  pdtd_unit_day: "days", pdtd_nowork: "No work orders in the selected period", pdtd_capped: "(latest {n} shown)", pdtd_min: "min",
  dur_hr: "h", dur_min: "m",
});
Object.assign(I18N.th, {
  imp_nav: "นำเข้าข้อมูล", imp_nav_d: "Template · ตรวจสอบ · Import",
  imp_step1: "เลือกชุดข้อมูล", imp_step1d: "จะนำเข้าตารางไหน",
  imp_step2: "ดาวน์โหลด Template", imp_step2d: "เปิดไฟล์ แล้วก็อปข้อมูลวางใต้หัวตาราง (อย่าแก้ชื่อหัวตาราง)",
  imp_template_lbl: "ดาวน์โหลด Template (.xlsx)", imp_cols_sum: "คอลัมน์ที่ต้องมี ({n})",
  imp_step3: "อัปโหลด & ตรวจสอบ", imp_step3d: "เลือกไฟล์ที่กรอกแล้ว ระบบจะตรวจให้ก่อนนำเข้า",
  imp_drop_main: "ลากไฟล์มาวาง หรือคลิกเพื่อเลือก", imp_drop_sub: "รองรับ .xlsx เท่านั้น",
  imp_drop_file: "ไฟล์: {name}",
  imp_mode_append: "เพิ่มต่อท้าย", imp_mode_append_d: "เก็บข้อมูลเดิม แล้วเพิ่มแถวใหม่",
  imp_mode_replace: "แทนที่ทั้งหมด", imp_mode_replace_d: "ลบข้อมูลเดิมทั้งตารางก่อน",
  imp_report_title: "ผลการตรวจสอบ", imp_checking: "กำลังตรวจสอบ…", imp_committing: "กำลังนำเข้า…",
  imp_ok: "ข้อมูลพร้อมนำเข้า", imp_blocked: "ยังนำเข้าไม่ได้ ต้องแก้ก่อน",
  imp_total: "แถวทั้งหมด", imp_valid: "จะนำเข้า", imp_skipped: "ข้าม (ไม่มี key)", imp_issues: "เซลล์ที่มีปัญหา",
  imp_key_missing: "ขาดคอลัมน์หลักที่จำเป็น", imp_missing_headers: "คอลัมน์ที่ขาด (จะถูกเว้นว่าง)",
  imp_preview: "ตัวอย่างข้อมูล (แถวแรก ๆ)", imp_issue_list: "รายการเซลล์ที่แปลงค่าไม่ได้",
  imp_th_row: "แถว", imp_th_col: "คอลัมน์", imp_th_val: "ค่า", imp_th_reason: "ปัญหา",
  imp_reset: "ล้าง/เลือกไฟล์ใหม่", imp_commit_append: "ยืนยันนำเข้า (เพิ่มต่อ)", imp_commit_replace: "ยืนยันนำเข้า (แทนที่)",
  imp_done: "นำเข้าสำเร็จ {n} แถว → {table}", imp_replace_warn: "โหมดแทนที่จะลบข้อมูลเดิมทั้งหมดในตารางนี้ก่อน — ทำแล้วย้อนกลับไม่ได้",
  imp_err: "เกิดข้อผิดพลาด", imp_more_issues: "และอีก {n} รายการ",
  flow_title: "การไหลของข้อมูล (Live)", flow_live: "อัปเดตสด", flow_updated: "อัปเดตเมื่อ {t}",
  flow_sub: "ข้อมูลในฐานข้อมูลไหลไปแสดงผลในแท็บไหนบ้าง — ตัวเลขอัปเดตอัตโนมัติ และหลังนำเข้าข้อมูลใหม่",
  flow_src: "ฐานข้อมูล", flow_use: "นำไปใช้ใน", flow_rows: "แถว", flow_months: "เดือน", flow_latest: "ล่าสุด",
  flow_c_dup: "WO ซ้ำ Ticket เดิม", flow_c_pdt: "PDT/Day ไม่ผ่านเกณฑ์", flow_c_mhd: "Man Hour/Day < 9",
  flow_c_hours: "เวลาทำงาน (ไม่ผ่านทั้งคู่)", flow_c_point: "Point/Day เกิน 13",
  flow_tab_dup: "แท็บ WO ซ้ำ Ticket", flow_tab_pdt: "แท็บ PDT & Point",
  auth_title: "เข้าสู่ระบบ", auth_sub: "ลงชื่อเข้าใช้เพื่อเปิดแดชบอร์ดกำกับดูแล", auth_user: "ชื่อผู้ใช้", auth_pass: "รหัสผ่าน",
  auth_login: "เข้าสู่ระบบ", auth_logging: "กำลังเข้าสู่ระบบ…", auth_bad: "เข้าสู่ระบบไม่สำเร็จ", auth_logout: "ออกจากระบบ",
  auth_brand_h: "เห็นทีมที่ควรตรวจสอบ ก่อนใคร", auth_brand_p: "หลายเงื่อนไขตรวจจับ — WO ซ้ำ Ticket, PDT & Point พร้อมเจาะลึกหลายมิติ จากข้อมูล MATELINE + Work Load สด",
  auth_foot: "ww.co.th · เครื่องมือภายในองค์กร",
  role_admin: "ผู้ดูแลระบบ", role_viewer: "ผู้ชม",
  users_btn: "ผู้ใช้งาน", users_title: "จัดการผู้ใช้งาน", users_add: "เพิ่มผู้ใช้ใหม่",
  users_th_user: "ชื่อผู้ใช้", users_th_role: "สิทธิ์", users_th_act: "จัดการ",
  users_uname_ph: "ชื่อผู้ใช้", users_pw_ph: "รหัสผ่าน", users_newpw_ph: "รหัสผ่านใหม่ (เว้นว่าง=คงเดิม)",
  users_create: "เพิ่ม", users_save: "บันทึก", users_del: "ลบ", users_you: "(คุณ)",
  users_del_confirm: "ลบผู้ใช้ \"{u}\" ?", users_saved: "บันทึกแล้ว", users_loaderr: "โหลดรายชื่อผู้ใช้ไม่ได้",
});
Object.assign(I18N.en, {
  imp_nav: "Import data", imp_nav_d: "Template · validate · import",
  imp_step1: "Choose a dataset", imp_step1d: "Which table to import into",
  imp_step2: "Download the template", imp_step2d: "Open it and paste your rows under the header (don't rename the headers)",
  imp_template_lbl: "Download template (.xlsx)", imp_cols_sum: "Required columns ({n})",
  imp_step3: "Upload & validate", imp_step3d: "Pick the filled file; it's checked before anything is imported",
  imp_drop_main: "Drag a file here, or click to choose", imp_drop_sub: ".xlsx only",
  imp_drop_file: "File: {name}",
  imp_mode_append: "Append", imp_mode_append_d: "Keep existing rows, add the new ones",
  imp_mode_replace: "Replace all", imp_mode_replace_d: "Empty the whole table first",
  imp_report_title: "Validation result", imp_checking: "Checking…", imp_committing: "Importing…",
  imp_ok: "Ready to import", imp_blocked: "Can't import yet, fix the issues first",
  imp_total: "Total rows", imp_valid: "Will import", imp_skipped: "Skipped (no key)", imp_issues: "Cell issues",
  imp_key_missing: "Missing required key column", imp_missing_headers: "Missing columns (left blank)",
  imp_preview: "Preview (first rows)", imp_issue_list: "Cells that couldn't be parsed",
  imp_th_row: "Row", imp_th_col: "Column", imp_th_val: "Value", imp_th_reason: "Issue",
  imp_reset: "Clear / choose another", imp_commit_append: "Confirm import (append)", imp_commit_replace: "Confirm import (replace)",
  imp_done: "Imported {n} rows → {table}", imp_replace_warn: "Replace mode deletes ALL existing rows in this table first — this can't be undone",
  imp_err: "Something went wrong", imp_more_issues: "and {n} more",
  flow_title: "Data flow (Live)", flow_live: "Live", flow_updated: "updated {t}",
  flow_sub: "Where each table feeds in the dashboard — counts refresh automatically and after every import.",
  flow_src: "Database", flow_use: "Used in", flow_rows: "rows", flow_months: "months", flow_latest: "latest",
  flow_c_dup: "Duplicate WO/Ticket", flow_c_pdt: "PDT/Day below baseline", flow_c_mhd: "Man Hour/Day < 9",
  flow_c_hours: "Working hours (fails both)", flow_c_point: "Point/Day over 13",
  flow_tab_dup: "Duplicate WO/Ticket tab", flow_tab_pdt: "PDT & Point tab",
  auth_title: "Sign in", auth_sub: "Sign in to open the oversight dashboard", auth_user: "Username", auth_pass: "Password",
  auth_login: "Sign in", auth_logging: "Signing in…", auth_bad: "Sign-in failed", auth_logout: "Sign out",
  auth_brand_h: "Spot the teams worth checking, first", auth_brand_p: "Multiple detection conditions — Duplicate WO/Ticket, PDT & Point with multi-dimensional drill-down, live from MATELINE + Work Load",
  auth_foot: "ww.co.th · internal tool",
  role_admin: "Admin", role_viewer: "Viewer",
  users_btn: "Users", users_title: "Manage users", users_add: "Add a user",
  users_th_user: "Username", users_th_role: "Role", users_th_act: "Actions",
  users_uname_ph: "username", users_pw_ph: "password", users_newpw_ph: "new password (blank = keep)",
  users_create: "Add", users_save: "Save", users_del: "Delete", users_you: "(you)",
  users_del_confirm: "Delete user \"{u}\" ?", users_saved: "Saved", users_loaderr: "Couldn't load users",
});
function t(k, vars) {
  let s = (I18N[LANG] && I18N[LANG][k]) != null ? I18N[LANG][k] : k;
  if (vars) for (const v in vars) s = s.replace("{" + v + "}", vars[v]);
  return s;
}

// ---- auth layer (runs before the app boots) ----
const AUTH = { token: null, user: null };
try { AUTH.token = localStorage.getItem("tt_token"); } catch (e) {}
const isAdmin = () => !!(AUTH.user && AUTH.user.role === "admin");
function onAuthFail() {
  AUTH.token = null; AUTH.user = null;
  try { localStorage.removeItem("tt_token"); } catch (e) {}
  showLogin();
}
// fetch wrapper that attaches the bearer token and bounces to login on 401
function apiFetch(path, opts) {
  opts = opts || {};
  const headers = Object.assign({}, opts.headers || {});
  if (AUTH.token) headers["Authorization"] = "Bearer " + AUTH.token;
  return fetch(path, Object.assign({}, opts, { headers })).then((r) => {
    if (r.status === 401) { onAuthFail(); throw new Error("unauthorized"); }
    return r;
  });
}
// Prefer the live PostgreSQL-backed API; fall back to the static data file (only on a real outage, never on 401).
function loadJSON(apiPath, staticPath) {
  return apiFetch(apiPath).then((r) => { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
    .catch((e) => { if (String(e).includes("unauthorized")) throw e; return fetch(staticPath).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); });
}
const $$ = (id) => document.getElementById(id);
function showLogin() {
  const sc = $$("authScreen"); if (!sc) return;
  const loading = $$("loading"); if (loading) loading.remove();
  $$("authTitle").textContent = t("auth_title");
  $$("authSub").textContent = t("auth_sub");
  $$("authUserLbl").textContent = t("auth_user");
  $$("authPassLbl").textContent = t("auth_pass");
  $$("authSubmit").textContent = t("auth_login");
  $$("authBrandH").textContent = t("auth_brand_h");
  $$("authBrandP").textContent = t("auth_brand_p");
  $$("authBrandFoot").textContent = t("auth_foot");
  $$("authErr").hidden = true;
  document.querySelector(".wrap").style.display = "none";
  sc.hidden = false;
  setTimeout(() => $$("authUser").focus(), 30);
}
function hideLogin() {
  const sc = $$("authScreen"); if (sc) sc.hidden = true;
  const w = document.querySelector(".wrap"); if (w) w.style.display = "";
}
$$("authToggle").addEventListener("click", () => {
  const inp = $$("authPass"), shown = inp.type === "text";
  inp.type = shown ? "password" : "text";
  $$("authToggle").querySelector("use").setAttribute("href", shown ? "#i-eye" : "#i-eye-off");
  inp.focus();
});
$$("authForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const btn = $$("authSubmit"), err = $$("authErr");
  const username = $$("authUser").value.trim(), password = $$("authPass").value;
  btn.disabled = true; btn.classList.add("is-loading"); btn.textContent = t("auth_logging"); err.hidden = true;
  fetch("api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) })
    .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
    .then(({ ok, j }) => {
      if (!ok) throw new Error(j.detail || t("auth_bad"));
      AUTH.token = j.token; AUTH.user = j.user;
      try { localStorage.setItem("tt_token", j.token); } catch (e2) {}
      $$("authPass").value = "";
      hideLogin(); startApp();
    })
    .catch((ex) => { err.textContent = String(ex.message || ex); err.hidden = false; })
    .finally(() => { btn.disabled = false; btn.classList.remove("is-loading"); btn.textContent = t("auth_login"); });
});
function startApp() {
  const w = document.querySelector(".wrap");
  if (w && !w.querySelector("#main")) { location.reload(); return; } // app was torn down by an error screen
  loadJSON("api/data", "./data/data.json")
    .then(boot)
    .catch((err) => {
      console.error(err);
      const loading = $$("loading"); if (loading) loading.remove();
      const wrap = document.querySelector(".wrap");
      if (wrap) wrap.innerHTML = '<div class="errscreen" role="alert">' + icon("i-alert") +
        "<h2>" + t("err_title") + "</h2><p>" + t("err_body") + "</p><pre>" + String(err) + "</pre></div>";
    });
}
function startAuth() {
  if (!AUTH.token) { showLogin(); return; }
  apiFetch("api/auth/me").then((r) => { if (!r.ok) throw new Error("me " + r.status); return r.json(); })
    .then((u) => { AUTH.user = u; hideLogin(); startApp(); })
    .catch(() => { /* 401 already routed to showLogin via apiFetch; other errors: */ if (AUTH.token) onAuthFail(); });
}
startAuth();

function boot(DATA) {
  const loading = document.getElementById("loading"); if (loading) loading.remove();

  const BEH = [
    { k: "dup", th: { t: "WO ซ้ำ Ticket เดิม", d: "WO ต่อ Ticket เกิน 1 → เปิดซ้ำ" }, en: { t: "Duplicate WO/Ticket", d: ">1 WO per ticket → reopened" } },
  ];
  const behName = (b) => b[LANG].t, behDesc = (b) => b[LANG].d;
  const DIMS = DATA.dims || {};
  const dimLabel = (d) => DIMS[d] ? (LANG === "en" ? DIMS[d].label_en : DIMS[d].label_th) : d;
  const dimUnit = (d) => (DIMS[d] && DIMS[d].unit === "ticket") ? t("unit_ticket") : t("unit_wo");
  const lastM = DATA.months.length - 1;

  const S = {
    skill: "ALL", level: "region", beh: "dup", region: "", prov: "",
    months: [Math.max(0, lastM - 2), Math.max(0, lastM - 1), lastM].filter((v, i, a) => a.indexOf(v) === i),
    minWO: 20, sel: null, search: "", sortKey: "rank", sortDir: "asc",
    dim: Object.keys(DIMS)[0] || "sevT",
    view: "dup",
    pdt: { months: [], weeks: [], status: "", region: "", skill: "", province: "" },
    imp: { dataset: "mateline", mode: "append" },
  };
  let pdtData = null;
  let impSpec = null, impFile = null, impReport = null, impBusy = false;
  let lastRows = [], refocusKey = null, bdOtherKeys = [], drillState = null;
  const detailCache = {};

  const $ = (id) => document.getElementById(id);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, v | 0));
  const pct = (v) => (v * 100).toFixed(v < 0.001 ? 2 : 1) + "%";
  const monthLbl = (m) => { const [y, mo] = m.split("-"); return mo + "/" + y.slice(2); };
  const monthLong = (m) => { const [y, mo] = m.split("-"); return mo + "/" + y; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rateColor = (d) => (d < -0.0005 ? "down" : d > 0.0005 ? "up" : "flat");
  const cssEscape = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\\]]/g, "\\$&"));
  const rankMonth = () => S.months[S.months.length - 1];
  const baseMonth = () => S.months[0];
  const catLabel = (key) => key === "OTHER" ? t("sev_other") : (key === "ไม่ระบุ" ? t("none") : key);

  function fmtDelta(d) {
    if (d == null) return '<span class="muted-dash">—</span>';
    const cls = rateColor(d), ic = cls === "down" ? "i-down" : cls === "up" ? "i-up" : "i-minus";
    const v = d * 100, sign = v > 0 ? "+" : "";
    return `<span class="delta ${cls}">${icon(ic)}<span class="tnum">${sign}${v.toFixed(1)} pt</span></span>`;
  }

  /* ---------- data plumbing ---------- */
  function recs() {
    return DATA.records.filter((r) => {
      if (S.skill !== "ALL" && r.skill !== S.skill) return false;
      if (S.level !== "region" && S.region && r.region !== S.region) return false;
      if (S.level === "team" && S.prov && r.prov !== S.prov) return false;
      return true;
    });
  }
  function keyOf(r) {
    if (S.level === "region") return r.region;
    if (S.level === "prov") return r.region + " / " + r.prov;
    return r.team;
  }
  function metaOf(r) {
    if (S.level === "region") return { name: r.region, sub: "ภาค (Region)", region: r.region, prov: "" };
    if (S.level === "prov") return { name: r.prov, sub: "ภาค " + r.region, region: r.region, prov: r.prov };
    return { name: r.name, sub: r.region + " · " + r.prov + " · " + r.skill, region: r.region, prov: r.prov };
  }
  function aggMonth(month) {
    const g = {};
    for (const r of recs()) {
      if (r.m !== month) continue;
      const k = keyOf(r);
      if (!g[k]) g[k] = { wo: 0, tickets: 0, dup: 0, nowork: 0, cross: 0, sys: 0, man: 0, meta: metaOf(r) };
      const o = g[k];
      o.wo += r.wo; o.tickets += r.tickets; o.dup += r.dup; o.nowork += r.nowork; o.cross += r.cross; o.sys += r.sys; o.man += r.man;
    }
    return g;
  }
  function series(key) {
    const out = DATA.months.map(() => ({ num: 0, wo: 0 }));
    for (const r of recs()) {
      if (key !== null && keyOf(r) !== key) continue;
      const i = DATA.months.indexOf(r.m);
      out[i].num += r[S.beh]; out[i].wo += r.wo;
    }
    return out.map((o) => (o.wo ? o.num / o.wo : null));
  }
  // sum a breakdown dimension over current filter (+ optional unit) for one month
  function aggBD(dim, monthIdx, selKey) {
    const month = DATA.months[monthIdx], c = {};
    for (const r of recs()) {
      if (r.m !== month) continue;
      if (selKey != null && keyOf(r) !== selKey) continue;
      const o = r.bd && r.bd[dim]; if (!o) continue;
      for (const k in o) c[k] = (c[k] || 0) + o[k];
    }
    return c;
  }

  // Canonical "badness" ranking by the latest selected month, with per-month rate series.
  function computeRanked() {
    const sel = S.months, rankMi = sel[sel.length - 1];
    const aggs = {}; sel.forEach((mi) => (aggs[mi] = aggMonth(DATA.months[mi])));
    const B = aggs[rankMi];
    const all = Object.keys(B).map((k) => {
      const rates = sel.map((mi) => { const g = aggs[mi][k]; return g && g.wo ? g[S.beh] / g.wo : null; });
      const rB = rates[rates.length - 1], rA = rates[0];
      return { k, meta: B[k].meta, rates, rB, rA, woB: B[k].wo, delta: rA == null || rB == null ? null : rB - rA };
    });
    const eligible = all.filter((x) => x.woB >= S.minWO).sort((x, y) => y.rB - x.rB);
    eligible.forEach((x, i) => (x.rank = i + 1));
    return { ranked: eligible, totalUnits: all.length, hidden: all.length - eligible.length };
  }
  function sortView(rows) {
    const sign = S.sortDir === "asc" ? 1 : -1, key = S.sortKey;
    return rows.slice().sort((a, b) => {
      if (key === "name") return sign * a.meta.name.localeCompare(b.meta.name, "th");
      const va = key === "rank" ? a.rank : a[key], vb = key === "rank" ? b.rank : b[key];
      const na = va == null, nb = vb == null;
      if (na && nb) return 0; if (na) return 1; if (nb) return -1;
      return sign * (va - vb);
    });
  }

  // tiny inline trend sparkline across the selected months.
  // badUp=true → an upward trend is the "bad" one (red); pass false where a falling metric is the problem.
  function spark(rates, badUp = true) {
    const pts = rates.map((v, i) => [i, v]).filter((p) => p[1] != null);
    if (pts.length < 2) return '<span class="muted-dash">—</span>';
    const ys = pts.map((p) => p[1]), mn = Math.min(...ys), mx = Math.max(...ys);
    const w = 88, h = 22, pad = 3, n = rates.length - 1 || 1;
    const X = (i) => pad + (w - 2 * pad) * (i / n);
    const Y = (v) => mx === mn ? h / 2 : pad + (h - 2 * pad) * (1 - (v - mn) / (mx - mn));
    let d = ""; pts.forEach((p) => { d += (d ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1) + " "; });
    const delta = (pts[pts.length - 1][1] - pts[0][1]) * (badUp ? 1 : -1);
    const cls = rateColor(delta);
    const col = cls === "up" ? "var(--bad)" : cls === "down" ? "var(--good)" : "var(--text-faint)";
    const lp = pts[pts.length - 1];
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6"/><circle cx="${X(lp[0]).toFixed(1)}" cy="${Y(lp[1]).toFixed(1)}" r="2.1" fill="${col}"/></svg>`;
  }

  /* ---------- ranking head + body ---------- */
  function renderHead() {
    const rankMi = rankMonth();
    let h = '<tr><th class="l" data-sort="rank"><button type="button">#' + caret() + "</button></th>" +
      '<th class="l" data-sort="name"><button type="button">' + t("th_name") + caret() + "</button></th>";
    S.months.forEach((mi) => {
      h += `<th class="month-col${mi === rankMi ? " is-rankcol" : ""}"><span class="tnum">${monthLbl(DATA.months[mi])}</span>${mi === rankMi ? '<span class="ranktag">' + t("ranktag") + "</span>" : ""}</th>`;
    });
    h += '<th data-sort="delta"><button type="button">' + t("th_delta") + caret() + "</button></th>";
    h += "<th>" + t("th_trend") + "</th>";
    h += '<th data-sort="woB"><button type="button">' + t("th_wo") + caret() + "</button></th></tr>";
    $("rankHead").innerHTML = h;
    $("rankHead").querySelectorAll("th[data-sort]").forEach((th) => {
      if (th.dataset.sort === S.sortKey) th.setAttribute("aria-sort", S.sortDir === "asc" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });
  }
  const caret = () => '<svg class="caret ico" aria-hidden="true"><use href="#i-caret"/></svg>';

  function renderRanking() {
    const colCount = 5 + S.months.length;
    if (!S.months.length) {
      $("rankBody").innerHTML = `<tr class="empty-row"><td colspan="${colCount}">${icon("i-filter")}${t("pick_months")}</td></tr>`;
      $("rowcount").textContent = ""; lastRows = []; return { ranked: [] };
    }
    const { ranked, hidden } = computeRanked();
    const maxR = ranked.length ? Math.max(...ranked.map((x) => x.rB)) : 1;
    const q = S.search.trim().toLowerCase();
    const filtered = q ? ranked.filter((x) => (x.meta.name + " " + x.meta.sub).toLowerCase().includes(q)) : ranked;
    const view = sortView(filtered);
    lastRows = view;

    const body = $("rankBody");
    if (!view.length) {
      body.innerHTML = `<tr class="empty-row"><td colspan="${colCount}">${icon("i-filter")}` +
        (q ? `${t("no_match")} “${esc(S.search)}”` : t("no_data")) + "</td></tr>";
    } else {
      const rankMi = rankMonth();
      body.innerHTML = view.map((x) => {
        const top = x.rank <= 3, rkCls = top ? "top rk-" + x.rank : "";
        let cells = "";
        S.months.forEach((mi, idx) => {
          const v = x.rates[idx], isRank = mi === rankMi;
          cells += `<td class="month-col tnum${isRank ? " is-rankcol" : ""}">` +
            (v == null ? '<span class="muted-dash">—</span>' : (isRank ? `<b>${pct(v)}</b><div class="bar"><i style="width:${Math.max(2, (x.rB / maxR) * 100)}%"></i></div>` : pct(v))) + "</td>";
        });
        return `<tr data-k="${esc(x.k)}" class="${S.sel === x.k ? "sel" : ""}${top ? " is-top" : ""}" tabindex="0" role="button" aria-pressed="${S.sel === x.k}" ` +
          `aria-label="${esc(x.meta.name)} ${t("rank_by") ? "" : ""}#${x.rank}, ${pct(x.rB)}, ${x.delta == null ? "" : (x.delta < 0 ? t("cards_imp") : x.delta > 0 ? t("cards_wor") : t("cards_flat"))}">` +
          `<td class="l"><span class="rk ${rkCls}">${x.rank}</span></td>` +
          `<td class="l"><div class="namecell"><span class="nm" lang="en" title="${esc(x.meta.name)}">${esc(x.meta.name)}</span><small title="${esc(x.meta.sub)}">${esc(x.meta.sub)}</small></div></td>` +
          cells +
          `<td>${fmtDelta(x.delta)}</td>` +
          `<td class="trendcell">${spark(x.rates)}</td>` +
          `<td class="tnum">${x.woB.toLocaleString()}</td></tr>`;
      }).join("");
    }
    const parts = [`${t("showing")} <b>${view.length.toLocaleString()}</b> ${t("of")} <b>${ranked.length.toLocaleString()}</b> ${t("units")}`];
    if (hidden > 0) parts.push(`<span class="hidden-note">${t("hidden")} ${hidden.toLocaleString()} (${t("wo_lt")} ${S.minWO})</span>`);
    $("rowcount").innerHTML = parts.join(" · ");

    if (refocusKey != null) { const el = body.querySelector(`tr[data-k="${cssEscape(refocusKey)}"]`); if (el) el.focus(); refocusKey = null; }
    return { ranked };
  }

  /* ---------- detail ---------- */
  function renderDetail() {
    const box = $("detail");
    if (!S.sel) { box.innerHTML = `<div class="hintbox">${icon("i-arrow")}${t("hint_click")}</div>`; return; }
    const A = aggMonth(DATA.months[baseMonth()])[S.sel], B = aggMonth(DATA.months[rankMonth()])[S.sel];
    if (!B) { box.innerHTML = `<div class="hintbox">${icon("i-info")}${t("detail_no_b")}</div>`; return; }
    const meta = B.meta;
    const rows = BEH.map((b) => {
      const rB = B.wo ? B[b.k] / B.wo : 0, rA = A && A.wo ? A[b.k] / A.wo : null, d = rA == null ? null : rB - rA;
      return `<tr${b.k === S.beh ? ' class="beh-active"' : ""}><td class="l">${behName(b)}</td>` +
        `<td class="tnum">${rA == null ? "—" : pct(rA)}</td><td class="tnum"><b>${pct(rB)}</b></td><td>${fmtDelta(d)}</td></tr>`;
    }).join("");
    box.innerHTML = `<div class="detail">
      <div class="dhead"><div><h3 lang="en">${esc(meta.name)}</h3><div class="meta">${esc(meta.sub)}</div></div>
        <button class="x" type="button" data-action="close">${icon("i-x")}${LANG === "en" ? "Close" : "ปิด"}</button></div>
      <table><thead><tr><th class="l">${t("behavior")}</th><th>A (${monthLbl(DATA.months[baseMonth()])})</th><th>B (${monthLbl(DATA.months[rankMonth()])})</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="kv">
        <span><span lang="en">WO</span>: <b class="tnum">${B.wo.toLocaleString()}</b></span>
        <span>Ticket: <b class="tnum">${B.tickets.toLocaleString()}</b></span>
        <span>${LANG === "en" ? "Duplicate" : "WO ซ้ำ"}: <b class="tnum">${B.dup.toLocaleString()}</b></span>
      </div></div>`;
  }

  /* ---------- cards ---------- */
  function renderCards(rows) {
    const A = aggMonth(DATA.months[baseMonth()]), B = aggMonth(DATA.months[rankMonth()]);
    const sum = (g) => { let n = 0, w = 0; for (const k in g) { n += g[k][S.beh]; w += g[k].wo; } return w ? n / w : 0; };
    const rA = sum(A), rB = sum(B), d = rB - rA;
    let imp = 0, wor = 0;
    rows.forEach((x) => { if (x.delta !== null) { if (x.delta < -0.0005) imp++; else if (x.delta > 0.0005) wor++; } });
    const b = BEH.find((x) => x.k === S.beh);
    $("cards").innerHTML = `
      <div class="card card--primary">
        <div class="k">${t("card_overview")}: ${esc(behName(b))}</div>
        <div class="v"><span class="tnum">${pct(rB)}</span> ${fmtDelta(d)}</div>
        <div class="k sub">${monthLbl(DATA.months[baseMonth()])} → ${monthLbl(DATA.months[rankMonth()])} · ${t("card_base")} ${pct(rA)}</div>
      </div>
      <div class="card card--stat down"><div class="card-ico">${icon("i-down")}</div><div><div class="v down tnum">${imp}</div><div class="k">${t("cards_imp")} · ${t("cards_from")} ${rows.length}</div></div></div>
      <div class="card card--stat up"><div class="card-ico">${icon("i-up")}</div><div><div class="v up tnum">${wor}</div><div class="k">${t("cards_wor")} · ${t("cards_from")} ${rows.length}</div></div></div>
      <div class="card card--stat flat"><div class="card-ico">${icon("i-minus")}</div><div><div class="v tnum">${rows.length - imp - wor}</div><div class="k">${t("cards_flat")} · ${t("cards_from")} ${rows.length}</div></div></div>`;
  }

  /* ---------- breakdown ---------- */
  function renderDimSeg() {
    $("dimSeg").innerHTML = Object.keys(DIMS).map((d) =>
      `<button type="button" data-d="${d}" aria-pressed="${d === S.dim}">${esc(dimLabel(d))}</button>`).join("");
  }
  function renderBreakdown() {
    const dim = S.dim, mi = rankMonth();
    if (!DIMS[dim] || mi == null) { $("bdContent").innerHTML = ""; $("bdScope").textContent = ""; return; }
    const counts = aggBD(dim, mi, S.sel || null);
    const order = DIMS[dim].cats.map((c) => c.key);
    let items = order.filter((k) => counts[k]).map((k) => ({ key: k, n: counts[k] }));
    // any keys not in catalog (defensive)
    for (const k in counts) if (!order.includes(k)) items.push({ key: k, n: counts[k] });
    items.sort((a, b) => b.n - a.n);
    const total = items.reduce((s, x) => s + x.n, 0);
    const scopeName = S.sel ? selName(S.sel) : t("bd_all");
    $("bdScope").innerHTML = `${t("bd_scope")}: <b>${esc(scopeName)}</b> · ${monthLong(DATA.months[mi])} · ${t("bd_total")} <b class="tnum">${total.toLocaleString()}</b> ${dimUnit(dim)}`;
    if (!total) { $("bdContent").innerHTML = `<div class="hintbox">${icon("i-info")}${t("bd_empty")}</div>`; return; }
    const TOPN = 10;
    let shown = items.slice(0, TOPN);
    bdOtherKeys = items.slice(TOPN).map((x) => x.key);
    const restN = items.slice(TOPN).reduce((s, x) => s + x.n, 0);
    if (restN) shown.push({ key: "__other__", n: restN });
    const maxN = Math.max(...shown.map((x) => x.n));
    $("bdContent").innerHTML = '<div class="bdbars">' + shown.map((x) => {
      const label = x.key === "__other__" ? t("other") : catLabel(x.key);
      const p = total ? (x.n / total * 100) : 0;
      return `<div class="bdrow" role="button" tabindex="0" data-cat="${esc(x.key)}" title="${esc(label)} · ${t("drill_hint")}">` +
        `<div class="bdlabel" lang="en">${esc(label)}</div>` +
        `<div class="bdbar"><i style="width:${Math.max(1, x.n / maxN * 100)}%"></i></div>` +
        `<div class="bdval tnum">${x.n.toLocaleString()}<span class="bdpct">${p.toFixed(1)}%</span></div>` +
        `<span class="bdgo">${icon("i-chev")}</span></div>`;
    }).join("") + "</div>";
  }

  /* ---------- drill into a breakdown category: which tickets / WOs? ---------- */
  const DIM_FIELD = { sevT: "tsev", status: "status", wtype: "wtype", root: "root", sla: "sla" };
  function loadDetail(month) {
    if (detailCache[month]) return Promise.resolve(detailCache[month]);
    return loadJSON(`api/detail/${month}`, `./data/detail/${month}.json`)
      .then((d) => { d.fi = {}; d.fields.forEach((f, i) => (d.fi[f] = i)); detailCache[month] = d; return d; });
  }
  function openDrill(cat) {
    const dim = S.dim, mi = rankMonth(), month = DATA.months[mi];
    const field = DIM_FIELD[dim] || "tsev";
    const targets = cat === "__other__" ? new Set(bdOtherKeys) : new Set([cat]);
    const ticketMode = dim === "sevT";
    const d = $("drillDialog");
    $("drillTitle").textContent = t("drill_title");
    $("drillCount").innerHTML = `<span class="muted">${t("drill_loading")}</span>`;
    $("drillBody").innerHTML = ""; $("drillSearch").value = "";
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
    loadDetail(month).then((dt) => {
      const fi = dt.fi, dict = dt.dict, matched = [];
      for (const row of dt.rows) {
        const region = dict.region[row[fi.region]], prov = dict.prov[row[fi.prov]], skill = dict.skill[row[fi.skill]], team = dict.team[row[fi.team]];
        if (S.skill !== "ALL" && skill !== S.skill) continue;
        if (S.level !== "region" && S.region && region !== S.region) continue;
        if (S.level === "team" && S.prov && prov !== S.prov) continue;
        if (S.sel) {
          if (S.level === "region" && region !== S.sel) continue;
          if (S.level === "prov" && region + " / " + prov !== S.sel) continue;
          if (S.level === "team" && team !== S.sel) continue;
        }
        if (!targets.has(dict[field][row[fi[field]]])) continue;
        matched.push({ tid: row[fi.tid], team, name: dict.name[row[fi.name]], region, prov,
          tsev: dict.tsev[row[fi.tsev]], sev: dict.sev[row[fi.sev]], status: dict.status[row[fi.status]],
          wtype: dict.wtype[row[fi.wtype]], root: dict.root[row[fi.root]], sla: dict.sla[row[fi.sla]], site: dict.site[row[fi.site]] });
      }
      drillState = {
        dim, catName: cat === "__other__" ? t("other") : catLabel(cat), month, ticketMode, matched,
        sevField: ticketMode ? "tsev" : "sev", colFilters: {}, _cols: null,
      };
      drillRender();
    }).catch((err) => { $("drillCount").textContent = ""; $("drillBody").innerHTML = `<div class="hintbox">${icon("i-alert")}${esc(String(err))}</div>`; });
  }
  // Column model for the drill table (varies by ticket vs WO mode). Every column filters
  // via a dropdown: value = fval(r), shown label = disp(r).
  function drillColumns() {
    const st = drillState, tm = st.ticketMode;
    const C = {
      tid:    { id: "tid",    label: "Ticket ID",     cls: "l tnum", en: 1, disp: (r) => r.tid || "—", fval: (r) => r.tid || "", num: 0 },
      team:   { id: "team",   label: t("col_team"),   cls: "l", en: 1, disp: (r) => r.name, fval: (r) => r.name },
      loc:    { id: "loc",    label: t("col_loc"),    cls: "l", disp: (r) => r.region + " · " + r.prov, fval: (r) => r.region + " · " + r.prov },
      sev:    { id: "sev",    label: t("col_sev"),    cls: "", disp: (r) => catLabel(r.sev), fval: (r) => r.sev },
      wo:     { id: "wo",     label: "WO",            cls: "tnum", disp: (r) => r.wo, fval: (r) => r.wo, num: 1 },
      status: { id: "status", label: t("col_status"), cls: "l", disp: (r) => tm ? r.statusTop : r.status, fval: (r) => tm ? r.statusTop : r.status },
      wtype:  { id: "wtype",  label: t("col_wtype"),  cls: "l", disp: (r) => r.wtype, fval: (r) => r.wtype },
      root:   { id: "root",   label: t("col_root"),   cls: "l", disp: (r) => r.root, fval: (r) => r.root },
      sla:    { id: "sla",    label: t("col_sla"),    cls: "l", disp: (r) => r.sla, fval: (r) => r.sla },
      site:   { id: "site",   label: t("col_site"),   cls: "l", en: 1, disp: (r) => r.site, fval: (r) => r.site },
    };
    return tm ? [C.tid, C.team, C.loc, C.sev, C.wo, C.status]
              : [C.tid, C.team, C.loc, C.sev, C.status, C.wtype, C.root, C.sla, C.site];
  }
  function drillBaseRows() {
    const st = drillState;
    if (!st.ticketMode) return st.matched;
    const byT = {};
    for (const m of st.matched) { const k = m.tid || "—"; if (!byT[k]) byT[k] = { tid: m.tid, name: m.name, region: m.region, prov: m.prov, sev: m.tsev, wo: 0, st: {} }; const g = byT[k]; g.wo++; g.st[m.status] = (g.st[m.status] || 0) + 1; }
    return Object.values(byT).map((g) => ({ ...g, statusTop: Object.entries(g.st).sort((a, b) => b[1] - a[1])[0][0] }));
  }
  // row passes the active dropdown filters (+ global search), optionally ignoring one column
  // so that column's own option list stays full (faceted/cascading filtering).
  function drillPass(r, cols, F, q, exceptId) {
    for (const c of cols) { if (c.id === exceptId) continue; const fv = F[c.id]; if (fv == null || fv === "") continue; if (String(c.fval(r)) !== String(fv)) return false; }
    if (q && !cols.map((c) => c.fval(r)).join(" ").toLowerCase().includes(q)) return false;
    return true;
  }
  function drillApplyFilters() {
    const st = drillState, cols = st._cols || (st._cols = drillColumns()), F = st.colFilters || {};
    const q = $("drillSearch").value.trim().toLowerCase();
    return drillBaseRows().filter((r) => drillPass(r, cols, F, q, null));
  }
  const OPT_CAP = 800;
  function drillRender() {
    const st = drillState; if (!st) return;
    const cols = st._cols || (st._cols = drillColumns()), F = st.colFilters || {};
    const base = drillBaseRows(), q = $("drillSearch").value.trim().toLowerCase();
    // header: each column is a dropdown whose options cascade off the other active filters
    const head = cols.map((c) => {
      const seen = new Map();
      for (const r of base) { if (!drillPass(r, cols, F, q, c.id)) continue; const v = String(c.fval(r) ?? ""); if (v === "") continue; if (!seen.has(v)) seen.set(v, String(c.disp(r))); }
      let arr = [...seen.entries()];
      arr.sort(c.num ? (a, b) => (+a[0]) - (+b[0]) : (a, b) => a[1].localeCompare(b[1], "th"));
      const capped = arr.length > OPT_CAP; if (capped) arr = arr.slice(0, OPT_CAP);
      const cur = F[c.id] || "";
      const optsHtml = arr.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");
      return `<th class="${c.cls}"><div class="thlabel">${esc(c.label)}</div>` +
        `<select class="cf" data-c="${c.id}" aria-label="${esc(c.label)}"><option value="">${t("q_all")}</option>${optsHtml}${capped ? '<option value="" disabled>…</option>' : ""}</select></th>`;
    }).join("");
    // body
    const rows = base.filter((r) => drillPass(r, cols, F, q, null));
    const woCount = st.ticketMode ? rows.reduce((s, r) => s + r.wo, 0) : rows.length;
    const distinct = st.ticketMode ? rows.length : new Set(rows.map((r) => r.tid).filter(Boolean)).size;
    $("drillCount").innerHTML = `${esc(dimLabel(st.dim))} = <b>${esc(st.catName)}</b> · ${monthLong(st.month)} · ` +
      (st.ticketMode ? `<b class="tnum">${distinct.toLocaleString()}</b> ${t("drill_tickets")} <span class="muted">(${woCount.toLocaleString()} WO)</span>`
        : `<b class="tnum">${woCount.toLocaleString()}</b> WO <span class="muted">· ${distinct.toLocaleString()} ${t("drill_distinct")}</span>`);
    const CAP = 500, show = rows.slice(0, CAP);
    const bodyHtml = rows.length
      ? show.map((r) => "<tr>" + cols.map((c) => `<td class="${c.cls}">${c.en ? '<span lang="en">' : ""}${esc(String(c.disp(r)))}${c.en ? "</span>" : ""}</td>`).join("") + "</tr>").join("")
      : `<tr><td colspan="${cols.length}"><div class="hintbox" style="margin:6px 0 0">${icon("i-filter")}${t("drill_empty")}</div></td></tr>`;
    const note = rows.length > CAP ? `<div class="drill-note">${t("drill_first", { n: CAP })} ${rows.length.toLocaleString()} ${t("drill_more")}</div>` : "";
    $("drillBody").innerHTML = `<div class="tablewrap" style="max-height:56vh"><table><thead><tr>${head}</tr></thead><tbody>${bodyHtml}</tbody></table></div>${note}`;
  }
  function drillCSV() {
    const st = drillState; if (!st) return;
    const cols = st._cols || drillColumns(), rows = drillApplyFilters();
    const line = (a) => a.map((v) => { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",");
    const out = [line(cols.map((c) => c.label))];
    rows.forEach((r) => out.push(line(cols.map((c) => c.disp(r)))));
    const blob = new Blob(["﻿" + out.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `drill_${st.dim}_${st.catName}_${st.month}.csv`.replace(/[^\w.\-]+/g, "_");
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }
  function selName(k) {
    const rr = recs().find((r) => keyOf(r) === k);
    return rr ? metaOf(rr).name : k;
  }

  /* ---------- chart ---------- */
  function renderChart() {
    const svg = $("chart"), W = svg.clientWidth || 560, H = svg.clientHeight || 250;
    const cs = getComputedStyle(document.documentElement);
    const C = { grid: cs.getPropertyValue("--chart-grid").trim(), line: cs.getPropertyValue("--chart-line").trim(),
      axis: cs.getPropertyValue("--chart-axis").trim(), axisOn: cs.getPropertyValue("--chart-axis-on").trim(),
      accent: cs.getPropertyValue("--accent").trim(), guide: cs.getPropertyValue("--chart-guide").trim(), area: cs.getPropertyValue("--chart-area").trim() };
    const pad = { l: 46, r: 14, t: 14, b: 26 }, months = DATA.months;
    const lines = [{ name: t("overview"), data: series(null), col: C.line, dash: "4 3" }];
    let selNm = null;
    if (S.sel) { selNm = selName(S.sel); lines.push({ name: selNm, data: series(S.sel), col: C.accent, area: true }); }
    const all = lines.flatMap((l) => l.data).filter((v) => v != null);
    const mx = Math.max(0.001, ...all), mn = 0;
    const x = (i) => pad.l + (W - pad.l - pad.r) * (months.length < 2 ? 0.5 : i / (months.length - 1));
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - mn) / (mx - mn));
    let h = "";
    for (let g = 0; g <= 4; g++) { const v = mn + (mx - mn) * g / 4, yy = y(v);
      h += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="${C.grid}"/>`;
      h += `<text x="${pad.l - 6}" y="${yy + 3}" fill="${C.axis}" font-size="10" text-anchor="end">${(v * 100).toFixed(1)}%</text>`; }
    months.forEach((m, i) => { const xx = x(i), on = S.months.includes(i);
      h += `<text x="${xx}" y="${H - 8}" fill="${on ? C.axisOn : C.axis}" font-size="10" text-anchor="middle"${on ? ' font-weight="700"' : ""}>${monthLbl(m)}</text>`;
      if (on) h += `<line x1="${xx}" y1="${pad.t}" x2="${xx}" y2="${H - pad.b}" stroke="${C.guide}"/>`; });
    lines.forEach((l) => {
      let d = ""; l.data.forEach((v, i) => { if (v == null) return; d += (d ? "L" : "M") + x(i) + " " + y(v) + " "; });
      if (l.area && d) { const pts = l.data.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
        if (pts.length) h += `<path d="M${pts[0][0]} ${y(mn)} ${pts.map((p) => "L" + p[0] + " " + p[1]).join(" ")} L${pts[pts.length - 1][0]} ${y(mn)} Z" fill="${C.area}" stroke="none"/>`; }
      h += `<path d="${d}" fill="none" stroke="${l.col}" stroke-width="2.2"${l.dash ? ` stroke-dasharray="${l.dash}"` : ""}/>`;
      l.data.forEach((v, i) => { if (v == null) return; h += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${l.col}"><title>${monthLong(months[i])}: ${(v * 100).toFixed(2)}%</title></circle>`; });
    });
    svg.innerHTML = h;
    $("legend").innerHTML = lines.map((l) => `<span><span class="dot${l.dash ? " dash" : ""}" style="${l.dash ? "color:" + l.col : "background:" + l.col}"></span>${esc(l.name)}</span>`).join("");
    const focus = S.sel ? series(S.sel) : series(null);
    const first = focus.find((v) => v != null), last = [...focus].reverse().find((v) => v != null);
    const ch = last != null && first != null ? last - first : null;
    const subj = S.sel ? selNm : t("overview");
    svg.setAttribute("aria-label", `${t("trend_title", { beh: behName(BEH.find((x) => x.k === S.beh)) })} — ${subj}, ${monthLong(months[0])}–${monthLong(months[lastM])}`);
    $("chartDesc").textContent = svg.getAttribute("aria-label");
    const ov = series(null);
    $("chartTable").innerHTML = `<table><caption>${esc(t("trend_title", { beh: behName(BEH.find((x) => x.k === S.beh)) }))}</caption><thead><tr><th>${t("src_thmonth")}</th><th>${t("overview")}</th>${S.sel ? `<th>${esc(selNm)}</th>` : ""}</tr></thead><tbody>` +
      months.map((m, i) => `<tr><td>${monthLong(m)}</td><td>${ov[i] == null ? "—" : (ov[i] * 100).toFixed(2) + "%"}</td>${S.sel ? `<td>${focus[i] == null ? "—" : (focus[i] * 100).toFixed(2) + "%"}</td>` : ""}</tr>`).join("") + "</tbody></table>";
    $("miniStats").innerHTML = ch === null ? "" : `<div class="pill">${t("range_all")} ${monthLbl(months[0])} → ${monthLbl(months[lastM])}: ${fmtDelta(ch)}</div>`;
  }

  /* ---------- tabs / chips / selectors ---------- */
  function renderNav() {
    let h = BEH.map((b) =>
      `<button type="button" role="tab" class="navitem" data-view="dup" data-k="${b.k}" aria-selected="${S.view === "dup" && b.k === S.beh}">` +
      `${icon("i-alert")}<span class="txt"><span class="nm">${behName(b)}</span><span class="d">${behDesc(b)}</span></span></button>`).join("");
    h += `<button type="button" role="tab" class="navitem" data-view="pdtpoint" aria-selected="${S.view === "pdtpoint"}">` +
      `${icon("i-layers")}<span class="txt"><span class="nm">${t("pdt_nav")}</span><span class="d">${t("pdt_nav_d")}</span></span></button>`;
    if (isAdmin()) h += `<button type="button" role="tab" class="navitem navitem-import" data-view="import" aria-selected="${S.view === "import"}">` +
      `${icon("i-download")}<span class="txt"><span class="nm">${t("imp_nav")}</span><span class="d">${t("imp_nav_d")}</span></span></button>`;
    $("behNav").innerHTML = h;
  }

  /* ---------- PDT & Point view ---------- */
  function pdtParams() {
    const p = new URLSearchParams();
    if (S.pdt.months.length) p.set("months", S.pdt.months.join(","));
    if (S.pdt.weeks.length) p.set("weeks", S.pdt.weeks.join(","));
    ["status", "region", "skill", "province"].forEach((k) => { if (S.pdt[k]) p.set(k, S.pdt[k]); });
    return p.toString();
  }
  function loadPdt() {
    const load = `<div class="hintbox">${icon("i-info")}${t("drill_loading")}</div>`;
    ["pdtP1", "pdtP2", "pdtP3", "pdtP4"].forEach((id) => { $(id).innerHTML = load; });
    return apiFetch("api/pdtpoint?" + pdtParams()).then((r) => { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
      .then((d) => { pdtData = d; S.pdt.months = d.selected.months; S.pdt.weeks = d.selected.weeks; renderPdt(); writeURL(); })
      .catch((e) => { $("pdtP1").innerHTML = `<div class="hintbox">${icon("i-alert")}${esc(String(e))}</div>`; });
  }
  function pdtFilters() {
    const o = pdtData.options, S0 = S.pdt;
    const sel = (key, label, vals, all, withAll) =>
      `<div class="cgroup"><span class="cgroup-title">${esc(label)}</span><div class="cgroup-body">` +
      `<select class="pdt-f" data-k="${key}">${withAll ? `<option value="">${esc(all)}</option>` : ""}` +
      vals.map((v) => `<option${S0[key] === v ? " selected" : ""}>${esc(v)}</option>`).join("") + "</select></div></div>";
    const chips = (cls, key, label, vals, fmt) => `<div class="cgroup cgroup-grow"><span class="cgroup-title">${esc(label)}</span>` +
      `<div class="cgroup-body cgroup-months"><div class="month-chips">` +
      vals.map((v) => `<button type="button" class="mchip ${cls}" data-v="${esc(v)}" aria-pressed="${S0[key].includes(v)}">${esc(fmt ? fmt(v) : v)}</button>`).join("") +
      `</div></div></div>`;
    $("pdtFilters").innerHTML =
      chips("pdt-mchip", "months", t("pdt_month"), o.months, monthLbl) +
      chips("pdt-wchip", "weeks", t("pdt_week"), o.weeks, null) +
      sel("status", "Status", o.statuses, t("q_all"), true) +
      sel("region", t("lvl_region"), o.regions, t("region_all"), true) +
      sel("skill", "Skill", o.skills, t("q_all"), true) +
      sel("province", t("lvl_prov"), o.provinces, t("prov_all"), true);
  }
  function pdtTable(cols, rows, panel, emptyMsg) {
    if (!rows || !rows.length) return `<div class="hintbox">${icon("i-filter")}${emptyMsg || t("pdt_none")}</div>`;
    const head = `<tr><th class="l">#</th>${cols.map((c) => `<th class="${c.cls || ""}">${esc(c.label)}</th>`).join("")}<th class="pdtd-go" aria-hidden="true"></th></tr>`;
    const body = rows.slice(0, 200).map((r, i) =>
      `<tr class="pdtd-row" data-team="${esc(r.team)}" data-panel="${panel}" tabindex="0" role="button" aria-label="${esc(r.name)} — ${t("pdtd_hint")}">` +
      `<td class="l"><span class="rk ${i < 3 ? "top rk-" + (i + 1) : ""}">${i + 1}</span></td>` +
      cols.map((c) => `<td class="${c.cls || ""}">${c.get(r)}</td>`).join("") +
      `<td class="pdtd-go" aria-hidden="true">${icon("i-chev")}</td></tr>`).join("");
    return `<div class="tablewrap" style="max-height:420px"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }
  function renderPdt() {
    if (!pdtData) return;
    pdtFilters();
    $("pdtFilters").querySelectorAll(".pdt-f").forEach((s) => { s.value = S.pdt[s.dataset.k] || ""; });
    $("pdtT1").textContent = t("pdt_t1"); $("pdtT2").textContent = t("pdt_t2");
    $("pdtT3").textContent = t("pdt_t3"); $("pdtT4").textContent = t("pdt_t4");
    const nameCell = (r) => `<div class="namecell"><span class="nm" lang="en" title="${esc(r.team)}">${esc(r.name)}</span><small>${esc(r.region)} · ${esc(r.province)} · ${esc(r.skill)}</small></div>`;
    const c = pdtData.counts;
    $("pdtC1").innerHTML = `<b>${c.p1}</b> ${t("units")}`;
    $("pdtC2").innerHTML = `<b>${c.p2}</b> ${t("units")}`;
    $("pdtC3").innerHTML = `<b>${(pdtData.panel3 || []).length}</b> ${t("units")}`;
    $("pdtC4").innerHTML = `<b>${c.p4}</b> ${t("units")}`;
    $("pdtP1").innerHTML = pdtTable([
      { label: t("th_name"), cls: "l", get: nameCell },
      { label: t("pdt_th_pdt"), cls: "tnum", get: (r) => `<b class="up">${r.pdt}</b> <small class="muted-dash">/ ${r.threshold}</small>` },
      { label: t("pdt_th_days"), cls: "tnum", get: (r) => r.days },
      { label: t("th_trend"), cls: "trendcell", get: (r) => spark(r.spark || [], false) },
    ], pdtData.panel1, 1);
    $("pdtP2").innerHTML = pdtTable([
      { label: t("th_name"), cls: "l", get: nameCell },
      { label: t("pdt_th_mhd"), cls: "tnum", get: (r) => `<b class="up">${r.mhd}</b>` },
      { label: t("pdt_th_days"), cls: "tnum", get: (r) => r.days },
      { label: t("th_trend"), cls: "trendcell", get: (r) => spark(r.spark || [], false) },
    ], pdtData.panel2, 2);
    const weekMsg = S.pdt.weeks.length ? t("pdt_none") : t("pdt_pickweek");
    $("pdtP3").innerHTML = pdtTable([
      { label: t("th_name"), cls: "l", get: nameCell },
      { label: t("pdt_th_first"), cls: "tnum", get: (r) => r.first_arrive || "—" },
      { label: t("pdt_th_last"), cls: "tnum", get: (r) => r.last_complete || "—" },
      { label: t("pdt_th_hours"), cls: "tnum", get: (r) => r.hours == null ? "—" : `<b>${r.hours}</b>` },
      { label: t("pdt_th_days"), cls: "tnum", get: (r) => r.days },
      { label: t("th_trend"), cls: "trendcell", get: (r) => spark(r.spark || [], false) },
    ], pdtData.panel3, 3, weekMsg);
    $("pdtP4").innerHTML = pdtTable([
      { label: t("th_name"), cls: "l", get: nameCell },
      { label: t("pdt_th_ptday"), cls: "tnum", get: (r) => `<b class="up">${r.point_per_day}</b>` },
      { label: t("pdt_th_days"), cls: "tnum", get: (r) => r.days },
      { label: t("pdt_th_work"), cls: "l", get: (r) => `<span lang="en">${esc(r.top_work || "—")}</span>` },
      { label: t("th_trend"), cls: "trendcell", get: (r) => spark(r.spark || []) },
    ], pdtData.panel4, 4, weekMsg);
    pdtTrend();
  }
  function pdtTrend() {
    const tr = pdtData.trend || [], svg = $("pdtTrendSvg");
    $("pdtTT").textContent = t("pdt_trend");
    $("pdtTC").innerHTML = `<b>${tr.length}</b> Week`;
    if (tr.length < 2) { svg.innerHTML = ""; $("pdtTrendLeg").innerHTML = `<span class="muted">${t("pdt_none")}</span>`; return; }
    const W = svg.clientWidth || 760, H = svg.clientHeight || 240, cs = getComputedStyle(document.documentElement);
    const grid = cs.getPropertyValue("--chart-grid").trim(), axis = cs.getPropertyValue("--chart-axis").trim();
    const accent = cs.getPropertyValue("--accent").trim(), bad = cs.getPropertyValue("--bad").trim();
    const pad = { l: 40, r: 14, t: 12, b: 50 }, n = tr.length - 1 || 1;
    const vals = tr.flatMap((d) => [d.pdt, d.mhd]).filter((v) => v != null);
    const mx = Math.max(0.001, ...vals), mn = 0;
    const x = (i) => pad.l + (W - pad.l - pad.r) * (i / n);
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - mn) / (mx - mn));
    const wkNum = (w) => (String(w).match(/\d+/) || [w])[0];
    let h = "";
    for (let g = 0; g <= 4; g++) { const v = mn + (mx - mn) * g / 4, yy = y(v); h += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="${grid}"/><text x="${pad.l - 6}" y="${yy + 3}" fill="${axis}" font-size="10" text-anchor="end">${v.toFixed(1)}</text>`; }
    // small week ticks (left→right = past→present); thinned out when crowded
    const step = Math.ceil(tr.length / 18);
    tr.forEach((d, i) => { if (i % step === 0 || i === tr.length - 1) { const xx = x(i); h += `<text x="${xx}" y="${H - 30}" fill="${axis}" font-size="8.5" text-anchor="middle">W${esc(wkNum(d.wk))}</text>`; } });
    // month boundaries: faint separator + centred month label so chronology reads clearly across the year reset
    let gs = 0;
    for (let i = 1; i <= tr.length; i++) {
      if (i === tr.length || tr[i].month !== tr[gs].month) {
        if (i < tr.length) { const bx = (x(i - 1) + x(i)) / 2; h += `<line x1="${bx}" y1="${pad.t}" x2="${bx}" y2="${H - pad.b}" stroke="${grid}" stroke-dasharray="3 3"/>`; }
        const cx = (x(gs) + x(i - 1)) / 2; h += `<text x="${cx}" y="${H - 12}" fill="${axis}" font-size="10" font-weight="600" text-anchor="middle">${esc(String(tr[gs].month).slice(2))}</text>`;
        gs = i;
      }
    }
    const line = (key, col) => { let d = ""; tr.forEach((p, i) => { if (p[key] == null) return; d += (d ? "L" : "M") + x(i).toFixed(1) + " " + y(p[key]).toFixed(1) + " "; }); let dots = ""; tr.forEach((p, i) => { if (p[key] == null) return; dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="2.4" fill="${col}"><title>${esc(p.label)} — ${key.toUpperCase()}: ${p[key]}</title></circle>`; }); return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2"/>${dots}`; };
    svg.innerHTML = h + line("pdt", accent) + line("mhd", bad);
    $("pdtTrendLeg").innerHTML = `<span><span class="dot" style="background:${accent}"></span>${t("pdt_th_pdt")}</span><span><span class="dot" style="background:${bad}"></span>Man Hour/Day</span>`;
  }
  /* ---------- PDT drill-down: why did this team fail? ---------- */
  let pdtDrillReq = 0;
  function openPdtDrill(team, panel) {
    const d = $("pdtDrill");
    $("pdtDrillTitle").textContent = nameOf(team);
    $("pdtDrillMeta").textContent = "";
    $("pdtDrillBody").innerHTML = `<div class="hintbox">${icon("i-info")}${t("drill_loading")}</div>`;
    if (d.showModal) { if (d.open) d.close(); d.showModal(); } else d.setAttribute("open", "");
    const req = ++pdtDrillReq;
    const p = new URLSearchParams({ team, panel });
    if (S.pdt.months.length) p.set("months", S.pdt.months.join(","));
    if (S.pdt.weeks.length) p.set("weeks", S.pdt.weeks.join(","));
    apiFetch("api/pdtdetail?" + p.toString())
      .then((r) => { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
      .then((dt) => { if (req === pdtDrillReq) renderPdtDrill(dt); })
      .catch((e) => { if (req === pdtDrillReq) $("pdtDrillBody").innerHTML = `<div class="hintbox">${icon("i-alert")}${esc(String(e))}</div>`; });
  }
  // team name without the live data dependency (pdtData rows carry .name; fall back to raw code)
  function nameOf(team) {
    for (const k of ["panel1", "panel2", "panel3", "panel4"]) {
      const hit = (pdtData && pdtData[k] || []).find((r) => r.team === team);
      if (hit) return hit.name;
    }
    return team;
  }
  function pdtGauge(value, thr, over, unit, sk) {
    if (value == null) return "";
    const scale = Math.max(value, thr) * 1.3 || 1;
    const vp = Math.max(3, Math.min(100, (value / scale) * 100));
    const tp = Math.min(100, (thr / scale) * 100);
    const gap = (over ? value - thr : thr - value);
    return `<div class="pdtd-gauge">
      <div class="pdtd-val"><b>${value}</b><span class="pdtd-unit">${esc(unit)}${sk ? ` · ${esc(sk)}` : ""}</span></div>
      <div class="pdtd-track" role="img" aria-label="${esc(unit)} ${value} · ${t("pdtd_baseline")} ${thr}">
        <div class="pdtd-fill ${over ? "over" : "under"}" style="width:${vp.toFixed(1)}%"></div>
        <div class="pdtd-base" style="left:${tp.toFixed(1)}%"></div>
      </div>
      <div class="pdtd-scale"><span class="pdtd-gap ${over ? "over" : "under"}">${over ? "▲" : "▼"} ${t("pdtd_gap")} ${gap.toFixed(2)}</span><span class="pdtd-blabel">${t("pdtd_baseline")} ${thr}</span></div>
    </div>`;
  }
  function pdtDTable(cols, rows, empty, rowBad) {
    if (!rows || !rows.length) return `<div class="hintbox">${icon("i-filter")}${empty || t("pdt_none")}</div>`;
    const head = cols.map((c) => `<th class="${c.cls || ""}">${esc(c.label)}</th>`).join("");
    const body = rows.map((r) => `<tr class="${rowBad && rowBad(r) ? "is-bad" : ""}">` +
      cols.map((c) => `<td class="${c.cls || ""}">${c.get(r)}</td>`).join("") + "</tr>").join("");
    return `<div class="tablewrap" style="max-height:340px"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function renderPdtDrill(dt) {
    const m = dt.meta, panel = dt.panel, num = (v) => (v == null ? "—" : v);
    $("pdtDrillTitle").textContent = m.name;
    $("pdtDrillMeta").innerHTML = [m.region, m.province, m.skill, m.manager].filter(Boolean).map(esc).join(" · ") +
      ` · <span lang="en">${esc(m.team)}</span>`;
    const titleKey = { 1: "pdt_t1", 2: "pdt_t2", 3: "pdt_t3", 4: "pdt_t4" }[panel];

    // 1) verdict gauge(s)
    let gauges = "";
    if (panel === 1) gauges = pdtGauge(m.pdt, m.pdt_threshold, false, "PDT/Day", m.skill);
    else if (panel === 2) gauges = pdtGauge(m.mhd, 9, false, "Man Hour/Day");
    else if (panel === 3) gauges = `<div class="pdtd-gauges">${pdtGauge(m.pdt, m.pdt_threshold, false, "PDT/Day", m.skill)}${pdtGauge(m.mhd, 9, false, "Man Hour/Day")}</div>`;
    else if (panel === 4) gauges = dt.ml.point_per_day != null ? pdtGauge(dt.ml.point_per_day, 13, true, "Point/Day")
      : `<div class="hintbox">${icon("i-filter")}${t("pdtd_noml")}</div>`;

    // 2) reasons
    const reasons = [];
    if (panel === 1 && m.pdt != null) {
      reasons.push(t("pdtd_r_pdt", { v: m.pdt, sk: m.skill, thr: m.pdt_threshold, gap: (m.pdt_threshold - m.pdt).toFixed(2), days: m.days }));
      const below = dt.daily_wl.filter((x) => x.pdt != null && x.pdt < m.pdt_threshold).length;
      if (below) reasons.push(t("pdtd_below_n", { n: below }));
    } else if (panel === 2 && m.mhd != null) {
      reasons.push(t("pdtd_r_mhd", { v: m.mhd, gap: (9 - m.mhd).toFixed(2), days: m.days }));
      const below = dt.daily_wl.filter((x) => x.mhd != null && x.mhd < 9).length;
      if (below) reasons.push(t("pdtd_below_n", { n: below }));
    } else if (panel === 3) {
      reasons.push(t("pdtd_r_both", { pdt: num(m.pdt), mhd: num(m.mhd) }));
      if (dt.ml.avg_span != null) reasons.push(t("pdtd_r_span", { span: dt.ml.avg_span, days: dt.ml.day_count }));
    } else if (panel === 4 && dt.ml.point_per_day != null) {
      reasons.push(t("pdtd_r_ppd", { v: dt.ml.point_per_day, gap: (dt.ml.point_per_day - 13).toFixed(2), pts: num(dt.ml.total_points), days: dt.ml.point_days }));
      const over = dt.daily_ml.length;
      if (over) reasons.push(t("pdtd_over_n", { n: over }));
      if (dt.worktypes.length) {
        const tot = dt.worktypes.reduce((s, w) => s + (w.points || 0), 0), top = dt.worktypes[0];
        reasons.push(t("pdtd_r_topwork", { w: top.work_type, share: tot ? Math.round((top.points / tot) * 100) + "%" : "—" }));
      }
    }

    // 3) selected-period summary strip (what the team actually did) + travel time
    const W = dt.work || {};
    // human-readable duration: 47 -> "47 น." · 223 -> "3 ชม. 43 น."
    const dur = (v) => {
      if (v == null) return "—";
      const mm = Math.round(v), h = Math.floor(mm / 60), m = mm % 60;
      if (h <= 0) return `${m}<small> ${t("dur_min")}</small>`;
      return `${h}<small> ${t("dur_hr")}</small>${m ? ` ${m}<small> ${t("dur_min")}</small>` : ""}`;
    };
    const sumTile = (lbl, val, sub) => `<div class="pdtd-sum"><div class="pdtd-sumv">${val}</div><div class="pdtd-suml">${esc(lbl)}${sub ? ` <small>${esc(sub)}</small>` : ""}</div></div>`;
    const summary = `<section class="pdtd-block"><h3 class="pdtd-h">${t("pdtd_summary")}</h3><div class="pdtd-sumrow">` +
      sumTile(t("pdtd_s_worked"), `${W.worked_days || 0} <small>/ ${W.work_days || 0}</small>`, t("pdtd_unit_day")) +
      sumTile(t("pdtd_s_wo"), (W.wo || 0).toLocaleString()) +
      sumTile(t("pdtd_s_travel"), dur(W.avg_travel_min)) +
      sumTile(t("pdtd_s_onsite"), dur(W.avg_onsite_min)) +
      sumTile(t("pdtd_s_points"), W.points == null ? "—" : W.points.toLocaleString()) +
      `</div></section>`;

    // 4) what they did, by work type (all panels)
    let wt = "";
    if (dt.worktypes2 && dt.worktypes2.length) {
      const totN = dt.worktypes2.reduce((s, w) => s + (w.n || 0), 0) || 1;
      wt = `<section class="pdtd-block"><h3 class="pdtd-h">${t("pdtd_worktypes2")}</h3>` + pdtDTable([
        { label: t("pdt_th_work"), cls: "l", get: (r) => `<span lang="en">${esc(r.work_type)}</span>` },
        { label: t("pdtd_th_wo"), cls: "tnum", get: (r) => r.n },
        { label: t("pdtd_th_pts"), cls: "tnum", get: (r) => num(r.points) },
        { label: t("pdtd_th_travelavg"), cls: "tnum", get: (r) => dur(r.travel) },
        { label: t("pdtd_th_share"), cls: "", get: (r) => { const pct = Math.round((r.n / totN) * 100); return `<div class="pdtd-share"><div class="pdtd-sharebar" style="width:${pct}%"></div><span>${pct}%</span></div>`; } },
      ], dt.worktypes2) + `</section>`;
    }

    // 5) work log — every WO in the period with travel time + what was done
    const wl = dt.worklog || [];
    const worklog = `<section class="pdtd-block"><h3 class="pdtd-h">${t("pdtd_worklog")}${W.capped ? ` <small class="muted-dash">${t("pdtd_capped", { n: 300 })}</small>` : ""}</h3>` + pdtDTable([
      { label: t("pdtd_th_date"), cls: "l tnum", get: (r) => r.date || "—" },
      { label: t("pdt_th_work"), cls: "l", get: (r) => `<span lang="en">${esc(r.work_type)}</span>` },
      { label: t("pdtd_th_sev"), cls: "", get: (r) => esc(r.severity || "—") },
      { label: t("pdtd_th_depart"), cls: "tnum", get: (r) => r.departed || "—" },
      { label: t("pdtd_th_arrive"), cls: "tnum", get: (r) => r.arrived || "—" },
      { label: t("pdtd_th_travel"), cls: "tnum", get: (r) => r.travel_min == null ? "—" : `<b>${dur(r.travel_min)}</b>` },
      { label: t("pdtd_th_done"), cls: "tnum", get: (r) => r.completed || "—" },
      { label: t("pdtd_th_onsite"), cls: "tnum", get: (r) => dur(r.onsite_min) },
      { label: t("pdtd_th_pts"), cls: "tnum", get: (r) => num(r.point) },
      { label: t("pdtd_th_detail"), cls: "l", get: (r) => `<span class="pdtd-wd" title="${esc(r.detail || "")}">${esc((r.detail || "").slice(0, 60)) || "—"}</span>` },
    ], wl, t("pdtd_nowork")) + `</section>`;

    // 4) daily evidence
    let ev;
    if (panel === 1) ev = pdtDTable([
      { label: t("pdtd_th_date"), cls: "l tnum", get: (r) => r.date || "—" },
      { label: t("pdtd_th_wk"), cls: "", get: (r) => esc(r.wk || "—") },
      { label: "PDT/Day", cls: "tnum", get: (r) => r.pdt == null ? "—" : `<b class="${r.pdt < m.pdt_threshold ? "up" : "down"}">${r.pdt}</b>` },
      { label: t("pdtd_th_wd"), cls: "tnum", get: (r) => num(r.work_days) },
      { label: t("pdtd_th_disp"), cls: "tnum", get: (r) => num(r.dispatched) },
      { label: t("pdtd_th_comp"), cls: "tnum", get: (r) => num(r.completed) },
    ], dt.daily_wl, "", (r) => r.pdt != null && r.pdt < m.pdt_threshold);
    else if (panel === 2) ev = pdtDTable([
      { label: t("pdtd_th_date"), cls: "l tnum", get: (r) => r.date || "—" },
      { label: t("pdtd_th_wk"), cls: "", get: (r) => esc(r.wk || "—") },
      { label: t("pdtd_th_mh"), cls: "tnum", get: (r) => num(r.man_hour) },
      { label: "Man Hour/Day", cls: "tnum", get: (r) => r.mhd == null ? "—" : `<b class="${r.mhd < 9 ? "up" : "down"}">${r.mhd}</b>` },
      { label: t("pdtd_th_wd"), cls: "tnum", get: (r) => num(r.work_days) },
      { label: t("pdtd_th_comp"), cls: "tnum", get: (r) => num(r.completed) },
    ], dt.daily_wl, "", (r) => r.mhd != null && r.mhd < 9);
    else if (panel === 3) ev = pdtDTable([
      { label: t("pdtd_th_date"), cls: "l tnum", get: (r) => r.date || "—" },
      { label: t("pdt_th_first"), cls: "tnum", get: (r) => r.first_arrive || "—" },
      { label: t("pdt_th_last"), cls: "tnum", get: (r) => r.last_complete || "—" },
      { label: t("pdtd_th_span"), cls: "tnum", get: (r) => r.span == null ? "—" : `<b>${r.span}</b>` },
      { label: t("pdtd_th_wo"), cls: "tnum", get: (r) => r.wo },
    ], dt.daily_ml, t("pdtd_noml"));
    else ev = pdtDTable([
      { label: t("pdtd_th_date"), cls: "l tnum", get: (r) => r.date || "—" },
      { label: t("pdtd_th_wo"), cls: "tnum", get: (r) => r.wo },
      { label: t("pdtd_th_pts"), cls: "tnum", get: (r) => `<b class="up">${num(r.points)}</b>` },
    ], dt.daily_ml, t("pdtd_noml"));

    const cond = `<div class="pdtd-cond"><span class="pdtd-badge ${panel === 4 ? "over" : "bad"}">${icon("i-alert")}${t("pdtd_flag")}</span><span class="pdtd-cond-t">${esc(t(titleKey))}</span></div>`;
    const reasonsHtml = reasons.length ? `<ul class="pdtd-reasons">${reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "";
    $("pdtDrillBody").innerHTML =
      `<section class="pdtd-block pdtd-verdict">${cond}${gauges}${reasonsHtml}</section>` +
      summary + wt +
      `<section class="pdtd-block"><h3 class="pdtd-h">${t("pdtd_evidence")}</h3>${ev}</section>` +
      worklog;
  }
  /* ---------- Import data tab ---------- */
  const impTable = (ds) => (impSpec && impSpec[ds] ? impSpec[ds].table : ds);
  /* ---------- live data-flow diagram ---------- */
  let flowTimer = null;
  function flowSVG() {
    // source nodes (left) + consumer nodes (right) + animated edges; counts are filled by pollFlow()
    const src = (y, accent, table, idR, idM) => `
      <g class="flow-node flow-src ${accent}">
        <rect x="12" y="${y}" width="232" height="96" rx="12"/>
        <text class="flow-tname" x="28" y="${y + 26}" lang="en">${esc(table)}</text>
        <text class="flow-rows" id="${idR}" x="28" y="${y + 58}">—</text>
        <text class="flow-meta" id="${idM}" x="28" y="${y + 80}">—</text>
      </g>`;
    const cons = [
      [16, t("flow_c_dup"), t("flow_tab_dup"), "acc"],
      [70, t("flow_c_pdt"), t("flow_tab_pdt"), "teal"],
      [124, t("flow_c_mhd"), t("flow_tab_pdt"), "teal"],
      [178, t("flow_c_hours"), t("flow_tab_pdt"), "both"],
      [232, t("flow_c_point"), t("flow_tab_pdt"), "acc"],
    ].map(([y, label, tab, cls]) => `
      <g class="flow-node flow-con ${cls}">
        <rect x="486" y="${y}" width="262" height="46" rx="10"/>
        <text class="flow-clabel" x="502" y="${y + 20}">${esc(label)}</text>
        <text class="flow-ctab" x="502" y="${y + 36}">${esc(tab)}</text>
      </g>`).join("");
    const edge = (sx, sy, ex, ey, cls) => `<path class="flow-edge ${cls}" d="M${sx} ${sy} C${sx + 130} ${sy}, ${ex - 130} ${ey}, ${ex} ${ey}"/>`;
    const M = [244, 78], W = [244, 222];   // source right-centres
    const edges =
      edge(M[0], M[1], 486, 37, "acc") + edge(M[0], M[1], 486, 199, "acc") + edge(M[0], M[1], 486, 253, "acc") +
      edge(W[0], W[1], 486, 91, "teal") + edge(W[0], W[1], 486, 145, "teal") + edge(W[0], W[1], 486, 199, "teal");
    return `<svg class="flowsvg" viewBox="0 0 760 296" role="img" aria-label="data flow">
      <g class="flow-edges">${edges}</g>
      ${src(30, "acc", "mateline_ticket_closed", "fMatRows", "fMatMeta")}
      ${src(174, "teal", "work_load", "fWlRows", "fWlMeta")}
      ${cons}
    </svg>`;
  }
  function pollFlow() {
    apiFetch("api/import/flow").then((r) => { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
      .then((d) => {
        const fill = (idR, idM, s) => {
          const er = $(idR), em = $(idM); if (!er || !em) return;
          er.textContent = (s.rows || 0).toLocaleString() + " " + t("flow_rows");
          em.textContent = `${s.months || 0} ${t("flow_months")} · ${t("flow_latest")} ${s.latest || "—"}`;
        };
        fill("fMatRows", "fMatMeta", d.mateline || {});
        fill("fWlRows", "fWlMeta", d.work_load || {});
        const now = new Date().toLocaleTimeString(LANG === "th" ? "th-TH" : "en-GB");
        $("flowLiveLbl").textContent = `${t("flow_live")} · ${t("flow_updated", { t: now })}`;
      })
      .catch((e) => { if (!String(e).includes("unauthorized")) { /* keep last values */ } });
  }
  function stopFlow() { if (flowTimer) { clearInterval(flowTimer); flowTimer = null; } }
  function startFlow() {
    stopFlow(); pollFlow();
    flowTimer = setInterval(() => { if (S.view !== "import") { stopFlow(); return; } pollFlow(); }, 6000);
  }
  function renderFlow() {
    $("flowTitle").textContent = t("flow_title");
    $("flowSub").textContent = t("flow_sub");
    $("flowLiveLbl").textContent = t("flow_live");
    $("impFlow").innerHTML = flowSVG();
    startFlow();
  }
  function impDownloadTemplate(ds) {
    apiFetch("api/import/template?dataset=" + encodeURIComponent(ds))
      .then((r) => { if (!r.ok) throw new Error("api " + r.status); return r.blob(); })
      .then((blob) => {
        const url = URL.createObjectURL(blob), a = document.createElement("a");
        a.href = url; a.download = "template_" + ds + ".xlsx"; document.body.appendChild(a); a.click();
        a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
      })
      .catch((e) => { if (!String(e).includes("unauthorized")) window.alert(t("imp_err") + ": " + e); });
  }
  function loadImpSpec() {
    return apiFetch("api/import/spec").then((r) => { if (!r.ok) throw new Error("api " + r.status); return r.json(); }).then((d) => { impSpec = d; });
  }
  function renderImport() {
    renderFlow();   // live data-flow overview (independent of the import spec)
    if (!impSpec) { loadImpSpec().then(renderImport).catch((e) => { $("impReport").hidden = false; $("impReportTitle").textContent = t("imp_err"); $("impReportBody").innerHTML = `<div class="hintbox">${icon("i-alert")}${esc(String(e))}</div>`; }); return; }
    const ds = S.imp.dataset;
    $("impStep1").textContent = t("imp_step1"); $("impStep1d").textContent = t("imp_step1d");
    $("impStep2").textContent = t("imp_step2"); $("impStep2d").textContent = t("imp_step2d");
    $("impStep3").textContent = t("imp_step3"); $("impStep3d").textContent = t("imp_step3d");
    $("impDataset").innerHTML = Object.keys(impSpec).map((k) =>
      `<button type="button" class="imp-dsbtn" data-ds="${k}" aria-pressed="${ds === k}">` +
      `<span class="imp-dslabel" lang="en">${esc(impSpec[k].label)}</span>` +
      `<span class="imp-dstable" lang="en">${esc(impSpec[k].table)}</span></button>`).join("");
    $("impTemplate").href = "#"; $("impTemplate").dataset.ds = ds;   // download is fetched with the token (see click handler)
    $("impTemplateLbl").textContent = t("imp_template_lbl");
    const cols = impSpec[ds].cols, keyc = impSpec[ds].key_cols, kcls = { ts: "k-ts", num: "k-num", txt: "k-txt" };
    $("impColsSum").textContent = t("imp_cols_sum", { n: cols.length });
    $("impColList").innerHTML = cols.map((c) => {
      const k = keyc.includes(c.col);
      return `<span class="imp-colchip ${kcls[c.kind]}${k ? " is-key" : ""}" lang="en" title="${esc(c.col)} · ${c.kind}">${esc(c.header)}${k ? " ★" : ""}</span>`;
    }).join("");
    $("impDropMain").textContent = impFile ? t("imp_drop_file", { name: impFile.name }) : t("imp_drop_main");
    $("impDropSub").textContent = t("imp_drop_sub");
    $("impDrop").classList.toggle("has-file", !!impFile);
    $("impMode").innerHTML = [["append", "imp_mode_append", "imp_mode_append_d"], ["replace", "imp_mode_replace", "imp_mode_replace_d"]].map(([m, l, d]) =>
      `<button type="button" class="imp-modebtn${m === "replace" ? " is-replace" : ""}" data-mode="${m}" aria-pressed="${S.imp.mode === m}">` +
      `<span class="imp-modet">${t(l)}</span><span class="imp-moded">${t(d)}</span></button>`).join("");
    $("impResetLbl").textContent = t("imp_reset");
    $("impCommitLbl").textContent = t(S.imp.mode === "replace" ? "imp_commit_replace" : "imp_commit_append");
    if (impReport) renderImportReport(); else $("impReport").hidden = true;
  }
  function impPickFile(f) {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) { impFile = null; impReport = { error: t("imp_drop_sub") }; renderImport(); return; }
    impFile = f; impReport = null; renderImport(); impSend(false);
  }
  function impSend(commit) {
    if (!impFile || impBusy) return;
    if (commit && S.imp.mode === "replace" && !window.confirm(t("imp_replace_warn"))) return;
    impBusy = true;
    $("impReport").hidden = false;
    $("impReportTitle").textContent = t("imp_report_title");
    $("impReportCount").textContent = "";
    $("impReportBody").innerHTML = `<div class="hintbox">${icon("i-info")}${commit ? t("imp_committing") : t("imp_checking")}</div>`;
    $("impCommit").disabled = true; $("impReset").disabled = true;
    const fd = new FormData();
    fd.append("dataset", S.imp.dataset); fd.append("mode", S.imp.mode);
    fd.append("commit", commit ? "true" : "false"); fd.append("file", impFile, impFile.name);
    apiFetch("api/import", { method: "POST", body: fd })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { impBusy = false; $("impReset").disabled = false; impReport = ok ? j : { error: j.detail || ("API " + (j.status || "error")) }; if (ok && commit && j.committed) impFile = null; renderImport(); })
      .catch((e) => { impBusy = false; $("impReset").disabled = false; impReport = { error: String(e) }; renderImportReport(); });
  }
  function renderImportReport() {
    const r = impReport;
    if (!r) { $("impReport").hidden = true; return; }
    $("impReport").hidden = false;
    $("impReportTitle").textContent = t("imp_report_title");
    if (r.error) {
      $("impReportCount").textContent = "";
      $("impReportBody").innerHTML = `<div class="hintbox">${icon("i-alert")}${esc(r.error)}</div>`;
      $("impCommit").disabled = true; return;
    }
    if (r.committed) {
      const msg = t("imp_done", { n: r.inserted, table: impTable(r.dataset) });
      $("impReportCount").innerHTML = `<span class="imp-badge ok">${icon("i-check")}${esc(msg)}</span>`;
      $("impReportBody").innerHTML = `<div class="hintbox imp-success">${icon("i-check")}${esc(msg)}</div>`;
      $("impCommit").disabled = true; return;
    }
    const ok = r.ok;
    const stat = (lbl, val, cls) => `<div class="imp-stat${cls ? " " + cls : ""}"><div class="imp-statv">${val}</div><div class="imp-statl">${esc(lbl)}</div></div>`;
    let body = `<div class="imp-verdict ${ok ? "ok" : "bad"}">${icon(ok ? "i-check" : "i-alert")}<b>${t(ok ? "imp_ok" : "imp_blocked")}</b></div>`;
    body += `<div class="imp-statrow">` + stat(t("imp_total"), r.total_rows) + stat(t("imp_valid"), r.valid_rows, "good") +
      stat(t("imp_skipped"), r.skipped_rows) + stat(t("imp_issues"), r.issue_count, r.issue_count ? "warn" : "") + `</div>`;
    if (r.key_missing && r.key_missing.length) body += `<div class="imp-note bad">${icon("i-alert")}${t("imp_key_missing")}: <b lang="en">${r.key_missing.map(esc).join(", ")}</b></div>`;
    if (r.missing_headers && r.missing_headers.length) body += `<div class="imp-note warn">${icon("i-info")}${t("imp_missing_headers")}: <span lang="en">${r.missing_headers.map(esc).join(", ")}</span></div>`;
    if (S.imp.mode === "replace") body += `<div class="imp-note warn">${icon("i-alert")}${t("imp_replace_warn")}</div>`;
    if (r.issues && r.issues.length) {
      const head = `<tr><th class="tnum">${t("imp_th_row")}</th><th class="l">${t("imp_th_col")}</th><th class="l">${t("imp_th_val")}</th><th class="l">${t("imp_th_reason")}</th></tr>`;
      const rh = r.issues.map((it) => `<tr><td class="tnum">${it.row}</td><td class="l" lang="en">${esc(it.column)}</td><td class="l">${esc(it.value)}</td><td class="l">${esc(it.reason)}</td></tr>`).join("");
      const more = r.issue_count > r.issues.length ? `<div class="drill-note">${t("imp_more_issues", { n: r.issue_count - r.issues.length })}</div>` : "";
      body += `<h3 class="imp-h">${t("imp_issue_list")}</h3><div class="tablewrap" style="max-height:240px"><table><thead>${head}</thead><tbody>${rh}</tbody></table></div>${more}`;
    }
    if (r.preview && r.preview.length) {
      const head = `<tr>${r.preview_cols.map((c) => `<th class="l" lang="en">${esc(c)}</th>`).join("")}</tr>`;
      const rh = r.preview.map((row) => `<tr>${row.map((v) => `<td class="l">${esc(v)}</td>`).join("")}</tr>`).join("");
      body += `<h3 class="imp-h">${t("imp_preview")}</h3><div class="tablewrap" style="max-height:240px"><table><thead>${head}</thead><tbody>${rh}</tbody></table></div>`;
    }
    $("impReportCount").textContent = "";
    $("impReportBody").innerHTML = body;
    $("impCommit").disabled = !ok;
  }
  function renderMonthChips() {
    $("monthChips").innerHTML = DATA.months.map((m, i) => `<button type="button" class="mchip" data-mi="${i}" aria-pressed="${S.months.includes(i)}">${monthLbl(m)}</button>`).join("");
  }
  function fillSelectors() {
    const rs = [...new Set(DATA.records.filter((r) => S.skill === "ALL" || r.skill === S.skill).map((r) => r.region))].sort();
    $("fRegion").innerHTML = `<option value="">${t("region_all")}</option>` + rs.map((r) => `<option${r === S.region ? " selected" : ""}>${r}</option>`).join("");
    const ps = [...new Set(DATA.records.filter((r) => (S.skill === "ALL" || r.skill === S.skill) && (!S.region || r.region === S.region)).map((r) => r.prov))].sort();
    $("fProv").innerHTML = `<option value="">${t("prov_all")}</option>` + ps.map((p) => `<option${p === S.prov ? " selected" : ""}>${p}</option>`).join("");
    $("fRegion").style.display = S.level === "region" ? "none" : "";
    $("fProv").style.display = S.level === "team" ? "" : "none";
    $("minWO").value = S.minWO;
  }
  const setSeg = (id, v) => $(id).querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));

  /* ---------- master render ---------- */
  function render() {
    if (S.view === "import" && !isAdmin()) S.view = "dup";   // viewers never reach the import tab
    const isPdt = S.view === "pdtpoint", isImp = S.view === "import";
    $("dupView").hidden = isPdt || isImp;
    $("pdtView").hidden = !isPdt;
    $("importView").hidden = !isImp;
    $("behNav").querySelectorAll(".navitem").forEach((el) =>
      el.setAttribute("aria-selected", String(el.dataset.view === "pdtpoint" ? isPdt
        : el.dataset.view === "import" ? isImp : (!isPdt && !isImp && el.dataset.k === S.beh))));
    if (isImp) { renderImport(); writeURL(); return; }
    if (isPdt) { pdtData ? renderPdt() : loadPdt(); writeURL(); return; }
    try {
      const b = BEH.find((x) => x.k === S.beh), lvlTxt = t("lvl_" + S.level);
      $("rankTitle").textContent = t("rank_title", { beh: behName(b), lvl: lvlTxt });
      $("trendTitle").textContent = t("trend_title", { beh: behName(b) });
      let cr = `Skill: <b>${S.skill}</b> · ${t("ctl_level")}: <b>${lvlTxt}</b>`;
      if (S.level !== "region" && S.region) cr += ` · ${t("lvl_region")}: <b>${esc(S.region)}</b>`;
      if (S.level === "team" && S.prov) cr += ` · ${t("lvl_prov")}: <b>${esc(S.prov)}</b>`;
      if (S.months.length) cr += ` · ${t("cmp")} <b>${monthLbl(DATA.months[baseMonth()])}–${monthLbl(DATA.months[rankMonth()])}</b> · ${t("rank_by")} <b>${monthLbl(DATA.months[rankMonth()])}</b>`;
      $("crumb").innerHTML = cr;
      setSeg("skillSeg", S.skill); setSeg("levelSeg", S.level);
      $("behNav").querySelectorAll(".navitem").forEach((el) => el.setAttribute("aria-selected", String(el.dataset.k === S.beh)));
      $("monthChips").querySelectorAll(".mchip").forEach((el) => el.setAttribute("aria-pressed", String(S.months.includes(+el.dataset.mi))));
      $("dimSeg").querySelectorAll("button").forEach((el) => el.setAttribute("aria-pressed", String(el.dataset.d === S.dim)));
      fillSelectors(); renderHead();
      const { ranked } = renderRanking();
      renderCards(ranked);
      renderDetail();
      renderChart();
      renderBreakdown();
      writeURL();
    } catch (err) {
      console.error(err);
      $("rankBody").innerHTML = `<tr class="empty-row"><td colspan="${5 + S.months.length}">${icon("i-alert")}${t("render_err")}</td></tr>`;
    }
  }
  function selectKey(k, fromKeyboard) { S.sel = S.sel === k ? null : k; refocusKey = fromKeyboard ? k : null; render(); }

  /* ---------- URL deep-link ---------- */
  function writeURL() {
    try {
      const p = new URLSearchParams();
      p.set("view", S.view);
      if (S.view === "pdtpoint") {
        if (S.pdt.months.length) p.set("pdt_months", S.pdt.months.join(","));
        if (S.pdt.weeks.length) p.set("pdt_weeks", S.pdt.weeks.join(","));
        ["status", "region", "skill", "province"].forEach((k) => { if (S.pdt[k]) p.set("pdt_" + k, S.pdt[k]); });
      }
      p.set("beh", S.beh); p.set("skill", S.skill); p.set("level", S.level);
      if (S.region) p.set("region", S.region); if (S.prov) p.set("prov", S.prov);
      p.set("ms", S.months.join(",")); p.set("minWO", S.minWO);
      p.set("sort", S.sortKey); p.set("dir", S.sortDir); p.set("dim", S.dim);
      if (S.sel) p.set("sel", S.sel); if (S.search) p.set("q", S.search);
      history.replaceState(null, "", "#" + p.toString());
    } catch (e) {}
  }
  function readURL() {
    const h = location.hash.slice(1); if (!h) return;
    const p = new URLSearchParams(h);
    if (BEH.some((b) => b.k === p.get("beh"))) S.beh = p.get("beh");
    if (["ALL", "NODE", "OFC"].includes(p.get("skill"))) S.skill = p.get("skill");
    if (["region", "prov", "team"].includes(p.get("level"))) S.level = p.get("level");
    if (p.has("region")) S.region = p.get("region");
    if (p.has("prov")) S.prov = p.get("prov");
    if (p.has("ms")) { const ms = p.get("ms").split(",").map(Number).filter((n) => n >= 0 && n <= lastM); if (ms.length) S.months = [...new Set(ms)].sort((a, b) => a - b); }
    if (p.has("minWO")) S.minWO = clampInt(+p.get("minWO"), 0, 100000);
    if (["rank", "name", "delta", "woB"].includes(p.get("sort"))) S.sortKey = p.get("sort");
    if (["asc", "desc"].includes(p.get("dir"))) S.sortDir = p.get("dir");
    if (DIMS[p.get("dim")]) S.dim = p.get("dim");
    if (p.has("sel")) S.sel = p.get("sel");
    if (p.has("q")) S.search = p.get("q");
    if (p.get("view") === "pdtpoint") S.view = "pdtpoint";
    else if (p.get("view") === "import") S.view = "import";
    if (p.has("pdt_months")) S.pdt.months = p.get("pdt_months").split(",").filter(Boolean);
    if (p.has("pdt_weeks")) S.pdt.weeks = p.get("pdt_weeks").split(",").filter(Boolean);
    ["status", "region", "skill", "province"].forEach((k) => { if (p.has("pdt_" + k)) S.pdt[k] = p.get("pdt_" + k); });
  }

  /* ---------- CSV (multi-month) ---------- */
  function csvCell(v) { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV() {
    const b = BEH.find((x) => x.k === S.beh);
    const monthCols = S.months.map((mi) => monthLbl(DATA.months[mi]));
    const head = ["rank", "name", "detail", "behavior", ...monthCols, "delta(pt)", "WO(latest)"];
    const lines = [head.map(csvCell).join(",")];
    lastRows.forEach((x) => {
      lines.push([x.rank, x.meta.name, x.meta.sub, behName(b),
        ...x.rates.map((r) => r == null ? "" : (r * 100).toFixed(2)),
        x.delta == null ? "" : (x.delta * 100).toFixed(2), x.woB].map(csvCell).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `behavior_${S.beh}_${S.level}_${DATA.months[rankMonth()]}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }

  /* ---------- theme / lang ---------- */
  function applyThemeIcon() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    $("themeToggle").querySelector("use").setAttribute("href", dark ? "#i-sun" : "#i-moon");
    const tl = dark ? t("theme_light") : t("theme_dark");
    $("themeToggle").setAttribute("aria-label", tl); $("themeToggle").setAttribute("title", tl);
  }
  function applyI18n() {
    document.documentElement.setAttribute("lang", LANG);
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $("search").placeholder = t("search_ph"); $("search").setAttribute("aria-label", t("search_al"));
    $("drillSearch").placeholder = t("drill_search"); $("drillSearch").setAttribute("aria-label", t("drill_search"));
    $("signalNote").innerHTML = t("signal_note");
    $("tablewrap").setAttribute("aria-label", LANG === "en" ? "Ranking table (arrow keys move rows, Enter opens detail)" : "ตารางอันดับ (ลูกศรเลื่อนแถว Enter เปิดรายละเอียด)");
    $("scaleLegend").innerHTML =
      `<span><span class="swatch" style="border-color:var(--accent)"></span>${t("lg_lower")}</span>` +
      `<span class="down">${icon("i-down")}${t("lg_down")}</span>` +
      `<span class="up">${icon("i-up")}${t("lg_up")}</span>` +
      `<span class="flat">${icon("i-minus")}${t("lg_flat")}</span>`;
    $("langSeg").querySelectorAll("button").forEach((bn) => bn.setAttribute("aria-pressed", String(bn.dataset.lang === LANG)));
    renderFooter(); applyThemeIcon();
  }
  function renderFooter() {
    $("foot").innerHTML = `<span class="defrow"><b>${t("foot_def")}</b> ${t("foot_sub")}</span>` +
      `<details class="help"><summary>${icon("i-chev")}${t("foot_help")}</summary><div style="margin-top:8px">${t("formulas")}</div></details>`;
  }

  /* ---------- provenance / dialog ---------- */
  function provenance() {
    const meta = DATA.meta;
    if (meta && Array.isArray(meta.sources) && meta.sources.length)
      return { derived: false, sources: meta.sources, files: meta.total_files || meta.sources.length,
        totalRecords: meta.total_records != null ? meta.total_records : DATA.records.length,
        totalWO: meta.total_wo, generatedAt: meta.generated_at, src: meta.src,
        system: meta.source_system || "MATELINE" };
    const byM = {}; DATA.months.forEach((m) => (byM[m] = { teams: 0, wo: 0, tickets: 0 }));
    for (const r of DATA.records) { const o = byM[r.m]; if (o) { o.teams++; o.wo += r.wo; o.tickets += r.tickets; } }
    const sources = DATA.months.map((m) => ({ file: `MATELINE TICKET CLOSED_${m.replace("-", "")}.xlsx`, month: m, teams: byM[m].teams, wo: byM[m].wo, tickets: byM[m].tickets }));
    return { derived: true, sources, files: DATA.months.length, totalRecords: DATA.records.length, totalWO: sources.reduce((s, x) => s + x.wo, 0), generatedAt: null, src: null, system: "ระบบ MATELINE — รายงาน Ticket Closed (.xlsx) รายเดือน" };
  }
  function renderSrcDialog() {
    const p = provenance(), range = `${monthLong(DATA.months[0])} – ${monthLong(DATA.months[lastM])}`;
    const live = /postgre/i.test(p.system || "");
    const rows = p.sources.map((s) => `<tr><td class="l"><span class="nm" lang="en" title="${esc(s.file)}">${esc(s.file)}</span></td><td>${monthLbl(s.month)}</td><td class="tnum">${(s.teams || 0).toLocaleString()}</td><td class="tnum">${(s.wo || 0).toLocaleString()}</td></tr>`).join("");
    $("srcBody").innerHTML =
      `<p class="src-summary">${t("src_from")} <b>${p.files}</b> ${t("files")} · ${t("src_range")} <b>${range}</b> · <b class="tnum">${p.totalRecords.toLocaleString()}</b> ${t("src_unitmonths")}${p.totalWO ? ` · <b class="tnum">${p.totalWO.toLocaleString()}</b> WO` : ""}</p>` +
      `<div class="src-note">${icon("i-info")}<div><b>${t("src_source")}:</b> ${esc(p.system)}<br>` +
      (live ? `${t("src_livequery")} <code lang="en">${esc(p.src)}</code>` : t("src_proc") + (p.src ? `<br>${t("src_folder")}: <code lang="en">${esc(p.src)}</code>` : "")) +
      (p.generatedAt ? `<br>${live ? t("src_queried") : t("src_gen")}: <span lang="en">${esc(p.generatedAt)}</span>` : "") +
      (p.derived ? `<br><span class="muted">${t("src_derived")}</span>` : "") + "</div></div>" +
      `<div class="tablewrap" style="max-height:48vh"><table><thead><tr><th class="l">${t("src_thfile")}</th><th>${t("src_thmonth")}</th><th>${t("src_thteams")}</th><th><span lang="en">WO</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- events ---------- */
  $("skillSeg").querySelectorAll("button").forEach((b) => b.onclick = () => { S.skill = b.dataset.v; S.region = ""; S.prov = ""; S.sel = null; render(); });
  $("levelSeg").querySelectorAll("button").forEach((b) => b.onclick = () => { S.level = b.dataset.v; S.sel = null; render(); });
  const navSelect = (el) => {
    if (el.dataset.view === "pdtpoint") S.view = "pdtpoint";
    else if (el.dataset.view === "import") S.view = "import";
    else { S.view = "dup"; S.beh = el.dataset.k; }
    render();
  };
  $("behNav").addEventListener("click", (e) => { const x = e.target.closest(".navitem"); if (x) navSelect(x); });
  $("behNav").addEventListener("keydown", (e) => {
    const items = [...$("behNav").querySelectorAll(".navitem")], i = items.indexOf(document.activeElement); if (i < 0) return;
    let n = -1; if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % items.length; else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + items.length) % items.length;
    if (n >= 0) { e.preventDefault(); items[n].focus(); navSelect(items[n]); }
  });
  $("pdtFilters").addEventListener("change", (e) => { const s = e.target.closest(".pdt-f"); if (s) { S.pdt[s.dataset.k] = s.value; loadPdt(); } });
  $("pdtFilters").addEventListener("click", (e) => {
    const toggle = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };
    const mc = e.target.closest(".pdt-mchip"); if (mc) { toggle(S.pdt.months, mc.dataset.v); loadPdt(); return; }
    const wc = e.target.closest(".pdt-wchip"); if (wc) { toggle(S.pdt.weeks, wc.dataset.v); loadPdt(); }
  });
  // open the drill-down for a clicked / keyboard-activated team row in any PDT panel
  $("pdtView").addEventListener("click", (e) => {
    const row = e.target.closest(".pdtd-row"); if (row) openPdtDrill(row.dataset.team, +row.dataset.panel);
  });
  $("pdtView").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(".pdtd-row"); if (row) { e.preventDefault(); openPdtDrill(row.dataset.team, +row.dataset.panel); }
  });
  $("pdtDrillClose").onclick = () => $("pdtDrill").close();
  $("pdtDrill").addEventListener("click", (e) => { if (e.target === $("pdtDrill")) $("pdtDrill").close(); });
  // ---- import tab handlers ----
  $("impDataset").addEventListener("click", (e) => { const b = e.target.closest(".imp-dsbtn"); if (b) { S.imp.dataset = b.dataset.ds; impFile = null; impReport = null; renderImport(); } });
  $("impMode").addEventListener("click", (e) => { const b = e.target.closest(".imp-modebtn"); if (b) { S.imp.mode = b.dataset.mode; renderImport(); } });
  $("impFile").addEventListener("change", (e) => { impPickFile(e.target.files[0]); e.target.value = ""; });
  $("impDrop").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("impFile").click(); } });
  ["dragenter", "dragover"].forEach((ev) => $("impDrop").addEventListener(ev, (e) => { e.preventDefault(); $("impDrop").classList.add("is-drag"); }));
  ["dragleave", "drop"].forEach((ev) => $("impDrop").addEventListener(ev, (e) => { e.preventDefault(); $("impDrop").classList.remove("is-drag"); }));
  $("impDrop").addEventListener("drop", (e) => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) impPickFile(f); });
  $("impReset").onclick = () => { impFile = null; impReport = null; renderImport(); };
  $("impCommit").onclick = () => impSend(true);
  $("monthChips").addEventListener("click", (e) => {
    const c = e.target.closest(".mchip"); if (!c) return;
    const mi = +c.dataset.mi, has = S.months.includes(mi);
    if (has && S.months.length === 1) return;            // keep at least one
    S.months = (has ? S.months.filter((x) => x !== mi) : [...S.months, mi]).sort((a, b) => a - b);
    render();
  });
  document.querySelectorAll(".chiplink").forEach((c) => c.onclick = () => {
    const q = c.dataset.q;
    if (q === "all") S.months = DATA.months.map((_, i) => i);
    else if (q === "last3") S.months = [lastM - 2, lastM - 1, lastM].filter((v) => v >= 0);
    else if (q === "last6") S.months = Array.from({ length: Math.min(6, DATA.months.length) }, (_, i) => lastM - i).reverse();
    render();
  });
  $("dimSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.dim = b.dataset.d; renderBreakdown(); $("dimSeg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.d === S.dim))); writeURL(); } });
  $("bdContent").addEventListener("click", (e) => { const r = e.target.closest(".bdrow"); if (r) openDrill(r.dataset.cat); });
  $("bdContent").addEventListener("keydown", (e) => { const r = e.target.closest(".bdrow"); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openDrill(r.dataset.cat); } });
  $("drillClose").onclick = () => $("drillDialog").close();
  $("drillDialog").addEventListener("click", (e) => { if (e.target === $("drillDialog")) $("drillDialog").close(); });
  $("drillSearch").oninput = debounce(drillRender, 150);
  // per-column header dropdowns (delegated; the search box lives outside #drillBody so its focus is safe)
  $("drillBody").addEventListener("change", (e) => { const c = e.target.closest(".cf"); if (c && drillState) { drillState.colFilters[c.dataset.c] = c.value; drillRender(); } });
  $("drillExport").onclick = drillCSV;
  $("fRegion").onchange = (e) => { S.region = e.target.value; S.prov = ""; S.sel = null; render(); };
  $("fProv").onchange = (e) => { S.prov = e.target.value; S.sel = null; render(); };
  $("minWO").onchange = (e) => { S.minWO = clampInt(+e.target.value || 0, 0, 100000); e.target.value = S.minWO; render(); };
  $("search").oninput = debounce((e) => { S.search = $("search").value; render(); }, 150);
  $("clearBtn").onclick = () => {
    Object.assign(S, { skill: "ALL", level: "region", region: "", prov: "", months: [lastM - 2, lastM - 1, lastM].filter((v) => v >= 0), minWO: 20, sel: null, search: "", sortKey: "rank", sortDir: "asc" });
    $("search").value = ""; render();
  };
  $("exportBtn").onclick = exportCSV;
  $("rankHead").addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort]"); if (!th) return;
    const key = th.dataset.sort;
    if (S.sortKey === key) S.sortDir = S.sortDir === "asc" ? "desc" : "asc";
    else { S.sortKey = key; S.sortDir = { rank: "asc", name: "asc", delta: "desc", woB: "desc" }[key]; }
    render();
  });
  const tbody = $("rankBody");
  tbody.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-k]"); if (tr) selectKey(tr.dataset.k, false); });
  tbody.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-k]"); if (!tr) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectKey(tr.dataset.k, true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); const n = tr.nextElementSibling; if (n && n.dataset.k) n.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const p = tr.previousElementSibling; if (p && p.dataset.k) p.focus(); }
    else if (e.key === "Home") { e.preventDefault(); const f = tbody.querySelector("tr[data-k]"); if (f) f.focus(); }
    else if (e.key === "End") { e.preventDefault(); const a = tbody.querySelectorAll("tr[data-k]"); if (a.length) a[a.length - 1].focus(); }
  });
  $("detail").addEventListener("click", (e) => { if (e.target.closest('[data-action="close"]')) selectKey(S.sel, false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.sel && !$("srcDialog").open && !$("drillDialog").open) selectKey(S.sel, false); });
  $("themeToggle").onclick = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    applyThemeIcon(); renderChart();
  };
  $("langSeg").querySelectorAll("button").forEach((b) => b.onclick = () => {
    if (LANG === b.dataset.lang) return;
    LANG = b.dataset.lang; try { localStorage.setItem("lang", LANG); } catch (e) {}
    applyI18n(); applyAuthUI(); renderNav(); renderDimSeg(); render();
  });
  window.addEventListener("resize", debounce(renderChart, 120));

  /* ---------- auth UI (header chip, logout, user management) ---------- */
  function applyAuthUI() {
    const u = AUTH.user || {}, admin = isAdmin();
    $("userChip").hidden = false;
    $("userName").textContent = u.username || "";
    $("userRole").textContent = t(u.role === "admin" ? "role_admin" : "role_viewer");
    $("userRole").className = "urole " + (u.role === "admin" ? "is-admin" : "is-viewer");
    $("logoutBtn").hidden = false; $("logoutLbl").textContent = t("auth_logout");
    $("usersBtn").hidden = !admin; $("usersBtnLbl").textContent = t("users_btn");
  }
  $("logoutBtn").onclick = () => {
    AUTH.token = null; AUTH.user = null;
    try { localStorage.removeItem("tt_token"); } catch (e) {}
    location.reload();
  };
  function openUsers() { $("usersDialog").showModal ? $("usersDialog").showModal() : $("usersDialog").setAttribute("open", ""); $("usersTitle").textContent = t("users_title"); renderUsers(); }
  $("usersBtn").onclick = openUsers;
  $("usersClose").onclick = () => $("usersDialog").close();
  $("usersDialog").addEventListener("click", (e) => { if (e.target === $("usersDialog")) $("usersDialog").close(); });
  function renderUsers() {
    $("usersBody").innerHTML = `<div class="hintbox">${icon("i-info")}${t("drill_loading")}</div>`;
    apiFetch("api/users").then((r) => { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
      .then((d) => paintUsers(d.users || []))
      .catch((e) => { if (!String(e).includes("unauthorized")) $("usersBody").innerHTML = `<div class="hintbox">${icon("i-alert")}${t("users_loaderr")}</div>`; });
  }
  function paintUsers(users) {
    const me = (AUTH.user || {}).username;
    const roleOpts = (sel) => `<option value="viewer"${sel === "viewer" ? " selected" : ""}>${t("role_viewer")}</option><option value="admin"${sel === "admin" ? " selected" : ""}>${t("role_admin")}</option>`;
    const rows = users.map((u) => `<tr data-u="${esc(u.username)}">
      <td class="l"><b lang="en">${esc(u.username)}</b>${u.username === me ? ` <small class="muted-dash">${t("users_you")}</small>` : ""}</td>
      <td><select class="u-role" aria-label="role">${roleOpts(u.role)}</select></td>
      <td class="l"><span class="u-newpw-wrap"><input class="u-newpw" type="password" placeholder="${t("users_newpw_ph")}" autocomplete="new-password"></span></td>
      <td class="u-actions">
        <button class="iconbtn u-save" type="button" title="${t("users_save")}">${icon("i-check")}</button>
        <button class="iconbtn u-del" type="button" title="${t("users_del")}"${u.username === me ? " disabled" : ""}>${icon("i-trash")}</button>
      </td></tr>`).join("");
    const head = `<tr><th class="l">${t("users_th_user")}</th><th>${t("users_th_role")}</th><th class="l">${t("users_th_act")}</th><th></th></tr>`;
    $("usersBody").innerHTML =
      `<div class="tablewrap" style="max-height:46vh"><table class="utable"><thead>${head}</thead><tbody>${rows}</tbody></table></div>` +
      `<form class="u-addform" id="uAdd"><h3 class="imp-h">${t("users_add")}</h3><div class="u-addrow">` +
      `<input id="uNewName" type="text" placeholder="${t("users_uname_ph")}" autocomplete="off" required>` +
      `<input id="uNewPw" type="password" placeholder="${t("users_pw_ph")}" autocomplete="new-password" required>` +
      `<select id="uNewRole">${roleOpts("viewer")}</select>` +
      `<button class="btn btn-primary" type="submit">${icon("i-plus")}${t("users_create")}</button></div><div class="autherr" id="uAddErr" hidden></div></form>`;
  }
  function uApi(path, opts) {
    return apiFetch(path, opts).then((r) => r.json().then((j) => ({ ok: r.ok, j })));
  }
  $("usersBody").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-u]"); if (!tr) return;
    const uname = tr.dataset.u;
    if (e.target.closest(".u-save")) {
      const role = tr.querySelector(".u-role").value, pw = tr.querySelector(".u-newpw").value;
      const body = { role }; if (pw) body.password = pw;
      uApi("api/users/" + encodeURIComponent(uname), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(({ ok, j }) => { if (!ok) throw new Error(j.detail || "error"); renderUsers(); })
        .catch((ex) => { if (!String(ex).includes("unauthorized")) window.alert(String(ex.message || ex)); });
    } else if (e.target.closest(".u-del")) {
      if (!window.confirm(t("users_del_confirm", { u: uname }))) return;
      uApi("api/users/" + encodeURIComponent(uname), { method: "DELETE" })
        .then(({ ok, j }) => { if (!ok) throw new Error(j.detail || "error"); renderUsers(); })
        .catch((ex) => { if (!String(ex).includes("unauthorized")) window.alert(String(ex.message || ex)); });
    }
  });
  $("usersBody").addEventListener("submit", (e) => {
    if (e.target.id !== "uAdd") return;
    e.preventDefault();
    const err = $("uAddErr");
    const body = { username: $("uNewName").value.trim(), password: $("uNewPw").value, role: $("uNewRole").value };
    uApi("api/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(({ ok, j }) => { if (!ok) throw new Error(j.detail || "error"); renderUsers(); })
      .catch((ex) => { if (String(ex).includes("unauthorized")) return; err.textContent = String(ex.message || ex); err.hidden = false; });
  });

  /* ---------- import handlers (template download needs the token) ---------- */
  $("impTemplate").addEventListener("click", (e) => { e.preventDefault(); impDownloadTemplate(S.imp.dataset); });

  /* ---------- boot ---------- */
  readURL();
  applyI18n();
  applyAuthUI();
  renderNav();
  renderMonthChips();
  renderDimSeg();
  render();
}

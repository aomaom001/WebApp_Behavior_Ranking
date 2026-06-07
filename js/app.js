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
    subtitle: "จัดอันดับ WO ซ้ำ Ticket เดิม · เจาะลึกหลายมิติ · MATELINE",
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
    subtitle: "Duplicate WO/Ticket ranking · multi-dimension drill-down · MATELINE",
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
});
Object.assign(I18N.en, {
  drill_hint: "Click to list records", drill_title: "Drill-down records", drill_loading: "Loading detail…",
  drill_empty: "No records match", drill_tickets: "tickets", drill_distinct: "distinct tickets",
  drill_first: "Showing first {n} of", drill_more: "records. Use search to narrow it down.", drill_search: "Search list…",
  col_team: "Team", col_loc: "Region · Province", col_sev: "Severity", col_status: "Status",
  col_wtype: "Work Type", col_root: "Root Cause", col_sla: "SLA", col_site: "Site",
  err_title: "Couldn't load data", err_body: "Open it through a web server, not by opening the file directly. See the README (e.g. npm run dev).",
});
function t(k, vars) {
  let s = (I18N[LANG] && I18N[LANG][k]) != null ? I18N[LANG][k] : k;
  if (vars) for (const v in vars) s = s.replace("{" + v + "}", vars[v]);
  return s;
}

// Prefer the live PostgreSQL-backed API; fall back to the static data file (e.g. on GitHub Pages).
function loadJSON(apiPath, staticPath) {
  return fetch(apiPath).then((r) => { if (!r.ok) throw new Error("api " + r.status); return r.json(); })
    .catch(() => fetch(staticPath).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }));
}
loadJSON("api/data", "./data/data.json")
  .then(boot)
  .catch((err) => {
    console.error(err);
    const loading = document.getElementById("loading"); if (loading) loading.remove();
    const wrap = document.querySelector(".wrap");
    if (wrap) wrap.innerHTML = '<div class="errscreen" role="alert">' + icon("i-alert") +
      "<h2>" + t("err_title") + "</h2>" +
      "<p>" + t("err_body") + "</p>" +
      "<pre>" + String(err) + "</pre></div>";
  });

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
  };
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

  // tiny inline trend sparkline across the selected months
  function spark(rates) {
    const pts = rates.map((v, i) => [i, v]).filter((p) => p[1] != null);
    if (pts.length < 2) return '<span class="muted-dash">—</span>';
    const ys = pts.map((p) => p[1]), mn = Math.min(...ys), mx = Math.max(...ys);
    const w = 88, h = 22, pad = 3, n = rates.length - 1 || 1;
    const X = (i) => pad + (w - 2 * pad) * (i / n);
    const Y = (v) => mx === mn ? h / 2 : pad + (h - 2 * pad) * (1 - (v - mn) / (mx - mn));
    let d = ""; pts.forEach((p) => { d += (d ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1) + " "; });
    const cls = rateColor(pts[pts.length - 1][1] - pts[0][1]);
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
    $("behNav").innerHTML = BEH.map((b) =>
      `<button type="button" role="tab" class="navitem" data-k="${b.k}" aria-selected="${b.k === S.beh}">` +
      `${icon("i-alert")}<span class="txt"><span class="nm">${behName(b)}</span><span class="d">${behDesc(b)}</span></span></button>`).join("");
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
    $("dataSrcLbl").textContent = `${t("src_btn")} · ${provenance().files} ${t("files")}`;
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
  $("behNav").addEventListener("click", (e) => { const x = e.target.closest(".navitem"); if (x) { S.beh = x.dataset.k; render(); } });
  $("behNav").addEventListener("keydown", (e) => {
    const items = [...$("behNav").querySelectorAll(".navitem")], i = items.indexOf(document.activeElement); if (i < 0) return;
    let n = -1; if (e.key === "ArrowDown" || e.key === "ArrowRight") n = (i + 1) % items.length; else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = (i - 1 + items.length) % items.length;
    if (n >= 0) { e.preventDefault(); items[n].focus(); S.beh = items[n].dataset.k; render(); }
  });
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
    applyI18n(); renderNav(); renderDimSeg(); render();
  });
  $("copyLink").onclick = () => {
    const btn = $("copyLink"), lbl = btn.querySelector(".lbl");
    const done = () => { btn.classList.add("is-ok"); btn.querySelector("use").setAttribute("href", "#i-check"); if (lbl) lbl.textContent = t("copied");
      setTimeout(() => { btn.classList.remove("is-ok"); btn.querySelector("use").setAttribute("href", "#i-link"); if (lbl) lbl.textContent = t("copy"); }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done).catch(done); else done();
  };
  $("dataSrc").onclick = () => { renderSrcDialog(); const d = $("srcDialog"); if (d.showModal) d.showModal(); else d.setAttribute("open", ""); };
  $("srcClose").onclick = () => $("srcDialog").close();
  $("srcDialog").addEventListener("click", (e) => { if (e.target === $("srcDialog")) $("srcDialog").close(); });
  window.addEventListener("resize", debounce(renderChart, 120));

  /* ---------- boot ---------- */
  readURL();
  applyI18n();
  renderNav();
  renderMonthChips();
  renderDimSeg();
  render();
}

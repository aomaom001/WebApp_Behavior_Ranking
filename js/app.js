/**
 * Team Behavior Ranking Dashboard
 * Entry point: loads data/data.json then boots the UI.
 * No build step — plain ES + fetch. Must be served over HTTP (see README).
 */
"use strict";

const icon = (id, cls) => `<svg class="ico ${cls || ""}" aria-hidden="true"><use href="#${id}"/></svg>`;

fetch("./data/data.json")
  .then((res) => {
    if (!res.ok) throw new Error("HTTP " + res.status + " while loading data.json");
    return res.json();
  })
  .then(boot)
  .catch((err) => {
    console.error(err);
    const loading = document.getElementById("loading");
    if (loading) loading.remove();
    const wrap = document.querySelector(".wrap");
    if (wrap) wrap.innerHTML =
      '<div class="errscreen" role="alert">' +
      '<svg class="ico"><use href="#i-alert"/></svg>' +
      "<h2>โหลดข้อมูลไม่สำเร็จ</h2>" +
      '<p>ต้องเปิดผ่าน web server ไม่ใช่ดับเบิลคลิกไฟล์ตรง ๆ — ดูวิธีรันใน README (เช่น <b>npm run dev</b>)</p>' +
      "<pre>" + String(err) + "</pre></div>";
  });

function boot(DATA) {
  const loading = document.getElementById("loading");
  if (loading) loading.remove();

  const BEH = [
    { k: "dup",    t: "WO ซ้ำ Ticket เดิม",  d: "WO ต่อ Ticket เกิน 1 → เปิดซ้ำ" },
    { k: "nowork", t: "เปิด WO ไม่ทำงานจริง", d: "No-Visit / ไม่มี Solution / Canceled" },
    { k: "cross",  t: "ช่วยข้าม Province",    d: "Province ของ WO ≠ Province ของ Ticket" },
    { k: "sys",    t: "System WO ผิดปกติ",    d: "สัดส่วน WO ที่สร้างโดย System" },
  ];
  const LVL = { region: "ภาค", prov: "จังหวัด", team: "ทีม" };
  const SORT_DEFAULT_DIR = { rank: "asc", name: "asc", rA: "desc", rB: "desc", delta: "desc", woB: "desc" };

  const lastM = DATA.months.length - 1;
  const S = {
    skill: "ALL", level: "region", beh: "dup", region: "", prov: "",
    mA: 0, mB: lastM, minWO: 20, sel: null, search: "",
    sortKey: "rank", sortDir: "asc",
  };
  let lastRows = [];      // rows currently shown (for CSV export)
  let refocusKey = null;  // row key to refocus after a keyboard-driven re-render

  const $ = (id) => document.getElementById(id);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, v | 0));
  const pct = (v) => (v * 100).toFixed(v < 0.001 ? 2 : 1) + "%";
  const monthLbl = (m) => { const [y, mo] = m.split("-"); return mo + "/" + y.slice(2); };
  const monthLong = (m) => { const [y, mo] = m.split("-"); return mo + "/" + y; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rateColor = (d) => (d < -0.0005 ? "down" : d > 0.0005 ? "up" : "flat");

  // One delta renderer used everywhere → consistent formatting (triple-encoded: icon + sign + colour)
  function fmtDelta(d) {
    if (d == null) return '<span class="muted-dash">—</span>';
    const cls = rateColor(d);
    const ic = cls === "down" ? "i-down" : cls === "up" ? "i-up" : "i-minus";
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

  // Canonical "badness" ranking (rate B desc), rank assigned before any display sort.
  function computeRanked() {
    const A = aggMonth(DATA.months[S.mA]), B = aggMonth(DATA.months[S.mB]);
    const all = Object.keys(B).map((k) => {
      const b = B[k], a = A[k];
      const rB = b.wo ? b[S.beh] / b.wo : 0;
      const rA = a && a.wo ? a[S.beh] / a.wo : null;
      return { k, meta: b.meta, rB, rA, woB: b.wo, delta: rA === null ? null : rB - rA };
    });
    const totalUnits = all.length;
    const eligible = all.filter((x) => x.woB >= S.minWO).sort((x, y) => y.rB - x.rB);
    eligible.forEach((x, i) => (x.rank = i + 1));
    return { ranked: eligible, totalUnits, hidden: totalUnits - eligible.length };
  }

  function sortView(rows) {
    const { sortKey: key, sortDir: dir } = S;
    const sign = dir === "asc" ? 1 : -1;
    return rows.slice().sort((a, b) => {
      if (key === "name") return sign * a.meta.name.localeCompare(b.meta.name, "th");
      const va = key === "rank" ? a.rank : a[key];
      const vb = key === "rank" ? b.rank : b[key];
      const na = va == null, nb = vb == null;
      if (na && nb) return 0;
      if (na) return 1;       // nulls always last
      if (nb) return -1;
      return sign * (va - vb);
    });
  }

  /* ---------- ranking table ---------- */
  function renderRanking() {
    const { ranked, totalUnits, hidden } = computeRanked();
    const maxR = ranked.length ? Math.max(...ranked.map((x) => x.rB)) : 1;
    const q = S.search.trim().toLowerCase();
    const filtered = q ? ranked.filter((x) => (x.meta.name + " " + x.meta.sub).toLowerCase().includes(q)) : ranked;
    const view = sortView(filtered);
    lastRows = view;

    const body = $("rankBody");
    if (!view.length) {
      body.innerHTML =
        `<tr class="empty-row"><td colspan="6">${icon("i-filter")}` +
        (q ? `ไม่พบหน่วยที่ตรงกับคำค้น “${esc(S.search)}”`
           : "ไม่มีข้อมูลตามเงื่อนไข — ลองลด “WO ≥” หรือกดล้างตัวกรอง") +
        "</td></tr>";
    } else {
      const html = view.map((x) => {
        const top = x.rank <= 3;
        const rkCls = top ? "top rk-" + x.rank : "";
        const bar = `<div class="barcell"><span class="barval tnum">${pct(x.rB)}</span>` +
          `<div class="bar"><i style="width:${Math.max(2, (x.rB / maxR) * 100)}%"></i></div></div>`;
        return `<tr data-k="${esc(x.k)}" class="${S.sel === x.k ? "sel" : ""}${top ? " is-top" : ""}" ` +
          `tabindex="0" role="button" aria-pressed="${S.sel === x.k}" ` +
          `aria-label="${esc(x.meta.name)} อันดับ ${x.rank}, ${pct(x.rB)}, ${x.delta == null ? "ไม่มีข้อมูลเทียบ" : (x.delta < 0 ? "ดีขึ้น" : x.delta > 0 ? "แย่ลง" : "ทรงตัว")}">` +
          `<td class="l"><span class="rk ${rkCls}">${x.rank}</span></td>` +
          `<td class="l"><div class="namecell"><span class="nm" lang="en" title="${esc(x.meta.name)}">${esc(x.meta.name)}</span>` +
          `<small title="${esc(x.meta.sub)}">${esc(x.meta.sub)}</small></div></td>` +
          `<td class="tnum">${x.rA === null ? '<span class="muted-dash">—</span>' : pct(x.rA)}</td>` +
          `<td>${bar}</td>` +
          `<td>${fmtDelta(x.delta)}</td>` +
          `<td class="tnum">${x.woB.toLocaleString()}</td></tr>`;
      }).join("");
      body.innerHTML = html;
    }

    // status line
    const parts = [`แสดง <b>${view.length.toLocaleString()}</b> จาก <b>${ranked.length.toLocaleString()}</b> หน่วย`];
    if (hidden > 0) parts.push(`<span class="hidden-note">ซ่อน ${hidden.toLocaleString()} (WO < ${S.minWO})</span>`);
    if (S.mA === S.mB) parts.push(`<span class="hidden-note">เลือกคนละเดือนเพื่อเทียบ A→B</span>`);
    $("rowcount").innerHTML = parts.join(" · ");

    if (refocusKey != null) {
      const el = body.querySelector(`tr[data-k="${cssEscape(refocusKey)}"]`);
      if (el) el.focus();
      refocusKey = null;
    }
    return ranked;
  }
  const cssEscape = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\\]]/g, "\\$&"));

  function updateSortHeaders() {
    document.querySelectorAll("#rankHead th").forEach((th) => {
      const key = th.dataset.sort;
      if (key === S.sortKey) th.setAttribute("aria-sort", S.sortDir === "asc" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });
  }

  /* ---------- detail panel ---------- */
  function renderDetail() {
    const box = $("detail");
    if (!S.sel) {
      box.innerHTML = `<div class="hintbox">${icon("i-arrow")}คลิกแถวในตารางเพื่อดูค่าทั้ง 4 พฤติกรรม และจำนวนดิบของหน่วยนั้น</div>`;
      return;
    }
    const A = aggMonth(DATA.months[S.mA])[S.sel], B = aggMonth(DATA.months[S.mB])[S.sel];
    if (!B) {
      box.innerHTML = `<div class="hintbox">${icon("i-info")}หน่วยที่เลือกไม่มีข้อมูลในเดือนเปรียบเทียบ — ลองเปลี่ยนเดือน หรือเลือกหน่วยอื่น</div>`;
      return;
    }
    const meta = B.meta;
    const rows = BEH.map((b) => {
      const rB = B.wo ? B[b.k] / B.wo : 0;
      const rA = A && A.wo ? A[b.k] / A.wo : null;
      const d = rA == null ? null : rB - rA;
      return `<tr${b.k === S.beh ? ' class="beh-active"' : ""}><td class="l">${b.t}</td>` +
        `<td class="tnum">${rA == null ? "—" : pct(rA)}</td><td class="tnum"><b>${pct(rB)}</b></td>` +
        `<td>${fmtDelta(d)}</td></tr>`;
    }).join("");
    box.innerHTML = `<div class="detail">
      <div class="dhead"><div><h3 lang="en">${esc(meta.name)}</h3><div class="meta">${esc(meta.sub)}</div></div>
        <button class="x" type="button" data-action="close">${icon("i-x")}ปิด</button></div>
      <table><thead><tr><th class="l">พฤติกรรม</th><th>A (${monthLbl(DATA.months[S.mA])})</th><th>B (${monthLbl(DATA.months[S.mB])})</th><th>Δ</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <div class="kv">
        <span><span lang="en">WO</span> (B): <b class="tnum">${B.wo.toLocaleString()}</b></span>
        <span>Ticket ไม่ซ้ำ: <b class="tnum">${B.tickets.toLocaleString()}</b></span>
        <span>WO ซ้ำ: <b class="tnum">${B.dup.toLocaleString()}</b></span>
        <span>ไม่ทำงานจริง: <b class="tnum">${B.nowork.toLocaleString()}</b></span>
        <span>ข้าม Province: <b class="tnum">${B.cross.toLocaleString()}</b></span>
        <span>System: <b class="tnum">${B.sys.toLocaleString()}</b></span>
        <span>Manual: <b class="tnum">${B.man.toLocaleString()}</b></span>
      </div></div>`;
  }

  /* ---------- stat cards ---------- */
  function renderCards(rows) {
    const A = aggMonth(DATA.months[S.mA]), B = aggMonth(DATA.months[S.mB]);
    const sum = (g) => { let n = 0, w = 0; for (const k in g) { n += g[k][S.beh]; w += g[k].wo; } return w ? n / w : 0; };
    const rA = sum(A), rB = sum(B), d = rB - rA;
    let imp = 0, wor = 0;
    rows.forEach((x) => { if (x.delta !== null) { if (x.delta < -0.0005) imp++; else if (x.delta > 0.0005) wor++; } });
    const b = BEH.find((x) => x.k === S.beh);
    $("cards").innerHTML = `
      <div class="card card--primary">
        <div class="k">ภาพรวม ${esc(b.t)}</div>
        <div class="v"><span class="tnum">${pct(rB)}</span> ${fmtDelta(d)}</div>
        <div class="k sub">${monthLbl(DATA.months[S.mA])} → ${monthLbl(DATA.months[S.mB])} · เดือน A อยู่ที่ ${pct(rA)}</div>
      </div>
      <div class="card card--stat down">
        <div class="card-ico">${icon("i-down")}</div>
        <div><div class="v down tnum">${imp}</div><div class="k">หน่วยที่ดีขึ้น · จาก ${rows.length}</div></div>
      </div>
      <div class="card card--stat up">
        <div class="card-ico">${icon("i-up")}</div>
        <div><div class="v up tnum">${wor}</div><div class="k">หน่วยที่แย่ลง · จาก ${rows.length}</div></div>
      </div>
      <div class="card card--stat flat">
        <div class="card-ico">${icon("i-minus")}</div>
        <div><div class="v tnum">${rows.length - imp - wor}</div><div class="k">ทรงตัว · จาก ${rows.length}</div></div>
      </div>`;
  }

  /* ---------- trend chart (+ accessible fallbacks) ---------- */
  function renderChart() {
    const svg = $("chart");
    const W = svg.clientWidth || 560, H = svg.clientHeight || 250;
    const cs = getComputedStyle(document.documentElement);
    const C = {
      grid: cs.getPropertyValue("--chart-grid").trim(), line: cs.getPropertyValue("--chart-line").trim(),
      axis: cs.getPropertyValue("--chart-axis").trim(), axisOn: cs.getPropertyValue("--chart-axis-on").trim(),
      accent: cs.getPropertyValue("--accent").trim(), guide: cs.getPropertyValue("--chart-guide").trim(),
      area: cs.getPropertyValue("--chart-area").trim(),
    };
    const pad = { l: 46, r: 14, t: 14, b: 26 }, months = DATA.months;
    const lines = [{ name: "ภาพรวม (ตามตัวกรอง)", data: series(null), col: C.line, dash: "4 3" }];
    let selName = null;
    if (S.sel) {
      const rr = recs().find((r) => keyOf(r) === S.sel);
      selName = rr ? metaOf(rr).name : S.sel;
      lines.push({ name: selName, data: series(S.sel), col: C.accent, area: true });
    }
    const all = lines.flatMap((l) => l.data).filter((v) => v != null);
    const mx = Math.max(0.001, ...all), mn = 0;
    const x = (i) => pad.l + (W - pad.l - pad.r) * (months.length < 2 ? 0.5 : i / (months.length - 1));
    const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - mn) / (mx - mn));

    let h = "";
    for (let g = 0; g <= 4; g++) {
      const v = mn + (mx - mn) * g / 4, yy = y(v);
      h += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="${C.grid}"/>`;
      h += `<text x="${pad.l - 6}" y="${yy + 3}" fill="${C.axis}" font-size="10" text-anchor="end">${(v * 100).toFixed(1)}%</text>`;
    }
    months.forEach((m, i) => {
      const xx = x(i), onAB = i === S.mA || i === S.mB;
      h += `<text x="${xx}" y="${H - 8}" fill="${onAB ? C.axisOn : C.axis}" font-size="10" text-anchor="middle"${onAB ? ' font-weight="700"' : ""}>${monthLbl(m)}</text>`;
      if (onAB) h += `<line x1="${xx}" y1="${pad.t}" x2="${xx}" y2="${H - pad.b}" stroke="${C.guide}"/>`;
    });
    lines.forEach((l) => {
      let d = "";
      l.data.forEach((v, i) => { if (v == null) return; d += (d ? "L" : "M") + x(i) + " " + y(v) + " "; });
      if (l.area && d) {
        const pts = l.data.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
        if (pts.length) {
          const area = `M${pts[0][0]} ${y(mn)} ` + pts.map((p) => `L${p[0]} ${p[1]}`).join(" ") + ` L${pts[pts.length - 1][0]} ${y(mn)} Z`;
          h += `<path d="${area}" fill="${C.area}" stroke="none"/>`;
        }
      }
      h += `<path d="${d}" fill="none" stroke="${l.col}" stroke-width="2.2"${l.dash ? ` stroke-dasharray="${l.dash}"` : ""}/>`;
      l.data.forEach((v, i) => {
        if (v == null) return;
        h += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${l.col}"><title>${monthLong(months[i])}: ${(v * 100).toFixed(2)}%</title></circle>`;
      });
    });
    svg.innerHTML = h;

    $("legend").innerHTML = lines.map((l) =>
      `<span><span class="dot${l.dash ? " dash" : ""}" style="${l.dash ? "color:" + l.col : "background:" + l.col}"></span>${esc(l.name)}</span>`
    ).join("");

    // Screen-reader description + data table
    const focus = S.sel ? series(S.sel) : series(null);
    const first = focus.find((v) => v != null), last = [...focus].reverse().find((v) => v != null);
    const ch = last != null && first != null ? last - first : null;
    const behName = BEH.find((x) => x.k === S.beh).t;
    const subj = S.sel ? selName : "ภาพรวมตามตัวกรอง";
    svg.setAttribute("aria-label", `กราฟแนวโน้ม ${behName} ของ ${subj} ตั้งแต่ ${monthLong(months[0])} ถึง ${monthLong(months[lastM])}` +
      (ch != null ? ` เปลี่ยนแปลงรวม ${ch < 0 ? "" : "+"}${(ch * 100).toFixed(1)} จุดเปอร์เซ็นต์` : ""));
    $("chartDesc").textContent = svg.getAttribute("aria-label") + ". ดูตารางข้อมูลด้านล่าง";

    const ov = series(null);
    $("chartTable").innerHTML =
      `<table><caption>ข้อมูลแนวโน้ม ${esc(behName)} รายเดือน (อัตรา %)</caption>` +
      `<thead><tr><th>เดือน</th><th>ภาพรวม</th>${S.sel ? `<th>${esc(selName)}</th>` : ""}</tr></thead><tbody>` +
      months.map((m, i) => `<tr><td>${monthLong(m)}</td><td>${ov[i] == null ? "—" : (ov[i] * 100).toFixed(2) + "%"}</td>` +
        (S.sel ? `<td>${focus[i] == null ? "—" : (focus[i] * 100).toFixed(2) + "%"}</td>` : "") + "</tr>").join("") +
      "</tbody></table>";

    $("miniStats").innerHTML = ch === null ? "" :
      `<div class="pill">ทั้งช่วง ${monthLbl(months[0])} → ${monthLbl(months[lastM])}: ${fmtDelta(ch)}</div>`;
  }

  /* ---------- tabs / selectors ---------- */
  function renderTabs() {
    $("behTabs").innerHTML = BEH.map((b) =>
      `<button type="button" role="tab" class="tab" data-k="${b.k}" aria-selected="${b.k === S.beh}">
        <span class="t">${b.t}</span><span class="d">${b.d}</span></button>`).join("");
  }
  function fillSelectors() {
    const mopt = DATA.months.map((m, i) => `<option value="${i}">${monthLbl(m)}</option>`).join("");
    $("mA").innerHTML = mopt; $("mB").innerHTML = mopt; $("mA").value = S.mA; $("mB").value = S.mB;
    const rs = [...new Set(DATA.records.filter((r) => S.skill === "ALL" || r.skill === S.skill).map((r) => r.region))].sort();
    $("fRegion").innerHTML = '<option value="">ทุกภาค</option>' + rs.map((r) => `<option${r === S.region ? " selected" : ""}>${r}</option>`).join("");
    const ps = [...new Set(DATA.records.filter((r) => (S.skill === "ALL" || r.skill === S.skill) && (!S.region || r.region === S.region)).map((r) => r.prov))].sort();
    $("fProv").innerHTML = '<option value="">ทุกจังหวัด</option>' + ps.map((p) => `<option${p === S.prov ? " selected" : ""}>${p}</option>`).join("");
    $("fRegion").style.display = S.level === "region" ? "none" : "";
    $("fProv").style.display = S.level === "team" ? "" : "none";
    $("minWO").value = S.minWO;
  }
  function setSeg(id, v) {
    $(id).querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  }
  function setTabs() {
    $("behTabs").querySelectorAll(".tab").forEach((el) => el.setAttribute("aria-selected", String(el.dataset.k === S.beh)));
  }

  /* ---------- master render ---------- */
  function render() {
    try {
      document.querySelectorAll(".mA-lbl").forEach((e) => (e.textContent = monthLbl(DATA.months[S.mA])));
      document.querySelectorAll(".mB-lbl").forEach((e) => (e.textContent = monthLbl(DATA.months[S.mB])));
      const b = BEH.find((x) => x.k === S.beh), lvlTxt = LVL[S.level];
      $("rankTitle").textContent = `อันดับ: ${b.t} — ราย${lvlTxt}`;
      $("trendTitle").textContent = `แนวโน้มรายเดือน: ${b.t}`;
      let cr = `Skill: <b>${S.skill}</b> · ระดับ: <b>${lvlTxt}</b>`;
      if (S.level !== "region" && S.region) cr += ` · ภาค: <b>${esc(S.region)}</b>`;
      if (S.level === "team" && S.prov) cr += ` · จังหวัด: <b>${esc(S.prov)}</b>`;
      $("crumb").innerHTML = cr;
      setSeg("skillSeg", S.skill); setSeg("levelSeg", S.level); setTabs();
      fillSelectors(); updateSortHeaders();
      const rows = renderRanking();
      renderCards(rows);
      renderDetail();
      renderChart();
      writeURL();
    } catch (err) {
      console.error(err);
      $("rankBody").innerHTML = `<tr class="empty-row"><td colspan="6">${icon("i-alert")}เกิดข้อผิดพลาดในการแสดงผล — ลองกดล้างตัวกรอง</td></tr>`;
    }
  }

  /* ---------- selection helpers ---------- */
  function selectKey(k, fromKeyboard) {
    S.sel = S.sel === k ? null : k;
    refocusKey = fromKeyboard ? k : null;
    render();
  }

  /* ---------- URL deep-link ---------- */
  function writeURL() {
    try {
      const p = new URLSearchParams();
      p.set("beh", S.beh); p.set("skill", S.skill); p.set("level", S.level);
      if (S.region) p.set("region", S.region);
      if (S.prov) p.set("prov", S.prov);
      p.set("mA", S.mA); p.set("mB", S.mB); p.set("minWO", S.minWO);
      p.set("sort", S.sortKey); p.set("dir", S.sortDir);
      if (S.sel) p.set("sel", S.sel);
      if (S.search) p.set("q", S.search);
      history.replaceState(null, "", "#" + p.toString());
    } catch (e) { /* sandboxed / file:// — deep-link is a non-critical enhancement */ }
  }
  function readURL() {
    const h = location.hash.slice(1);
    if (!h) return;
    const p = new URLSearchParams(h);
    if (BEH.some((b) => b.k === p.get("beh"))) S.beh = p.get("beh");
    if (["ALL", "NODE", "OFC"].includes(p.get("skill"))) S.skill = p.get("skill");
    if (LVL[p.get("level")]) S.level = p.get("level");
    if (p.has("region")) S.region = p.get("region");
    if (p.has("prov")) S.prov = p.get("prov");
    if (p.has("mA")) S.mA = clampInt(+p.get("mA"), 0, lastM);
    if (p.has("mB")) S.mB = clampInt(+p.get("mB"), 0, lastM);
    if (p.has("minWO")) S.minWO = clampInt(+p.get("minWO"), 0, 100000);
    if (SORT_DEFAULT_DIR[p.get("sort")]) S.sortKey = p.get("sort");
    if (["asc", "desc"].includes(p.get("dir"))) S.sortDir = p.get("dir");
    if (p.has("sel")) S.sel = p.get("sel");
    if (p.has("q")) S.search = p.get("q");
  }

  /* ---------- CSV export ---------- */
  function csvCell(v) { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV() {
    const b = BEH.find((x) => x.k === S.beh), mA = monthLbl(DATA.months[S.mA]), mB = monthLbl(DATA.months[S.mB]);
    const head = ["อันดับ", "ชื่อ", "รายละเอียด", "พฤติกรรม", "A (" + mA + ")", "B (" + mB + ")", "เดลตา (pt)", "WO (B)"];
    const lines = [head.map(csvCell).join(",")];
    lastRows.forEach((x) => {
      lines.push([x.rank, x.meta.name, x.meta.sub, b.t,
        x.rA === null ? "" : (x.rA * 100).toFixed(2), (x.rB * 100).toFixed(2),
        x.delta === null ? "" : (x.delta * 100).toFixed(2), x.woB].map(csvCell).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `behavior_${S.beh}_${S.level}_${DATA.months[S.mA]}_vs_${DATA.months[S.mB]}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }

  /* ---------- theme ---------- */
  function applyThemeIcon() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    $("themeToggle").querySelector("use").setAttribute("href", dark ? "#i-sun" : "#i-moon");
    const tl = dark ? "สลับเป็นธีมสว่าง" : "สลับเป็นธีมมืด";
    $("themeToggle").setAttribute("aria-label", tl);
    $("themeToggle").setAttribute("title", tl);
  }

  /* ---------- footer ---------- */
  function renderFooter() {
    $("foot").innerHTML =
      '<span class="defrow"><b>นิยามตัวชี้วัด</b> (ค่าต่ำ = ดีกว่า · อันดับ 1 = แย่ที่สุด · Δ ลดลง = ดีขึ้น · |Δ| น้อยกว่า 0.05 pt นับเป็นทรงตัว)</span>' +
      '<details class="help"><summary>' + icon("i-chev") + 'ดูสูตรการคำนวณทั้ง 4 พฤติกรรม</summary>' +
      '<div style="margin-top:8px">' +
      '<b>WO ซ้ำ Ticket</b> = (จำนวน WO − จำนวน Ticket ไม่ซ้ำ) ÷ WO<br>' +
      '<b>ไม่ทำงานจริง</b> = WO ที่เป็น No-Visit หรือไม่มี Complete Solution หรือ Canceled ÷ WO<br>' +
      '<b>ข้าม Province</b> = WO ที่ Province ไม่ตรงกับ Province หลักของ Ticket ÷ WO<br>' +
      '<b>System ผิดปกติ</b> = WO ที่ WO Creator = System ÷ WO<br>' +
      'หน่วยที่มี WO ในเดือนเปรียบเทียบน้อยกว่าค่า “WO ≥” จะถูกตัดออกจากการจัดอันดับ' +
      '</div></details>';
  }

  /* ---------- data provenance ("ที่มาข้อมูล") ---------- */
  // Prefer the pipeline-embedded meta (DATA.meta); otherwise derive truthfully from the
  // data we already have — month → the exact MATELINE filename, plus per-file team/WO counts.
  function provenance() {
    const meta = DATA.meta;
    if (meta && Array.isArray(meta.sources) && meta.sources.length) {
      return {
        derived: false, sources: meta.sources, files: meta.total_files || meta.sources.length,
        totalRecords: meta.total_records != null ? meta.total_records : DATA.records.length,
        totalWO: meta.total_wo, generatedAt: meta.generated_at, src: meta.src,
        system: meta.source_system || "ระบบ MATELINE — รายงาน Ticket Closed (.xlsx) รายเดือน",
      };
    }
    const byM = {};
    DATA.months.forEach((m) => (byM[m] = { teams: 0, wo: 0, tickets: 0 }));
    for (const r of DATA.records) { const o = byM[r.m]; if (o) { o.teams++; o.wo += r.wo; o.tickets += r.tickets; } }
    const sources = DATA.months.map((m) => ({
      file: `MATELINE TICKET CLOSED_${m.replace("-", "")}.xlsx`,
      month: m, teams: byM[m].teams, wo: byM[m].wo, tickets: byM[m].tickets,
    }));
    return {
      derived: true, sources, files: DATA.months.length, totalRecords: DATA.records.length,
      totalWO: sources.reduce((s, x) => s + x.wo, 0), generatedAt: null, src: null,
      system: "ระบบ MATELINE — รายงาน Ticket Closed (.xlsx) รายเดือน",
    };
  }
  function renderSrcDialog() {
    const p = provenance();
    const range = `${monthLong(DATA.months[0])} – ${monthLong(DATA.months[lastM])}`;
    const rows = p.sources.map((s) =>
      `<tr><td class="l"><span class="nm" lang="en" title="${esc(s.file)}">${esc(s.file)}</span></td>` +
      `<td>${monthLbl(s.month)}</td><td class="tnum">${(s.teams || 0).toLocaleString()}</td>` +
      `<td class="tnum">${(s.wo || 0).toLocaleString()}</td></tr>`).join("");
    $("srcBody").innerHTML =
      `<p class="src-summary">ดึงข้อมูลจาก <b>${p.files}</b> ไฟล์ · ช่วง <b>${range}</b> · รวม ` +
      `<b class="tnum">${p.totalRecords.toLocaleString()}</b> หน่วย-เดือน` +
      (p.totalWO ? ` · <b class="tnum">${p.totalWO.toLocaleString()}</b> WO` : "") + "</p>" +
      `<div class="src-note">${icon("i-info")}<div>` +
      `<b>แหล่งที่มา:</b> ${esc(p.system)}<br>` +
      `ประมวลผลเป็น <code>data/data.json</code> ด้วยสคริปต์ <code>scripts/build_data.py</code>` +
      (p.src ? `<br>โฟลเดอร์ต้นทาง: <code lang="en">${esc(p.src)}</code>` : "") +
      (p.generatedAt ? `<br>สร้างไฟล์ข้อมูลเมื่อ: <span lang="en">${esc(p.generatedAt)}</span>` : "") +
      (p.derived ? `<br><span class="muted">* รายชื่อไฟล์อนุมานจากเดือนในข้อมูล — รัน build_data.py ใหม่เพื่อฝังชื่อไฟล์/วันที่/ขนาดจริงลงใน data.json</span>` : "") +
      "</div></div>" +
      `<div class="tablewrap" style="max-height:48vh"><table>` +
      `<caption class="sr-only">รายการไฟล์ต้นทางทั้งหมด</caption>` +
      `<thead><tr><th class="l">ไฟล์ต้นทาง</th><th>เดือน</th><th>หน่วย (ทีม)</th><th><span lang="en">WO</span></th></tr></thead>` +
      `<tbody>${rows}</tbody></table></div>`;
  }

  /* ---------- events (bound once) ---------- */
  $("skillSeg").querySelectorAll("button").forEach((b) => b.onclick = () => { S.skill = b.dataset.v; S.region = ""; S.prov = ""; S.sel = null; render(); });
  $("levelSeg").querySelectorAll("button").forEach((b) => b.onclick = () => { S.level = b.dataset.v; S.sel = null; render(); });
  $("behTabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) { S.beh = t.dataset.k; render(); } });
  $("behTabs").addEventListener("keydown", (e) => {
    const tabs = [...$("behTabs").querySelectorAll(".tab")];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + tabs.length) % tabs.length;
    if (n >= 0) { e.preventDefault(); tabs[n].focus(); S.beh = tabs[n].dataset.k; render(); }
  });
  $("fRegion").onchange = (e) => { S.region = e.target.value; S.prov = ""; S.sel = null; render(); };
  $("fProv").onchange = (e) => { S.prov = e.target.value; S.sel = null; render(); };
  $("mA").onchange = (e) => { S.mA = +e.target.value; render(); };
  $("mB").onchange = (e) => { S.mB = +e.target.value; render(); };
  $("minWO").onchange = (e) => { S.minWO = clampInt(+e.target.value || 0, 0, 100000); e.target.value = S.minWO; render(); };
  const renderDebounced = debounce(render, 150);
  $("search").oninput = (e) => { S.search = e.target.value; renderDebounced(); };
  $("clearBtn").onclick = () => {
    Object.assign(S, { skill: "ALL", level: "region", region: "", prov: "", mA: 0, mB: lastM, minWO: 20, sel: null, search: "", sortKey: "rank", sortDir: "asc" });
    $("search").value = ""; render();
  };
  $("exportBtn").onclick = exportCSV;

  // Sortable headers
  $("rankHead").querySelectorAll("th[data-sort] button").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.parentElement.dataset.sort;
      if (S.sortKey === key) S.sortDir = S.sortDir === "asc" ? "desc" : "asc";
      else { S.sortKey = key; S.sortDir = SORT_DEFAULT_DIR[key]; }
      render();
    };
  });

  // Table row interaction (delegated → no per-row listeners, survives innerHTML swaps)
  const tbody = $("rankBody");
  tbody.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-k]"); if (tr) selectKey(tr.dataset.k, false); });
  tbody.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-k]"); if (!tr) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectKey(tr.dataset.k, true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); const n = tr.nextElementSibling; if (n && n.dataset.k) n.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const p = tr.previousElementSibling; if (p && p.dataset.k) p.focus(); }
    else if (e.key === "Home") { e.preventDefault(); const f = tbody.querySelector("tr[data-k]"); if (f) f.focus(); }
    else if (e.key === "End") { e.preventDefault(); const all = tbody.querySelectorAll("tr[data-k]"); if (all.length) all[all.length - 1].focus(); }
  });

  // Detail close (delegated → fixes the dead inline-onclick bug)
  $("detail").addEventListener("click", (e) => { if (e.target.closest('[data-action="close"]')) selectKey(S.sel, false); });

  // Esc anywhere clears the current selection (emergency exit; the dialog handles its own Esc)
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.sel && !$("srcDialog").open) selectKey(S.sel, false); });

  $("themeToggle").onclick = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    applyThemeIcon();
    renderChart();
  };
  $("copyLink").onclick = () => {
    const btn = $("copyLink"), lbl = btn.querySelector(".lbl");
    const done = () => { btn.classList.add("is-ok"); btn.querySelector("use").setAttribute("href", "#i-check"); if (lbl) lbl.textContent = "คัดลอกแล้ว";
      setTimeout(() => { btn.classList.remove("is-ok"); btn.querySelector("use").setAttribute("href", "#i-link"); if (lbl) lbl.textContent = "คัดลอกลิงก์"; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done).catch(done);
    else done();
  };
  window.addEventListener("resize", debounce(renderChart, 120));

  // Data-source dialog
  $("dataSrc").onclick = () => {
    renderSrcDialog();
    const d = $("srcDialog");
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  };
  $("srcClose").onclick = () => $("srcDialog").close();
  $("srcDialog").addEventListener("click", (e) => { if (e.target === $("srcDialog")) $("srcDialog").close(); });

  /* ---------- boot ---------- */
  readURL();
  applyThemeIcon();
  $("dataSrcLbl").textContent = "ที่มาข้อมูล · " + provenance().files + " ไฟล์";
  renderTabs();
  renderFooter();
  render();
}

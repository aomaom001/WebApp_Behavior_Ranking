/**
 * Team Behavior Ranking Dashboard
 * Entry point: loads data/data.json then boots the UI.
 * No build step — plain ES + fetch. Must be served over HTTP (see README).
 */
"use strict";

fetch("./data/data.json")
  .then((res) => {
    if (!res.ok) throw new Error("HTTP " + res.status + " while loading data.json");
    return res.json();
  })
  .then(boot)
  .catch((err) => {
    console.error(err);
    document.querySelector(".wrap").innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--bad)">' +
      '<h2>โหลดข้อมูลไม่สำเร็จ</h2>' +
      '<p style="color:var(--text-muted);margin-top:8px">ต้องเปิดผ่าน web server ไม่ใช่ double-click ไฟล์ — ดู README (npm run dev)</p>' +
      '<pre style="color:var(--text-muted);margin-top:12px;font-size:12px">' + String(err) + '</pre></div>';
  });

function boot(DATA) {

  const BEH = [
    {k:'dup',   t:'WO ซ้ำ Ticket เดิม',   d:'WO ต่อ Ticket เกิน 1 → เปิดซ้ำ'},
    {k:'nowork',t:'เปิด WO ไม่ทำงานจริง',  d:'No-Visit / ไม่มี Solution / Canceled'},
    {k:'cross', t:'ช่วยข้าม Province',     d:'Province ของ WO ≠ Province ของ Ticket'},
    {k:'sys',   t:'System WO ผิดปกติ',     d:'สัดส่วน WO ที่สร้างโดย System'},
  ];
  let S = {skill:'ALL', level:'region', beh:'dup', region:'', prov:'', mA:0, mB:DATA.months.length-1, minWO:20, sel:null, search:''};
  let lastRows = []; // rows currently shown in the ranking table (for CSV export)

  const $=id=>document.getElementById(id);
  const pct=v=>(v*100).toFixed(v<0.01?2:1)+'%';
  const monthLbl=m=>{const [y,mo]=m.split('-');return mo+'/'+y.slice(2);};
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const rateColor=d=>d<-0.0005?'down':(d>0.0005?'up':'flat');
  const arrow=d=>d<-0.0005?'▼':(d>0.0005?'▲':'■');

  function recs(){
    return DATA.records.filter(r=>{
      if(S.skill!=='ALL' && r.skill!==S.skill) return false;
      if(S.level!=='region' && S.region && r.region!==S.region) return false;
      if(S.level==='team' && S.prov && r.prov!==S.prov) return false;
      return true;
    });
  }
  function keyOf(r){
    if(S.level==='region') return r.region;
    if(S.level==='prov') return r.region+' / '+r.prov;
    return r.team;
  }
  function metaOf(r){
    if(S.level==='region') return {name:r.region, sub:'ภาค (Region)', region:r.region, prov:''};
    if(S.level==='prov') return {name:r.prov, sub:'ภาค '+r.region, region:r.region, prov:r.prov};
    return {name:r.name, sub:r.region+' · '+r.prov+' · '+r.skill, region:r.region, prov:r.prov};
  }
  // aggregate ALL metrics by key for a month
  function aggMonth(month){
    const g={};
    for(const r of recs()){
      if(r.m!==month) continue;
      const k=keyOf(r);
      if(!g[k]) g[k]={wo:0,tickets:0,dup:0,nowork:0,cross:0,sys:0,man:0,meta:metaOf(r)};
      const o=g[k]; o.wo+=r.wo;o.tickets+=r.tickets;o.dup+=r.dup;o.nowork+=r.nowork;o.cross+=r.cross;o.sys+=r.sys;o.man+=r.man;
    }
    return g;
  }
  function series(key){
    const out=DATA.months.map(()=>({num:0,wo:0}));
    for(const r of recs()){
      if(key!==null && keyOf(r)!==key) continue;
      const i=DATA.months.indexOf(r.m);
      out[i].num+=r[S.beh]; out[i].wo+=r.wo;
    }
    return out.map(o=>o.wo?o.num/o.wo:null);
  }

  function renderRanking(){
    const A=aggMonth(DATA.months[S.mA]), B=aggMonth(DATA.months[S.mB]);
    const rows=Object.keys(B).map(k=>{
      const b=B[k], a=A[k];
      const rB=b.wo?b[S.beh]/b.wo:0, rA=(a&&a.wo)?a[S.beh]/a.wo:null;
      return {k, meta:b.meta, rB, rA, woB:b.wo, delta:(rA===null?null:rB-rA)};
    }).filter(x=>x.woB>=S.minWO);
    rows.sort((x,y)=>y.rB-x.rB);
    const maxR=rows.length?rows[0].rB:1;
    // keep the full (rank-assigned) list for export, then filter the view by search text
    const ranked=rows.map((x,i)=>({...x, rank:i+1}));
    const q=S.search.trim().toLowerCase();
    const view=q?ranked.filter(x=>(x.meta.name+' '+x.meta.sub).toLowerCase().includes(q)):ranked;
    lastRows=view;
    const body=$('rankBody'); body.innerHTML='';
    view.forEach(x=>{
      const tr=document.createElement('tr');
      if(S.sel===x.k) tr.className='sel';
      const dCell = x.delta===null?'<span class="flat">—</span>':
        `<span class="delta ${rateColor(x.delta)}">${arrow(x.delta)} ${x.delta<0?'':'+'}${(x.delta*100).toFixed(1)} pt</span>`;
      tr.innerHTML=`<td class="l rk ${x.rank<=3?'top':''}">${x.rank}</td>
        <td class="l"><div class="namecell"><span>${esc(x.meta.name)}</span><small>${esc(x.meta.sub)}</small></div></td>
        <td>${x.rA===null?'<span class="flat">—</span>':pct(x.rA)}</td>
        <td><b>${pct(x.rB)}</b><div class="bar"><i style="width:${Math.max(2,x.rB/maxR*100)}%"></i></div></td>
        <td>${dCell}</td>
        <td>${x.woB.toLocaleString()}</td>`;
      tr.onclick=()=>{S.sel=(S.sel===x.k?null:x.k); render();};
      body.appendChild(tr);
    });
    if(!view.length) body.innerHTML=`<tr><td colspan="6" class="l" style="color:var(--text-muted);padding:20px">${q?'ไม่พบหน่วยที่ตรงกับคำค้น “'+esc(S.search)+'”':'ไม่มีข้อมูลตามเงื่อนไข (ลองลด WO ขั้นต่ำ หรือกดล้างตัวกรอง)'}</td></tr>`;
    return rows;
  }

  function renderDetail(){
    const box=$('detail');
    if(!S.sel){box.innerHTML='<div class="hintbox">คลิกแถวในตารางทางซ้ายเพื่อดูรายละเอียด — ค่าทั้ง 4 พฤติกรรม + จำนวนดิบของหน่วยนั้น</div>';return;}
    const A=aggMonth(DATA.months[S.mA])[S.sel], B=aggMonth(DATA.months[S.mB])[S.sel];
    if(!B){box.innerHTML='<div class="hintbox">หน่วยที่เลือกไม่มีข้อมูลในเดือน B (ลองเปลี่ยนเดือน)</div>';return;}
    const meta=B.meta;
    let rows='';
    BEH.forEach(b=>{
      const rB=B.wo?B[b.k]/B.wo:0, rA=(A&&A.wo)?A[b.k]/A.wo:null, d=rA==null?null:rB-rA;
      rows+=`<tr${b.k===S.beh?' class="beh-active"':''}><td class="l">${b.t}</td>
        <td>${rA==null?'—':pct(rA)}</td><td><b>${pct(rB)}</b></td>
        <td>${d==null?'—':`<span class="delta ${rateColor(d)}">${arrow(d)} ${d<0?'':'+'}${(d*100).toFixed(1)}pt</span>`}</td></tr>`;
    });
    box.innerHTML=`<div class="detail">
       <div class="dhead"><div><h3>${esc(meta.name)}</h3><div class="meta">${esc(meta.sub)}</div></div>
         <button class="x" onclick="S.sel=null;render();">✕ ปิด</button></div>
       <table><thead><tr><th class="l">พฤติกรรม</th><th>A (${monthLbl(DATA.months[S.mA])})</th><th>B (${monthLbl(DATA.months[S.mB])})</th><th>Δ</th></tr></thead>
         <tbody>${rows}</tbody></table>
       <div class="kv">
         <span>WO (B): <b>${B.wo.toLocaleString()}</b></span>
         <span>Ticket ไม่ซ้ำ: <b>${B.tickets.toLocaleString()}</b></span>
         <span>WO ซ้ำ: <b>${B.dup.toLocaleString()}</b></span>
         <span>ไม่ทำงานจริง: <b>${B.nowork.toLocaleString()}</b></span>
         <span>ข้าม Province: <b>${B.cross.toLocaleString()}</b></span>
         <span>System: <b>${B.sys.toLocaleString()}</b></span>
         <span>Manual: <b>${B.man.toLocaleString()}</b></span>
       </div></div>`;
  }

  function renderCards(rows){
    const A=aggMonth(DATA.months[S.mA]), B=aggMonth(DATA.months[S.mB]);
    const sum=g=>{let n=0,w=0;for(const k in g){n+=g[k][S.beh];w+=g[k].wo;}return w?n/w:0;};
    const rA=sum(A), rB=sum(B), d=rB-rA;
    let imp=0,wor=0;
    rows.forEach(x=>{if(x.delta!==null){if(x.delta<-0.0005)imp++;else if(x.delta>0.0005)wor++;}});
    const b=BEH.find(x=>x.k===S.beh);
    $('cards').innerHTML=`
      <div class="card"><div class="k">ภาพรวม ${monthLbl(DATA.months[S.mA])} → ${monthLbl(DATA.months[S.mB])}</div>
        <div class="v">${pct(rB)} <small class="delta ${rateColor(d)}">${arrow(d)} ${d<0?'':'+'}${(d*100).toFixed(1)} pt</small></div>
        <div class="k" style="margin-top:4px">${esc(b.t)}</div></div>
      <div class="card"><div class="k">เดือน A (${monthLbl(DATA.months[S.mA])})</div><div class="v">${pct(rA)}</div></div>
      <div class="card"><div class="k">หน่วยที่ดีขึ้น ✓</div><div class="v down">${imp}</div><div class="k">จาก ${rows.length} หน่วย</div></div>
      <div class="card"><div class="k">หน่วยที่แย่ลง ✗</div><div class="v up">${wor}</div><div class="k">จาก ${rows.length} หน่วย</div></div>`;
  }

  function renderChart(){
    const svg=$('chart'); const W=svg.clientWidth||560, H=svg.clientHeight||250;
    // Pull theme colors from CSS variables so the chart follows the active theme.
    const cs=getComputedStyle(document.documentElement);
    const C={grid:cs.getPropertyValue('--chart-grid').trim(),
             line:cs.getPropertyValue('--chart-line').trim(),
             axis:cs.getPropertyValue('--chart-axis').trim(),
             axisOn:cs.getPropertyValue('--chart-axis-on').trim(),
             accent:cs.getPropertyValue('--accent').trim(),
             guide:cs.getPropertyValue('--chart-guide').trim()};
    const pad={l:46,r:14,t:14,b:26}, months=DATA.months, lines=[];
    lines.push({name:'ภาพรวม (ตามตัวกรอง)', data:series(null), col:C.line, dash:'4 3'});
    if(S.sel){const rr=recs().find(r=>keyOf(r)===S.sel);const m=rr?metaOf(rr):{};lines.push({name:m.name||S.sel, data:series(S.sel), col:C.accent});}
    const all=lines.flatMap(l=>l.data).filter(v=>v!=null);
    const mx=Math.max(0.001,...all), mn=0;
    const x=i=>pad.l+(W-pad.l-pad.r)*(months.length<2?0.5:i/(months.length-1));
    const y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-mn)/(mx-mn));
    let h='';
    for(let g=0;g<=4;g++){const v=mn+(mx-mn)*g/4,yy=y(v);
      h+=`<line x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}" stroke="${C.grid}"/>`;
      h+=`<text x="${pad.l-6}" y="${yy+3}" fill="${C.axis}" font-size="10" text-anchor="end">${(v*100).toFixed(1)}%</text>`;}
    months.forEach((m,i)=>{const xx=x(i),onAB=(i===S.mA||i===S.mB);
      h+=`<text x="${xx}" y="${H-8}" fill="${onAB?C.axisOn:C.axis}" font-size="10" text-anchor="middle"${onAB?' font-weight="700"':''}>${monthLbl(m)}</text>`;
      if(onAB) h+=`<line x1="${xx}" y1="${pad.t}" x2="${xx}" y2="${H-pad.b}" stroke="${C.guide}"/>`;});
    lines.forEach(l=>{let d='';l.data.forEach((v,i)=>{if(v==null)return;d+=(d?'L':'M')+x(i)+' '+y(v)+' ';});
      h+=`<path d="${d}" fill="none" stroke="${l.col}" stroke-width="2.2"${l.dash?` stroke-dasharray="${l.dash}"`:''}/>`;
      l.data.forEach((v,i)=>{if(v==null)return;h+=`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${l.col}"/>`;});});
    svg.innerHTML=h;
    $('legend').innerHTML=lines.map(l=>`<span><span class="dot" style="background:${l.col}"></span>${esc(l.name)}</span>`).join('');
    const s=S.sel?series(S.sel):series(null);
    const first=s.find(v=>v!=null), last=[...s].reverse().find(v=>v!=null);
    const ch=(last!=null&&first!=null)?last-first:null;
    $('miniStats').innerHTML = ch===null?'':
      `<div class="pill">ทั้งช่วง ${monthLbl(months[0])} → ${monthLbl(months[months.length-1])}: <b class="${rateColor(ch)}">${arrow(ch)} ${ch<0?'':'+'}${(ch*100).toFixed(1)} pt</b></div>`;
  }

  function renderTabs(){
    $('behTabs').innerHTML=BEH.map(b=>`<div class="tab ${b.k===S.beh?'on':''}" data-k="${b.k}">
      <div class="t">${b.t}</div><div class="d">${b.d}</div></div>`).join('');
    $('behTabs').querySelectorAll('.tab').forEach(el=>el.onclick=()=>{S.beh=el.dataset.k;render();});
  }

  function fillSelectors(){
    const mopt=DATA.months.map((m,i)=>`<option value="${i}">${monthLbl(m)}</option>`).join('');
    $('mA').innerHTML=mopt;$('mB').innerHTML=mopt;$('mA').value=S.mA;$('mB').value=S.mB;
    const rs=[...new Set(DATA.records.filter(r=>S.skill==='ALL'||r.skill===S.skill).map(r=>r.region))].sort();
    $('fRegion').innerHTML='<option value="">ทุกภาค</option>'+rs.map(r=>`<option${r===S.region?' selected':''}>${r}</option>`).join('');
    const ps=[...new Set(DATA.records.filter(r=>(S.skill==='ALL'||r.skill===S.skill)&&(!S.region||r.region===S.region)).map(r=>r.prov))].sort();
    $('fProv').innerHTML='<option value="">ทุกจังหวัด</option>'+ps.map(p=>`<option${p===S.prov?' selected':''}>${p}</option>`).join('');
    $('fRegion').disabled=(S.level==='region'); $('fProv').disabled=(S.level!=='team');
    $('fRegion').style.opacity=$('fRegion').disabled?.5:1; $('fProv').style.opacity=$('fProv').disabled?.5:1;
    $('minWO').value=S.minWO;
  }

  function setSeg(id,v){$(id).querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));}

  function render(){
    document.querySelectorAll('.mA-lbl').forEach(e=>e.textContent=monthLbl(DATA.months[S.mA]));
    document.querySelectorAll('.mB-lbl').forEach(e=>e.textContent=monthLbl(DATA.months[S.mB]));
    const b=BEH.find(x=>x.k===S.beh), lvlTxt={region:'ภาค',prov:'จังหวัด',team:'ทีม'}[S.level];
    $('rankTitle').textContent=`อันดับ: ${b.t} — ราย${lvlTxt}`;
    $('trendTitle').textContent=`แนวโน้มรายเดือน: ${b.t}`;
    let cr=`Skill: <b>${S.skill}</b> · ระดับ: <b>${lvlTxt}</b>`;
    if(S.level!=='region'&&S.region) cr+=` · ภาค: <b>${S.region}</b>`;
    if(S.level==='team'&&S.prov) cr+=` · จังหวัด: <b>${S.prov}</b>`;
    $('crumb').innerHTML=cr;
    fillSelectors();
    const rows=renderRanking();
    renderCards(rows);
    renderDetail();
    renderChart();
  }

  $('skillSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{setSeg('skillSeg',b.dataset.v);S.skill=b.dataset.v;S.region='';S.prov='';S.sel=null;render();});
  $('levelSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{setSeg('levelSeg',b.dataset.v);S.level=b.dataset.v;S.sel=null;render();});
  $('fRegion').onchange=e=>{S.region=e.target.value;S.prov='';S.sel=null;render();};
  $('fProv').onchange=e=>{S.prov=e.target.value;S.sel=null;render();};
  $('mA').onchange=e=>{S.mA=+e.target.value;render();};
  $('mB').onchange=e=>{S.mB=+e.target.value;render();};
  $('minWO').onchange=e=>{S.minWO=+e.target.value||0;render();};
  $('search').oninput=e=>{S.search=e.target.value;render();};
  $('clearBtn').onclick=()=>{S.skill='ALL';S.level='region';S.region='';S.prov='';S.mA=0;S.mB=DATA.months.length-1;S.minWO=20;S.sel=null;S.search='';
    $('search').value='';setSeg('skillSeg','ALL');setSeg('levelSeg','region');render();};
  $('exportBtn').onclick=exportCSV;
  window.addEventListener('resize',renderChart);

  // Export the currently displayed ranking to CSV (UTF-8 BOM so Excel reads Thai).
  function csvCell(v){v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  function exportCSV(){
    const b=BEH.find(x=>x.k===S.beh), mA=monthLbl(DATA.months[S.mA]), mB=monthLbl(DATA.months[S.mB]);
    const head=['อันดับ','ชื่อ','รายละเอียด','พฤติกรรม','A ('+mA+')','B ('+mB+')','เดลตา (pt)','WO (B)'];
    const lines=[head.map(csvCell).join(',')];
    lastRows.forEach(x=>{
      lines.push([x.rank, x.meta.name, x.meta.sub, b.t,
        x.rA===null?'':(x.rA*100).toFixed(2), (x.rB*100).toFixed(2),
        x.delta===null?'':(x.delta*100).toFixed(2), x.woB].map(csvCell).join(','));
    });
    const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`behavior_${S.beh}_${S.level}_${DATA.months[S.mA]}_vs_${DATA.months[S.mB]}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }

  // Theme toggle: icon shows the theme you'll switch TO.
  function applyThemeIcon(){
    const dark=document.documentElement.getAttribute('data-theme')==='dark';
    $('themeToggle').textContent=dark?'☀️':'🌙';
  }
  $('themeToggle').onclick=()=>{
    const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    localStorage.setItem('theme',next);
    applyThemeIcon();
    renderChart(); // chart colors come from CSS vars — re-render to repaint
  };
  applyThemeIcon();

  $('foot').innerHTML='นิยามตัวชี้วัด: '+
   '<b>WO ซ้ำ Ticket</b> = (จำนวน WO − จำนวน Ticket ไม่ซ้ำ) ÷ WO · '+
   '<b>ไม่ทำงานจริง</b> = WO ที่เป็น No-Visit หรือไม่มี Complete Solution หรือ Canceled ÷ WO · '+
   '<b>ข้าม Province</b> = WO ที่ Province ไม่ตรงกับ Province หลักของ Ticket ÷ WO · '+
   '<b>System ผิดปกติ</b> = WO ที่ WO Creator = System ÷ WO · '+
   'ทุกตัวชี้วัด: ค่าต่ำ = ดีกว่า · อันดับ 1 = แย่ที่สุด · Δ ลดลง (▼ เขียว) = ดีขึ้น';

  renderTabs();render();
}

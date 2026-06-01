/* views.js — All 7 dashboard views */
const Charts={};
function destroyCharts(){Object.values(Charts).forEach(c=>{try{c.destroy();}catch(e){}});Object.keys(Charts).forEach(k=>delete Charts[k]);}
function mkChart(id,type,data,opts){const el=document.getElementById(id);if(!el)return;if(Charts[id])try{Charts[id].destroy();}catch(e){}Charts[id]=new Chart(el,{type,data,options:opts||{}});}
const QCOLS={Q1:'#2E5FA3',Q2:'#4A80C8',Q3:'#C8A755',Q4:'#C00000'};
const TYPE_COLORS=['#1F3864','#2E5FA3','#4A80C8','#7CA8DA','#C8A755','#C00000','#15803D','#D97706','#7C3AED','#DB2777','#0891B2','#65A30D'];

function applyFilters(acts,f){
  return acts.filter(a=>{
    if(f.market&&a.market!==f.market) return false;
    if(f.type&&a.activityType!==f.type) return false;
    if(f.priority&&String(a.priority)!==f.priority) return false;
    if(f.lock&&a.locked!==f.lock) return false;
    if(f.region){const r=getRegion(a.market);if(r!==f.region) return false;}
    return true;
  });
}

/* ═══ MULTI-SELECT HELPERS ═══════════════════════════════ */
function buildMS(id,label,options){
  return `<div class="ms-wrap" id="${id}">
    <button class="ms-btn" onclick="toggleMS('${id}')">${label} ▾</button>
    <div class="ms-panel hidden">
      ${options.map(o=>`<label class="ms-opt"><input type="checkbox" value="${o.value||o}"> ${o.label||o}</label>`).join('')}
      <div class="ms-divider"></div>
      <div class="ms-clear" onclick="clearMS('${id}')">Clear all</div>
    </div>
  </div>`;
}
function toggleMS(id){
  const panel=document.querySelector(`#${id} .ms-panel`);
  document.querySelectorAll('.ms-panel').forEach(p=>{if(p!==panel)p.classList.add('hidden');});
  panel.classList.toggle('hidden');
}
function clearMS(id){
  document.querySelectorAll(`#${id} input`).forEach(i=>i.checked=false);
  document.querySelector(`#${id} .ms-btn`).classList.remove('has-selection');
  document.querySelector(`#${id} .ms-btn`).textContent=document.querySelector(`#${id} .ms-btn`).textContent.replace(/\s\(\d+\)/,'');
}
function getMSValues(id){return [...document.querySelectorAll(`#${id} input:checked`)].map(i=>i.value);}
function updateMSLabel(id,baseLabel){
  const vals=getMSValues(id);
  const btn=document.querySelector(`#${id} .ms-btn`);
  btn.textContent=vals.length?`${baseLabel} (${vals.length}) ▾`:`${baseLabel} ▾`;
  btn.classList.toggle('has-selection',vals.length>0);
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.ms-wrap'))document.querySelectorAll('.ms-panel').forEach(p=>p.classList.add('hidden'));
});

/* ═══ VIEW 1 — OVERVIEW ══════════════════════════════════ */
function renderOverview(state){
  const acts27=applyFilters(state.review.activities||[],state.filters);
  const acts26=state.baseline.activities||[];
  const cf27=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  const cf26=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  acts27.forEach(a=>MONTH_LABELS.forEach(m=>{cf27[m]+=a.monthly[m]||0;}));
  acts26.forEach(a=>MONTH_LABELS.forEach(m=>{cf26[m]+=a.monthly[m]||0;}));
  const tot27=Object.values(cf27).reduce((s,v)=>s+v,0);
  const tot26=Object.values(cf26).reduce((s,v)=>s+v,0);
  const h1_27=MONTH_LABELS.slice(0,6).reduce((s,m)=>s+cf27[m],0);
  const h2_27=MONTH_LABELS.slice(6).reduce((s,m)=>s+cf27[m],0);

  // Activity type × market matrix
  const allTypes=[...new Set(acts27.map(a=>a.activityType))].filter(Boolean);
  const typeTotals={};
  allTypes.forEach(t=>{typeTotals[t]=acts27.filter(a=>a.activityType===t).reduce((s,a)=>s+a.cashflow,0);});
  const topTypes=Object.entries(typeTotals).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([t])=>t);
  const markets=[...new Set(acts27.map(a=>a.market))].filter(Boolean).sort();
  const mktTypeMatrix={};
  markets.forEach(m=>{mktTypeMatrix[m]={};topTypes.forEach(t=>{mktTypeMatrix[m][t]=0;});mktTypeMatrix[m]._total=0;});
  acts27.forEach(a=>{
    if(!mktTypeMatrix[a.market])return;
    mktTypeMatrix[a.market]._total+=a.cashflow;
    if(topTypes.includes(a.activityType))mktTypeMatrix[a.market][a.activityType]+=a.cashflow;
  });
  const typeTotalsRow={};topTypes.forEach(t=>{typeTotalsRow[t]=markets.reduce((s,m)=>s+(mktTypeMatrix[m]?.[t]||0),0);});
  const maxCellVal=Math.max(...markets.flatMap(m=>topTypes.map(t=>mktTypeMatrix[m]?.[t]||0)),1);
  function cfCls(v){if(!v)return'cf-cell-0';const r=v/maxCellVal;return r<.1?'cf-cell-1':r<.25?'cf-cell-2':r<.5?'cf-cell-3':r<.75?'cf-cell-4':'cf-cell-5';}

  // Q3/Q4 driver by market+type
  const h2Drivers=[];
  markets.forEach(m=>{
    const mActs=acts27.filter(a=>a.market===m);
    topTypes.forEach(t=>{
      const tActs=mActs.filter(a=>a.activityType===t);
      const h2=tActs.reduce((s,a)=>s+MONTH_LABELS.slice(6).reduce((ss,mo)=>ss+(a.monthly[mo]||0),0),0);
      if(h2>100000)h2Drivers.push({market:m,type:t,h2,label:`${m} — ${t}`});
    });
  });
  h2Drivers.sort((a,b)=>b.h2-a.h2);
  const top10drivers=h2Drivers.slice(0,12);
  const maxH2=top10drivers[0]?.h2||1;

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Overview — 2027 vs 2026 <small>Source: Tactical Details</small></div>
    <div class="grid4 mb20">
      <div class="kpi-card kpi-info"><div class="kpi-label">2027 Total Cashflow</div><div class="kpi-value">${fmtShort(tot27)}</div><div class="kpi-sub">AED</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">2026 Total Cashflow</div><div class="kpi-value">${fmtShort(tot26)}</div><div class="kpi-sub">AED</div></div>
      <div class="kpi-card ${tot27>tot26?'kpi-danger':'kpi-success'}"><div class="kpi-label">YoY Change</div><div class="kpi-value ${tot27>tot26?'t-red':'t-green'}">${tot27>=tot26?'+':''}${fmtShort(tot27-tot26)}</div><div class="kpi-sub">${tot26?((tot27-tot26)/tot26*100).toFixed(1)+'%':''}</div></div>
      <div class="kpi-card ${h2_27>h1_27?'kpi-danger':'kpi-success'}"><div class="kpi-label">H1 vs H2 (2027)</div><div class="kpi-value ${h2_27>h1_27?'t-red':'t-green'}">${h2_27>h1_27?'H2 HEAVY':'H1 OK'}</div><div class="kpi-sub">H1: ${fmtShort(h1_27)} | H2: ${fmtShort(h2_27)}</div></div>
    </div>

    <div class="grid2 mb20">
      <div class="card"><div class="section-hd" style="font-size:.9rem">Monthly Cashflow — 2027 vs 2026</div><div class="chart-wrap"><canvas id="c-monthly-cmp"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.9rem">2027 Quarterly Distribution</div><div class="chart-wrap"><canvas id="c-quarterly"></canvas></div></div>
    </div>

    <div class="card mb20">
      <div class="section-hd" style="font-size:.9rem">Cashflow by Activity Type × Market (2027) <small>Top 8 activity types by value</small></div>
      <div class="heatmap-wrap">
        <table class="matrix-cf">
          <thead><tr>
            <th class="mkt-col">Market</th>
            ${topTypes.map((t,i)=>`<th style="background:${TYPE_COLORS[i]}">${t}</th>`).join('')}
            <th style="background:#2E5FA3">Total</th>
          </tr></thead>
          <tbody>
            ${markets.map(m=>`<tr>
              <td class="mkt-name"><span class="region-badge r-${getRegion(m).toLowerCase().replace(/[^a-z]/g,'').slice(0,6)}">${getRegion(m)}</span> ${m}</td>
              ${topTypes.map(t=>{const v=mktTypeMatrix[m]?.[t]||0;return`<td class="${cfCls(v)}">${v?fmtShort(v):''}</td>`;}).join('')}
              <td class="total-col">${fmtShort(mktTypeMatrix[m]?._total||0)}</td>
            </tr>`).join('')}
            <tr class="total-row">
              <td class="mkt-name"><strong>TOTAL</strong></td>
              ${topTypes.map(t=>`<td class="total-col"><strong>${fmtShort(typeTotalsRow[t]||0)}</strong></td>`).join('')}
              <td class="total-col"><strong>${fmtShort(tot27)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="section-hd" style="font-size:.9rem">H2 Cashflow Drivers — Which Market &amp; Activity Type is Causing Back-Loading</div>
      ${top10drivers.map(d=>`<div class="driver-row">
        <div class="driver-label" title="${d.label}">${d.label}</div>
        <div class="driver-bar-wrap"><div class="driver-bar" style="width:${(d.h2/maxH2*100).toFixed(1)}%;background:${d.h2/maxH2>.6?'var(--red)':d.h2/maxH2>.3?'var(--amber)':'var(--blue)'}"></div></div>
        <div class="driver-val">${fmtShort(d.h2)}</div>
        <div class="driver-pct">${tot27?(d.h2/tot27*100).toFixed(1)+'%':''}</div>
      </div>`).join('')}
    </div>
  `;

  requestAnimationFrame(()=>{
    mkChart('c-monthly-cmp','bar',{labels:MONTH_LABELS,datasets:[
      {label:'2026',data:MONTH_LABELS.map(m=>cf26[m]),backgroundColor:'rgba(46,95,163,.3)',borderColor:'#2E5FA3',borderWidth:1},
      {label:'2027',data:MONTH_LABELS.map(m=>cf27[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)},
    ]},{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});
    const Q1v=MONTH_LABELS.slice(0,3).reduce((s,m)=>s+cf27[m],0),Q2v=MONTH_LABELS.slice(3,6).reduce((s,m)=>s+cf27[m],0);
    const Q3v=MONTH_LABELS.slice(6,9).reduce((s,m)=>s+cf27[m],0),Q4v=MONTH_LABELS.slice(9).reduce((s,m)=>s+cf27[m],0);
    mkChart('c-quarterly','doughnut',{labels:['Q1','Q2','Q3','Q4'],datasets:[{data:[Q1v,Q2v,Q3v,Q4v],backgroundColor:[QCOLS.Q1,QCOLS.Q2,QCOLS.Q3,QCOLS.Q4]}]},{plugins:{legend:{position:'bottom'}}});
  });
}

/* ═══ VIEW 2 — COMPARISON ═══════════════════════════════ */
function renderComparison(state){
  const {added,removed,changed}=state.comparison;
  const f=state.filters;
  const addF=applyFilters(added,f),remF=applyFilters(removed,f);
  const chgF=changed.filter(c=>(!f.market||c.activity.market===f.market));
  const totNew=addF.reduce((s,a)=>s+a.cashflow,0),totDrop=remF.reduce((s,a)=>s+a.cashflow,0);
  const totChg=chgF.reduce((s,c)=>{const ch=c.changes.find(x=>x.field==='Cashflow');return s+(ch?ch.to-ch.from:0);},0);
  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">2026 vs 2027 — Activity Changes</div>
    <div class="grid3 mb20">
      <div class="kpi-card kpi-success"><div class="kpi-label">New in 2027</div><div class="kpi-value t-green">${addF.length}</div><div class="kpi-sub">${fmtAED(totNew)} new cashflow</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-label">Removed from 2026</div><div class="kpi-value t-red">${remF.length}</div><div class="kpi-sub">${fmtAED(totDrop)} dropped</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">Changed</div><div class="kpi-value t-amber">${chgF.length}</div><div class="kpi-sub">${totChg>=0?'+':''}${fmtAED(totChg)} shift</div></div>
    </div>
    <div class="grid2 mb20">
      <div class="card"><div class="section-hd" style="font-size:.9rem">✅ New in 2027 <span class="badge b-new">${addF.length}</span></div>
        <div class="tbl-scroll tbl-scroll-h"><table class="dt"><thead><tr><th>Market</th><th>Activity</th><th>Type</th><th class="th-r">Cashflow</th><th>P</th></tr></thead><tbody>
          ${addF.length?addF.sort((a,b)=>b.cashflow-a.cashflow).map(a=>`<tr class="row-new"><td>${a.market}</td><td style="font-size:.76rem">${a.activityName}</td><td><span class="badge b-blue" style="font-size:.62rem">${a.activityType}</span></td><td class="td-r t-mono">${fmtNum(a.cashflow)}</td><td class="td-c">${a.priority||'—'}</td></tr>`).join('')
          :`<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--g400)">No new activities</td></tr>`}
        </tbody></table></div>
      </div>
      <div class="card"><div class="section-hd" style="font-size:.9rem">❌ Removed from 2026 <span class="badge b-removed">${remF.length}</span></div>
        <div class="tbl-scroll tbl-scroll-h"><table class="dt"><thead><tr><th>Market</th><th>Activity</th><th>Type</th><th class="th-r">2026 CF</th></tr></thead><tbody>
          ${remF.length?remF.sort((a,b)=>b.cashflow-a.cashflow).map(a=>`<tr class="row-removed"><td>${a.market}</td><td style="font-size:.76rem">${a.activityName}</td><td><span class="badge b-low" style="font-size:.62rem">${a.activityType}</span></td><td class="td-r t-mono">${fmtNum(a.cashflow)}</td></tr>`).join('')
          :`<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--g400)">No removed activities</td></tr>`}
        </tbody></table></div>
      </div>
    </div>
    <div class="card"><div class="section-hd" style="font-size:.9rem">🔄 Changed <span class="badge b-changed">${chgF.length}</span></div>
      <div class="tbl-scroll tbl-scroll-h"><table class="dt"><thead><tr><th>Market</th><th>Activity</th><th>Field</th><th>2026</th><th>2027</th><th>Δ Cashflow</th></tr></thead><tbody>
        ${chgF.length?chgF.map(({activity:a,changes})=>changes.map(ch=>{const d=ch.field==='Cashflow'?ch.to-ch.from:null;return`<tr class="${d&&d>0?'row-warn':''}"><td>${a.market}</td><td style="font-size:.76rem">${a.activityName}</td><td><span class="badge b-changed">${ch.field}</span></td><td class="t-mono">${ch.field==='Cashflow'?fmtNum(ch.from):ch.from}</td><td class="t-mono ${d&&d>0?'t-red':d&&d<0?'t-green':''}">${ch.field==='Cashflow'?fmtNum(ch.to):ch.to}</td><td class="td-r t-mono ${d&&d>0?'t-red':d&&d<0?'t-green':''}">${d!==null?(d>=0?'+':'')+fmtNum(d):'—'}</td></tr>`;}).join('')).join('')
        :`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--g400)">No changed activities</td></tr>`}
      </tbody></table></div>
    </div>`;
}

/* ═══ VIEW 3 — ACTIVITIES ══════════════════════════════ */
function renderActivities(state){
  const acts=applyFilters(state.review.activities||[],state.filters);
  const byMkt={},byType={};
  acts.forEach(a=>{byMkt[a.market]=(byMkt[a.market]||0)+1;byType[a.activityType]=(byType[a.activityType]||0)+1;});
  const mktSort=Object.entries(byMkt).sort((a,b)=>b[1]-a[1]);
  const typeSort=Object.entries(byType).sort((a,b)=>b[1]-a[1]);
  const othersCount=acts.filter(a=>/^others$/i.test(a.activityType)).length;
  const noKPI=acts.filter(a=>!a.revenue&&!a.attendees&&!isJMP(a)).length;
  function isJMP(a){return /jmp/i.test(a.activityType);}
  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Activities — 2027 Plan <small>${acts.length} activities</small></div>
    <div class="grid2 mb20">
      <div class="card"><div class="section-hd" style="font-size:.9rem">By Market</div><div class="chart-wrap-lg"><canvas id="c-by-mkt"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.9rem">By Type</div><div class="chart-wrap-lg"><canvas id="c-by-type"></canvas></div></div>
    </div>
    <div class="grid2 mb20">
      <div class="kpi-card ${othersCount>0?'kpi-danger':'kpi-success'}"><div class="kpi-label">"Others" Type</div><div class="kpi-value ${othersCount>0?'t-red':''}">${othersCount}</div><div class="kpi-sub">${othersCount>0?'Must be reclassified':'None — all typed correctly'}</div></div>
      <div class="kpi-card ${noKPI>0?'kpi-warning':'kpi-success'}"><div class="kpi-label">Missing KPIs (non-JMP)</div><div class="kpi-value ${noKPI>0?'t-amber':''}">${noKPI}</div><div class="kpi-sub">no revenue + no attendees</div></div>
    </div>
    <div class="card"><div class="flex-between mb16"><div class="section-hd" style="font-size:.9rem;margin:0;border:none">Activity Detail</div><span class="t-muted" style="font-size:.78rem">${acts.length} rows</span></div>
      <div class="tbl-scroll tbl-scroll-h"><table class="dt"><thead><tr><th>ID</th><th>Market</th><th>Activity Name</th><th>Type</th><th class="td-c">P</th><th>Owner</th><th class="th-r">Cashflow</th><th class="th-r">Revenue</th><th class="td-c">Att.</th><th>Lock</th></tr></thead><tbody>
        ${acts.map(a=>{const flags=/^others$/i.test(a.activityType)?'row-flag':(!a.revenue&&!a.attendees&&!/jmp/i.test(a.activityType))?'row-warn':'';
          return`<tr class="${flags}"><td class="t-muted" style="font-size:.72rem">${a.id||'—'}</td><td>${a.market}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem" title="${a.activityName}">${a.activityName}</td><td><span class="badge b-blue" style="font-size:.62rem">${a.activityType}</span></td><td class="td-c">${a.priority||'—'}</td><td style="font-size:.76rem">${a.owner||'—'}</td><td class="td-r t-mono">${fmtNum(a.cashflow)}</td><td class="td-r t-mono">${fmtNum(a.revenue)}</td><td class="td-c">${a.attendees||'—'}</td><td><span class="badge ${a.locked==='Locked'?'b-locked':'b-unlocked'}" style="font-size:.62rem">${a.locked}</span></td></tr>`;}).join('')}
      </tbody></table></div>
    </div>`;
  requestAnimationFrame(()=>{
    mkChart('c-by-mkt','bar',{labels:mktSort.map(([m])=>m),datasets:[{label:'Activities',data:mktSort.map(([,c])=>c),backgroundColor:'#2E5FA3'}]},{indexAxis:'y',plugins:{legend:{display:false}}});
    mkChart('c-by-type','bar',{labels:typeSort.map(([t])=>t),datasets:[{label:'Count',data:typeSort.map(([,c])=>c),backgroundColor:typeSort.map(([t])=>/^others$/i.test(t)?'#C00000':'#2E5FA3')}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  });
}

/* ═══ VIEW 4 — CASHFLOW HEATMAP ════════════════════════ */
function renderCashflow(state){
  const acts=applyFilters(state.review.activities||[],state.filters);
  const markets=[...new Set(acts.map(a=>a.market))].sort();
  const cfByMkt={};
  markets.forEach(m=>{cfByMkt[m]=MONTH_LABELS.reduce((o,mo)=>({...o,[mo]:0}),{});});
  acts.forEach(a=>MONTH_LABELS.forEach(m=>{cfByMkt[a.market][m]+=a.monthly[m]||0;}));
  const allVals=Object.values(cfByMkt).flatMap(m=>Object.values(m));
  const maxV=Math.max(...allVals,1);
  function hCls(v,max){if(!v)return'h0';const r=v/max;return r<.15?'h1':r<.30?'h2':r<.55?'h3':r<.80?'h4':'h5';}
  const mTotals=MONTH_LABELS.reduce((o,m)=>({...o,[m]:markets.reduce((s,mkt)=>s+(cfByMkt[mkt][m]||0),0)}),{});
  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Cashflow Heatmap — Market × Month (2027)</div>
    <div class="card mb20"><div class="section-hd" style="font-size:.9rem">Monthly Totals 2027</div><div class="chart-wrap"><canvas id="c-cf-tot"></canvas></div></div>
    <div class="card">
      <div class="flex-between mb16"><div class="section-hd" style="font-size:.9rem;margin:0;border:none">Market × Month Heatmap</div><small class="t-muted">Oct-Dec cells in red = Rule 1.3 | H2>H1 flag = Rule 1.2</small></div>
      <div class="heatmap-wrap"><table class="heatmap"><thead><tr><th class="market-hd">Market</th>${MONTH_LABELS.map(m=>`<th>${m}</th>`).join('')}<th>H1/H2</th></tr></thead>
        <tbody>
          ${markets.map(mkt=>{const mo=cfByMkt[mkt];const h1=MONTH_LABELS.slice(0,6).reduce((s,m)=>s+mo[m],0);const h2=MONTH_LABELS.slice(6).reduce((s,m)=>s+mo[m],0);return`<tr><td class="market-cell">${mkt}</td>${MONTH_LABELS.map((m,i)=>{const v=mo[m]||0;const cls=i>=9&&v>0?'h-viol':hCls(v,maxV);return`<td class="${cls}" title="${mkt} ${m}: ${fmtAED(v)}">${v?fmtShort(v):''}</td>`;}).join('')}<td style="text-align:center">${h2>h1?'<span class="badge b-high">H2!</span>':'<span class="badge b-ok">✓</span>'}</td></tr>`;}).join('')}
          <tr style="font-weight:700;background:var(--g100)"><td class="market-cell">TOTAL</td>${MONTH_LABELS.map(m=>`<td style="text-align:center;font-size:.72rem;font-weight:700">${fmtShort(mTotals[m])}</td>`).join('')}<td></td></tr>
        </tbody>
      </table></div>
    </div>`;
  requestAnimationFrame(()=>{mkChart('c-cf-tot','bar',{labels:MONTH_LABELS,datasets:[{label:'Total',data:MONTH_LABELS.map(m=>mTotals[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)}]},{plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});});
}

/* ═══ VIEW 5 — MARKET DEEP DIVE ════════════════════════ */
function renderMarket(state,sel){
  const acts27=state.review.activities||[];
  const acts26=state.baseline.activities||[];
  const markets=[...new Set(acts27.map(a=>a.market).filter(Boolean))].sort();
  const mkt=sel||markets[0]||'';
  const m27=acts27.filter(a=>a.market===mkt),m26=acts26.filter(a=>a.market===mkt);
  const cf27=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{}),cf26=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  m27.forEach(a=>MONTH_LABELS.forEach(m=>{cf27[m]+=a.monthly[m]||0;}));
  m26.forEach(a=>MONTH_LABELS.forEach(m=>{cf26[m]+=a.monthly[m]||0;}));
  const tot27=m27.reduce((s,a)=>s+a.cashflow,0),tot26=m26.reduce((s,a)=>s+a.cashflow,0);
  const h1=MONTH_LABELS.slice(0,6).reduce((s,m)=>s+cf27[m],0),h2=MONTH_LABELS.slice(6).reduce((s,m)=>s+cf27[m],0);
  function isJMPa(a){return /jmp/i.test(a.activityType);}
  function isMissiona(a){return /mission/i.test(a.activityType+' '+a.activityName);}
  function isTraininga(a){return /training|workshop/i.test(a.activityType+' '+a.activityName);}
  function isWebinara(a){return /webinar|virtual/i.test(a.activityType+' '+a.activityName);}
  function isJMPend(a){return isJMPa(a)&&a.endDate&&a.endDate.getFullYear()===2027&&a.endDate.getMonth()>=6&&a.endDate.getMonth()<=8;}
  const hasOthers=m27.some(a=>/^others$/i.test(a.activityType));
  const missions=m27.filter(isMissiona).length;
  const noKPI=m27.filter(a=>!a.revenue&&!a.attendees&&!isJMPa(a)).length;
  const trainP1=m27.some(a=>isTraininga(a)&&a.priority===1);
  const q3JMPs=m27.filter(isJMPend).length;
  const RAM_S=new Date(2027,1,18),RAM_E=new Date(2027,2,20);
  const ramZero=m27.filter(a=>{const d=a.startDate||a.endDate;return d&&d>=RAM_S&&d<=RAM_E&&a.cashflow===0;}).length;
  const mktViols=state.violations.filter(v=>v.market===mkt&&v.status!=='accepted');
  function chk(pass,text){return `<div class="check-item ${pass?'pass':'fail'}"><span class="check-icon">${pass?'✅':'❌'}</span><span>${text}</span></div>`;}
  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Market Deep Dive</div>
    <div class="market-selector"><label>Select Market:</label>
      <select id="mkt-sel">${markets.map(m=>`<option value="${m}"${m===mkt?' selected':''}>${m}</option>`).join('')}</select>
      <span class="badge r-${getRegion(mkt).toLowerCase().replace(/[^a-z]/g,'').slice(0,6)} region-badge">${getRegion(mkt)}</span>
      <span class="t-muted" style="font-size:.78rem">${m27.length} activities | ${fmtAED(tot27)}</span>
    </div>
    <div class="grid2 mb20">
      <div class="card"><div class="section-hd" style="font-size:.9rem">Monthly Cashflow — 2027 vs 2026</div><div class="chart-wrap"><canvas id="c-mkt-cf"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.9rem">Compliance Checklist</div>
        <div class="checklist">
          ${chk(!hasOthers,'No "Others" activity types')}
          ${chk(h2<=h1,`H1 >= H2 (H1: ${fmtAED(h1)} / H2: ${fmtAED(h2)})`)}
          ${chk(q3JMPs===0,`JMP Q3 closures: ${q3JMPs} (causes H2 heaviness)`)}
          ${chk(ramZero>=2,`Ramadan zero-budget activities: ${ramZero}/2 required`)}
          ${chk(missions<=1,`Sales missions: ${missions} (max 1)`)}
          ${chk(noKPI===0,`Non-JMP activities without KPIs: ${noKPI}`)}
          ${chk(!trainP1,'No training activities at Priority 1')}
        </div>
        <table class="dt mt16"><tbody>
          <tr><td>Activities 2027</td><td class="td-r"><strong>${m27.length}</strong></td></tr>
          <tr><td>Activities 2026</td><td class="td-r">${m26.length}</td></tr>
          <tr><td>Cashflow Change</td><td class="td-r ${tot27>tot26?'t-red':'t-green'}">${tot27>=tot26?'+':''}${fmtNum(tot27-tot26)}</td></tr>
          <tr><td>Active Violations</td><td class="td-r ${mktViols.length>0?'t-red':''}">${mktViols.length}</td></tr>
        </tbody></table>
      </div>
    </div>
    ${mktViols.length>0?`<div class="card mb20">
      <div class="section-hd" style="font-size:.9rem">Active Violations for ${mkt} <span class="badge b-high">${mktViols.length}</span></div>
      <div class="tbl-scroll"><table class="dt"><thead><tr><th>Tact. ID</th><th>Severity</th><th>Rule</th><th>Activity</th><th>Detail</th><th>Status</th></tr></thead><tbody>
        ${mktViols.map(v=>`<tr><td class="t-muted" style="font-size:.72rem">${v.activityId}</td><td><span class="badge b-${v.severity.toLowerCase()}">${v.severity}</span></td><td style="font-size:.72rem;color:var(--blue)">${v.ruleId}</td><td style="font-size:.76rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.item}</td><td style="font-size:.74rem;max-width:220px">${v.detail}</td><td><span class="badge ${v.status==='action-required'?'b-high':v.status==='accepted'?'b-ok':'b-low'}">${v.status==='action-required'?'Action Required':v.status==='accepted'?'Accepted':'Pending'}</span></td></tr>`).join('')}
      </tbody></table></div>
    </div>`:''}
    <div class="card"><div class="section-hd" style="font-size:.9rem">All Activities in ${mkt}</div>
      <div class="tbl-scroll tbl-scroll-h"><table class="dt"><thead><tr><th>ID</th><th>Activity</th><th>Type</th><th class="td-c">P</th><th>Start</th><th>End</th><th class="th-r">Cashflow</th><th class="th-r">Revenue</th><th class="td-c">Att.</th><th>Owner</th></tr></thead><tbody>
        ${m27.map(a=>`<tr class="${/^others$/i.test(a.activityType)?'row-flag':(!a.revenue&&!a.attendees&&!isJMPa(a))?'row-warn':''}">
          <td class="t-muted" style="font-size:.72rem">${a.id||'—'}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem" title="${a.activityName}">${a.activityName}</td>
          <td><span class="badge b-blue" style="font-size:.62rem">${a.activityType}</span></td>
          <td class="td-c">${a.priority||'—'}</td>
          <td>${fmtDate(a.startDate)}</td><td>${fmtDate(a.endDate)}</td>
          <td class="td-r t-mono">${fmtNum(a.cashflow)}</td>
          <td class="td-r t-mono">${fmtNum(a.revenue)}</td>
          <td class="td-c">${a.attendees||'—'}</td>
          <td style="font-size:.76rem">${a.owner||'—'}</td>
        </tr>`).join('')}
      </tbody></table></div>
    </div>`;
  document.getElementById('mkt-sel').addEventListener('change',e=>renderMarket(state,e.target.value));
  requestAnimationFrame(()=>{mkChart('c-mkt-cf','bar',{labels:MONTH_LABELS,datasets:[{label:'2026',data:MONTH_LABELS.map(m=>cf26[m]),backgroundColor:'rgba(46,95,163,.3)',borderColor:'#2E5FA3',borderWidth:1},{label:'2027',data:MONTH_LABELS.map(m=>cf27[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)}]},{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});});
}

/* ═══ VIEW 6 — OWNERS ══════════════════════════════════ */
function renderOwners(state){
  const acts=applyFilters(state.review.activities||[],state.filters);
  const ownerMap={};
  acts.forEach(a=>{const o=a.owner||'Unassigned';if(!ownerMap[o])ownerMap[o]={count:0,cashflow:0,markets:new Set(),types:{}};ownerMap[o].count++;ownerMap[o].cashflow+=a.cashflow;ownerMap[o].markets.add(a.market);ownerMap[o].types[a.activityType]=(ownerMap[o].types[a.activityType]||0)+1;});
  const owners=Object.entries(ownerMap).sort((a,b)=>b[1].count-a[1].count);
  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Owners — 2027 <small>${owners.length} owners</small></div>
    <div class="grid2 mb20">
      <div class="card"><div class="section-hd" style="font-size:.9rem">Activities per Owner (Top 15)</div><div class="chart-wrap-lg"><canvas id="c-owner-acts"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.9rem">Cashflow per Owner (Top 15)</div><div class="chart-wrap-lg"><canvas id="c-owner-cf"></canvas></div></div>
    </div>
    <div class="card"><div class="section-hd" style="font-size:.9rem">Owner Summary</div>
      <div class="tbl-scroll tbl-scroll-h"><table class="dt"><thead><tr><th>Owner</th><th class="th-r">Activities</th><th class="th-r">Total Cashflow</th><th class="th-r">Markets</th><th>Top Type</th></tr></thead><tbody>
        ${owners.map(([o,d])=>{const top=Object.entries(d.types).sort((a,b)=>b[1]-a[1])[0];return`<tr><td><strong>${o}</strong></td><td class="td-r">${d.count}</td><td class="td-r t-mono">${fmtNum(d.cashflow)}</td><td class="td-r">${d.markets.size}</td><td><span class="badge b-blue" style="font-size:.62rem">${top?top[0]:'—'}</span></td></tr>`;}).join('')}
      </tbody></table></div>
    </div>`;
  requestAnimationFrame(()=>{
    const top15=owners.slice(0,15);
    mkChart('c-owner-acts','bar',{labels:top15.map(([o])=>o.split(' ').slice(0,2).join(' ')),datasets:[{label:'Activities',data:top15.map(([,d])=>d.count),backgroundColor:'#2E5FA3'}]},{indexAxis:'y',plugins:{legend:{display:false}}});
    mkChart('c-owner-cf','bar',{labels:top15.map(([o])=>o.split(' ').slice(0,2).join(' ')),datasets:[{label:'Cashflow',data:top15.map(([,d])=>d.cashflow),backgroundColor:'#1F3864'}]},{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>fmtShort(v)}}}});
  });
}

/* ═══ VIEW 7 — VIOLATIONS (FULL OVERHAUL) ══════════════ */
function renderViolations(state){
  let viols=state.violations;
  let fSev=[],fMkt=[],fRule=[],fType=[],fRegion=[];
  const sum=summarise(viols);
  const allTypes=[...new Set(viols.map(v=>v.activityType||'—'))].sort();
  const allRegions=[...new Set(viols.map(v=>v.region||'—'))].sort();
  const allMkts=[...new Set(viols.map(v=>v.market))].sort();
  const allRules=[...new Set(viols.map(v=>v.ruleId))].sort();

  function filtered(){
    return viols.filter(v=>{
      if(fSev.length&&!fSev.includes(v.severity)) return false;
      if(fMkt.length&&!fMkt.includes(v.market)) return false;
      if(fRule.length&&!fRule.includes(v.ruleId)) return false;
      if(fType.length&&!fType.includes(v.activityType||'—')) return false;
      if(fRegion.length&&!fRegion.includes(v.region)) return false;
      return true;
    });
  }

  // Violations by activity type for chart
  const byType={};
  viols.filter(v=>v.status!=='accepted').forEach(v=>{
    const t=v.activityType||v.item||'Unknown';
    byType[t]=(byType[t]||0)+1;
  });
  const typeEntries=Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,10);

  function renderTbl(){
    const fv=filtered();
    document.getElementById('viol-count-lbl').textContent=`${fv.length} violation${fv.length!==1?'s':''}`;
    document.getElementById('viol-tbody').innerHTML=fv.map(v=>{
      const ri=viols.indexOf(v);
      const statusCls=v.status==='accepted'?'s-accepted':v.status==='action-required'?'s-action':'';
      return `<tr style="${v.status==='accepted'?'opacity:.45':''}">
        <td class="t-muted" style="font-size:.72rem;white-space:nowrap">${v.activityId}</td>
        <td class="td-c"><span class="badge b-${v.severity.toLowerCase()}">${v.severity}</span></td>
        <td><code style="font-size:.7rem;color:var(--blue)">${v.ruleId}</code></td>
        <td style="font-size:.76rem;white-space:nowrap">${v.ruleName}</td>
        <td><span class="badge b-blue" style="font-size:.62rem">${v.activityType||'—'}</span></td>
        <td style="font-size:.74rem"><span class="region-badge r-${(v.region||'').toLowerCase().replace(/[^a-z]/g,'').slice(0,6)}">${v.region}</span> ${v.market}</td>
        <td style="font-size:.76rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.item}">${v.item}</td>
        <td style="font-size:.74rem;max-width:240px;color:var(--g700)">${v.detail}</td>
        <td>
          <select class="status-select ${statusCls}" data-idx="${ri}" onchange="onStatusChange(this)">
            <option value="pending" ${v.status==='pending'?'selected':''}>— Pending —</option>
            <option value="accepted" ${v.status==='accepted'?'selected':''}>✓ Accepted</option>
            <option value="action-required" ${v.status==='action-required'?'selected':''}>⚠ Action Required</option>
          </select>
        </td>
        <td>
          <input type="text" class="comment-input ${v.status==='action-required'&&!v.comment?'required':''}"
            placeholder="${v.status==='action-required'?'What needs to change…':'Add note…'}"
            data-idx="${ri}" value="${v.comment||''}"
            oninput="onCommentInput(this)">
        </td>
      </tr>`;
    }).join('')||`<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--g400)">No violations match the selected filters.</td></tr>`;
  }

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Rule Violations — 2027 Plan</div>
    <div class="grid4 mb20">
      <div class="kpi-card kpi-danger"><div class="kpi-label">HIGH</div><div class="kpi-value t-red">${sum.counts.HIGH}</div><div class="kpi-sub">active violations</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">MEDIUM</div><div class="kpi-value" style="color:var(--amber)">${sum.counts.MEDIUM}</div><div class="kpi-sub">active violations</div></div>
      <div class="kpi-card kpi-info"><div class="kpi-label">LOW</div><div class="kpi-value">${sum.counts.LOW}</div><div class="kpi-sub">active violations</div></div>
      <div class="kpi-card"><div class="kpi-label">Top Market</div><div class="kpi-value" style="font-size:1rem">${sum.topMarkets[0]?.market||'—'}</div><div class="kpi-sub">${sum.topMarkets[0]?.count||0} violations</div></div>
    </div>
    <div class="grid3 mb20">
      <div class="card"><div class="section-hd" style="font-size:.9rem">By Market</div><div class="chart-wrap-sm"><canvas id="c-v-mkt"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.9rem">By Rule</div><div class="chart-wrap-sm"><canvas id="c-v-rule"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.9rem">By Activity Type</div><div class="chart-wrap-sm"><canvas id="c-v-type"></canvas></div></div>
    </div>
    <div class="card">
      <div class="flex-between mb16">
        <div class="flex-gap">
          <span class="section-hd" style="font-size:.9rem;margin:0;border:none">All Violations</span>
          <span id="viol-count-lbl" class="t-muted" style="font-size:.78rem"></span>
        </div>
        <div class="flex-gap">
          ${buildMS('ms-sev','Severity',['HIGH','MEDIUM','LOW'])}
          ${buildMS('ms-region','Region',allRegions)}
          ${buildMS('ms-mkt','Market',allMkts)}
          ${buildMS('ms-rule','Rule',allRules.map(r=>({value:r,label:`${r} — ${RULE_META[r]?.name?.slice(0,25)||r}`})))}
          ${buildMS('ms-type','Activity Type',allTypes)}
          <button class="btn-export" id="btn-xl">⬇ Excel</button>
          <button class="btn-secondary" id="btn-csv">⬇ CSV</button>
        </div>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Tact. ID</th><th class="td-c">Severity</th><th>Rule</th><th>Rule Name</th>
            <th>Type</th><th>Region / Market</th><th>Activity</th><th>Detail</th>
            <th style="min-width:140px">Status</th><th style="min-width:200px">What Needs to Change</th>
          </tr></thead>
          <tbody id="viol-tbody"></tbody>
        </table>
      </div>
    </div>`;

  renderTbl();

  // Multi-select filter listeners
  function bindMS(id, target, label){
    document.querySelector(`#${id} .ms-panel`).addEventListener('change',()=>{
      target.length=0;getMSValues(id).forEach(v=>target.push(v));
      updateMSLabel(id,label);renderTbl();
    });
  }
  bindMS('ms-sev',fSev,'Severity');
  bindMS('ms-region',fRegion,'Region');
  bindMS('ms-mkt',fMkt,'Market');
  bindMS('ms-rule',fRule,'Rule');
  bindMS('ms-type',fType,'Activity Type');

  document.getElementById('btn-xl').addEventListener('click',()=>exportViolationsToExcel(viols));
  document.getElementById('btn-csv').addEventListener('click',()=>exportViolationsToCSV(viols));

  requestAnimationFrame(()=>{
    const top8=sum.topMarkets.slice(0,8);
    mkChart('c-v-mkt','bar',{labels:top8.map(m=>m.market),datasets:[{label:'Violations',data:top8.map(m=>m.count),backgroundColor:'#C00000'}]},{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});
    const byRule={};viols.filter(v=>v.status!=='accepted').forEach(v=>{byRule[v.ruleId]=(byRule[v.ruleId]||0)+1;});
    const topR=Object.entries(byRule).sort((a,b)=>b[1]-a[1]).slice(0,10);
    mkChart('c-v-rule','bar',{labels:topR.map(([r])=>r),datasets:[{label:'Count',data:topR.map(([,c])=>c),backgroundColor:topR.map(([r])=>RULE_META[r]?.severity==='HIGH'?'#C00000':RULE_META[r]?.severity==='MEDIUM'?'#D97706':'#8D94A6')}]},{plugins:{legend:{display:false}},scales:{y:{ticks:{stepSize:1}}}});
    mkChart('c-v-type','bar',{labels:typeEntries.map(([t])=>t.length>18?t.slice(0,18)+'…':t),datasets:[{label:'Count',data:typeEntries.map(([,c])=>c),backgroundColor:'#2E5FA3'}]},{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});
  });
}

// Status and comment handlers — defined globally so inline onchange works
function onStatusChange(el){
  const idx=el.dataset.idx;
  APP.violations[idx].status=el.value;
  el.className='status-select'+(el.value==='accepted'?' s-accepted':el.value==='action-required'?' s-action':'');
  el.closest('tr').style.opacity=el.value==='accepted'?'.45':'1';
  const commentEl=el.closest('tr').querySelector('.comment-input');
  if(commentEl){commentEl.placeholder=el.value==='action-required'?'What needs to change…':'Add note…';commentEl.classList.toggle('required',el.value==='action-required'&&!commentEl.value);}
  document.getElementById('nav-viol-count').textContent=APP.violations.filter(v=>v.status!=='accepted').length;
  const sp=document.getElementById('sev-pills');
  if(sp){const s=summarise(APP.violations);sp.innerHTML=`<div class="sev-pill high">${s.counts.HIGH} HIGH</div><div class="sev-pill medium">${s.counts.MEDIUM} MED</div><div class="sev-pill low">${s.counts.LOW} LOW</div>`;}
}
function onCommentInput(el){
  const idx=el.dataset.idx;
  APP.violations[idx].comment=el.value;
  el.classList.toggle('required',APP.violations[idx].status==='action-required'&&!el.value);
}

/* ═══ SHARED HELPERS ════════════════════════════════════ */
function fmtShort(n){if(!n||n===0)return'0';const a=Math.abs(n);if(a>=1e6)return(n/1e6).toFixed(1)+'M';if(a>=1e3)return(n/1e3).toFixed(0)+'K';return Math.round(n).toString();}
function isJMP(a){return /jmp/i.test(a.activityType);}

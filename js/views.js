/* ═══════════════════════════════════════════════════════════
   VIEWS.JS — All 7 dashboard views
   Data source: Tactical Details only
═══════════════════════════════════════════════════════════ */

const Charts = {};
function destroyCharts() {
  Object.values(Charts).forEach(c=>{ try{c.destroy();}catch(e){} });
  Object.keys(Charts).forEach(k=>delete Charts[k]);
}

function mkChart(id,type,data,opts) {
  const el = document.getElementById(id); if(!el) return;
  if(Charts[id]) try{Charts[id].destroy();}catch(e){}
  Charts[id] = new Chart(el,{type,data,options:opts||{}});
}

const QCOLS = {Q1:'#2E5FA3',Q2:'#4A80C8',Q3:'#C8A755',Q4:'#C00000'};
const BLUE_PAL = ['#1F3864','#2E5FA3','#4A80C8','#7CA8DA','#AAC9EA','#D5E4F5'];

function applyFilters(acts, f) {
  return acts.filter(a => {
    if (f.market   && a.market       !== f.market)        return false;
    if (f.type     && a.activityType !== f.type)          return false;
    if (f.priority && String(a.priority) !== f.priority)  return false;
    if (f.lock     && a.locked       !== f.lock)          return false;
    return true;
  });
}

// ═══════════════════ VIEW 1 — OVERVIEW ═══════════════════
function renderOverview(state) {
  const acts27 = applyFilters(state.review.activities||[], state.filters);
  const acts26 = state.baseline.activities||[];

  const cf27 = MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  const cf26 = MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  acts27.forEach(a => MONTH_LABELS.forEach(m=>{ cf27[m]+=a.monthly[m]||0; }));
  acts26.forEach(a => MONTH_LABELS.forEach(m=>{ cf26[m]+=a.monthly[m]||0; }));

  const tot27 = Object.values(cf27).reduce((s,v)=>s+v,0);
  const tot26 = Object.values(cf26).reduce((s,v)=>s+v,0);

  const h1_27 = MONTH_LABELS.slice(0,6).reduce((s,m)=>s+cf27[m],0);
  const h2_27 = MONTH_LABELS.slice(6).reduce((s,m)=>s+cf27[m],0);
  const q34viol = h2_27 > h1_27;

  // Top 10 markets by cashflow 2027
  const mktCF = {};
  acts27.forEach(a => { mktCF[a.market]=(mktCF[a.market]||0)+a.cashflow; });
  const topMkts = Object.entries(mktCF).sort((a,b)=>b[1]-a[1]).slice(0,10);

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Overview — 2027 vs 2026 <small>Source: Tactical Details</small></div>

    <div class="grid4 mb20" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card kpi-info"><div class="kpi-label">2027 Total Cashflow</div><div class="kpi-value">${fmtShort(tot27)}</div><div class="kpi-sub">AED</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">2026 Total Cashflow</div><div class="kpi-value">${fmtShort(tot26)}</div><div class="kpi-sub">AED</div></div>
      <div class="kpi-card ${tot27>tot26?'kpi-danger':'kpi-success'}">
        <div class="kpi-label">YoY Change</div>
        <div class="kpi-value ${tot27>tot26?'t-red':'t-green'}">${tot27>=tot26?'+':''}${fmtShort(tot27-tot26)}</div>
        <div class="kpi-sub">${tot26?((tot27-tot26)/tot26*100).toFixed(1)+'%':''}</div>
      </div>
      <div class="kpi-card ${q34viol?'kpi-danger':'kpi-success'}">
        <div class="kpi-label">H1 vs H2 (2027)</div>
        <div class="kpi-value ${q34viol?'t-red':'t-green'}">${q34viol?'H2 HEAVY':'H1 OK'}</div>
        <div class="kpi-sub">H1: ${fmtShort(h1_27)} | H2: ${fmtShort(h2_27)}</div>
      </div>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Monthly Cashflow — 2027 vs 2026</div>
        <div class="chart-wrap"><canvas id="c-monthly-cmp"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">2027 Quarterly Distribution</div>
        <div class="chart-wrap"><canvas id="c-quarterly"></canvas></div>
      </div>
    </div>

    <div class="card mb20">
      <div class="section-hd" style="font-size:.9rem">Top 10 Markets by 2027 Cashflow</div>
      <div class="chart-wrap"><canvas id="c-top-mkt"></canvas></div>
    </div>

    <div class="card">
      <div class="section-hd" style="font-size:.9rem">Monthly Breakdown Table</div>
      <div class="tbl-scroll">
        <table class="dt">
          <thead><tr>
            <th>Month</th><th>Qtr</th>
            <th class="th-r">2026 (AED)</th>
            <th class="th-r">2027 (AED)</th>
            <th class="th-r">Change</th>
            <th class="th-r">Change %</th>
          </tr></thead>
          <tbody>
            ${MONTH_LABELS.map((m,i)=>{
              const v26=cf26[m]||0, v27=cf27[m]||0, diff=v27-v26;
              const q = i<3?'Q1':i<6?'Q2':i<9?'Q3':'Q4';
              const flag = i>=9&&v27>0?'row-flag':'';
              return `<tr class="${flag}">
                <td>${m}</td><td>${q}</td>
                <td class="td-r t-mono">${fmtNum(v26)}</td>
                <td class="td-r t-mono">${fmtNum(v27)}</td>
                <td class="td-r ${diff>0?'t-red':diff<0?'t-green':''}">${diff>=0?'+':''}${fmtNum(diff)}</td>
                <td class="td-r ${diff>0?'t-red':diff<0?'t-green':''}">${v26?((diff/v26)*100).toFixed(1)+'%':'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  requestAnimationFrame(()=>{
    mkChart('c-monthly-cmp','bar',{
      labels:MONTH_LABELS,
      datasets:[
        {label:'2026',data:MONTH_LABELS.map(m=>cf26[m]),backgroundColor:'rgba(46,95,163,.35)',borderColor:'#2E5FA3',borderWidth:1},
        {label:'2027',data:MONTH_LABELS.map(m=>cf27[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)},
      ]
    },{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});

    const Q1v=MONTH_LABELS.slice(0,3).reduce((s,m)=>s+cf27[m],0);
    const Q2v=MONTH_LABELS.slice(3,6).reduce((s,m)=>s+cf27[m],0);
    const Q3v=MONTH_LABELS.slice(6,9).reduce((s,m)=>s+cf27[m],0);
    const Q4v=MONTH_LABELS.slice(9).reduce((s,m)=>s+cf27[m],0);
    mkChart('c-quarterly','doughnut',{
      labels:['Q1','Q2','Q3','Q4'],
      datasets:[{data:[Q1v,Q2v,Q3v,Q4v],backgroundColor:[QCOLS.Q1,QCOLS.Q2,QCOLS.Q3,QCOLS.Q4]}]
    },{plugins:{legend:{position:'bottom'}}});

    mkChart('c-top-mkt','bar',{
      labels:topMkts.map(([m])=>m),
      datasets:[{label:'2027 Cashflow',data:topMkts.map(([,v])=>v),backgroundColor:'#2E5FA3'}]
    },{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>fmtShort(v)}}}});
  });
}

// ═══════════════════ VIEW 2 — COMPARISON ═════════════════
function renderComparison(state) {
  const {added,removed,changed} = state.comparison;
  const f = state.filters;
  const addF   = applyFilters(added,   f);
  const remF   = applyFilters(removed, f);
  const chgF   = changed.filter(c=> (!f.market||c.activity.market===f.market));

  const totNew  = addF.reduce((s,a)=>s+a.cashflow,0);
  const totDrop = remF.reduce((s,a)=>s+a.cashflow,0);
  const totChg  = chgF.reduce((s,c)=>{ const ch=c.changes.find(x=>x.field==='Cashflow'); return s+(ch?ch.to-ch.from:0); },0);

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">2026 vs 2027 — Activity Changes</div>

    <div class="grid3 mb20">
      <div class="kpi-card kpi-success"><div class="kpi-label">New Activities (2027)</div><div class="kpi-value t-green">${addF.length}</div><div class="kpi-sub">${fmtAED(totNew)} new cashflow</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-label">Removed Activities</div><div class="kpi-value t-red">${remF.length}</div><div class="kpi-sub">${fmtAED(totDrop)} dropped</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">Changed Activities</div><div class="kpi-value t-amber">${chgF.length}</div><div class="kpi-sub">${totChg>=0?'+':''}${fmtAED(totChg)} cashflow shift</div></div>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">✅ New in 2027 <span class="badge b-new">${addF.length}</span></div>
        <div class="tbl-scroll tbl-scroll-h">
          <table class="dt">
            <thead><tr><th>Market</th><th>Activity</th><th>Type</th><th class="th-r">Cashflow</th><th>Priority</th></tr></thead>
            <tbody>
              ${addF.length?addF.sort((a,b)=>b.cashflow-a.cashflow).map(a=>`
                <tr class="row-new">
                  <td>${a.market}</td><td>${a.activityName}</td>
                  <td><span class="badge b-blue" style="font-size:.65rem">${a.activityType}</span></td>
                  <td class="td-r t-mono">${fmtNum(a.cashflow)}</td>
                  <td class="td-c">${a.priority||'—'}</td>
                </tr>`).join('')
              :`<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--g400)">No new activities</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="section-hd" style="font-size:.9rem">❌ Removed from 2026 <span class="badge b-removed">${remF.length}</span></div>
        <div class="tbl-scroll tbl-scroll-h">
          <table class="dt">
            <thead><tr><th>Market</th><th>Activity</th><th>Type</th><th class="th-r">2026 Cashflow</th></tr></thead>
            <tbody>
              ${remF.length?remF.sort((a,b)=>b.cashflow-a.cashflow).map(a=>`
                <tr class="row-removed">
                  <td>${a.market}</td><td>${a.activityName}</td>
                  <td><span class="badge b-low" style="font-size:.65rem">${a.activityType}</span></td>
                  <td class="td-r t-mono">${fmtNum(a.cashflow)}</td>
                </tr>`).join('')
              :`<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--g400)">No removed activities</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-hd" style="font-size:.9rem">🔄 Changed Activities <span class="badge b-changed">${chgF.length}</span></div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr><th>Market</th><th>Activity</th><th>Field Changed</th><th>2026 Value</th><th>2027 Value</th><th>Δ Cashflow</th></tr></thead>
          <tbody>
            ${chgF.length?chgF.map(({activity:a,changes})=>
              changes.map(ch=>{
                const isCash = ch.field==='Cashflow';
                const delta = isCash ? ch.to-ch.from : null;
                return `<tr class="${isCash&&delta>0?'row-warn':''}">
                  <td>${a.market}</td><td>${a.activityName}</td>
                  <td><span class="badge b-changed">${ch.field}</span></td>
                  <td class="t-mono">${isCash?fmtNum(ch.from):ch.from}</td>
                  <td class="t-mono ${isCash&&delta>0?'t-red':isCash&&delta<0?'t-green':''}">${isCash?fmtNum(ch.to):ch.to}</td>
                  <td class="td-r t-mono ${delta>0?'t-red':delta<0?'t-green':''}">${isCash?(delta>=0?'+':'')+fmtNum(delta):'—'}</td>
                </tr>`;
              }).join('')
            ).join('')
            :`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--g400)">No changed activities</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ═══════════════════ VIEW 3 — ACTIVITIES ═════════════════
function renderActivities(state) {
  const acts = applyFilters(state.review.activities||[], state.filters);

  const byMkt={}, byType={};
  acts.forEach(a=>{
    byMkt[a.market]=(byMkt[a.market]||0)+1;
    byType[a.activityType]=(byType[a.activityType]||0)+1;
  });
  const mktSort = Object.entries(byMkt).sort((a,b)=>b[1]-a[1]);
  const typeSort = Object.entries(byType).sort((a,b)=>b[1]-a[1]);

  const othersCount = acts.filter(a=>/^others$/i.test(a.activityType)).length;
  const noKPI = acts.filter(a=>!a.revenue&&!a.attendees).length;

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Activities — 2027 Plan <small>${acts.length} activities</small></div>
    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Activities by Market</div>
        <div class="chart-wrap-lg"><canvas id="c-by-mkt"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Activities by Type</div>
        <div class="chart-wrap-lg"><canvas id="c-by-type"></canvas></div>
      </div>
    </div>
    <div class="grid2 mb20">
      <div class="kpi-card ${othersCount>0?'kpi-danger':'kpi-success'}">
        <div class="kpi-label">"Others" Type</div>
        <div class="kpi-value ${othersCount>0?'t-red':''}">${othersCount}</div>
        <div class="kpi-sub">${othersCount>0?'Must be reclassified':'None — good'}</div>
      </div>
      <div class="kpi-card ${noKPI>0?'kpi-warning':'kpi-success'}">
        <div class="kpi-label">Missing KPIs</div>
        <div class="kpi-value ${noKPI>0?'t-amber':''}">${noKPI}</div>
        <div class="kpi-sub">no revenue + no attendees</div>
      </div>
    </div>
    <div class="card">
      <div class="flex-between mb16">
        <div class="section-hd" style="font-size:.9rem;margin:0;border:none">Activity Detail Table</div>
        <span class="t-muted" style="font-size:.78rem">${acts.length} rows shown</span>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Market</th><th>Activity Name</th><th>Type</th>
            <th class="td-c">P</th><th>Owner</th>
            <th class="th-r">Cashflow</th><th class="th-r">Revenue</th>
            <th class="td-c">Att.</th><th>Lock</th><th>Flags</th>
          </tr></thead>
          <tbody>
            ${acts.map(a=>{
              const flags=[];
              if(/^others$/i.test(a.activityType)) flags.push('<span class="badge b-high">Others!</span>');
              if(!a.revenue&&!a.attendees) flags.push('<span class="badge b-medium">No KPI</span>');
              if(a.cashflow>a.revenue&&a.revenue>0) flags.push('');
              return `<tr class="${/^others$/i.test(a.activityType)?'row-flag':(!a.revenue&&!a.attendees)?'row-warn':''}">
                <td>${a.market}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.activityName}">${a.activityName}</td>
                <td><span class="badge b-blue" style="font-size:.65rem">${a.activityType}</span></td>
                <td class="td-c">${a.priority||'—'}</td>
                <td style="font-size:.76rem">${a.owner||'—'}</td>
                <td class="td-r t-mono">${fmtNum(a.cashflow)}</td>
                <td class="td-r t-mono">${fmtNum(a.revenue)}</td>
                <td class="td-c">${a.attendees||'—'}</td>
                <td><span class="badge ${a.locked==='Locked'?'b-locked':'b-unlocked'}">${a.locked}</span></td>
                <td>${flags.join(' ')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  requestAnimationFrame(()=>{
    mkChart('c-by-mkt','bar',{
      labels:mktSort.map(([m])=>m),
      datasets:[{label:'Activities',data:mktSort.map(([,c])=>c),backgroundColor:'#2E5FA3'}]
    },{indexAxis:'y',plugins:{legend:{display:false}}});

    mkChart('c-by-type','bar',{
      labels:typeSort.map(([t])=>t),
      datasets:[{label:'Count',data:typeSort.map(([,c])=>c),
        backgroundColor:typeSort.map(([t])=>/^others$/i.test(t)?'#C00000':'#2E5FA3')}]
    },{indexAxis:'y',plugins:{legend:{display:false}}});
  });
}

// ═══════════════════ VIEW 4 — CASHFLOW HEATMAP ════════════
function renderCashflow(state) {
  const acts = applyFilters(state.review.activities||[], state.filters);
  const markets = [...new Set(acts.map(a=>a.market))].sort();

  const cfByMkt={};
  markets.forEach(m=>{ cfByMkt[m]=MONTH_LABELS.reduce((o,mo)=>({...o,[mo]:0}),{}); });
  acts.forEach(a=>MONTH_LABELS.forEach(m=>{ cfByMkt[a.market][m]+=a.monthly[m]||0; }));

  const allVals = Object.values(cfByMkt).flatMap(m=>Object.values(m));
  const maxV = Math.max(...allVals,1);

  function hCls(v,max){ if(!v) return 'h0'; const r=v/max; return r<.15?'h1':r<.30?'h2':r<.55?'h3':r<.80?'h4':'h5'; }

  const mTotals=MONTH_LABELS.reduce((o,m)=>({...o,[m]:markets.reduce((s,mkt)=>s+(cfByMkt[mkt][m]||0),0)}),{});

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Cashflow Heatmap — Market × Month (2027)</div>
    <div class="card mb20">
      <div class="section-hd" style="font-size:.9rem">Monthly Totals — 2027</div>
      <div class="chart-wrap"><canvas id="c-cf-tot"></canvas></div>
    </div>
    <div class="card">
      <div class="flex-between mb16">
        <div class="section-hd" style="font-size:.9rem;margin:0;border:none">Market × Month Heatmap</div>
        <small class="t-muted">Red = Oct–Dec spend (Rule 1.3) | H2>H1 = Row flag (Rule 1.2)</small>
      </div>
      <div class="heatmap-wrap">
        <table class="heatmap">
          <thead><tr>
            <th class="market-hd">Market</th>
            ${MONTH_LABELS.map(m=>`<th>${m}</th>`).join('')}
            <th>H1/H2</th>
          </tr></thead>
          <tbody>
            ${markets.map(mkt=>{
              const mo=cfByMkt[mkt];
              const h1=MONTH_LABELS.slice(0,6).reduce((s,m)=>s+mo[m],0);
              const h2=MONTH_LABELS.slice(6).reduce((s,m)=>s+mo[m],0);
              return `<tr>
                <td class="market-cell">${mkt}</td>
                ${MONTH_LABELS.map((m,i)=>{
                  const v=mo[m]||0;
                  const cls=i>=9&&v>0?'h-viol':hCls(v,maxV);
                  return `<td class="${cls}" title="${mkt} ${m}: ${fmtAED(v)}">${v>0?fmtShort(v):''}</td>`;
                }).join('')}
                <td style="text-align:center">${h2>h1?'<span class="badge b-high">H2!</span>':'<span class="badge b-ok">✓</span>'}</td>
              </tr>`;
            }).join('')}
            <tr style="font-weight:700;background:var(--g100)">
              <td class="market-cell">TOTAL</td>
              ${MONTH_LABELS.map(m=>`<td style="text-align:center;font-size:.72rem;font-weight:700">${fmtShort(mTotals[m])}</td>`).join('')}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;font-size:.72rem;align-items:center">
        <span>Intensity:</span>
        ${['h1','h2','h3','h4','h5'].map((c,i)=>`<span class="${c}" style="padding:3px 10px;border-radius:4px">${['Low','','Med','','High'][i]}</span>`).join('')}
        <span class="h-viol" style="padding:3px 10px;border-radius:4px">Oct–Dec Active</span>
      </div>
    </div>
  `;

  requestAnimationFrame(()=>{
    mkChart('c-cf-tot','bar',{
      labels:MONTH_LABELS,
      datasets:[{label:'Total Cashflow',data:MONTH_LABELS.map(m=>mTotals[m]),
        backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)}]
    },{plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});
  });
}

// ═══════════════════ VIEW 5 — MARKET DEEP DIVE ════════════
function renderMarket(state, sel) {
  const acts27 = state.review.activities||[];
  const acts26 = state.baseline.activities||[];
  const markets = [...new Set(acts27.map(a=>a.market).filter(Boolean))].sort();
  const mkt = sel || markets[0] || '';

  const m27 = acts27.filter(a=>a.market===mkt);
  const m26 = acts26.filter(a=>a.market===mkt);

  const cf27=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  const cf26=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  m27.forEach(a=>MONTH_LABELS.forEach(m=>{ cf27[m]+=a.monthly[m]||0; }));
  m26.forEach(a=>MONTH_LABELS.forEach(m=>{ cf26[m]+=a.monthly[m]||0; }));

  const tot27=m27.reduce((s,a)=>s+a.cashflow,0);
  const tot26=m26.reduce((s,a)=>s+a.cashflow,0);
  const h1=MONTH_LABELS.slice(0,6).reduce((s,m)=>s+cf27[m],0);
  const h2=MONTH_LABELS.slice(6).reduce((s,m)=>s+cf27[m],0);

  // Compliance checks
  const hasOthers = m27.some(a=>/^others$/i.test(a.activityType));
  const q34viol   = h2>h1;
  const missions  = m27.filter(a=>isMission(a)).length;
  const noKPI     = m27.filter(a=>!a.revenue&&!a.attendees).length;
  const trainP1   = m27.some(a=>isTraining(a)&&a.priority===1);
  const RAM_S=new Date(2027,1,18), RAM_E=new Date(2027,2,20);
  const ramZero = m27.filter(a=>{
    const inR=(d=>d&&d>=RAM_S&&d<=RAM_E);
    return (inR(a.startDate)||inR(a.endDate))&&a.cashflow===0;
  }).length;
  const jmpsClosed = m27.filter(a=>isJMP(a)&&a.endDate&&a.endDate.getMonth()>=6).length;

  function chk(pass,text){ return `<div class="check-item ${pass?'pass':'fail'}"><span class="check-icon">${pass?'✅':'❌'}</span><span>${text}</span></div>`; }

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Market Deep Dive</div>
    <div class="market-selector">
      <label>Select Market:</label>
      <select id="mkt-sel">
        ${markets.map(m=>`<option value="${m}"${m===mkt?' selected':''}>${m}</option>`).join('')}
      </select>
      <span class="t-muted" style="font-size:.78rem">${m27.length} activities in 2027 | ${m26.length} in 2026 | Budget: ${fmtAED(tot27)}</span>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Monthly Cashflow — 2027 vs 2026</div>
        <div class="chart-wrap"><canvas id="c-mkt-cf"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Compliance Checklist — 2027</div>
        <div class="checklist">
          ${chk(!hasOthers,    'No "Others" activity types')}
          ${chk(!q34viol,      `H1 ≥ H2 (H1: ${fmtAED(h1)} / H2: ${fmtAED(h2)})`)}
          ${chk(jmpsClosed===0,`JMP contracts close in Q1/Q2 (${jmpsClosed} in Q3/Q4)`)}
          ${chk(ramZero>=2,    `Ramadan zero-budget activities: ${ramZero}/2 required`)}
          ${chk(missions<=1,   `Sales missions: ${missions} (max 1)`)}
          ${chk(noKPI===0,     `Activities without KPIs: ${noKPI}`)}
          ${chk(!trainP1,      'No training activities at Priority 1')}
        </div>
        <div style="margin-top:14px">
          <table class="dt"><tbody>
            <tr><td>Activities 2027</td><td class="td-r"><strong>${m27.length}</strong></td></tr>
            <tr><td>Activities 2026</td><td class="td-r">${m26.length}</td></tr>
            <tr><td>Total 2027 Cashflow</td><td class="td-r t-mono">${fmtNum(tot27)}</td></tr>
            <tr><td>Total 2026 Cashflow</td><td class="td-r t-mono">${fmtNum(tot26)}</td></tr>
            <tr><td>Change</td><td class="td-r t-mono ${tot27>tot26?'t-red':'t-green'}">${tot27>=tot26?'+':''}${fmtNum(tot27-tot26)}</td></tr>
            <tr><td>Locked Activities</td><td class="td-r">${m27.filter(a=>a.locked==='Locked').length}</td></tr>
          </tbody></table>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-hd" style="font-size:.9rem">Activities in ${mkt}</div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Activity</th><th>Type</th><th class="td-c">P</th>
            <th>Start</th><th>End</th>
            <th class="th-r">Cashflow</th><th class="th-r">Revenue</th>
            <th class="td-c">Att.</th><th>Owner</th><th>Lock</th>
          </tr></thead>
          <tbody>
            ${m27.map(a=>`<tr class="${/^others$/i.test(a.activityType)?'row-flag':!a.revenue&&!a.attendees?'row-warn':''}">
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.activityName}">${a.activityName}</td>
              <td><span class="badge b-blue" style="font-size:.65rem">${a.activityType}</span></td>
              <td class="td-c">${a.priority||'—'}</td>
              <td>${fmtDate(a.startDate)}</td><td>${fmtDate(a.endDate)}</td>
              <td class="td-r t-mono">${fmtNum(a.cashflow)}</td>
              <td class="td-r t-mono">${fmtNum(a.revenue)}</td>
              <td class="td-c">${a.attendees||'—'}</td>
              <td style="font-size:.76rem">${a.owner||'—'}</td>
              <td><span class="badge ${a.locked==='Locked'?'b-locked':'b-unlocked'}" style="font-size:.65rem">${a.locked}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('mkt-sel').addEventListener('change',e=>renderMarket(state,e.target.value));

  requestAnimationFrame(()=>{
    mkChart('c-mkt-cf','bar',{
      labels:MONTH_LABELS,
      datasets:[
        {label:'2026',data:MONTH_LABELS.map(m=>cf26[m]),backgroundColor:'rgba(46,95,163,.3)',borderColor:'#2E5FA3',borderWidth:1},
        {label:'2027',data:MONTH_LABELS.map(m=>cf27[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)},
      ]
    },{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});
  });
}

// ═══════════════════ VIEW 6 — OWNERS ═════════════════════
function renderOwners(state) {
  const acts = applyFilters(state.review.activities||[], state.filters);
  const ownerMap={};
  acts.forEach(a=>{
    const o=a.owner||'Unassigned';
    if(!ownerMap[o]) ownerMap[o]={count:0,cashflow:0,markets:new Set(),types:{}};
    ownerMap[o].count++;
    ownerMap[o].cashflow+=a.cashflow;
    ownerMap[o].markets.add(a.market);
    ownerMap[o].types[a.activityType]=(ownerMap[o].types[a.activityType]||0)+1;
  });
  const owners=Object.entries(ownerMap).sort((a,b)=>b[1].count-a[1].count);

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Activity Owners — 2027 <small>${[...new Set(acts.map(a=>a.owner).filter(Boolean))].length} owners</small></div>
    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Activities per Owner</div>
        <div class="chart-wrap-lg"><canvas id="c-owner-acts"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Cashflow per Owner (AED)</div>
        <div class="chart-wrap-lg"><canvas id="c-owner-cf"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="section-hd" style="font-size:.9rem">Owner Summary Table</div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Owner</th><th class="th-r">Activities</th><th class="th-r">Total Cashflow</th>
            <th class="th-r">Markets</th><th>Top Activity Type</th>
          </tr></thead>
          <tbody>
            ${owners.map(([owner,d])=>{
              const topType=Object.entries(d.types).sort((a,b)=>b[1]-a[1])[0];
              return `<tr>
                <td><strong>${owner}</strong></td>
                <td class="td-r">${d.count}</td>
                <td class="td-r t-mono">${fmtNum(d.cashflow)}</td>
                <td class="td-r">${d.markets.size}</td>
                <td><span class="badge b-blue" style="font-size:.65rem">${topType?topType[0]:'—'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  requestAnimationFrame(()=>{
    const top15=owners.slice(0,15);
    mkChart('c-owner-acts','bar',{
      labels:top15.map(([o])=>o.split(' ').slice(0,2).join(' ')),
      datasets:[{label:'Activities',data:top15.map(([,d])=>d.count),backgroundColor:'#2E5FA3'}]
    },{indexAxis:'y',plugins:{legend:{display:false}}});

    mkChart('c-owner-cf','bar',{
      labels:top15.map(([o])=>o.split(' ').slice(0,2).join(' ')),
      datasets:[{label:'Cashflow',data:top15.map(([,d])=>d.cashflow),backgroundColor:'#1F3864'}]
    },{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>fmtShort(v)}}}});
  });
}

// ═══════════════════ VIEW 7 — VIOLATIONS ═════════════════
function renderViolations(state) {
  let viols = state.violations;
  let fSev='', fMkt='', fRule='';
  const sum = summarise(viols);

  function filtered(){ return viols.filter(v=>(!fSev||v.severity===fSev)&&(!fMkt||v.market===fMkt)&&(!fRule||v.ruleId===fRule)); }

  function renderTbl(){
    const fv=filtered();
    document.getElementById('viol-count-lbl').textContent=`${fv.length} violation${fv.length!==1?'s':''}`;
    document.getElementById('viol-tbody').innerHTML=fv.map(v=>{
      const ri=viols.indexOf(v);
      return `<tr style="${v.justified?'opacity:.5':''}">
        <td class="td-c"><span class="badge b-${v.severity.toLowerCase()}">${v.severity}</span></td>
        <td><code style="font-size:.72rem;color:var(--blue)">${v.ruleId}</code></td>
        <td style="font-size:.78rem">${v.ruleName}</td>
        <td>${v.market}</td>
        <td style="font-size:.78rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.item}">${v.item}</td>
        <td style="font-size:.76rem;color:var(--g700);max-width:260px">${v.detail}</td>
        <td class="td-c"><input type="checkbox" class="justify-checkbox" data-idx="${ri}" ${v.justified?'checked':''}></td>
        <td><input type="text" class="justify-input" placeholder="Add note…" data-idx="${ri}" value="${v.justificationNote||''}"></td>
      </tr>`;
    }).join('')||`<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--g400)">No violations match filter.</td></tr>`;
  }

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Rule Violations — 2027 Plan</div>
    <div class="grid4 mb20">
      <div class="kpi-card kpi-danger"><div class="kpi-label">HIGH</div><div class="kpi-value t-red">${sum.counts.HIGH}</div><div class="kpi-sub">violations</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">MEDIUM</div><div class="kpi-value" style="color:var(--amber)">${sum.counts.MEDIUM}</div><div class="kpi-sub">violations</div></div>
      <div class="kpi-card kpi-info"><div class="kpi-label">LOW</div><div class="kpi-value">${sum.counts.LOW}</div><div class="kpi-sub">violations</div></div>
      <div class="kpi-card"><div class="kpi-label">Top Market</div><div class="kpi-value" style="font-size:1rem">${sum.topMarkets[0]?.market||'—'}</div><div class="kpi-sub">${sum.topMarkets[0]?.count||0} violations</div></div>
    </div>

    <div class="grid2 mb20">
      <div class="card"><div class="section-hd" style="font-size:.9rem">By Market</div><div class="chart-wrap-sm"><canvas id="c-v-mkt"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.9rem">By Rule</div><div class="chart-wrap-sm"><canvas id="c-v-rule"></canvas></div></div>
    </div>

    <div class="card">
      <div class="flex-between mb16">
        <div class="flex-gap">
          <span class="section-hd" style="font-size:.9rem;margin:0;border:none">All Violations</span>
          <span id="viol-count-lbl" class="t-muted" style="font-size:.78rem"></span>
        </div>
        <div class="flex-gap">
          <select class="flt-select" id="fv-sev"><option value="">All Severity</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select>
          <select class="flt-select" id="fv-mkt"><option value="">All Markets</option>${[...new Set(viols.map(v=>v.market))].sort().map(m=>`<option>${m}</option>`).join('')}</select>
          <select class="flt-select" id="fv-rule"><option value="">All Rules</option>${[...new Set(viols.map(v=>v.ruleId))].sort().map(r=>`<option value="${r}">${r} — ${RULE_META[r]?.name||r}</option>`).join('')}</select>
          <button class="btn-export" id="btn-xl">⬇ Excel</button>
          <button class="btn-secondary" id="btn-csv">⬇ CSV</button>
        </div>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th class="td-c">Severity</th><th>Rule</th><th>Rule Name</th>
            <th>Market</th><th>Activity</th><th>Detail</th>
            <th class="td-c">Justified</th><th>Note</th>
          </tr></thead>
          <tbody id="viol-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderTbl();

  document.getElementById('fv-sev').addEventListener('change',e=>{fSev=e.target.value;renderTbl();});
  document.getElementById('fv-mkt').addEventListener('change',e=>{fMkt=e.target.value;renderTbl();});
  document.getElementById('fv-rule').addEventListener('change',e=>{fRule=e.target.value;renderTbl();});

  document.getElementById('viol-tbody').addEventListener('change',e=>{
    if(e.target.classList.contains('justify-checkbox')){
      const idx=e.target.dataset.idx;
      viols[idx].justified=e.target.checked;
      e.target.closest('tr').style.opacity=e.target.checked?'.5':'1';
      document.getElementById('nav-viol-count').textContent=viols.filter(v=>!v.justified).length;
    }
  });
  document.getElementById('viol-tbody').addEventListener('input',e=>{
    if(e.target.classList.contains('justify-input'))
      viols[e.target.dataset.idx].justificationNote=e.target.value;
  });

  document.getElementById('btn-xl').addEventListener('click',()=>exportViolationsToExcel(viols));
  document.getElementById('btn-csv').addEventListener('click',()=>exportViolationsToCSV(viols));

  requestAnimationFrame(()=>{
    const top8=sum.topMarkets.slice(0,8);
    mkChart('c-v-mkt','bar',{
      labels:top8.map(m=>m.market),
      datasets:[{label:'Violations',data:top8.map(m=>m.count),backgroundColor:'#C00000'}]
    },{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});

    const byRule={};
    viols.forEach(v=>{byRule[v.ruleId]=(byRule[v.ruleId]||0)+1;});
    const topR=Object.entries(byRule).sort((a,b)=>b[1]-a[1]).slice(0,10);
    mkChart('c-v-rule','bar',{
      labels:topR.map(([r])=>r),
      datasets:[{label:'Count',data:topR.map(([,c])=>c),
        backgroundColor:topR.map(([r])=>RULE_META[r]?.severity==='HIGH'?'#C00000':RULE_META[r]?.severity==='MEDIUM'?'#D97706':'#8D94A6')}]
    },{plugins:{legend:{display:false}},scales:{y:{ticks:{stepSize:1}}}});
  });
}

// ── Type helpers available in views ──────────────────────
function isJMP(a)     { return /jmp/i.test(a.activityType); }
function isMission(a) { return /mission/i.test(a.activityType+' '+a.activityName); }
function isTraining(a){ return /training|workshop/i.test(a.activityType+' '+a.activityName); }

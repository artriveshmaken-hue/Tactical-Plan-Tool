/* views.js — 3 views: Overview | Market Review | Violations */

const Charts={};
function destroyCharts(){Object.values(Charts).forEach(c=>{try{c.destroy();}catch(e){}});Object.keys(Charts).forEach(k=>delete Charts[k]);}
function mkChart(id,type,data,opts){const el=document.getElementById(id);if(!el)return;if(Charts[id])try{Charts[id].destroy();}catch(e){}Charts[id]=new Chart(el,{type,data,options:opts||{}});}
const QCOLS={Q1:'#2E5FA3',Q2:'#4A80C8',Q3:'#C8A755',Q4:'#C00000'};
const PALETTE=['#1F3864','#2E5FA3','#C00000','#C8A755','#15803D','#7C3AED','#0891B2','#D97706','#DB2777','#65A30D','#4A80C8','#6B7280'];

function isJMP(a){return /jmp/i.test(a.activityType||'');}
function isMission(a){return /mission/i.test(`${a.activityType||''} ${a.activityName||''}`);}
function isWebinar(a){return /webinar|virtual|online/i.test(`${a.activityType||''} ${a.activityName||''}`);}

function applyFilters(acts,f){
  return acts.filter(a=>{
    if(f.region  && getRegion(a.market)!==f.region) return false;
    if(f.market  && a.market!==f.market)             return false;
    if(f.type    && a.activityType!==f.type)         return false;
    if(f.priority&& String(a.priority)!==f.priority) return false;
    if(f.lock    && a.locked!==f.lock)               return false;
    return true;
  });
}

/* ══════════════════════════════════════════════════════════
   VIEW 1 — OVERVIEW
   Global picture: KPIs, type×market matrix, H2 drivers,
   violation heatmap by market
══════════════════════════════════════════════════════════ */
function renderOverview(state){
  const acts27=applyFilters(state.review.activities||[],state.filters);
  const acts26=state.baseline.activities||[];
  const viols=state.violations;

  // Monthly totals
  const cf27=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  const cf26=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  acts27.forEach(a=>MONTH_LABELS.forEach(m=>{cf27[m]+=a.monthly[m]||0;}));
  acts26.forEach(a=>MONTH_LABELS.forEach(m=>{cf26[m]+=a.monthly[m]||0;}));
  const tot27=acts27.reduce((s,a)=>s+a.cashflow,0);
  const tot26=acts26.reduce((s,a)=>s+a.cashflow,0);
  const h1=MONTH_LABELS.slice(0,6).reduce((s,m)=>s+cf27[m],0);
  const h2=MONTH_LABELS.slice(6).reduce((s,m)=>s+cf27[m],0);

  // Markets
  const markets=[...new Set(acts27.map(a=>a.market))].filter(Boolean).sort();
  const allTypes=[...new Set(acts27.map(a=>a.activityType))].filter(Boolean);
  const typeTotals={};
  allTypes.forEach(t=>{typeTotals[t]=acts27.filter(a=>a.activityType===t).reduce((s,a)=>s+a.cashflow,0);});
  const topTypes=Object.entries(typeTotals).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([t])=>t);

  // Market × Type matrix
  const mktMat={};
  markets.forEach(m=>{mktMat[m]={_total:0};topTypes.forEach(t=>{mktMat[m][t]=0;});});
  acts27.forEach(a=>{
    if(!mktMat[a.market])return;
    mktMat[a.market]._total+=a.cashflow;
    if(topTypes.includes(a.activityType))mktMat[a.market][a.activityType]+=a.cashflow;
  });
  const typeTotRow={};topTypes.forEach(t=>{typeTotRow[t]=markets.reduce((s,m)=>s+(mktMat[m]?.[t]||0),0);});
  const maxCell=Math.max(...markets.flatMap(m=>topTypes.map(t=>mktMat[m]?.[t]||0)),1);
  function cfCls(v){if(!v)return'cf0';const r=v/maxCell;return r<.1?'cf1':r<.25?'cf2':r<.5?'cf3':r<.75?'cf4':'cf5';}

  // H2 drivers
  const h2Drivers=[];
  markets.forEach(m=>{
    topTypes.forEach(t=>{
      const h2v=acts27.filter(a=>a.market===m&&a.activityType===t).reduce((s,a)=>s+MONTH_LABELS.slice(6).reduce((ss,mo)=>ss+(a.monthly[mo]||0),0),0);
      if(h2v>50000)h2Drivers.push({market:m,type:t,h2:h2v});
    });
  });
  h2Drivers.sort((a,b)=>b.h2-a.h2);
  const maxH2=h2Drivers[0]?.h2||1;

  // Violation counts per market
  const violByMkt={};
  viols.filter(v=>v.status!=='accepted').forEach(v=>{violByMkt[v.market]=(violByMkt[v.market]||0)+1;});
  const top5viol=Object.entries(violByMkt).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Summary stats
  const sum=summarise(viols);

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Global Overview — 2027 vs 2026</div>

    <div class="grid5 mb20">
      <div class="kpi-card kpi-info"><div class="kpi-label">2027 Cashflow</div><div class="kpi-value">${fmtShort(tot27)}</div><div class="kpi-sub">AED</div></div>
      <div class="kpi-card ${tot27>tot26?'kpi-danger':'kpi-success'}"><div class="kpi-label">vs 2026</div><div class="kpi-value ${tot27>tot26?'t-red':'t-green'}">${tot27>=tot26?'+':''}${fmtShort(tot27-tot26)}</div><div class="kpi-sub">${tot26?((tot27-tot26)/tot26*100).toFixed(1)+'%':''}</div></div>
      <div class="kpi-card"><div class="kpi-label">Markets</div><div class="kpi-value">${markets.length}</div><div class="kpi-sub">${acts27.length} activities</div></div>
      <div class="kpi-card ${h2>h1?'kpi-danger':'kpi-success'}"><div class="kpi-label">H1 vs H2</div><div class="kpi-value ${h2>h1?'t-red':'t-green'}">${h2>h1?'H2 Heavy':'H1 OK'}</div><div class="kpi-sub">H2=${tot27?((h2/tot27)*100).toFixed(0):'0'}%</div></div>
      <div class="kpi-card ${sum.total>0?'kpi-danger':'kpi-success'}"><div class="kpi-label">Active Violations</div><div class="kpi-value ${sum.total>0?'t-red':''}">${sum.total}</div><div class="kpi-sub">${sum.counts.HIGH} HIGH · ${sum.counts.MEDIUM} MED</div></div>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Monthly Cashflow — 2027 vs 2026</div>
        <div class="chart-wrap"><canvas id="c-monthly"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Violations by Market <small>Active only</small></div>
        <div class="chart-wrap"><canvas id="c-viol-mkt"></canvas></div>
      </div>
    </div>

    <div class="card mb20">
      <div class="section-hd" style="font-size:.88rem">Cashflow by Activity Type × Market (2027) <small>Top 7 types · Click row to open Market Review</small></div>
      <div style="overflow-x:auto">
        <table class="matrix-cf">
          <thead><tr>
            <th class="mkt-col">Market</th>
            <th class="mkt-col" style="min-width:100px">Region</th>
            ${topTypes.map((t,i)=>`<th style="background:${PALETTE[i]}" title="${t}">${t.length>18?t.slice(0,16)+'…':t}</th>`).join('')}
            <th style="background:var(--navy)">Total</th>
            <th style="background:var(--navy)">Viol.</th>
          </tr></thead>
          <tbody>
            ${markets.map(m=>{const vcount=violByMkt[m]||0;return`<tr class="mkt-matrix-row" data-market="${m}" style="cursor:pointer" title="Click to open ${m} Market Review">
              <td class="mkt-name">${m}</td>
              <td><span class="rbadge r-${getRegion(m).toLowerCase().replace(/[^a-z]/g,'').slice(0,5)}">${getRegion(m)}</span></td>
              ${topTypes.map(t=>{const v=mktMat[m]?.[t]||0;return`<td class="${cfCls(v)}">${v?fmtShort(v):''}</td>`;}).join('')}
              <td class="total-col">${fmtShort(mktMat[m]?._total||0)}</td>
              <td class="total-col ${vcount>0?'t-red':''}">${vcount>0?`<strong>${vcount}</strong>`:''}</td>
            </tr>`;}).join('')}
            <tr class="total-row">
              <td class="mkt-name" colspan="2"><strong>TOTAL</strong></td>
              ${topTypes.map(t=>`<td class="total-col"><strong>${fmtShort(typeTotRow[t]||0)}</strong></td>`).join('')}
              <td class="total-col"><strong>${fmtShort(tot27)}</strong></td>
              <td class="total-col"><strong>${sum.total}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="section-hd" style="font-size:.88rem">H2 Back-Loading Drivers — Market × Activity Type</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 40px">
        ${h2Drivers.slice(0,14).map(d=>`<div class="driver-row">
          <div class="driver-label" title="${d.market} — ${d.type}">${d.market} <span class="t-muted">·</span> ${d.type}</div>
          <div class="driver-bar-wrap"><div class="driver-bar" style="width:${(d.h2/maxH2*100).toFixed(1)}%;background:${d.h2/maxH2>.6?'var(--red)':d.h2/maxH2>.3?'var(--amber)':'var(--blue)'}"></div></div>
          <div class="driver-val">${fmtShort(d.h2)}</div>
        </div>`).join('')}
      </div>
    </div>
  `;

  // Click matrix row → Market Review
  document.querySelectorAll('.mkt-matrix-row').forEach(row=>{
    row.addEventListener('click',()=>{
      const mkt=row.dataset.market;
      document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
      document.querySelector('[data-view="market"]').classList.add('active');
      APP.activeView='market';
      destroyCharts();
      renderMarket(state,mkt);
    });
  });

  requestAnimationFrame(()=>{
    mkChart('c-monthly','bar',{labels:MONTH_LABELS,datasets:[
      {label:'2026',data:MONTH_LABELS.map(m=>cf26[m]),backgroundColor:'rgba(46,95,163,.28)',borderColor:'#2E5FA3',borderWidth:1.5,type:'bar'},
      {label:'2027',data:MONTH_LABELS.map(m=>cf27[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)},
    ]},{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});
    mkChart('c-viol-mkt','bar',{
      labels:top5viol.map(([m])=>m),
      datasets:[{label:'Violations',data:top5viol.map(([,c])=>c),backgroundColor:top5viol.map(([,c])=>c>5?'#C00000':c>2?'#D97706':'#2E5FA3')}]
    },{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});
  });
}

/* ══════════════════════════════════════════════════════════
   VIEW 2 — MARKET REVIEW
   Full per-market analysis: summary KPIs, cashflow chart,
   type breakdown, compliance checklist, 2026 vs 2027
   activity comparison table with violations inline
══════════════════════════════════════════════════════════ */
function renderMarket(state, sel){
  const A27=state.review.activities||[];
  const A26=state.baseline.activities||[];
  const markets=[...new Set(A27.map(a=>a.market).filter(Boolean))].sort();
  const mkt=sel||markets[0]||'';

  const m27=A27.filter(a=>a.market===mkt);
  const m26=A26.filter(a=>a.market===mkt);

  // Cashflow totals
  const tot27=m27.reduce((s,a)=>s+a.cashflow,0);
  const tot26=m26.reduce((s,a)=>s+a.cashflow,0);

  // Monthly
  const cf27=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  const cf26=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  m27.forEach(a=>MONTH_LABELS.forEach(m=>{cf27[m]+=a.monthly[m]||0;}));
  m26.forEach(a=>MONTH_LABELS.forEach(m=>{cf26[m]+=a.monthly[m]||0;}));
  const h1=MONTH_LABELS.slice(0,6).reduce((s,m)=>s+cf27[m],0);
  const h2=MONTH_LABELS.slice(6).reduce((s,m)=>s+cf27[m],0);

  // Type breakdown 2027
  const typeMap27={};
  m27.forEach(a=>{typeMap27[a.activityType]=(typeMap27[a.activityType]||0)+a.cashflow;});
  const typeMap26={};
  m26.forEach(a=>{typeMap26[a.activityType]=(typeMap26[a.activityType]||0)+a.cashflow;});

  // Activity comparison — match by name
  const nameMap26={};
  m26.forEach(a=>{nameMap26[a.activityName.toLowerCase().trim()]=a;});
  const nameMap27={};
  m27.forEach(a=>{nameMap27[a.activityName.toLowerCase().trim()]=a;});

  const compRows=[];
  // New in 2027
  m27.forEach(a=>{
    const k=a.activityName.toLowerCase().trim();
    const a26=nameMap26[k];
    if(!a26){
      compRows.push({status:'new',a27:a,a26:null,cfDiff:a.cashflow,changes:[]});
    } else {
      const ch=[];
      if(Math.abs(a.cashflow-a26.cashflow)>500) ch.push({field:'Cashflow',from:a26.cashflow,to:a.cashflow,diff:a.cashflow-a26.cashflow});
      if(a.priority!==a26.priority&&a.priority&&a26.priority) ch.push({field:'Priority',from:a26.priority,to:a.priority,diff:0});
      if(a.activityType!==a26.activityType) ch.push({field:'Type',from:a26.activityType,to:a.activityType,diff:0});
      if(a.locked!==a26.locked) ch.push({field:'Lock',from:a26.locked,to:a.locked,diff:0});
      compRows.push({status:ch.length?'changed':'same',a27:a,a26,cfDiff:a.cashflow-(a26.cashflow||0),changes:ch});
    }
  });
  // Removed
  m26.forEach(a=>{
    const k=a.activityName.toLowerCase().trim();
    if(!nameMap27[k]) compRows.push({status:'removed',a27:null,a26:a,cfDiff:-a.cashflow,changes:[]});
  });
  compRows.sort((a,b)=>{const ord={new:0,changed:1,removed:2,same:3};return(ord[a.status]||4)-(ord[b.status]||4);});

  const added=compRows.filter(r=>r.status==='new').length;
  const removed=compRows.filter(r=>r.status==='removed').length;
  const changed=compRows.filter(r=>r.status==='changed').length;

  // Violations for this market
  const mktViols=state.violations.filter(v=>v.market===mkt);
  const activeViols=mktViols.filter(v=>v.status!=='accepted');

  // Violations indexed by activityId for inline display
  const violByActId={};
  mktViols.forEach(v=>{
    if(v.activityId&&v.activityId!=='—'){
      if(!violByActId[v.activityId])violByActId[v.activityId]=[];
      violByActId[v.activityId].push(v);
    }
  });

  // Compliance checks
  const RAM_S=new Date(2027,1,18),RAM_E=new Date(2027,2,20);
  const ramZero=m27.filter(a=>{const d=a.startDate||a.endDate;return d&&d>=RAM_S&&d<=RAM_E&&a.cashflow===0;}).length;
  const missions=m27.filter(isMission).length;
  const noKPI=m27.filter(a=>!a.revenue&&!a.attendees&&!isJMP(a)&&!isWebinar(a)).length;
  const othersCount=m27.filter(a=>/^others$/i.test(a.activityType)).length;
  const q3JMPs=m27.filter(a=>/jmp/i.test(a.activityType)&&a.endDate&&a.endDate.getFullYear()===2027&&a.endDate.getMonth()>=6&&a.endDate.getMonth()<=8).length;
  const trainP1=m27.filter(a=>/training|workshop/i.test(`${a.activityType} ${a.activityName}`)&&a.priority===1).length;
  const lockedMod=m27.filter(a=>a.locked==='Locked'&&nameMap26[a.activityName.toLowerCase().trim()]&&Math.abs(a.cashflow-(nameMap26[a.activityName.toLowerCase().trim()]?.cashflow||0))>1000).length;

  function chk(pass,text,detail=''){
    return `<div class="check-item ${pass?'pass':'fail'}">
      <span class="check-icon">${pass?'✅':'❌'}</span>
      <div><div>${text}</div>${detail?`<div class="check-detail">${detail}</div>`:''}</div>
    </div>`;
  }

  // Type comparison table rows
  const allTypeKeys=[...new Set([...Object.keys(typeMap27),...Object.keys(typeMap26)])].sort();

  // JMP summary
  const jmps=m27.filter(isJMP);

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Market Review</div>

    <!-- Market selector -->
    <div class="market-selector mb20">
      <label>Market:</label>
      <select id="mkt-sel">
        ${markets.map(m=>`<option value="${m}"${m===mkt?' selected':''}>${m}</option>`).join('')}
      </select>
      <span class="rbadge r-${getRegion(mkt).toLowerCase().replace(/[^a-z]/g,'').slice(0,5)}">${getRegion(mkt)}</span>
      <div style="margin-left:auto;display:flex;gap:20px;font-size:.8rem">
        <span>${m27.length} activities in 2027 &nbsp;|&nbsp; ${m26.length} in 2026</span>
        <span class="${activeViols.length>0?'t-red':''}">${activeViols.length} active violation${activeViols.length!==1?'s':''}</span>
      </div>
    </div>

    <!-- KPI row -->
    <div class="grid5 mb20">
      <div class="kpi-card kpi-info"><div class="kpi-label">2027 Cashflow</div><div class="kpi-value">${fmtShort(tot27)}</div><div class="kpi-sub">AED</div></div>
      <div class="kpi-card ${tot27>tot26?'kpi-danger':'kpi-success'}"><div class="kpi-label">vs 2026</div><div class="kpi-value ${tot27>tot26?'t-red':'t-green'}">${tot27>=tot26?'+':''}${fmtShort(tot27-tot26)}</div><div class="kpi-sub">${tot26?((tot27-tot26)/tot26*100).toFixed(1)+'%':'new market'}</div></div>
      <div class="kpi-card kpi-success"><div class="kpi-label">New Activities</div><div class="kpi-value t-green">${added}</div><div class="kpi-sub">added in 2027</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-label">Removed</div><div class="kpi-value t-red">${removed}</div><div class="kpi-sub">dropped from 2026</div></div>
      <div class="kpi-card ${activeViols.length>0?'kpi-danger':'kpi-success'}"><div class="kpi-label">Violations</div><div class="kpi-value ${activeViols.length>0?'t-red':''}">${activeViols.length}</div><div class="kpi-sub">${mktViols.filter(v=>v.severity==='HIGH'&&v.status!=='accepted').length} HIGH</div></div>
    </div>

    <!-- Charts row -->
    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Monthly Cashflow — 2027 vs 2026</div>
        <div class="chart-wrap"><canvas id="c-mkt-cf"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Budget by Activity Type 2027</div>
        <div class="chart-wrap"><canvas id="c-mkt-type"></canvas></div>
      </div>
    </div>

    <!-- Compliance + Type comparison -->
    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Compliance Checklist — 2027</div>
        <div class="checklist">
          ${chk(othersCount===0,`No "Others" activity types`,othersCount>0?`${othersCount} must be reclassified`:'')}
          ${chk(h2<=h1,`H1 ≥ H2 cashflow`,`H1: ${fmtAED(h1)} | H2: ${fmtAED(h2)} (${tot27?((h2/tot27)*100).toFixed(0):'0'}%)`)}
          ${chk(q3JMPs===0,`No JMP closures in Q3`,q3JMPs>0?`${q3JMPs} JMP(s) closing Jul-Sep → payment in H2`:'')}
          ${chk(ramZero>=2,`≥ 2 Ramadan zero-budget activities`,`Found: ${ramZero}`)}
          ${chk(missions<=1,`≤ 1 sales mission`,`${missions} found`)}
          ${chk(noKPI===0,`All non-JMP activities have KPIs`,noKPI>0?`${noKPI} missing revenue + attendees`:'')}
          ${chk(trainP1===0,`No training at Priority 1`,trainP1>0?`${trainP1} training activity flagged`:'')}
          ${chk(lockedMod===0,`No locked activities modified`,lockedMod>0?`${lockedMod} locked activities have changed cashflow`:'')}
        </div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Activity Type Breakdown — 2026 vs 2027</div>
        <div class="tbl-scroll"><table class="dt">
          <thead><tr><th>Type</th><th class="th-r">2026 (AED)</th><th class="th-r">2027 (AED)</th><th class="th-r">Change</th></tr></thead>
          <tbody>
            ${allTypeKeys.filter(t=>t&&t!=='undefined').map(t=>{
              const v26=typeMap26[t]||0,v27=typeMap27[t]||0,diff=v27-v26;
              return`<tr class="${diff>50000?'row-warn':diff<-50000?'row-removed':''}">
                <td><span class="type-chip">${t}</span></td>
                <td class="td-r t-mono">${v26?fmtNum(v26):'—'}</td>
                <td class="td-r t-mono">${v27?fmtNum(v27):'—'}</td>
                <td class="td-r t-mono ${diff>0?'t-red':diff<0?'t-green':''}">${diff?((diff>=0?'+':'')+fmtNum(diff)):'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>
    </div>

    <!-- Active violations for this market -->
    ${activeViols.length>0?`
    <div class="card mb20" style="border-left:3px solid var(--red)">
      <div class="section-hd" style="font-size:.88rem">Active Violations — ${mkt} <span class="badge b-high">${activeViols.length}</span></div>
      <div class="tbl-scroll"><table class="dt">
        <thead><tr><th>Tact. ID</th><th>Sev.</th><th>Rule</th><th>Type</th><th>Activity</th><th>Detail</th><th>Status</th></tr></thead>
        <tbody>
          ${activeViols.map(v=>`<tr>
            <td class="t-muted" style="font-size:.72rem">${v.activityId}</td>
            <td><span class="badge b-${v.severity.toLowerCase()}">${v.severity}</span></td>
            <td><code style="font-size:.7rem;color:var(--blue)">${v.ruleId}</code> <span style="font-size:.7rem;color:var(--g400)">${v.ruleName}</span></td>
            <td><span class="type-chip" style="font-size:.65rem">${v.activityType}</span></td>
            <td style="font-size:.76rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.activityName}">${v.activityName}</td>
            <td style="font-size:.74rem;max-width:240px;color:var(--g700)">${v.detail}</td>
            <td><span class="badge b-low">Pending</span></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`:''}

    <!-- Activity comparison table -->
    <div class="card">
      <div class="flex-between mb16">
        <div class="section-hd" style="font-size:.88rem;margin:0;border:none">
          Activity Comparison — 2026 vs 2027
          <span style="margin-left:12px;font-size:.72rem;font-weight:400">
            <span class="badge b-new" style="margin-right:4px">●</span>New (${added})
            <span class="badge b-changed" style="margin-left:6px;margin-right:4px">●</span>Changed (${changed})
            <span class="badge b-removed" style="margin-left:6px;margin-right:4px">●</span>Removed (${removed})
          </span>
        </div>
        <div class="flex-gap">
          <button class="btn-ghost btn-sm" id="btn-show-same" onclick="toggleSameRows()">Show unchanged</button>
        </div>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt" id="comp-table">
          <thead><tr>
            <th>Status</th><th>ID</th><th>Activity Name</th><th>Type</th>
            <th class="td-c">P</th>
            <th class="th-r">2026 CF</th><th class="th-r">2027 CF</th><th class="th-r">Change</th>
            <th>Lock</th><th>Owner</th><th>Violations</th>
          </tr></thead>
          <tbody>
            ${compRows.map(row=>{
              const a=row.a27||row.a26;
              const viols=row.a27&&violByActId[row.a27.id]||[];
              const rowCls=row.status==='new'?'row-new':row.status==='removed'?'row-removed':row.status==='changed'?'row-warn':'row-same';
              const badge=row.status==='new'?'<span class="badge b-new">NEW</span>':row.status==='removed'?'<span class="badge b-removed">REMOVED</span>':row.status==='changed'?'<span class="badge b-changed">CHANGED</span>':'<span class="badge b-low" style="opacity:.5">—</span>';
              const cf26v=row.a26?.cashflow||0, cf27v=row.a27?.cashflow||0;
              return `<tr class="${rowCls}${row.status==='same'?' same-row hidden':''}">
                <td>${badge}</td>
                <td class="t-muted" style="font-size:.7rem">${a?.id||'—'}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem" title="${a?.activityName||''}">${a?.activityName||'—'}</td>
                <td><span class="type-chip" style="font-size:.62rem">${a?.activityType||'—'}</span></td>
                <td class="td-c">${a?.priority||'—'}</td>
                <td class="td-r t-mono">${cf26v?fmtNum(cf26v):'—'}</td>
                <td class="td-r t-mono">${cf27v?fmtNum(cf27v):'—'}</td>
                <td class="td-r t-mono ${row.cfDiff>0?'t-red':row.cfDiff<0?'t-green':''}">${row.cfDiff?(row.cfDiff>0?'+':'')+fmtNum(row.cfDiff):'—'}</td>
                <td>${a?.locked?`<span class="badge ${a.locked==='Locked'?'b-locked':'b-unlocked'}" style="font-size:.62rem">${a.locked}</span>`:''}</td>
                <td style="font-size:.74rem;white-space:nowrap">${a?.owner||'—'}</td>
                <td>${viols.map(v=>`<span class="badge b-${v.severity.toLowerCase()}" style="font-size:.62rem;margin-right:2px" title="${v.ruleName}">${v.ruleId}</span>`).join('')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${jmps.length>0?`
    <!-- JMP Summary -->
    <div class="card mt20">
      <div class="section-hd" style="font-size:.88rem">JMP Summary — ${mkt} <small>${jmps.length} JMPs</small></div>
      <div class="tbl-scroll"><table class="dt">
        <thead><tr><th>ID</th><th>JMP Name</th><th>Type</th><th>Start</th><th>End</th><th class="th-r">Cashflow</th><th>Lock</th><th>Notes</th></tr></thead>
        <tbody>
          ${jmps.map(a=>{
            const v=violByActId[a.id]||[];
            return`<tr class="${a.cashflow>0&&/^new jmp$/i.test(a.activityType)?'row-warn':''}">
              <td class="t-muted" style="font-size:.7rem">${a.id}</td>
              <td style="font-size:.78rem">${a.activityName}</td>
              <td><span class="type-chip" style="font-size:.62rem">${a.activityType}</span></td>
              <td>${fmtDate(a.startDate)}</td>
              <td ${a.endDate&&a.endDate.getFullYear()===2027&&a.endDate.getMonth()>=6&&a.endDate.getMonth()<=8?'class="t-amber"':''}>${fmtDate(a.endDate)}</td>
              <td class="td-r t-mono ${a.cashflow>0&&/^new jmp$/i.test(a.activityType)?'t-amber':''}">${fmtNum(a.cashflow)}</td>
              <td><span class="badge ${a.locked==='Locked'?'b-locked':'b-unlocked'}" style="font-size:.62rem">${a.locked}</span></td>
              <td>${v.map(vv=>`<span class="badge b-${vv.severity.toLowerCase()}" style="font-size:.62rem" title="${vv.detail}">${vv.ruleId}</span>`).join(' ')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>`:''}
  `;

  // Market selector
  document.getElementById('mkt-sel').addEventListener('change',e=>{destroyCharts();renderMarket(state,e.target.value);});

  // Charts
  const typeLabels=Object.keys(typeMap27).filter(t=>t&&t!=='undefined');
  const typeVals=typeLabels.map(t=>typeMap27[t]);
  requestAnimationFrame(()=>{
    mkChart('c-mkt-cf','bar',{labels:MONTH_LABELS,datasets:[
      {label:'2026',data:MONTH_LABELS.map(m=>cf26[m]),backgroundColor:'rgba(46,95,163,.28)',borderColor:'#2E5FA3',borderWidth:1.5},
      {label:'2027',data:MONTH_LABELS.map(m=>cf27[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)},
    ]},{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});
    if(typeLabels.length>0){
      mkChart('c-mkt-type','doughnut',{labels:typeLabels,datasets:[{data:typeVals,backgroundColor:PALETTE}]},{plugins:{legend:{position:'right'}}});
    }
  });
}

let showSame=false;
function toggleSameRows(){
  showSame=!showSame;
  document.querySelectorAll('.same-row').forEach(r=>{r.classList.toggle('hidden',!showSame);});
  const btn=document.getElementById('btn-show-same');
  if(btn)btn.textContent=showSame?'Hide unchanged':'Show unchanged';
}

/* ══════════════════════════════════════════════════════════
   VIEW 3 — VIOLATIONS (ACTION CENTRE)
══════════════════════════════════════════════════════════ */
function buildMS(id,label,options){
  return `<div class="ms-wrap" id="ms-${id}">
    <button class="ms-btn" onclick="toggleMS('ms-${id}')">${label}</button>
    <div class="ms-panel hidden">
      ${options.map(o=>`<label class="ms-opt"><input type="checkbox" value="${o.value||o}"> ${o.label||o}</label>`).join('')}
      <div class="ms-divider"></div>
      <div class="ms-clear" onclick="clearMS('ms-${id}','${label}')">Clear</div>
    </div>
  </div>`;
}
function toggleMS(id){
  const p=document.querySelector(`#${id} .ms-panel`);
  document.querySelectorAll('.ms-panel').forEach(x=>{if(x!==p)x.classList.add('hidden');});
  p.classList.toggle('hidden');
}
function clearMS(id,label){
  document.querySelectorAll(`#${id} input`).forEach(i=>i.checked=false);
  const b=document.querySelector(`#${id} .ms-btn`);
  b.textContent=label; b.classList.remove('active-filter');
}
function getMSVals(id){return [...document.querySelectorAll(`#${id} input:checked`)].map(i=>i.value);}
function updateMSBtn(id,label){
  const vals=getMSVals(id);
  const b=document.querySelector(`#${id} .ms-btn`);
  b.textContent=vals.length?`${label} (${vals.length})`:label;
  b.classList.toggle('active-filter',vals.length>0);
}
document.addEventListener('click',e=>{if(!e.target.closest('.ms-wrap'))document.querySelectorAll('.ms-panel').forEach(p=>p.classList.add('hidden'));});

function renderViolations(state){
  let viols=state.violations;
  let fSev=[],fRegion=[],fMkt=[],fType=[],fRule=[],fStatus=[];
  const sum=summarise(viols);

  const allRegions=[...new Set(viols.map(v=>v.region))].sort();
  const allMkts=[...new Set(viols.map(v=>v.market))].sort();
  const allTypes=[...new Set(viols.map(v=>v.activityType).filter(t=>t&&t!=='—'))].sort();
  const allRules=[...new Set(viols.map(v=>v.ruleId))].sort();

  // By activity type chart data
  const byType={};
  viols.filter(v=>v.status!=='accepted'&&v.activityType&&v.activityType!=='—').forEach(v=>{byType[v.activityType]=(byType[v.activityType]||0)+1;});

  function filtered(){
    return viols.filter(v=>{
      if(fSev.length    && !fSev.includes(v.severity))     return false;
      if(fRegion.length && !fRegion.includes(v.region))    return false;
      if(fMkt.length    && !fMkt.includes(v.market))       return false;
      if(fType.length   && !fType.includes(v.activityType))return false;
      if(fRule.length   && !fRule.includes(v.ruleId))      return false;
      if(fStatus.length && !fStatus.includes(v.status))    return false;
      return true;
    });
  }

  function renderTbl(){
    const fv=filtered();
    document.getElementById('viol-count-lbl').textContent=`${fv.length} violation${fv.length!==1?'s':''}`;
    document.getElementById('viol-tbody').innerHTML=fv.map(v=>{
      const ri=viols.indexOf(v);
      const stCls=v.status==='accepted'?'s-accepted':v.status==='action-required'?'s-action':'';
      return `<tr style="${v.status==='accepted'?'opacity:.42':''}">
        <td class="t-muted" style="font-size:.7rem;white-space:nowrap">${v.activityId}</td>
        <td><span class="badge b-${v.severity.toLowerCase()}">${v.severity}</span></td>
        <td><code style="font-size:.7rem;color:var(--blue);white-space:nowrap">${v.ruleId}</code></td>
        <td style="font-size:.75rem">${v.ruleName}</td>
        <td><span class="type-chip" style="font-size:.64rem">${v.activityType}</span></td>
        <td style="font-size:.74rem"><span class="rbadge r-${(v.region||'').toLowerCase().replace(/[^a-z]/g,'').slice(0,5)}">${v.region}</span> ${v.market}</td>
        <td style="font-size:.76rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.activityName}">${v.activityName}</td>
        <td style="font-size:.73rem;max-width:260px;color:var(--g700)">${v.detail}</td>
        <td>
          <select class="status-sel ${stCls}" data-idx="${ri}" onchange="onStatusChange(this)">
            <option value="pending" ${v.status==='pending'?'selected':''}>— Pending —</option>
            <option value="accepted" ${v.status==='accepted'?'selected':''}>✓ Accepted</option>
            <option value="action-required" ${v.status==='action-required'?'selected':''}>⚠ Action Required</option>
          </select>
        </td>
        <td>
          <input class="comment-inp ${v.status==='action-required'&&!v.comment?'inp-required':''}"
            placeholder="${v.status==='action-required'?'What needs to change…':'Add note…'}"
            data-idx="${ri}" value="${v.comment||''}"
            oninput="onCommentInput(this)">
        </td>
      </tr>`;
    }).join('')||`<tr><td colspan="10" style="text-align:center;padding:28px;color:var(--g400)">No violations match the selected filters.</td></tr>`;
  }

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Rule Violations — Action Centre</div>

    <div class="grid5 mb20">
      <div class="kpi-card kpi-danger"><div class="kpi-label">HIGH</div><div class="kpi-value t-red">${sum.counts.HIGH}</div><div class="kpi-sub">active violations</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">MEDIUM</div><div class="kpi-value" style="color:var(--amber)">${sum.counts.MEDIUM}</div><div class="kpi-sub">active violations</div></div>
      <div class="kpi-card kpi-info"><div class="kpi-label">LOW</div><div class="kpi-value">${sum.counts.LOW}</div><div class="kpi-sub">active violations</div></div>
      <div class="kpi-card kpi-success"><div class="kpi-label">Accepted</div><div class="kpi-value t-green">${viols.filter(v=>v.status==='accepted').length}</div><div class="kpi-sub">justified & closed</div></div>
      <div class="kpi-card"><div class="kpi-label">Action Required</div><div class="kpi-value t-amber">${viols.filter(v=>v.status==='action-required').length}</div><div class="kpi-sub">needs change</div></div>
    </div>

    <div class="grid3 mb20">
      <div class="card"><div class="section-hd" style="font-size:.88rem">By Market</div><div class="chart-wrap-sm"><canvas id="c-v-mkt"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.88rem">By Rule</div><div class="chart-wrap-sm"><canvas id="c-v-rule"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.88rem">By Activity Type</div><div class="chart-wrap-sm"><canvas id="c-v-type"></canvas></div></div>
    </div>

    <div class="card">
      <div class="flex-between mb16">
        <div class="flex-gap">
          <span class="section-hd" style="font-size:.88rem;margin:0;border:none">All Violations</span>
          <span id="viol-count-lbl" class="t-muted" style="font-size:.78rem"></span>
        </div>
        <div class="flex-gap" style="flex-wrap:wrap">
          ${buildMS('sev','Severity',['HIGH','MEDIUM','LOW'])}
          ${buildMS('region','Region',allRegions)}
          ${buildMS('mkt','Market',allMkts)}
          ${buildMS('type','Activity Type',allTypes)}
          ${buildMS('rule','Rule',allRules.map(r=>({value:r,label:`${r} — ${RULE_META[r]?.name?.slice(0,22)||r}`})))}
          ${buildMS('status','Status',[{value:'pending',label:'Pending'},{value:'accepted',label:'Accepted'},{value:'action-required',label:'Action Required'}])}
          <button class="btn-export" id="btn-xl">⬇ Excel</button>
          <button class="btn-secondary" id="btn-csv">⬇ CSV</button>
        </div>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Tact.ID</th><th>Sev.</th><th>Rule</th><th>Rule Name</th>
            <th>Type</th><th>Region / Market</th>
            <th>Activity</th><th>Detail</th>
            <th style="min-width:140px">Status</th>
            <th style="min-width:200px">What Needs to Change</th>
          </tr></thead>
          <tbody id="viol-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderTbl();

  function bindMS(msId,arr,label){
    document.querySelector(`#ms-${msId} .ms-panel`).addEventListener('change',()=>{
      arr.length=0; getMSVals(`ms-${msId}`).forEach(v=>arr.push(v));
      updateMSBtn(`ms-${msId}`,label); renderTbl();
    });
  }
  bindMS('sev',fSev,'Severity'); bindMS('region',fRegion,'Region'); bindMS('mkt',fMkt,'Market');
  bindMS('type',fType,'Activity Type'); bindMS('rule',fRule,'Rule'); bindMS('status',fStatus,'Status');

  document.getElementById('btn-xl').addEventListener('click',()=>exportViolationsToExcel(viols));
  document.getElementById('btn-csv').addEventListener('click',()=>exportViolationsToCSV(viols));

  requestAnimationFrame(()=>{
    const top8=sum.topMarkets.slice(0,8);
    mkChart('c-v-mkt','bar',{labels:top8.map(m=>m.market),datasets:[{label:'Violations',data:top8.map(m=>m.count),backgroundColor:'#C00000'}]},{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});
    const byRule={};viols.filter(v=>v.status!=='accepted').forEach(v=>{byRule[v.ruleId]=(byRule[v.ruleId]||0)+1;});
    const topR=Object.entries(byRule).sort((a,b)=>b[1]-a[1]).slice(0,8);
    mkChart('c-v-rule','bar',{labels:topR.map(([r])=>r),datasets:[{label:'Count',data:topR.map(([,c])=>c),backgroundColor:topR.map(([r])=>RULE_META[r]?.severity==='HIGH'?'#C00000':RULE_META[r]?.severity==='MEDIUM'?'#D97706':'#8D94A6')}]},{plugins:{legend:{display:false}},scales:{y:{ticks:{stepSize:1}}}});
    const typeE=Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,10);
    mkChart('c-v-type','bar',{labels:typeE.map(([t])=>t.length>20?t.slice(0,18)+'…':t),datasets:[{label:'Count',data:typeE.map(([,c])=>c),backgroundColor:'#2E5FA3'}]},{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});
  });
}

// Global handlers for status/comment changes
function onStatusChange(el){
  const idx=el.dataset.idx;
  APP.violations[idx].status=el.value;
  el.className='status-sel'+(el.value==='accepted'?' s-accepted':el.value==='action-required'?' s-action':'');
  el.closest('tr').style.opacity=el.value==='accepted'?'.42':'1';
  const cinp=el.closest('tr').querySelector('.comment-inp');
  if(cinp){cinp.placeholder=el.value==='action-required'?'What needs to change…':'Add note…';cinp.classList.toggle('inp-required',el.value==='action-required'&&!cinp.value);}
  const cnt=APP.violations.filter(v=>v.status!=='accepted').length;
  const el2=document.getElementById('nav-viol-count');if(el2)el2.textContent=cnt;
  const sp=document.getElementById('sev-pills');
  if(sp){const s=summarise(APP.violations);sp.innerHTML=`<div class="sev-pill high">${s.counts.HIGH} HIGH</div><div class="sev-pill medium">${s.counts.MEDIUM} MED</div><div class="sev-pill low">${s.counts.LOW} LOW</div>`;}
}
function onCommentInput(el){
  APP.violations[el.dataset.idx].comment=el.value;
  el.classList.toggle('inp-required',APP.violations[el.dataset.idx].status==='action-required'&&!el.value);
}

function fmtShort(n){if(!n||n===0)return'0';const a=Math.abs(n);if(a>=1e6)return(n/1e6).toFixed(1)+'M';if(a>=1e3)return(n/1e3).toFixed(0)+'K';return Math.round(n).toString();}

/* ══════════════════════════════════════════════════════════
   VIEW — ANNUAL CALENDAR 2027
   12-month grid per market. Shows activity count per month,
   colour-coded by intensity. Flags conflicts (overlapping
   activities of same type in same market). Multi-select
   filter for region + market.
══════════════════════════════════════════════════════════ */
function renderCalendar(state) {
  const acts = state.review.activities || [];
  const allMarkets = [...new Set(acts.map(a => a.market).filter(Boolean))].sort();
  const allRegions = [...new Set(allMarkets.map(m => getRegion(m)))].filter(r => r !== 'Other').sort();

  // Selected filters (stored on element dataset)
  let selRegions = [], selMarkets = [];

  function getFilteredMarkets() {
    if (selMarkets.length) return selMarkets;
    if (selRegions.length) return allMarkets.filter(m => selRegions.includes(getRegion(m)));
    return allMarkets;
  }

  // Month index map
  const MONTH_IDX = {};
  MONTH_LABELS.forEach((m, i) => { MONTH_IDX[m] = i; });

  // For each market+month: list of activities active in that month
  function getActsInMonth(market, monthIdx) {
    return acts.filter(a => {
      if (a.market !== market) return false;
      if (!a.startDate && !a.endDate) {
        // Use cashflow month
        const cf_month = MONTH_LABELS.findIndex(m => (a.monthly[m] || 0) > 0);
        return cf_month === monthIdx;
      }
      const s = a.startDate ? a.startDate.getMonth() : monthIdx;
      const e = a.endDate   ? a.endDate.getMonth()   : monthIdx;
      return monthIdx >= s && monthIdx <= e;
    });
  }

  // Conflict detection: same market, same type, overlapping months
  function getConflicts(market) {
    const conflicts = [];
    const mActs = acts.filter(a => a.market === market && a.startDate && a.endDate);
    for (let i = 0; i < mActs.length; i++) {
      for (let j = i + 1; j < mActs.length; j++) {
        const a = mActs[i], b = mActs[j];
        if (a.activityType !== b.activityType) continue;
        const overlap = a.startDate <= b.endDate && b.startDate <= a.endDate;
        if (overlap) conflicts.push({ a, b });
      }
    }
    return conflicts;
  }

  function renderGrid() {
    const markets = getFilteredMarkets();
    const conflicts = {};
    markets.forEach(m => { const c = getConflicts(m); if (c.length) conflicts[m] = c; });

    return `
      <div style="overflow-x:auto">
        <table class="cal-table">
          <thead>
            <tr>
              <th class="cal-mkt-col">Market</th>
              <th class="cal-mkt-col">Region</th>
              ${MONTH_LABELS.map((m,i) => `<th class="${i>=9?'cal-q4-hd':i>=6?'cal-q3-hd':i>=3?'cal-q2-hd':'cal-q1-hd'}">${m}</th>`).join('')}
              <th>Total</th>
              <th>Conflicts</th>
            </tr>
            <tr class="cal-q-row">
              <th colspan="2"></th>
              <th colspan="3" class="cal-q1-hd">Q1</th>
              <th colspan="3" class="cal-q2-hd">Q2</th>
              <th colspan="3" class="cal-q3-hd">Q3</th>
              <th colspan="3" class="cal-q4-hd">Q4 ⚠</th>
              <th colspan="2"></th>
            </tr>
          </thead>
          <tbody>
            ${markets.map(mkt => {
              const mActs = acts.filter(a => a.market === mkt);
              const total = mActs.length;
              const cflicts = conflicts[mkt] || [];
              const q4Acts = mActs.filter(a => a.startDate && a.startDate.getMonth() >= 9);
              return `<tr class="cal-row${cflicts.length ? ' cal-has-conflict' : ''}" data-market="${mkt}">
                <td class="cal-mkt-cell">
                  <span class="cal-mkt-name" onclick="calExpandMarket('${mkt}')">${mkt}</span>
                </td>
                <td><span class="rbadge r-${getRegion(mkt).toLowerCase().replace(/[^a-z]/g,'').slice(0,5)}">${getRegion(mkt)}</span></td>
                ${MONTH_LABELS.map((mo, idx) => {
                  const monthActs = getActsInMonth(mkt, idx);
                  const n = monthActs.length;
                  const hasQ4 = idx >= 9;
                  const cls = n === 0 ? 'cal-0' : n <= 2 ? 'cal-1' : n <= 5 ? 'cal-2' : n <= 10 ? 'cal-3' : 'cal-4';
                  const q4warn = hasQ4 && n > 0 ? ' cal-q4-warn' : '';
                  const types = [...new Set(monthActs.map(a => a.activityType))].slice(0,3).join(', ');
                  return `<td class="cal-cell ${cls}${q4warn}" title="${mkt} ${mo}: ${n} activit${n!==1?'ies':'y'}${types?'\n'+types:''}" onclick="calShowMonth('${mkt}','${mo}',${idx})">${n > 0 ? n : ''}</td>`;
                }).join('')}
                <td class="cal-total-cell">${total}</td>
                <td class="cal-conflict-cell ${cflicts.length > 0 ? 't-red' : ''}">${cflicts.length > 0 ? `<span class="badge b-high" style="cursor:pointer" onclick="calShowConflicts('${mkt}')">${cflicts.length}</span>` : '—'}</td>
              </tr>
              <tr class="cal-detail-row hidden" id="cal-detail-${mkt.replace(/\s+/g,'_')}">
                <td colspan="16" style="padding:0">
                  <div class="cal-detail-inner" id="cal-detail-inner-${mkt.replace(/\s+/g,'_')}"></div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${Object.keys(conflicts).length > 0 ? `
      <div class="card mt20">
        <div class="section-hd" style="font-size:.88rem">⚠ Scheduling Conflicts — Same Type, Same Market, Overlapping Dates</div>
        ${Object.entries(conflicts).map(([mkt, cflicts]) => `
          <div style="margin-bottom:12px">
            <strong>${mkt}</strong> — ${cflicts.length} conflict${cflicts.length>1?'s':''}
            <div class="tbl-scroll mt16">
              <table class="dt">
                <thead><tr><th>Type</th><th>Activity A</th><th>Activity B</th><th>Overlap Period</th></tr></thead>
                <tbody>
                  ${cflicts.map(c => {
                    const overlapStart = c.a.startDate > c.b.startDate ? c.a.startDate : c.b.startDate;
                    const overlapEnd   = c.a.endDate   < c.b.endDate   ? c.a.endDate   : c.b.endDate;
                    return `<tr class="row-flag">
                      <td><span class="type-chip">${c.a.activityType}</span></td>
                      <td style="font-size:.77rem">${c.a.activityName}</td>
                      <td style="font-size:.77rem">${c.b.activityName}</td>
                      <td style="font-size:.75rem">${fmtDate(overlapStart)} → ${fmtDate(overlapEnd)}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>` : ''}
    `;
  }

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Annual Calendar — 2027 Activities</div>

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:12px 16px;background:white;border:1px solid var(--g200);border-radius:var(--r-md);flex-wrap:wrap">
      <span class="flt-label">Filter:</span>
      ${buildMS('cal-reg','Region',allRegions)}
      ${buildMS('cal-mkt','Market',allMarkets)}
      <button class="btn-ghost btn-sm" onclick="clearCalFilters()">Reset</button>
      <div style="margin-left:auto;display:flex;gap:16px;font-size:.78rem;align-items:center">
        <span>Intensity: </span>
        <span class="cal-1" style="padding:3px 10px;border-radius:4px">1-2</span>
        <span class="cal-2" style="padding:3px 10px;border-radius:4px">3-5</span>
        <span class="cal-3" style="padding:3px 10px;border-radius:4px">6-10</span>
        <span class="cal-4" style="padding:3px 10px;border-radius:4px">11+</span>
        <span class="cal-q4-warn" style="padding:3px 10px;border-radius:4px">Q4 Activity</span>
      </div>
    </div>

    <div class="card mb20" id="cal-grid-wrap">
      ${renderGrid()}
    </div>
  `;

  // Bind multi-select filters
  function bindCalMS(msId, arr, label) {
    document.querySelector(`#ms-${msId} .ms-panel`).addEventListener('change', () => {
      arr.length = 0;
      getMSVals(`ms-${msId}`).forEach(v => arr.push(v));
      updateMSBtn(`ms-${msId}`, label);
      document.getElementById('cal-grid-wrap').innerHTML = renderGrid();
    });
  }
  bindCalMS('cal-reg', selRegions, 'Region');
  bindCalMS('cal-mkt', selMarkets, 'Market');

  window.clearCalFilters = () => {
    selRegions.length = 0; selMarkets.length = 0;
    clearMS('ms-cal-reg', 'Region'); clearMS('ms-cal-mkt', 'Market');
    document.getElementById('cal-grid-wrap').innerHTML = renderGrid();
  };

  window.calShowMonth = (mkt, mo, idx) => {
    const safeId = mkt.replace(/\s+/g,'_');
    const detRow = document.getElementById(`cal-detail-${safeId}`);
    const detInner = document.getElementById(`cal-detail-inner-${safeId}`);
    if (!detRow || !detInner) return;
    const monthActs = getActsInMonth(mkt, idx);
    if (detRow.classList.contains('hidden') || detInner.dataset.month !== mo) {
      detInner.dataset.month = mo;
      detInner.innerHTML = monthActs.length ? `
        <table class="dt" style="border-radius:0">
          <thead><tr><th>ID</th><th>${mo} Activities in ${mkt}</th><th>Type</th><th class="td-c">P</th><th>Start</th><th>End</th><th class="th-r">Cashflow</th><th>Owner</th></tr></thead>
          <tbody>
            ${monthActs.map(a => `<tr>
              <td class="t-muted" style="font-size:.7rem">${a.id||'—'}</td>
              <td style="font-size:.78rem">${a.activityName}</td>
              <td><span class="type-chip" style="font-size:.62rem">${a.activityType}</span></td>
              <td class="td-c">${a.priority||'—'}</td>
              <td>${fmtDate(a.startDate)}</td>
              <td class="${a.endDate&&a.endDate.getMonth()>=9?'t-amber':''}">${fmtDate(a.endDate)}</td>
              <td class="td-r t-mono">${fmtNum(a.cashflow)}</td>
              <td style="font-size:.75rem">${a.owner||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : `<div style="padding:16px;color:var(--g400);font-size:.82rem">No activities in ${mo} for ${mkt}.</div>`;
      detRow.classList.remove('hidden');
    } else {
      detRow.classList.add('hidden');
    }
  };

  window.calExpandMarket = (mkt) => {
    // Show full year breakdown for market
    const safeId = mkt.replace(/\s+/g,'_');
    const detRow = document.getElementById(`cal-detail-${safeId}`);
    const detInner = document.getElementById(`cal-detail-inner-${safeId}`);
    if (!detRow || !detInner) return;
    if (!detRow.classList.contains('hidden') && detInner.dataset.month === 'all') {
      detRow.classList.add('hidden'); return;
    }
    const mActs = acts.filter(a => a.market === mkt).sort((a,b) => (a.startDate||new Date(0)) - (b.startDate||new Date(0)));
    detInner.dataset.month = 'all';
    detInner.innerHTML = `
      <table class="dt" style="border-radius:0">
        <thead><tr><th>ID</th><th>Activity Name</th><th>Type</th><th class="td-c">P</th><th>Start</th><th>End</th><th class="th-r">Cashflow</th><th>Lock</th><th>Owner</th></tr></thead>
        <tbody>
          ${mActs.map(a => `<tr class="${a.startDate&&a.startDate.getMonth()>=9?'row-warn':''}">
            <td class="t-muted" style="font-size:.7rem">${a.id||'—'}</td>
            <td style="font-size:.78rem">${a.activityName}</td>
            <td><span class="type-chip" style="font-size:.62rem">${a.activityType}</span></td>
            <td class="td-c">${a.priority||'—'}</td>
            <td>${fmtDate(a.startDate)}</td>
            <td class="${a.endDate&&a.endDate.getMonth()>=9?'t-amber':''}">${fmtDate(a.endDate)}</td>
            <td class="td-r t-mono">${fmtNum(a.cashflow)}</td>
            <td><span class="badge ${a.locked==='Locked'?'b-locked':'b-unlocked'}" style="font-size:.62rem">${a.locked}</span></td>
            <td style="font-size:.75rem">${a.owner||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    detRow.classList.remove('hidden');
  };

  window.calShowConflicts = (mkt) => calExpandMarket(mkt);
}

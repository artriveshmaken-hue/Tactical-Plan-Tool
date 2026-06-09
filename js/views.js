/* views.js — 6 views: Overview → Portfolio → Market → Calendar → Violations → Rules */

const Charts = {};
function destroyCharts(){Object.values(Charts).forEach(c=>{try{c.destroy();}catch(e){}});Object.keys(Charts).forEach(k=>delete Charts[k]);}
function mkChart(id,type,data,opts){const el=document.getElementById(id);if(!el)return;if(Charts[id])try{Charts[id].destroy();}catch(e){}Charts[id]=new Chart(el,{type,data,options:opts||{}});}

const QCOLS={Q1:'#2E5FA3',Q2:'#4A80C8',Q3:'#C8A755',Q4:'#C00000'};
const PAL=['#1F3864','#2E5FA3','#C00000','#C8A755','#15803D','#7C3AED','#0891B2','#D97706','#DB2777','#65A30D','#4A80C8','#6B7280','#EC4899','#F59E0B','#10B981'];

// ── Shared helpers ────────────────────────────────────────
function tierBadge(t){
  const cls=t===1?'tier-1':t===2?'tier-2':'tier-3';
  const lbl=t===1?'T1 Priority':t===2?'T2 Growth':'T3 Emerging';
  return `<span class="tier-badge ${cls}">${lbl}</span>`;
}
function regionBadge(r){
  const s=r.toLowerCase().replace(/[^a-z]/g,'').slice(0,5);
  return `<span class="rbadge r-${s}">${r}</span>`;
}
function typChip(t){ return `<span class="type-chip">${t||'—'}</span>`; }

// Multi-select
function buildMS(id,label,options){
  return `<div class="ms-wrap" id="ms-${id}">
    <button class="ms-btn" onclick="toggleMS('ms-${id}')">${label}</button>
    <div class="ms-panel hidden">
      ${options.map(o=>`<label class="ms-opt"><input type="checkbox" value="${o.value||o}"> ${o.label||o}</label>`).join('')}
      <div class="ms-divider"></div><div class="ms-clear" onclick="clearMS('ms-${id}','${label}')">Clear</div>
    </div></div>`;
}
function toggleMS(id){const p=document.querySelector(`#${id} .ms-panel`);document.querySelectorAll('.ms-panel').forEach(x=>{if(x!==p)x.classList.add('hidden');});p.classList.toggle('hidden');}
function clearMS(id,label){document.querySelectorAll(`#${id} input`).forEach(i=>i.checked=false);const b=document.querySelector(`#${id} .ms-btn`);b.textContent=label;b.classList.remove('active-filter');}
function getMSVals(id){return[...document.querySelectorAll(`#${id} input:checked`)].map(i=>i.value);}
function updateMSBtn(id,label){const vals=getMSVals(id);const b=document.querySelector(`#${id} .ms-btn`);b.textContent=vals.length?`${label} (${vals.length})`:label;b.classList.toggle('active-filter',vals.length>0);}
document.addEventListener('click',e=>{if(!e.target.closest('.ms-wrap'))document.querySelectorAll('.ms-panel').forEach(p=>p.classList.add('hidden'));});

// ── Activity bucketing ────────────────────────────────────
function getTypeBucket(atype){
  if (isJMP({activityType:atype})) return 'JMP';
  if (TRADE_PROMO_TYPES.has(atype)) return 'Trade Promotion';
  return atype;
}

// ══════════════════════════════════════════════════════════
// VIEW 1 — OVERVIEW: Global Picture
// ══════════════════════════════════════════════════════════
function renderOverview(state){
  const {acts, violations, baseline, review} = state;
  const a26 = baseline.activities||[];
  const a27 = review.activities||[];

  const tot27=acts.reduce((s,a)=>s+a.cashflow,0);
  const tot26=a26.reduce((s,a)=>s+a.cashflow,0);

  const cf27=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  const cf26=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  acts.forEach(a=>MONTH_LABELS.forEach(m=>{cf27[m]+=a.monthly[m]||0;}));
  a26.forEach(a=>MONTH_LABELS.forEach(m=>{cf26[m]+=a.monthly[m]||0;}));

  const sum=summarise(violations);
  const q4=acts.reduce((s,a)=>s+(a.monthly.Oct||0)+(a.monthly.Nov||0)+(a.monthly.Dec||0),0);
  const q4pct=tot27?(q4/tot27*100).toFixed(0):0;
  const jmpCF=acts.filter(a=>isJMP(a)).reduce((s,a)=>s+a.cashflow,0);
  const jmpPct=tot27?(jmpCF/tot27*100).toFixed(0):0;
  const t1CF=acts.filter(a=>getTier(a.market)===1).reduce((s,a)=>s+a.cashflow,0);
  const t2CF=acts.filter(a=>getTier(a.market)===2).reduce((s,a)=>s+a.cashflow,0);

  // Markets by violation count
  const violByMkt={};
  violations.filter(v=>v.status!=='accepted').forEach(v=>{violByMkt[v.market]=(violByMkt[v.market]||0)+1;});
  const topViolMkts=Object.entries(violByMkt).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Activity type composition
  const typeMap={};
  acts.forEach(a=>{typeMap[a.activityType]=(typeMap[a.activityType]||0)+a.cashflow;});
  const typeSort=Object.entries(typeMap).sort((a,b)=>b[1]-a[1]);

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Global Overview — 2027 vs 2026 <small>The big picture before diving deeper</small></div>

    <!-- Health scorecard -->
    <div class="scorecard-row mb20">
      <div class="score-card ${q4pct>30?'score-warn':'score-ok'}">
        <div class="score-icon">${q4pct>30?'⚠':'✓'}</div>
        <div class="score-label">Q4 Concentration</div>
        <div class="score-val">${q4pct}%</div>
        <div class="score-sub">${q4pct>30?'Above 30% threshold':'Within limit'}</div>
      </div>
      <div class="score-card ${jmpPct<40?'score-warn':'score-ok'}">
        <div class="score-icon">${jmpPct<40?'⚠':'✓'}</div>
        <div class="score-label">JMP Dominance</div>
        <div class="score-val">${jmpPct}%</div>
        <div class="score-sub">${jmpPct<40?'JMP share is low':'JMP is largest bucket'}</div>
      </div>
      <div class="score-card ${sum.counts.HIGH>10?'score-bad':sum.counts.HIGH>5?'score-warn':'score-ok'}">
        <div class="score-icon">${sum.counts.HIGH>5?'⚠':'✓'}</div>
        <div class="score-label">HIGH Violations</div>
        <div class="score-val">${sum.counts.HIGH}</div>
        <div class="score-sub">${sum.total} total active</div>
      </div>
      <div class="score-card score-info">
        <div class="score-icon">◫</div>
        <div class="score-label">Tier 1 / Tier 2 Split</div>
        <div class="score-val">${tot27?(t1CF/tot27*100).toFixed(0):0}% / ${tot27?(t2CF/tot27*100).toFixed(0):0}%</div>
        <div class="score-sub">${fmtShort(t1CF)} vs ${fmtShort(t2CF)}</div>
      </div>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Monthly Cashflow — 2027 vs 2026</div>
        <div class="chart-wrap"><canvas id="c-monthly"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Violations by Market <small>Active only — click to drill in</small></div>
        <div class="chart-wrap"><canvas id="c-viol-mkt"></canvas></div>
      </div>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Budget by Activity Type 2027 <small>% of total</small></div>
        <div style="display:flex;align-items:center;gap:20px">
          <div class="chart-wrap-sm" style="width:180px;flex-shrink:0"><canvas id="c-type-donut"></canvas></div>
          <div style="flex:1">
            ${typeSort.slice(0,8).map(([t,v],i)=>`
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:.76rem">
                <span style="width:10px;height:10px;border-radius:50%;background:${PAL[i]};flex-shrink:0"></span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t}</span>
                <span style="font-variant-numeric:tabular-nums">${fmtShort(v)}</span>
                <span class="t-muted">${tot27?(v/tot27*100).toFixed(1):'0'}%</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Markets Needing Attention</div>
        <div class="tbl-scroll"><table class="dt">
          <thead><tr><th>Market</th><th>Tier</th><th class="th-r">Violations</th><th class="th-r">2027 Budget</th><th class="th-r">vs 2026</th></tr></thead>
          <tbody>
            ${topViolMkts.map(([mkt,vc])=>{
              const mCF27=acts.filter(a=>a.market===mkt).reduce((s,a)=>s+a.cashflow,0);
              const mCF26=a26.filter(a=>a.market===mkt).reduce((s,a)=>s+a.cashflow,0);
              const chg=mCF27-mCF26;
              return`<tr class="clickable-mkt" onclick="jumpToMarket('${mkt}')" style="cursor:pointer">
                <td><strong>${mkt}</strong></td>
                <td>${tierBadge(getTier(mkt))}</td>
                <td class="td-r"><span class="badge b-high">${vc}</span></td>
                <td class="td-r t-mono">${fmtShort(mCF27)}</td>
                <td class="td-r t-mono ${chg>0?'t-red':'t-green'}">${chg>=0?'+':''}${fmtShort(chg)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
        <div style="font-size:.72rem;color:var(--g400);margin-top:8px;text-align:right">Click any row to open Market Review →</div>
      </div>
    </div>
  `;

  // Jump to market from overview
  window.jumpToMarket = (mkt) => {
    APP.activeView='market';
    document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
    document.querySelector('[data-view="market"]').classList.add('active');
    destroyCharts();
    const enriched={...state,acts:applyGlobalFilters(state.review.activities||[])};
    renderMarket(enriched, mkt);
  };

  requestAnimationFrame(()=>{
    mkChart('c-monthly','bar',{labels:MONTH_LABELS,datasets:[
      {label:'2026',data:MONTH_LABELS.map(m=>cf26[m]),backgroundColor:'rgba(46,95,163,.28)',borderColor:'#2E5FA3',borderWidth:1.5},
      {label:'2027',data:MONTH_LABELS.map(m=>cf27[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)},
    ]},{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});

    mkChart('c-viol-mkt','bar',{
      labels:topViolMkts.map(([m])=>m),
      datasets:[{label:'Violations',data:topViolMkts.map(([,c])=>c),backgroundColor:topViolMkts.map(([,c])=>c>10?'#C00000':c>5?'#D97706':'#2E5FA3')}]
    },{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});

    mkChart('c-type-donut','doughnut',{
      labels:typeSort.slice(0,8).map(([t])=>t),
      datasets:[{data:typeSort.slice(0,8).map(([,v])=>v),backgroundColor:PAL}]
    },{plugins:{legend:{display:false}},cutout:'65%'});
  });
}

// ══════════════════════════════════════════════════════════
// VIEW 2 — PORTFOLIO: Structure, Benchmarks, Outliers
// ══════════════════════════════════════════════════════════
function renderPortfolio(state){
  const {acts, violations, baseline} = state;
  const a26 = baseline.activities||[];
  const tot27=acts.reduce((s,a)=>s+a.cashflow,0);
  const tot26=a26.reduce((s,a)=>s+a.cashflow,0);

  // Activity type breakdown with/without JMPs
  const typeMap27={}, typeMap26={};
  acts.forEach(a=>{typeMap27[a.activityType]=(typeMap27[a.activityType]||0)+a.cashflow;});
  a26.forEach(a=>{typeMap26[a.activityType]=(typeMap26[a.activityType]||0)+a.cashflow;});

  const allTypes=[...new Set([...Object.keys(typeMap27),...Object.keys(typeMap26)])].sort((a,b)=>(typeMap27[b]||0)-(typeMap27[a]||0));
  const noJMPTotal=Object.entries(typeMap27).filter(([t])=>!isJMP({activityType:t})).reduce((s,[,v])=>s+v,0);

  // Tier split
  const t1CF=acts.filter(a=>getTier(a.market)===1).reduce((s,a)=>s+a.cashflow,0);
  const t2CF=acts.filter(a=>getTier(a.market)===2).reduce((s,a)=>s+a.cashflow,0);
  const t1_26=a26.filter(a=>getTier(a.market)===1).reduce((s,a)=>s+a.cashflow,0);
  const t2_26=a26.filter(a=>getTier(a.market)===2).reduce((s,a)=>s+a.cashflow,0);

  // JMP dominance — markets where JMP is NOT the largest type
  const markets=[...new Set(acts.map(a=>a.market))].filter(m=>getTier(m)<=2);
  const jmpDomIssues=[];
  markets.forEach(mkt=>{
    const mActs=acts.filter(a=>a.market===mkt);
    const hasJMP=mActs.some(a=>isJMP(a));
    if (!hasJMP) return;
    const byType={};
    mActs.forEach(a=>{byType[a.activityType]=(byType[a.activityType]||0)+a.cashflow;});
    const sorted=Object.entries(byType).sort((a,b)=>b[1]-a[1]);
    if (sorted.length>0 && !isJMP({activityType:sorted[0][0]})) {
      const jmpCF=Object.entries(byType).filter(([t])=>isJMP({activityType:t})).reduce((s,[,v])=>s+v,0);
      jmpDomIssues.push({mkt,topType:sorted[0][0],topCF:sorted[0][1],jmpCF});
    }
  });

  // Cost efficiency outliers from violations
  const outlierViols=violations.filter(v=>v.ruleId==='B.1'&&v.status!=='accepted');

  // VS Review metrics per market
  const vsMetrics=[];
  markets.forEach(mkt=>{
    const mActs=acts.filter(a=>a.market===mkt);
    const totalCF=mActs.reduce((s,a)=>s+a.cashflow,0);
    if (!totalCF) return;
    const gsaCF=mActs.filter(a=>isGSA(a)).reduce((s,a)=>s+a.cashflow,0);
    const famActs=mActs.filter(a=>isFAM(a));
    const famCF=famActs.reduce((s,a)=>s+a.cashflow,0);
    const famAtt=famActs.reduce((s,a)=>s+(a.attendees||0),0);
    const exhActs=mActs.filter(a=>isExhibition(a));
    const exhCF=exhActs.reduce((s,a)=>s+a.cashflow,0);
    const exhRev=exhActs.reduce((s,a)=>s+(a.revenue||0),0);
    vsMetrics.push({
      mkt,
      gsaPct:gsaCF?((gsaCF/totalCF)*100).toFixed(1):null,
      famCPA:famCF&&famAtt?Math.round(famCF/famAtt):null,
      exhRatio:exhCF&&exhRev?(exhCF/exhRev).toFixed(2):null,
      tier:getTier(mkt),
    });
  });
  vsMetrics.sort((a,b)=>a.tier-b.tier||(a.mkt>b.mkt?1:-1));

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Portfolio Analysis — Structure, Efficiency & Benchmarks</div>

    <!-- Tier split -->
    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Tier 1 vs Tier 2 — Budget Split</div>
        <div class="chart-wrap"><canvas id="c-tier-bar"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Activity Type — % of Budget <small>Toggle below</small></div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="tab-toggle active" id="tog-with" onclick="toggleTypeView('with')">With JMPs</button>
          <button class="tab-toggle" id="tog-without" onclick="toggleTypeView('without')">Without JMPs</button>
        </div>
        <div class="chart-wrap" id="type-chart-wrap"><canvas id="c-type-pct"></canvas></div>
      </div>
    </div>

    <!-- Activity breakdown table -->
    <div class="card mb20">
      <div class="section-hd" style="font-size:.88rem">Budget by Activity Type — 2026 vs 2027 with % <small>All types</small></div>
      <div class="tbl-scroll"><table class="dt">
        <thead><tr>
          <th>Activity Type</th>
          <th class="th-r">2026 (AED)</th><th class="th-r">2026 %</th>
          <th class="th-r">2027 (AED)</th><th class="th-r">2027 %</th>
          <th class="th-r">Change</th><th class="th-r">Change %</th>
          <th class="th-r">2027 % (ex-JMP)</th>
        </tr></thead>
        <tbody>
          ${allTypes.filter(t=>t&&t!=='undefined').map((t,i)=>{
            const v26=typeMap26[t]||0, v27=typeMap27[t]||0, diff=v27-v26;
            const pct27excl=!isJMP({activityType:t})&&noJMPTotal?(v27/noJMPTotal*100).toFixed(1)+'%':'—';
            return`<tr style="${isJMP({activityType:t})?'background:#F0F4FF':''}">
              <td><span style="display:inline-flex;align-items:center;gap:6px">
                <span style="width:8px;height:8px;border-radius:50%;background:${PAL[i%PAL.length]};flex-shrink:0"></span>
                ${typChip(t)}${isJMP({activityType:t})?'<span class="badge b-blue" style="font-size:.6rem">JMP</span>':''}
              </span></td>
              <td class="td-r t-mono">${v26?fmtNum(v26):'—'}</td>
              <td class="td-r">${tot26&&v26?(v26/tot26*100).toFixed(1)+'%':'—'}</td>
              <td class="td-r t-mono">${v27?fmtNum(v27):'—'}</td>
              <td class="td-r"><strong>${tot27&&v27?(v27/tot27*100).toFixed(1):'0'}%</strong></td>
              <td class="td-r t-mono ${diff>0?'t-red':diff<0?'t-green':''}">${diff?(diff>0?'+':'')+fmtNum(diff):'—'}</td>
              <td class="td-r ${diff>0?'t-red':diff<0?'t-green':''}">${v26&&diff?((diff/v26)*100).toFixed(1)+'%':'—'}</td>
              <td class="td-r">${pct27excl}</td>
            </tr>`;
          }).join('')}
          <tr style="font-weight:700;background:var(--g100)">
            <td>TOTAL</td><td class="td-r t-mono">${fmtNum(tot26)}</td><td class="td-r">100%</td>
            <td class="td-r t-mono">${fmtNum(tot27)}</td><td class="td-r">100%</td>
            <td class="td-r t-mono ${tot27>tot26?'t-red':'t-green'}">${(tot27>tot26?'+':'')+fmtNum(tot27-tot26)}</td>
            <td class="td-r ${tot27>tot26?'t-red':'t-green'}">${tot26?((tot27-tot26)/tot26*100).toFixed(1)+'%':'—'}</td>
            <td class="td-r">100%</td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <!-- JMP dominance -->
    ${jmpDomIssues.length>0?`
    <div class="card mb20" style="border-left:3px solid var(--amber)">
      <div class="section-hd" style="font-size:.88rem">⚠ JMP Not Largest Budget Type — ${jmpDomIssues.length} Market${jmpDomIssues.length>1?'s':''}</div>
      <div class="tbl-scroll"><table class="dt">
        <thead><tr><th>Market</th><th>Tier</th><th>Largest Type</th><th class="th-r">Largest Budget</th><th class="th-r">JMP Budget</th><th class="th-r">Gap</th></tr></thead>
        <tbody>
          ${jmpDomIssues.map(d=>`<tr class="row-warn">
            <td><strong>${d.mkt}</strong></td>
            <td>${tierBadge(getTier(d.mkt))}</td>
            <td>${typChip(d.topType)}</td>
            <td class="td-r t-mono">${fmtNum(d.topCF)}</td>
            <td class="td-r t-mono">${fmtNum(d.jmpCF)}</td>
            <td class="td-r t-red">${fmtNum(d.topCF-d.jmpCF)} over JMP</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`:''
    }

    <!-- Cost efficiency outliers -->
    <div class="card mb20">
      <div class="section-hd" style="font-size:.88rem">Cost Efficiency Outliers — Cost per Attendee/Stakeholder vs Portfolio Median <small>>15% above median flagged</small></div>
      ${outlierViols.length===0?
        '<div style="padding:20px;text-align:center;color:var(--green);font-size:.85rem">✅ No cost efficiency outliers detected in current filter</div>':
        `<div class="tbl-scroll tbl-scroll-h"><table class="dt">
          <thead><tr><th>Market</th><th>Tier</th><th>Activity Type</th><th>Detail</th><th>Status</th></tr></thead>
          <tbody>
            ${outlierViols.map(v=>`<tr class="row-warn">
              <td><strong>${v.market}</strong></td>
              <td>${tierBadge(v.tier)}</td>
              <td>${typChip(v.activityType)}</td>
              <td style="font-size:.77rem;color:var(--g700)">${v.detail}</td>
              <td><span class="badge b-medium">Review</span></td>
            </tr>`).join('')}
          </tbody>
        </table></div>`
      }
    </div>

    <!-- VS Review metrics -->
    <div class="card">
      <div class="section-hd" style="font-size:.88rem">VS Review Metrics — Efficiency Indicators per Market</div>
      <div class="tbl-scroll tbl-scroll-h"><table class="dt">
        <thead><tr>
          <th>Market</th><th>Tier</th>
          <th class="th-r">GSA % of Budget</th>
          <th class="th-r">FAM Cost/Agent (AED)</th>
          <th class="th-r">Exhibition Cost/Revenue</th>
        </tr></thead>
        <tbody>
          ${vsMetrics.map(m=>`<tr>
            <td><strong>${m.mkt}</strong></td>
            <td>${tierBadge(m.tier)}</td>
            <td class="td-r ${m.gsaPct&&parseFloat(m.gsaPct)>20?'t-amber':''}">${m.gsaPct?m.gsaPct+'%':'—'}</td>
            <td class="td-r t-mono">${m.famCPA?fmtNum(m.famCPA):'—'}</td>
            <td class="td-r ${m.exhRatio&&parseFloat(m.exhRatio)>2?'t-red':m.exhRatio&&parseFloat(m.exhRatio)>1?'t-amber':m.exhRatio?'t-green':''}">${m.exhRatio?m.exhRatio+'x':'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      <div style="font-size:.72rem;color:var(--g400);margin-top:10px;display:flex;gap:24px">
        <span>GSA %: amber if >20% of market budget</span>
        <span>Exhibition ratio: green <1x, amber 1-2x, red >2x (spending more than earning)</span>
      </div>
    </div>
  `;

  // Toggle handler
  let showWithJMP = true;
  window.toggleTypeView = (mode) => {
    showWithJMP = mode==='with';
    document.getElementById('tog-with').classList.toggle('active',showWithJMP);
    document.getElementById('tog-without').classList.toggle('active',!showWithJMP);
    const data = showWithJMP
      ? Object.entries(typeMap27).sort((a,b)=>b[1]-a[1]).slice(0,10)
      : Object.entries(typeMap27).filter(([t])=>!isJMP({activityType:t})).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const total = showWithJMP ? tot27 : noJMPTotal;
    if(Charts['c-type-pct']){Charts['c-type-pct'].data.labels=data.map(([t])=>t);Charts['c-type-pct'].data.datasets[0].data=data.map(([,v])=>v);Charts['c-type-pct'].update();}
  };

  requestAnimationFrame(()=>{
    // Tier bar
    mkChart('c-tier-bar','bar',{
      labels:['Tier 1 (Priority)','Tier 2 (Growth)'],
      datasets:[
        {label:'2026',data:[t1_26,t2_26],backgroundColor:'rgba(46,95,163,.4)'},
        {label:'2027',data:[t1CF,t2CF],backgroundColor:['#2E5FA3','#C8A755']},
      ]
    },{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});

    // Type % bar
    const tdata=Object.entries(typeMap27).sort((a,b)=>b[1]-a[1]).slice(0,10);
    mkChart('c-type-pct','bar',{
      labels:tdata.map(([t])=>t.length>20?t.slice(0,18)+'…':t),
      datasets:[{label:'2027 Budget',data:tdata.map(([,v])=>v),backgroundColor:PAL}]
    },{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>fmtShort(v)}}}});
  });
}

// ══════════════════════════════════════════════════════════
// VIEW 3 — MARKET REVIEW: Per-market deep dive
// ══════════════════════════════════════════════════════════
function renderMarket(state, selMkt){
  const {acts, violations, baseline} = state;
  const a26 = baseline.activities||[];
  const markets=[...new Set(acts.map(a=>a.market).filter(Boolean))].sort((a,b)=>{const td=getTier(a)-getTier(b);return td||a.localeCompare(b);});
  const mkt = selMkt||markets[0]||'';

  const m27=acts.filter(a=>a.market===mkt);
  const m26=a26.filter(a=>a.market===mkt);
  const tot27=m27.reduce((s,a)=>s+a.cashflow,0);
  const tot26=m26.reduce((s,a)=>s+a.cashflow,0);

  // Monthly
  const cf27=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  const cf26=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
  m27.forEach(a=>MONTH_LABELS.forEach(m=>{cf27[m]+=a.monthly[m]||0;}));
  m26.forEach(a=>MONTH_LABELS.forEach(m=>{cf26[m]+=a.monthly[m]||0;}));

  // Type breakdown
  const typeMap27={}, typeMap26={};
  m27.forEach(a=>{typeMap27[a.activityType]=(typeMap27[a.activityType]||0)+a.cashflow;});
  m26.forEach(a=>{typeMap26[a.activityType]=(typeMap26[a.activityType]||0)+a.cashflow;});
  const noJMPTot=Object.entries(typeMap27).filter(([t])=>!isJMP({activityType:t})).reduce((s,[,v])=>s+v,0);
  const allTypeKeys=[...new Set([...Object.keys(typeMap27),...Object.keys(typeMap26)])].sort((a,b)=>(typeMap27[b]||0)-(typeMap27[a]||0));

  // KPI totals
  const totAtt=m27.reduce((s,a)=>s+(a.attendees||0),0);
  const totStak=m27.reduce((s,a)=>s+(a.stakeholders||0),0);
  const totRev=m27.reduce((s,a)=>s+(a.revenue||0),0);
  const totHG=m27.reduce((s,a)=>s+(a.hotelGuests||0),0);

  // Violations for this market
  const mktViols=violations.filter(v=>v.market===mkt);
  const activeViols=mktViols.filter(v=>v.status!=='accepted');
  const violByActId={};
  mktViols.forEach(v=>{if(v.activityId&&v.activityId!=='—'&&v.activityId!=='Market-level'){if(!violByActId[v.activityId])violByActId[v.activityId]=[];violByActId[v.activityId].push(v);}});

  // VS metrics
  const gsaCF=m27.filter(a=>isGSA(a)).reduce((s,a)=>s+a.cashflow,0);
  const gsaPct=tot27?(gsaCF/tot27*100).toFixed(1):null;
  const famA=m27.filter(a=>isFAM(a)), famCF=famA.reduce((s,a)=>s+a.cashflow,0), famAtt=famA.reduce((s,a)=>s+(a.attendees||0),0);
  const exhA=m27.filter(a=>isExhibition(a)), exhCF=exhA.reduce((s,a)=>s+a.cashflow,0), exhRev=exhA.reduce((s,a)=>s+(a.revenue||0),0);

  // Compliance checks
  const RAM_S2=new Date(2027,1,18), RAM_E2=new Date(2027,2,20);
  const ramZero=m27.filter(a=>{const d=a.startDate||a.endDate;return d&&d>=RAM_S2&&d<=RAM_E2&&a.cashflow===0;}).length;
  const missions=m27.filter(a=>isMission(a)).length;
  const noKPI=m27.filter(a=>!a.revenue&&!a.attendees&&!isKPIExempt(a)&&!isWebinar(a)).length;
  const othersCount=m27.filter(a=>/^others$/i.test(a.activityType||'')).length;
  const q4CF=MONTH_LABELS.slice(9).reduce((s,m)=>s+(cf27[m]||0),0);
  const q4pct=tot27?(q4CF/tot27*100):0;
  const q4jmps=m27.filter(a=>isJMP(a)&&a.endDate&&a.endDate.getMonth()>=9).length;
  const jmpNoHG=m27.filter(a=>isJMP(a)&&(!a.hotelGuests||a.hotelGuests===0)).length;
  const lockedMod=m27.filter(a=>{if(a.locked!=='Locked')return false;const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}`;const a26d=a26.find(x=>`${x.market}||${(x.activityName||'').toLowerCase().trim()}`===k);return a26d&&Math.abs(a.cashflow-a26d.cashflow)>1000;}).length;

  function chk(pass,text,note=''){return`<div class="check-item ${pass?'pass':'fail'}"><span class="check-icon">${pass?'✅':'❌'}</span><div><div>${text}</div>${note?`<div class="check-detail">${note}</div>`:''}</div></div>`;}

  // Activity comparison
  const nameMap26={}, nameMap27={};
  m26.forEach(a=>{nameMap26[(a.activityName||'').toLowerCase().trim()]=a;});
  m27.forEach(a=>{nameMap27[(a.activityName||'').toLowerCase().trim()]=a;});
  const compRows=[];
  m27.forEach(a=>{
    const k=(a.activityName||'').toLowerCase().trim();
    const a26m=nameMap26[k];
    if(!a26m){compRows.push({status:'new',a27:a,a26:null,cfDiff:a.cashflow,changes:[]});}
    else{
      const ch=[];
      if(Math.abs(a.cashflow-a26m.cashflow)>500)ch.push({field:'Cashflow',from:a26m.cashflow,to:a.cashflow,diff:a.cashflow-a26m.cashflow});
      if(a.priority!==a26m.priority&&a.priority&&a26m.priority)ch.push({field:'Priority',from:a26m.priority,to:a.priority,diff:0});
      if(a.activityType!==a26m.activityType)ch.push({field:'Type',from:a26m.activityType,to:a.activityType,diff:0});
      compRows.push({status:ch.length?'changed':'same',a27:a,a26:a26m,cfDiff:a.cashflow-(a26m.cashflow||0),changes:ch});
    }
  });
  m26.forEach(a=>{const k=(a.activityName||'').toLowerCase().trim();if(!nameMap27[k])compRows.push({status:'removed',a27:null,a26:a,cfDiff:-a.cashflow,changes:[]});});
  compRows.sort((a,b)=>{const ord={new:0,changed:1,removed:2,same:3};return(ord[a.status]||4)-(ord[b.status]||4);});
  const added=compRows.filter(r=>r.status==='new').length;
  const removed=compRows.filter(r=>r.status==='removed').length;
  const changed=compRows.filter(r=>r.status==='changed').length;

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Market Review <small>From high-level summary to activity detail</small></div>

    <!-- Market selector -->
    <div class="market-selector mb20">
      <label>Market:</label>
      <select id="mkt-sel">
        ${markets.map(m=>`<optgroup label="Tier ${getTier(m)}">` ).filter((v,i,a)=>a.indexOf(v)===i).join('')}
        ${markets.map(m=>`<option value="${m}"${m===mkt?' selected':''}>${m}</option>`).join('')}
      </select>
      ${tierBadge(getTier(mkt))} ${regionBadge(getRegion(mkt))}
      <div style="margin-left:auto;display:flex;gap:20px;font-size:.8rem">
        <span>${m27.length} activities &nbsp;|&nbsp; ${fmtAED(tot27)}</span>
        <span class="${activeViols.length>0?'t-red':''}">${activeViols.length} active violation${activeViols.length!==1?'s':''}</span>
      </div>
    </div>

    <!-- Summary panel -->
    <div class="mkt-summary-panel mb20">
      <div class="mkt-sum-block"><div class="kpi-label">2026 Budget</div><div class="kpi-value">${fmtShort(tot26)}</div><div class="kpi-sub">AED</div></div>
      <div class="mkt-sum-arrow">→</div>
      <div class="mkt-sum-block ${tot27>tot26?'sum-up':'sum-down'}"><div class="kpi-label">2027 Budget</div><div class="kpi-value">${fmtShort(tot27)}</div><div class="kpi-sub">AED</div></div>
      <div class="mkt-sum-block ${tot27>tot26?'sum-change-up':'sum-change-down'}"><div class="kpi-label">Change</div><div class="kpi-value">${tot27>=tot26?'+':''}${fmtShort(tot27-tot26)}</div><div class="kpi-sub">${tot26?((tot27-tot26)/tot26*100).toFixed(1)+'%':'new'}</div></div>
      <div class="mkt-sum-divider"></div>
      <div class="mkt-sum-block"><div class="kpi-label">Activities</div><div class="kpi-value">${m27.length}</div><div class="kpi-sub">vs ${m26.length} in 2026</div></div>
      <div class="mkt-sum-block"><div class="kpi-label">Attendees Target</div><div class="kpi-value">${fmtShort(totAtt)}</div><div class="kpi-sub">2027 plan</div></div>
      <div class="mkt-sum-block"><div class="kpi-label">Hotel Guests Target</div><div class="kpi-value ${totHG===0?'t-red':''}">${totHG?fmtShort(totHG):'—'}</div><div class="kpi-sub">${totHG?'JMP targets':'Missing data'}</div></div>
      <div class="mkt-sum-block ${activeViols.length>0?'sum-viol':'sum-ok'}"><div class="kpi-label">Violations</div><div class="kpi-value">${activeViols.length}</div><div class="kpi-sub">${mktViols.filter(v=>v.severity==='HIGH'&&v.status!=='accepted').length} HIGH</div></div>
    </div>

    <!-- Charts row -->
    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Monthly Cashflow — 2027 vs 2026</div>
        <div class="chart-wrap"><canvas id="c-mkt-cf"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Activity Type % — With &amp; Without JMPs</div>
        <div class="chart-wrap"><canvas id="c-mkt-type"></canvas></div>
      </div>
    </div>

    <!-- VS metrics + checklist -->
    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">Compliance Checklist</div>
        <div class="checklist">
          ${chk(othersCount===0,'No "Others" activity types',othersCount>0?`${othersCount} must be reclassified`:'')}
          ${chk(q4pct<=30,`Q4 cashflow ≤30%`,`Q4=${fmtAED(q4CF)} (${q4pct.toFixed(1)}%)`)}
          ${chk(q4jmps===0,'No JMP contracts closing in Q4',q4jmps>0?`${q4jmps} JMP(s) ending Oct-Dec`:'')}
          ${chk(jmpNoHG===0,'All JMPs have Hotel Guest targets',jmpNoHG>0?`${jmpNoHG} JMP(s) missing hotel guest targets`:'')}
          ${chk(ramZero>=2,'≥2 Ramadan zero-budget activities',`Found: ${ramZero}`)}
          ${chk(missions<=1,`≤1 sales mission per quarter`,`${missions} total missions`)}
          ${chk(noKPI===0,'All non-JMP activities have KPIs',noKPI>0?`${noKPI} missing revenue+attendees`:'')}
          ${chk(lockedMod===0,'No locked activities modified',lockedMod>0?`${lockedMod} locked activities changed`:'')}
        </div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.88rem">VS Review Metrics</div>
        <table class="dt"><tbody>
          <tr><td>GSA % of Market Budget</td><td class="td-r ${gsaPct&&parseFloat(gsaPct)>20?'t-amber':''}">${gsaPct?gsaPct+'%':'—'} ${gsaCF?`(${fmtAED(gsaCF)})`:''}</td></tr>
          <tr><td>FAM Cost per Agent</td><td class="td-r t-mono">${famCF&&famAtt?fmtAED(Math.round(famCF/famAtt)):'—'} ${famAtt?`(${famAtt} agents)`:''}</td></tr>
          <tr><td>Exhibition Cost/Revenue Ratio</td><td class="td-r ${exhRev&&exhCF/exhRev>2?'t-red':exhRev&&exhCF/exhRev>1?'t-amber':exhRev?'t-green':''}">${exhCF&&exhRev?(exhCF/exhRev).toFixed(2)+'x':'—'}</td></tr>
          <tr><td>Total KPI Targets</td><td class="td-r">Att: ${fmtNum(totAtt)} · Stak: ${fmtNum(totStak)} · Rev: ${fmtShort(totRev)}</td></tr>
        </tbody></table>
        ${activeViols.length>0?`<div style="margin-top:14px">
          <div style="font-size:.78rem;font-weight:600;color:var(--g700);margin-bottom:8px">Active Violations:</div>
          ${activeViols.slice(0,5).map(v=>`<div style="display:flex;gap:6px;margin-bottom:5px;font-size:.75rem;padding:5px 8px;background:var(--g50);border-radius:4px;border-left:3px solid ${v.severity==='HIGH'?'var(--red)':v.severity==='MEDIUM'?'var(--amber)':'var(--g200)'}">
            <code style="color:var(--blue);flex-shrink:0">${v.ruleId}</code>
            <span>${v.detail.slice(0,80)}${v.detail.length>80?'…':''}</span>
          </div>`).join('')}
          ${activeViols.length>5?`<div style="font-size:.72rem;color:var(--g400);text-align:center">+${activeViols.length-5} more in Violations tab</div>`:''}
        </div>`:''}
      </div>
    </div>

    <!-- Activity type breakdown table -->
    <div class="card mb20">
      <div class="section-hd" style="font-size:.88rem">Budget by Activity Type — 2026 vs 2027</div>
      <div class="tbl-scroll"><table class="dt">
        <thead><tr><th>Type</th><th class="th-r">2026 (AED)</th><th class="th-r">2027 (AED)</th><th class="th-r">Change</th><th class="th-r">% of 2027</th><th class="th-r">% ex-JMP</th></tr></thead>
        <tbody>
          ${allTypeKeys.filter(t=>t&&t!=='undefined').map(t=>{
            const v26=typeMap26[t]||0, v27=typeMap27[t]||0, diff=v27-v26;
            const pctTotal=tot27&&v27?(v27/tot27*100).toFixed(1)+'%':'—';
            const pctExcl=!isJMP({activityType:t})&&noJMPTot&&v27?(v27/noJMPTot*100).toFixed(1)+'%':'—';
            return`<tr class="${diff>50000?'row-warn':diff<-50000?'row-removed':''}">
              <td>${typChip(t)}${isJMP({activityType:t})?'<span class="badge b-blue" style="font-size:.6rem;margin-left:4px">JMP</span>':''}</td>
              <td class="td-r t-mono">${v26?fmtNum(v26):'—'}</td>
              <td class="td-r t-mono">${v27?fmtNum(v27):'—'}</td>
              <td class="td-r t-mono ${diff>0?'t-red':diff<0?'t-green':''}">${diff?(diff>0?'+':'')+fmtNum(diff):'—'}</td>
              <td class="td-r"><strong>${pctTotal}</strong></td>
              <td class="td-r">${pctExcl}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>

    <!-- Activity comparison -->
    <div class="card">
      <div class="flex-between mb16">
        <div class="section-hd" style="font-size:.88rem;margin:0;border:none">
          Activity Comparison — 2026 vs 2027
          <span style="margin-left:10px;font-size:.72rem;font-weight:400">
            <span class="badge b-new">NEW ${added}</span>
            <span class="badge b-changed" style="margin-left:4px">CHANGED ${changed}</span>
            <span class="badge b-removed" style="margin-left:4px">REMOVED ${removed}</span>
          </span>
        </div>
        <button class="btn-ghost btn-sm" id="btn-show-same-mkt" onclick="toggleSameRowsMkt()">Show unchanged</button>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Status</th><th>ID</th><th>Activity Name</th><th>Type</th>
            <th class="td-c">P</th><th class="th-r">2026 CF</th><th class="th-r">2027 CF</th>
            <th class="th-r">Change</th><th>Lock</th><th>Owner</th><th>Violations</th>
          </tr></thead>
          <tbody>
            ${compRows.map(row=>{
              const a=row.a27||row.a26;
              const vs=row.a27&&violByActId[row.a27.id]||[];
              const badgeMap={new:'b-new',changed:'b-changed',removed:'b-removed',same:'b-low'};
              const rowCls={new:'row-new',changed:'row-warn',removed:'row-removed',same:''}[row.status]||'';
              const cf26v=row.a26?.cashflow||0, cf27v=row.a27?.cashflow||0;
              return`<tr class="${rowCls}${row.status==='same'?' same-row-mkt hidden':''}">
                <td><span class="badge ${badgeMap[row.status]||'b-low'}" style="font-size:.62rem">${row.status.toUpperCase()}</span></td>
                <td class="t-muted" style="font-size:.7rem">${a?.id||'—'}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem" title="${a?.activityName||''}">${a?.activityName||'—'}</td>
                <td>${typChip(a?.activityType||'—')}</td>
                <td class="td-c">${a?.priority||'—'}</td>
                <td class="td-r t-mono">${cf26v?fmtNum(cf26v):'—'}</td>
                <td class="td-r t-mono">${cf27v?fmtNum(cf27v):'—'}</td>
                <td class="td-r t-mono ${row.cfDiff>0?'t-red':row.cfDiff<0?'t-green':''}">${row.cfDiff?(row.cfDiff>0?'+':'')+fmtNum(row.cfDiff):'—'}</td>
                <td>${a?.locked?`<span class="badge ${a.locked==='Locked'?'b-locked':'b-unlocked'}" style="font-size:.62rem">${a.locked}</span>`:''}</td>
                <td style="font-size:.74rem">${a?.owner||'—'}</td>
                <td>${vs.map(v=>`<span class="badge b-${v.severity.toLowerCase()}" style="font-size:.6rem;margin-right:2px" title="${v.detail}">${v.ruleId}</span>`).join('')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('mkt-sel').addEventListener('change',e=>{destroyCharts();renderMarket(state,e.target.value);});

  let showSameMkt=false;
  window.toggleSameRowsMkt=()=>{
    showSameMkt=!showSameMkt;
    document.querySelectorAll('.same-row-mkt').forEach(r=>r.classList.toggle('hidden',!showSameMkt));
    const b=document.getElementById('btn-show-same-mkt');if(b)b.textContent=showSameMkt?'Hide unchanged':'Show unchanged';
  };

  requestAnimationFrame(()=>{
    mkChart('c-mkt-cf','bar',{labels:MONTH_LABELS,datasets:[
      {label:'2026',data:MONTH_LABELS.map(m=>cf26[m]),backgroundColor:'rgba(46,95,163,.28)',borderColor:'#2E5FA3',borderWidth:1.5},
      {label:'2027',data:MONTH_LABELS.map(m=>cf27[m]),backgroundColor:MONTH_LABELS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)},
    ]},{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtShort(v)}}}});

    const typeData=Object.entries(typeMap27).sort((a,b)=>b[1]-a[1]);
    const noJMPData=typeData.filter(([t])=>!isJMP({activityType:t}));
    mkChart('c-mkt-type','bar',{
      labels:typeData.map(([t])=>t.length>18?t.slice(0,16)+'…':t),
      datasets:[
        {label:'With JMPs',data:typeData.map(([,v])=>v),backgroundColor:typeData.map(([t],i)=>isJMP({activityType:t})?'#1F3864':PAL[(i)%PAL.length])},
      ]
    },{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>fmtShort(v)}}}});
  });
}

// ══════════════════════════════════════════════════════════
// VIEW 4 — CALENDAR: Annual Schedule
// ══════════════════════════════════════════════════════════
function renderCalendar(state){
  const acts = state.acts||[];
  const allMarkets=[...new Set(acts.map(a=>a.market).filter(Boolean))].sort();
  const allRegions=[...new Set(allMarkets.map(m=>getRegion(m)))].filter(r=>r!=='Other').sort();
  let selRegions=[], selMarkets=[];

  function getFilteredMarkets(){
    if(selMarkets.length) return selMarkets;
    if(selRegions.length) return allMarkets.filter(m=>selRegions.includes(getRegion(m)));
    return allMarkets;
  }

  function getActsInMonth(market, monthIdx){
    return acts.filter(a=>{
      if(a.market!==market) return false;
      if(!a.startDate&&!a.endDate){const ci=MONTH_LABELS.findIndex(m=>(a.monthly[m]||0)>0);return ci===monthIdx;}
      const s=a.startDate?a.startDate.getMonth():monthIdx;
      const e=a.endDate?a.endDate.getMonth():monthIdx;
      return monthIdx>=s&&monthIdx<=e;
    });
  }

  function getConflicts(market){
    const conflicts=[];
    const mActs=acts.filter(a=>a.market===market&&a.startDate&&a.endDate);
    for(let i=0;i<mActs.length;i++){for(let j=i+1;j<mActs.length;j++){
      const a=mActs[i],b=mActs[j];
      if(a.activityType!==b.activityType) continue;
      if(a.startDate<=b.endDate&&b.startDate<=a.endDate) conflicts.push({a,b});
    }}
    return conflicts;
  }

  function renderGrid(){
    const markets=getFilteredMarkets();
    const conflicts={};
    markets.forEach(m=>{const c=getConflicts(m);if(c.length)conflicts[m]=c;});
    return`<div style="overflow-x:auto"><table class="cal-table">
      <thead>
        <tr><th class="cal-mkt-col">Market</th><th class="cal-mkt-col">Tier</th>
          ${MONTH_LABELS.map((m,i)=>`<th class="${i>=9?'cal-q4-hd':i>=6?'cal-q3-hd':i>=3?'cal-q2-hd':'cal-q1-hd'}">${m}</th>`).join('')}
          <th>Total</th><th>Conflicts</th></tr>
        <tr class="cal-q-row"><th colspan="2"></th><th colspan="3" class="cal-q1-hd">Q1</th><th colspan="3" class="cal-q2-hd">Q2</th><th colspan="3" class="cal-q3-hd">Q3</th><th colspan="3" class="cal-q4-hd">Q4 ⚠</th><th colspan="2"></th></tr>
      </thead>
      <tbody>
        ${markets.map(mkt=>{
          const mActs=acts.filter(a=>a.market===mkt);
          const cflicts=conflicts[mkt]||[];
          return`<tr class="cal-row${cflicts.length?' cal-has-conflict':''}">
            <td class="cal-mkt-cell"><span class="cal-mkt-name" onclick="calExpandMarket('${mkt}')">${mkt}</span></td>
            <td>${tierBadge(getTier(mkt))}</td>
            ${MONTH_LABELS.map((mo,idx)=>{
              const n=getActsInMonth(mkt,idx).length;
              const cls=n===0?'cal-0':n<=2?'cal-1':n<=5?'cal-2':n<=10?'cal-3':'cal-4';
              const q4w=idx>=9&&n>0?' cal-q4-warn':'';
              return`<td class="cal-cell ${cls}${q4w}" title="${mkt} ${mo}: ${n} activit${n!==1?'ies':'y'}" onclick="calShowMonth('${mkt}','${mo}',${idx})">${n>0?n:''}</td>`;
            }).join('')}
            <td class="cal-total-cell">${mActs.length}</td>
            <td class="cal-conflict-cell ${cflicts.length>0?'t-red':''}">${cflicts.length>0?`<span class="badge b-high" style="cursor:pointer" onclick="calExpandMarket('${mkt}')">${cflicts.length}</span>`:'—'}</td>
          </tr>
          <tr class="cal-detail-row hidden" id="cal-det-${mkt.replace(/[\s&]/g,'_')}">
            <td colspan="16" style="padding:0"><div class="cal-detail-inner" id="cal-det-inner-${mkt.replace(/[\s&]/g,'_')}"></div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Annual Calendar 2027 <small>Scheduling conflicts &amp; Q4 concentration</small></div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:12px 16px;background:white;border:1px solid var(--g200);border-radius:var(--r-md);flex-wrap:wrap">
      <span class="flt-label">Filter:</span>
      ${buildMS('calreg','Region',allRegions)}
      ${buildMS('calmkt','Market',allMarkets)}
      <button class="btn-ghost btn-sm" onclick="clearCalFlt()">Reset</button>
      <div style="margin-left:auto;display:flex;gap:12px;font-size:.76rem;align-items:center">
        <span class="cal-1" style="padding:3px 10px;border-radius:4px">1-2</span>
        <span class="cal-2" style="padding:3px 10px;border-radius:4px">3-5</span>
        <span class="cal-3" style="padding:3px 10px;border-radius:4px">6-10</span>
        <span class="cal-4" style="padding:3px 10px;border-radius:4px">11+</span>
        <span class="cal-q4-warn" style="padding:3px 10px;border-radius:4px">Q4 Activity</span>
      </div>
    </div>
    <div class="card" id="cal-grid-wrap">${renderGrid()}</div>`;

  function bindCalMS(msId,arr,label){
    document.querySelector(`#ms-${msId} .ms-panel`)?.addEventListener('change',()=>{
      arr.length=0; getMSVals(`ms-${msId}`).forEach(v=>arr.push(v));
      updateMSBtn(`ms-${msId}`,label);
      document.getElementById('cal-grid-wrap').innerHTML=renderGrid();
    });
  }
  bindCalMS('calreg',selRegions,'Region'); bindCalMS('calmkt',selMarkets,'Market');
  window.clearCalFlt=()=>{selRegions.length=0;selMarkets.length=0;clearMS('ms-calreg','Region');clearMS('ms-calmkt','Market');document.getElementById('cal-grid-wrap').innerHTML=renderGrid();};

  window.calShowMonth=(mkt,mo,idx)=>{
    const safeId=mkt.replace(/[\s&]/g,'_');
    const detRow=document.getElementById(`cal-det-${safeId}`);
    const detInner=document.getElementById(`cal-det-inner-${safeId}`);
    if(!detRow||!detInner) return;
    const monthActs=getActsInMonth(mkt,idx);
    if(detRow.classList.contains('hidden')||detInner.dataset.month!==mo){
      detInner.dataset.month=mo;
      detInner.innerHTML=monthActs.length?`<table class="dt" style="border-radius:0"><thead><tr><th>ID</th><th>${mo} — ${mkt}</th><th>Type</th><th class="td-c">P</th><th>Start</th><th>End</th><th class="th-r">Cashflow</th></tr></thead><tbody>
        ${monthActs.map(a=>`<tr><td class="t-muted" style="font-size:.7rem">${a.id||'—'}</td><td style="font-size:.78rem">${a.activityName}</td><td>${typChip(a.activityType)}</td><td class="td-c">${a.priority||'—'}</td><td>${fmtDate(a.startDate)}</td><td class="${a.endDate&&a.endDate.getMonth()>=9?'t-amber':''}">${fmtDate(a.endDate)}</td><td class="td-r t-mono">${fmtNum(a.cashflow)}</td></tr>`).join('')}
      </tbody></table>`:`<div style="padding:14px;color:var(--g400);font-size:.82rem">No activities in ${mo} for ${mkt}.</div>`;
      detRow.classList.remove('hidden');
    } else { detRow.classList.add('hidden'); }
  };
  window.calExpandMarket=(mkt)=>{
    const safeId=mkt.replace(/[\s&]/g,'_');
    const detRow=document.getElementById(`cal-det-${safeId}`);
    const detInner=document.getElementById(`cal-det-inner-${safeId}`);
    if(!detRow||!detInner) return;
    if(!detRow.classList.contains('hidden')&&detInner.dataset.month==='all'){detRow.classList.add('hidden');return;}
    const mActs=acts.filter(a=>a.market===mkt).sort((a,b)=>(a.startDate||new Date(0))-(b.startDate||new Date(0)));
    detInner.dataset.month='all';
    detInner.innerHTML=`<table class="dt" style="border-radius:0"><thead><tr><th>ID</th><th>Activity</th><th>Type</th><th class="td-c">P</th><th>Start</th><th>End</th><th class="th-r">Cashflow</th><th>Owner</th></tr></thead><tbody>
      ${mActs.map(a=>`<tr class="${a.startDate&&a.startDate.getMonth()>=9?'row-warn':''}"><td class="t-muted" style="font-size:.7rem">${a.id||'—'}</td><td style="font-size:.78rem">${a.activityName}</td><td>${typChip(a.activityType)}</td><td class="td-c">${a.priority||'—'}</td><td>${fmtDate(a.startDate)}</td><td class="${a.endDate&&a.endDate.getMonth()>=9?'t-amber':''}">${fmtDate(a.endDate)}</td><td class="td-r t-mono">${fmtNum(a.cashflow)}</td><td style="font-size:.74rem">${a.owner||'—'}</td></tr>`).join('')}
    </tbody></table>`;
    detRow.classList.remove('hidden');
  };
}

// ══════════════════════════════════════════════════════════
// VIEW 5 — VIOLATIONS: Action Centre
// ══════════════════════════════════════════════════════════
function renderViolations(state){
  let viols=state.violations;
  let fSev=[],fRegion=[],fTier=[],fMkt=[],fType=[],fRule=[],fCat=[],fStatus=[];
  const sum=summarise(viols);

  const allRegions=[...new Set(viols.map(v=>v.region))].sort();
  const allMkts=[...new Set(viols.map(v=>v.market))].sort();
  const allTypes=[...new Set(viols.map(v=>v.activityType).filter(t=>t&&t!=='—'))].sort();
  const allRules=[...new Set(viols.map(v=>v.ruleId))].sort();
  const allCats=[...new Set(viols.map(v=>v.category||''))].filter(Boolean).sort();

  function filtered(){
    return viols.filter(v=>{
      if(fSev.length    && !fSev.includes(v.severity))    return false;
      if(fRegion.length && !fRegion.includes(v.region))   return false;
      if(fTier.length   && !fTier.includes(String(v.tier))) return false;
      if(fMkt.length    && !fMkt.includes(v.market))      return false;
      if(fType.length   && !fType.includes(v.activityType)) return false;
      if(fRule.length   && !fRule.includes(v.ruleId))     return false;
      if(fCat.length    && !fCat.includes(v.category||'')) return false;
      if(fStatus.length && !fStatus.includes(v.status))   return false;
      return true;
    });
  }

  const byType={};
  viols.filter(v=>v.status!=='accepted'&&v.activityType&&v.activityType!=='—').forEach(v=>{byType[v.activityType]=(byType[v.activityType]||0)+1;});

  function renderTbl(){
    const fv=filtered();
    document.getElementById('viol-count-lbl').textContent=`${fv.length} violation${fv.length!==1?'s':''}`;
    document.getElementById('viol-tbody').innerHTML=fv.map(v=>{
      const ri=viols.indexOf(v);
      const stCls=v.status==='accepted'?'s-accepted':v.status==='action-required'?'s-action':'';
      return`<tr style="${v.status==='accepted'?'opacity:.42':''}">
        <td class="t-muted" style="font-size:.7rem;white-space:nowrap">${v.activityId}</td>
        <td><span class="badge b-${v.severity.toLowerCase()}">${v.severity}</span></td>
        <td><span class="cat-chip cat-${(v.category||'').toLowerCase().replace(/[^a-z]/g,'')}">${v.category||'—'}</span></td>
        <td><code style="font-size:.7rem;color:var(--blue)">${v.ruleId}</code></td>
        <td style="font-size:.75rem">${v.ruleName}</td>
        <td>${typChip(v.activityType)}</td>
        <td>${tierBadge(v.tier)} ${regionBadge(v.region)} ${v.market}</td>
        <td style="font-size:.76rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.activityName}">${v.activityName}</td>
        <td style="font-size:.73rem;max-width:240px;color:var(--g700)">${v.detail}</td>
        <td><select class="status-sel ${stCls}" data-idx="${ri}" onchange="onStatusChange(this)">
          <option value="pending" ${v.status==='pending'?'selected':''}>— Pending —</option>
          <option value="accepted" ${v.status==='accepted'?'selected':''}>✓ Accepted</option>
          <option value="action-required" ${v.status==='action-required'?'selected':''}>⚠ Action Required</option>
        </select></td>
        <td><input class="comment-inp ${v.status==='action-required'&&!v.comment?'inp-required':''}" placeholder="${v.status==='action-required'?'What needs to change…':'Add note…'}" data-idx="${ri}" value="${v.comment||''}" oninput="onCommentInput(this)"></td>
      </tr>`;
    }).join('')||`<tr><td colspan="11" style="text-align:center;padding:28px;color:var(--g400)">No violations match the selected filters.</td></tr>`;
  }

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Violations — Action Centre <small>Review, accept or flag for action</small></div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:20px">
      <div class="kpi-card kpi-danger"><div class="kpi-label">HIGH</div><div class="kpi-value t-red">${sum.counts.HIGH}</div><div class="kpi-sub">active</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">MEDIUM</div><div class="kpi-value" style="color:var(--amber)">${sum.counts.MEDIUM}</div><div class="kpi-sub">active</div></div>
      <div class="kpi-card kpi-info"><div class="kpi-label">LOW</div><div class="kpi-value">${sum.counts.LOW}</div><div class="kpi-sub">active</div></div>
      <div class="kpi-card kpi-success"><div class="kpi-label">Accepted</div><div class="kpi-value t-green">${viols.filter(v=>v.status==='accepted').length}</div><div class="kpi-sub">closed</div></div>
      <div class="kpi-card"><div class="kpi-label">Action Required</div><div class="kpi-value t-amber">${viols.filter(v=>v.status==='action-required').length}</div><div class="kpi-sub">needs change</div></div>
    </div>
    <div class="grid3 mb20">
      <div class="card"><div class="section-hd" style="font-size:.85rem">By Market</div><div class="chart-wrap-sm"><canvas id="c-v-mkt"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.85rem">By Rule</div><div class="chart-wrap-sm"><canvas id="c-v-rule"></canvas></div></div>
      <div class="card"><div class="section-hd" style="font-size:.85rem">By Activity Type</div><div class="chart-wrap-sm"><canvas id="c-v-type"></canvas></div></div>
    </div>
    <div class="card">
      <div class="flex-between mb16">
        <div class="flex-gap">
          <span class="section-hd" style="font-size:.88rem;margin:0;border:none">All Violations</span>
          <span id="viol-count-lbl" class="t-muted" style="font-size:.78rem"></span>
        </div>
        <div class="flex-gap" style="flex-wrap:wrap">
          ${buildMS('vsev','Severity',['HIGH','MEDIUM','LOW'])}
          ${buildMS('vreg','Region',allRegions)}
          ${buildMS('vtier','Tier',[{value:'1',label:'Tier 1'},{value:'2',label:'Tier 2'},{value:'3',label:'Tier 3'}])}
          ${buildMS('vmkt','Market',allMkts)}
          ${buildMS('vtype','Activity Type',allTypes)}
          ${buildMS('vrule','Rule',allRules.map(r=>({value:r,label:`${r} — ${RULE_META[r]?.name?.slice(0,25)||r}`})))}
          ${buildMS('vcat','Category',allCats)}
          ${buildMS('vstat','Status',[{value:'pending',label:'Pending'},{value:'accepted',label:'Accepted'},{value:'action-required',label:'Action Required'}])}
          <button class="btn-export" id="btn-xl">⬇ Excel</button>
          <button class="btn-secondary" id="btn-csv">⬇ CSV</button>
        </div>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt"><thead><tr>
          <th>Tact.ID</th><th>Sev.</th><th>Category</th><th>Rule</th><th>Rule Name</th>
          <th>Type</th><th>Tier / Market</th><th>Activity</th><th>Detail</th>
          <th style="min-width:140px">Status</th><th style="min-width:200px">What Needs to Change</th>
        </tr></thead>
        <tbody id="viol-tbody"></tbody></table>
      </div>
    </div>`;

  renderTbl();

  function bindVMS(msId,arr,label){
    document.querySelector(`#ms-${msId} .ms-panel`)?.addEventListener('change',()=>{
      arr.length=0; getMSVals(`ms-${msId}`).forEach(v=>arr.push(v));
      updateMSBtn(`ms-${msId}`,label); renderTbl();
    });
  }
  bindVMS('vsev',fSev,'Severity'); bindVMS('vreg',fRegion,'Region'); bindVMS('vtier',fTier,'Tier');
  bindVMS('vmkt',fMkt,'Market'); bindVMS('vtype',fType,'Activity Type');
  bindVMS('vrule',fRule,'Rule'); bindVMS('vcat',fCat,'Category'); bindVMS('vstat',fStatus,'Status');
  document.getElementById('btn-xl')?.addEventListener('click',()=>exportViolationsToExcel(viols));
  document.getElementById('btn-csv')?.addEventListener('click',()=>exportViolationsToCSV(viols));

  requestAnimationFrame(()=>{
    const top8=sum.topMarkets.slice(0,8);
    mkChart('c-v-mkt','bar',{labels:top8.map(m=>m.market),datasets:[{label:'Violations',data:top8.map(m=>m.count),backgroundColor:'#C00000'}]},{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});
    const byRule={};viols.filter(v=>v.status!=='accepted').forEach(v=>{byRule[v.ruleId]=(byRule[v.ruleId]||0)+1;});
    const topR=Object.entries(byRule).sort((a,b)=>b[1]-a[1]).slice(0,10);
    mkChart('c-v-rule','bar',{labels:topR.map(([r])=>r),datasets:[{label:'Count',data:topR.map(([,c])=>c),backgroundColor:topR.map(([r])=>RULE_META[r]?.severity==='HIGH'?'#C00000':RULE_META[r]?.severity==='MEDIUM'?'#D97706':'#8D94A6')}]},{plugins:{legend:{display:false}},scales:{y:{ticks:{stepSize:1}}}});
    const typeE=Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,10);
    mkChart('c-v-type','bar',{labels:typeE.map(([t])=>t.length>18?t.slice(0,16)+'…':t),datasets:[{label:'Count',data:typeE.map(([,c])=>c),backgroundColor:'#2E5FA3'}]},{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{stepSize:1}}}});
  });
}

function onStatusChange(el){
  const idx=el.dataset.idx; APP.violations[idx].status=el.value;
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

// ══════════════════════════════════════════════════════════
// VIEW 6 — RULES REFERENCE: Handbook
// ══════════════════════════════════════════════════════════
function renderRulesRef(state){
  const viols=state.violations;
  const countByRule={};
  viols.filter(v=>v.status!=='accepted').forEach(v=>{countByRule[v.ruleId]=(countByRule[v.ruleId]||0)+1;});

  const RULE_GUIDE = {
    '0.1':{ desc:'Every activity must use one of the predefined activity types from the AOP KPI list. Any type not on the list is invalid.', action:'Change the activity type to one of the approved types. Contact the list administrator if a new type is needed.', why:'Ensures consistent reporting, KPI mapping and analysis across all markets.' },
    '1.1':{ desc:'Flagged if a 2027 activity budget is more than 10% higher than its 2026 equivalent AND the absolute increase exceeds AED 50,000.', action:'Provide justification for the budget increase — new contract terms, expanded scope, or cost inflation must be documented.', why:'Prevents uncontrolled budget creep. Small fluctuations (<10% or <50K) are ignored.' },
    '1.2':{ desc:'Flagged if a market has more than 30% of its annual cashflow scheduled in Q4 (Oct–Dec).', action:'Review payment schedules. Try to move cashflow to Q1–Q3. If unavoidable, document the reason.', why:'Back-loading into Q4 creates cash pressure and delivery risk at year-end.' },
    '1.3':{ desc:'Flagged if November and December together exceed 15% of a market\'s annual cashflow.', action:'Nov/Dec payments are particularly late. Push these earlier if contracts permit.', why:'Nov-Dec is the hardest time to execute and invoice — creates high risk of year-end rollover.' },
    '1.4':{ desc:'A New JMP signed in 2027 should not have cashflow in the same year. Payment should follow contract end (typically 2028+).', action:'If cashflow exists, confirm it is partial and not the full contract value. Full payment in signing year is a violation.', why:'New JMPs are commitments for future delivery — paying in the signing year creates financial exposure.' },
    '1.5':{ desc:'Webinars and online activities must be zero-cost. Any cashflow on a webinar activity is flagged.', action:'Remove budget from webinar activities. If there are real costs, reclassify the activity type.', why:'Webinars are a low-cost engagement tool. Budget should be allocated to in-person/high-value activities.' },
    '1.6':{ desc:'Admin Miscellaneous budget lines are not permitted. All costs must be coded to specific task codes.', action:'Remove or recode the activity using a specific, approved task code.', why:'Miscellaneous lines obscure where money is being spent and prevent proper KPI tracking.' },
    '1.7':{ desc:'An Existing JMP that is marked as Locked but has zero cashflow is suspicious — the contract value may be missing.', action:'Check the contract value and update the cashflow figure. If the JMP was terminated, remove or mark as cancelled.', why:'A locked JMP with no cashflow typically means a data entry error.' },
    '2.2':{ desc:'JMP contracts ending in Q4 (Oct–Dec) create year-end payment concentration. Q1, Q2 and Q3 closures are fine.', action:'Renegotiate JMP contract end dates to close by end of Q3 (September) so payment occurs before year-end.', why:'Q4 contract closures pile payments into the most pressured quarter of the year.' },
    '2.6':{ desc:'Every JMP must have a Hotel Guest target — the number of hotel overnights the trade partner is expected to generate.', action:'Add the Hotel Guest target for each JMP activity. This is the primary KPI for JMPs and must be agreed with the partner.', why:'Without a hotel guest target, there is no way to measure whether the JMP is delivering value.' },
    '3.1':{ desc:'"Others" is not a valid activity type. Every activity must be categorised into a specific approved type.', action:'Review the activity and assign the correct type from the predefined list.', why:'"Others" makes it impossible to track performance by activity type or benchmark against peers.' },
    '3.2':{ desc:'Two activities with exactly the same name AND the same type in the same market are duplicates. Same name with different types (e.g. Mission vs Roadshow) is acceptable.', action:'Review and either merge the duplicate or give one a more specific name.', why:'Duplicates inflate activity counts and create double-counting in KPI reporting.' },
    '3.3':{ desc:'A training or workshop activity that spans more than 31 days (1 month) is likely bundling multiple sessions into one line.', action:'Split the activity into individual sessions, each with its own start/end date, budget and attendee target.', why:'Bundled sessions make it impossible to track delivery, attendance and cost per session.' },
    '3.6':{ desc:'Webinar activities must be Priority 2 or Priority 3. Priority 1 (Committed) is not permitted for webinars.', action:'Change the priority of the webinar to P2 or P3.', why:'P1 activities are committed investments. Webinars are low-cost and should not be committed at the same level as in-person activities.' },
    '3.8':{ desc:'All non-JMP activities must have at least one KPI — either a revenue target or an attendee/participant target. Exemptions: JMPs, GSA Retainer, Mission & Travel, Manpower, Admin, Projects, Expenses, Stand Build, Hospitality.', action:'Add a revenue figure or attendee target to the activity.', why:'Without KPIs, it is impossible to measure whether activities are delivering results.' },
    '4.1':{ desc:'Mega FAM trips must target a minimum of 50 participants.', action:'Either increase the participant target to 50+ or reclassify the activity as a regular FAM trip.', why:'The "Mega FAM" designation implies scale. Below 50 participants, the activity does not justify the Mega FAM budget and format.' },
    '4.3':{ desc:'FAM trips should be scheduled during Ramadan or Early Summer (February–June). FAMs outside this window are flagged.', action:'Reschedule the FAM trip to the Feb–Jun window when possible.', why:'Ramadan and Early Summer are peak periods for trade partner interest and availability for Abu Dhabi experiences.' },
    '5.1':{ desc:'Each market must plan at least 2 zero-budget activities during Ramadan 2027 (Feb 18 – Mar 20). Webinars and virtual sessions are preferred.', action:'Add zero-cost Ramadan activities (e.g. webinars, virtual B2B sessions) to the market plan.', why:'Ramadan is a high-priority period for Abu Dhabi promotion. Zero-budget activities ensure presence without financial commitment.' },
    '6.1':{ desc:'A market can have multiple sales missions but not more than one per quarter. Two missions in the same quarter is a violation.', action:'Reschedule one of the conflicting missions to a different quarter, or justify why two missions are needed simultaneously.', why:'Multiple missions in the same quarter may indicate poor planning or duplicated effort.' },
    '6.3':{ desc:'Exhibition activities (ITB, WTM, ATM, etc.) must have a revenue KPI to justify participation.', action:'Add an expected revenue or lead generation figure to the exhibition activity.', why:'Exhibitions are expensive. Without a revenue target, there is no basis for evaluating whether participation is cost-effective.' },
    '8.4':{ desc:'A new activity with cashflow over AED 500,000 that has no equivalent in the 2026 plan needs documented rationale. JMPs, GSA and Missions are exempt.', action:'Add a description or note explaining why this new high-value activity has been included for the first time.', why:'Large new investments should have a clear strategic rationale, not just appear without context.' },
    'B.1':{ desc:'A market is paying more than 15% above the portfolio median cost per attendee or per stakeholder for a given activity type.', action:'Review the activity budget and targets. Either reduce the cost or justify why this market needs higher spend per person.', why:'Cost efficiency benchmarking ensures that markets are not overspending relative to peers for the same type of activity.' },
  };

  const cats={};
  Object.entries(RULE_META).forEach(([id,m])=>{
    if(!cats[m.cat])cats[m.cat]=[];
    cats[m.cat].push(id);
  });

  document.getElementById('view-area').innerHTML=`
    <div class="section-hd">Rules Reference — Complete Handbook</div>
    <div class="card mb20" style="background:linear-gradient(135deg,#1F3864,#2E5FA3);color:white;border:none">
      <div style="font-family:'Syne',sans-serif;font-size:1rem;font-weight:700;margin-bottom:8px">How to use this guide</div>
      <div style="font-size:.84rem;opacity:.85;line-height:1.6">Each rule below explains what triggers a violation, why the rule exists, and what action to take. When you receive a violation report, find the Rule ID here to understand exactly what needs to be corrected. Green = healthy, Amber = watch, Red = must fix before approval.</div>
    </div>
    ${Object.entries(cats).map(([cat,ruleIds])=>`
      <div class="card mb20">
        <div class="section-hd" style="font-size:.95rem">${cat}</div>
        ${ruleIds.map(id=>{
          const meta=RULE_META[id];
          if(!meta)return'';
          const guide=RULE_GUIDE[id]||{desc:'See tool documentation.',action:'Review and correct.',why:'Compliance requirement.'};
          const cnt=countByRule[id]||0;
          return`<div class="rule-card">
            <div class="rule-card-header">
              <div class="flex-gap">
                <code class="rule-id">${id}</code>
                <span class="badge b-${meta.severity.toLowerCase()}">${meta.severity}</span>
                <strong style="font-size:.88rem">${meta.name}</strong>
              </div>
              <div class="flex-gap">
                ${cnt>0?`<span class="badge b-high">${cnt} active violation${cnt>1?'s':''}</span>`:`<span class="badge b-ok">✓ No violations</span>`}
              </div>
            </div>
            <div class="rule-card-body">
              <div class="rule-section"><span class="rule-section-label">📋 What triggers it</span><p>${guide.desc}</p></div>
              <div class="rule-section"><span class="rule-section-label">🔧 What to do</span><p>${guide.action}</p></div>
              <div class="rule-section"><span class="rule-section-label">💡 Why it matters</span><p>${guide.why}</p></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `).join('')}
  `;
}

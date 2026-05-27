/* ═══════════════════════════════════════════════════════════
   VIEWS.JS — All 8 dashboard view renderers
   Views: overview | activities | jmp | cashflow |
          variance | missions | market | violations
═══════════════════════════════════════════════════════════ */

// Chart registry — destroy before re-creating
const Charts = {};
function destroyCharts() {
  Object.values(Charts).forEach(c => { try { c.destroy(); } catch(e){} });
  Object.keys(Charts).forEach(k => delete Charts[k]);
}

// Chart defaults
const BLUE_PALETTE = ['#1F3864','#2E5FA3','#4A80C8','#7CA8DA','#AAC9EA','#D5E4F5'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const QCOLS = { Q1:'#2E5FA3', Q2:'#4A80C8', Q3:'#C8A755', Q4:'#C00000' };

function mkChart(id, type, data, options) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (Charts[id]) { try { Charts[id].destroy(); } catch(e){} }
  Charts[id] = new Chart(canvas, { type, data, options: options || {} });
}

// ═══════════════════════════════════════════════════════════
// VIEW 1 — OVERVIEW
// ═══════════════════════════════════════════════════════════
function renderOverview(state) {
  const { review, violations } = state;
  const budget = review.budget || [];
  const acts   = review.tacticalDetails || [];

  // Aggregate monthly cashflow across all markets
  const monthly = MONTHS.reduce((o,m)=>({...o,[m]:0}), {});
  budget.forEach(r => MONTHS.forEach(m => { monthly[m] += r.monthly[m]||0; }));

  const total = Object.values(monthly).reduce((s,v)=>s+v,0);
  const Q1v = monthly.Jan+monthly.Feb+monthly.Mar;
  const Q2v = monthly.Apr+monthly.May+monthly.Jun;
  const Q3v = monthly.Jul+monthly.Aug+monthly.Sep;
  const Q4v = monthly.Oct+monthly.Nov+monthly.Dec;
  const H1pct = total ? ((Q1v+Q2v)/total*100).toFixed(1) : '0';
  const H2pct = total ? ((Q3v+Q4v)/total*100).toFixed(1) : '0';
  const q34flag = (Q3v+Q4v) > (Q1v+Q2v);

  // Top markets by cashflow
  const mktCF = {};
  budget.forEach(r => { mktCF[r.projectName] = (mktCF[r.projectName]||0) + Object.values(r.monthly).reduce((s,v)=>s+v,0); });
  const topMkts = Object.entries(mktCF).sort((a,b)=>b[1]-a[1]).slice(0,10);

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Global Cashflow Overview <small>Source: Budget Sheet</small></div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Monthly Cashflow Distribution</div>
        <div class="chart-wrap"><canvas id="c-monthly"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Quarterly Share of Annual Spend</div>
        <div style="display:flex;align-items:center;gap:20px">
          <div class="chart-wrap-sm" style="width:200px;flex-shrink:0"><canvas id="c-quarterly"></canvas></div>
          <div>
            <table class="dt" style="width:auto">
              <thead><tr><th>Quarter</th><th class="th-r">AED</th><th class="th-r">%</th><th class="th-r">Flag</th></tr></thead>
              <tbody>
                ${['Q1','Q2','Q3','Q4'].map((q,i)=>{
                  const v = [Q1v,Q2v,Q3v,Q4v][i];
                  const pct = total ? (v/total*100).toFixed(1) : '0';
                  const flag = (i>=2 && (Q3v+Q4v)>(Q1v+Q2v)) ? '<span class="badge b-high">VIOLATION</span>' : '';
                  return `<tr class="${i>=2&&q34flag?'row-flag':''}"><td>${q}</td><td class="td-r t-mono">${fmtNum(v)}</td><td class="td-r">${pct}%</td><td class="td-c">${flag}</td></tr>`;
                }).join('')}
                <tr style="font-weight:700;border-top:2px solid var(--g200)">
                  <td>Total</td><td class="td-r t-mono">${fmtNum(total)}</td><td class="td-r">100%</td><td></td>
                </tr>
              </tbody>
            </table>
            ${q34flag ? `<div class="badge b-high mt16">⚠ H2 > H1 — Rule 1.2 Violated</div>` : `<div class="badge b-ok mt16">✓ H1 ≥ H2</div>`}
          </div>
        </div>
      </div>
    </div>

    <div class="card mb20">
      <div class="section-hd" style="font-size:.9rem">Top 10 Markets by Cashflow</div>
      <div class="chart-wrap-lg"><canvas id="c-mkt-cf"></canvas></div>
    </div>

    <div class="card mb20">
      <div class="flex-between mb16">
        <div class="section-hd" style="font-size:.9rem;margin:0;border:none">Monthly Detail Table</div>
        <span class="${q34flag?'badge b-high':'badge b-ok'}">${q34flag?'⚠ H2 Dominates':'✓ H1 Concentrated'}</span>
      </div>
      <div class="tbl-scroll">
        <table class="dt">
          <thead><tr><th>Month</th><th>Quarter</th><th class="th-r">Cashflow (AED)</th><th class="th-r">% of Annual</th><th class="th-r">Cumulative %</th></tr></thead>
          <tbody>
            ${MONTHS.map((m,i)=>{
              const v = monthly[m];
              const pct = total ? (v/total*100).toFixed(1) : '0';
              const cum = total ? (MONTHS.slice(0,i+1).reduce((s,mo)=>s+monthly[mo],0)/total*100).toFixed(1) : '0';
              const q = i<3?'Q1':i<6?'Q2':i<9?'Q3':'Q4';
              const flag = (m==='Oct'||m==='Nov'||m==='Dec') && v>0 ? 'row-flag' : '';
              return `<tr class="${flag}"><td>${m}</td><td>${q}</td><td class="td-r t-mono">${fmtNum(v)}</td><td class="td-r">${pct}%</td><td class="td-r">${cum}%</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    // Monthly bar
    const mColors = MONTHS.map((_,i) => i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4);
    mkChart('c-monthly','bar',{
      labels: MONTHS,
      datasets:[{ label:'Cashflow (AED)', data: MONTHS.map(m=>monthly[m]), backgroundColor: mColors }]
    },{ plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>fmtShort(v)}}} });

    // Quarterly donut
    mkChart('c-quarterly','doughnut',{
      labels:['Q1','Q2','Q3','Q4'],
      datasets:[{ data:[Q1v,Q2v,Q3v,Q4v], backgroundColor:[QCOLS.Q1,QCOLS.Q2,QCOLS.Q3,QCOLS.Q4] }]
    },{ plugins:{legend:{position:'bottom'}} });

    // Top markets bar
    mkChart('c-mkt-cf','bar',{
      labels: topMkts.map(([m])=>m),
      datasets:[{ label:'Cashflow (AED)', data: topMkts.map(([,v])=>v), backgroundColor:'#2E5FA3' }]
    },{ indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{callback:v=>fmtShort(v)}}} });
  });
}

// ═══════════════════════════════════════════════════════════
// VIEW 2 — ACTIVITIES COUNT BY MARKET
// ═══════════════════════════════════════════════════════════
function renderActivities(state) {
  const acts = applyFilters(state.review.tacticalDetails || [], state.filters);
  const TYPES = ['Existing JMP','New JMP','GSA Retainer Fee','Trade Promotion',
    'Mission & Travel','Co-Host Industry Event','Roadshow','Webinar','Admin','Others'];

  // Count by market
  const byMkt = {};
  acts.forEach(a => {
    const m = a.market || 'Unknown';
    if (!byMkt[m]) byMkt[m] = { total:0 };
    byMkt[m].total++;
    const t = a.activityType || 'Others';
    byMkt[m][t] = (byMkt[m][t]||0)+1;
  });
  const mktsSorted = Object.entries(byMkt).sort((a,b)=>b[1].total-a[1].total);

  // Count by type
  const byType = {};
  acts.forEach(a => { const t = a.activityType||'Others'; byType[t]=(byType[t]||0)+1; });
  const typesSorted = Object.entries(byType).sort((a,b)=>b[1]-a[1]);

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Activities Count by Market <small>${acts.length} activities</small></div>
    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Markets by Total Activities</div>
        <div class="chart-wrap-lg"><canvas id="c-acts-mkt"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Activities by Type</div>
        <div class="chart-wrap-lg"><canvas id="c-acts-type"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="flex-between mb16">
        <div class="section-hd" style="font-size:.9rem;margin:0;border:none">Market Activity Detail</div>
        <span class="t-muted" style="font-size:.78rem">Click row to expand types</span>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Market</th><th class="th-r">Total</th>
            <th class="th-r">JMPs</th><th class="th-r">Trade Promo</th>
            <th class="th-r">Missions</th><th class="th-r">Webinars</th>
            <th>Flags</th>
          </tr></thead>
          <tbody>
            ${mktsSorted.map(([m,d])=>{
              const flags = [];
              if (d['Others']>0) flags.push('<span class="badge b-high">Others!</span>');
              const missions = Object.entries(d).filter(([k])=>/mission/i.test(k)).reduce((s,[,v])=>s+v,0);
              if (missions>1) flags.push('<span class="badge b-medium">2+ Missions</span>');
              const jmps = (d['Existing JMP']||0)+(d['New JMP']||0);
              return `<tr class="${d['Others']>0?'row-flag':''}">
                <td><strong>${m}</strong></td>
                <td class="td-r"><strong>${d.total}</strong></td>
                <td class="td-r">${jmps||0}</td>
                <td class="td-r">${d['Trade Promotion']||0}</td>
                <td class="td-r">${missions||0}</td>
                <td class="td-r">${d['Webinar']||d['Webinars']||0}</td>
                <td>${flags.join(' ')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    mkChart('c-acts-mkt','bar',{
      labels: mktsSorted.map(([m])=>m),
      datasets:[{ label:'Activities', data: mktsSorted.map(([,d])=>d.total), backgroundColor:'#2E5FA3' }]
    },{ indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{stepSize:5}}} });

    mkChart('c-acts-type','bar',{
      labels: typesSorted.map(([t])=>t),
      datasets:[{ label:'Count', data: typesSorted.map(([,c])=>c),
        backgroundColor: typesSorted.map(([t])=> t.toLowerCase()==='others'?'#C00000':'#2E5FA3')
      }]
    },{ indexAxis:'y', plugins:{legend:{display:false}} });
  });
}

// ═══════════════════════════════════════════════════════════
// VIEW 3 — JMP TARGETS
// ═══════════════════════════════════════════════════════════
function renderJMP(state) {
  const jmp = state.review.jmpTargets || [];
  let sortKey = 'io2026'; let sortDir = -1;

  const totIO26  = jmp.reduce((s,j)=>s+j.io2026,0);
  const totIO25  = jmp.reduce((s,j)=>s+j.target2025,0);
  const growth   = totIO25 ? ((totIO26-totIO25)/totIO25*100).toFixed(1) : '—';

  const noTarget = jmp.filter(j=>j.io2026===0);
  const negGrowth = jmp.filter(j=>j.yoyGrowth<0 && j.io2026>0);

  function tableRows(data) {
    return data.sort((a,b) => (a[sortKey]-b[sortKey])*sortDir).map(j => {
      const gv = j.yoyGrowth;
      const gClass = gv < 0 ? 't-red' : gv > 0 ? 't-green' : '';
      const flag = j.io2026===0 ? '<span class="badge b-high">No Target</span>' :
                   j.yoyGrowth > 50 ? '<span class="badge b-medium">Outlier</span>' :
                   j.yoyGrowth < -20 ? '<span class="badge b-high">Sharp Drop</span>' : '';
      return `<tr class="${j.io2026===0?'row-flag':j.yoyGrowth<-20?'row-warn':''}">
        <td>${j.market}</td>
        <td class="td-r t-mono">${fmtNum(j.target2024)||'—'}</td>
        <td class="td-r t-mono">${fmtNum(j.target2025)||'—'}</td>
        <td class="td-r t-mono"><strong>${fmtNum(j.io2026)||'—'}</strong></td>
        <td class="td-r ${gClass}">${gv ? gv.toFixed(1)+'%' : '—'}</td>
        <td class="td-r">${j.newJMPs||0}</td>
        <td>${flag}</td>
      </tr>`;
    }).join('');
  }

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">JMP Targets per Market <small>Source: JMP Targets sheet</small></div>

    <div class="grid3 mb20">
      <div class="kpi-card kpi-info"><div class="kpi-label">IO 2026 Target</div><div class="kpi-value">${fmtShort(totIO26)}</div><div class="kpi-sub">visitors</div></div>
      <div class="kpi-card ${growth<0?'kpi-danger':'kpi-success'}"><div class="kpi-label">YoY Growth</div><div class="kpi-value ${growth<0?'t-red':'t-green'}">${growth}%</div><div class="kpi-sub">vs 2025 target</div></div>
      <div class="kpi-card ${noTarget.length>0?'kpi-warning':'kpi-success'}"><div class="kpi-label">Markets Without Target</div><div class="kpi-value">${noTarget.length}</div><div class="kpi-sub">${noTarget.slice(0,3).map(j=>j.market).join(', ')}</div></div>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Target Trend (2024–2026)</div>
        <div class="chart-wrap"><canvas id="c-jmp-trend"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">YoY Growth % by Market</div>
        <div class="chart-wrap"><canvas id="c-jmp-growth"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="flex-between mb16">
        <div class="section-hd" style="font-size:.9rem;margin:0;border:none">JMP Target Detail</div>
        <div class="flex-gap">
          <span class="badge b-high">${noTarget.length} No Target</span>
          <span class="badge b-medium">${negGrowth.length} Negative Growth</span>
        </div>
      </div>
      <div class="tbl-scroll tbl-scroll-h" id="jmp-table-wrap">
        <table class="dt" id="jmp-table">
          <thead><tr>
            <th class="sortable" data-col="market">Market</th>
            <th class="th-r sortable" data-col="target2024">2024 Target</th>
            <th class="th-r sortable" data-col="target2025">2025 Target</th>
            <th class="th-r sortable" data-col="io2026">2026 Target</th>
            <th class="th-r sortable" data-col="yoyGrowth">YoY %</th>
            <th class="th-r">New JMPs</th>
            <th>Status</th>
          </tr></thead>
          <tbody id="jmp-tbody">${tableRows(jmp)}</tbody>
        </table>
      </div>
    </div>
  `;

  // Sort handlers
  document.querySelectorAll('#jmp-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortKey === col) sortDir *= -1; else { sortKey = col; sortDir = -1; }
      document.getElementById('jmp-tbody').innerHTML = tableRows(jmp);
    });
  });

  requestAnimationFrame(() => {
    const top10 = [...jmp].sort((a,b)=>b.io2026-a.io2026).slice(0,10);
    mkChart('c-jmp-trend','bar',{
      labels: top10.map(j=>j.market),
      datasets:[
        { label:'2024', data: top10.map(j=>j.target2024), backgroundColor:'#7CA8DA' },
        { label:'2025', data: top10.map(j=>j.target2025), backgroundColor:'#2E5FA3' },
        { label:'2026', data: top10.map(j=>j.io2026),     backgroundColor:'#1F3864' },
      ]
    },{ plugins:{legend:{position:'bottom'}}, scales:{y:{ticks:{callback:v=>fmtShort(v)}}} });

    const growthMkts = jmp.filter(j=>j.yoyGrowth!==0 && j.io2026>0);
    mkChart('c-jmp-growth','bar',{
      labels: growthMkts.map(j=>j.market),
      datasets:[{ label:'YoY %', data: growthMkts.map(j=>j.yoyGrowth),
        backgroundColor: growthMkts.map(j=>j.yoyGrowth<0?'#C00000':'#15803D')
      }]
    },{ plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>v+'%'}}} });
  });
}

// ═══════════════════════════════════════════════════════════
// VIEW 4 — CASHFLOW HEATMAP
// ═══════════════════════════════════════════════════════════
function renderCashflow(state) {
  const budget = applyFilters(state.review.budget || [], state.filters, 'projectName');
  const markets = [...new Set(budget.map(r=>r.projectName))].sort();
  const cfByMkt = {};
  markets.forEach(m => {
    cfByMkt[m] = { Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0 };
  });
  budget.forEach(r => MONTHS.forEach(m => { if(cfByMkt[r.projectName]) cfByMkt[r.projectName][m] += r.monthly[m]||0; }));

  function heatClass(v, maxV) {
    if (!v || v===0) return 'h0';
    const ratio = v/maxV;
    if (ratio < .15) return 'h1';
    if (ratio < .30) return 'h2';
    if (ratio < .55) return 'h3';
    if (ratio < .80) return 'h4';
    return 'h5';
  }

  const allVals = Object.values(cfByMkt).flatMap(m=>Object.values(m));
  const maxV = Math.max(...allVals, 1);

  // Monthly totals
  const mTotals = {};
  MONTHS.forEach(m => { mTotals[m] = Object.values(cfByMkt).reduce((s,mc)=>s+mc[m],0); });

  // Violation check per row
  function rowViolation(mo) {
    const H2 = (mo.Jul||0)+(mo.Aug||0)+(mo.Sep||0)+(mo.Oct||0)+(mo.Nov||0)+(mo.Dec||0);
    const H1 = (mo.Jan||0)+(mo.Feb||0)+(mo.Mar||0)+(mo.Apr||0)+(mo.May||0)+(mo.Jun||0);
    return H2 > H1;
  }

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Monthly Activity End Date Distribution <small>Cashflow heatmap by market</small></div>

    <div class="card mb20">
      <div class="section-hd" style="font-size:.9rem">Monthly Cashflow Totals</div>
      <div class="chart-wrap"><canvas id="c-cf-monthly"></canvas></div>
    </div>

    <div class="card">
      <div class="section-hd" style="font-size:.9rem flex-between">
        Cashflow Heatmap — Market × Month
        <small style="font-weight:400">🔴 = H2 > H1 violation (Rule 1.2)</small>
      </div>
      <div class="heatmap-wrap">
        <table class="heatmap">
          <thead>
            <tr>
              <th class="market-hd">Market</th>
              ${MONTHS.map(m=>`<th>${m}</th>`).join('')}
              <th>H1 vs H2</th>
            </tr>
          </thead>
          <tbody>
            ${markets.map(mkt => {
              const mo = cfByMkt[mkt];
              const viol = rowViolation(mo);
              const h1 = MONTHS.slice(0,6).reduce((s,m)=>s+mo[m],0);
              const h2 = MONTHS.slice(6).reduce((s,m)=>s+mo[m],0);
              return `<tr>
                <td class="market-cell">${mkt}</td>
                ${MONTHS.map(m => {
                  const v = mo[m]||0;
                  const cls = (m==='Oct'||m==='Nov'||m==='Dec')&&v>0 ? 'h-viol' : heatClass(v,maxV);
                  return `<td class="${cls}" title="${mkt} ${m}: ${fmtAED(v)}">${v>0?fmtShort(v):''}</td>`;
                }).join('')}
                <td style="text-align:center;padding:4px 8px">
                  ${viol?'<span class="badge b-high">H2!</span>':'<span class="badge b-ok">✓</span>'}
                </td>
              </tr>`;
            }).join('')}
            <tr style="font-weight:700;background:var(--g100)">
              <td class="market-cell">TOTAL</td>
              ${MONTHS.map(m=>`<td style="text-align:center;font-size:.72rem;font-weight:700">${fmtShort(mTotals[m])}</td>`).join('')}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;font-size:.72rem;align-items:center">
        <span>Intensity:</span>
        ${['h1','h2','h3','h4','h5'].map((c,i)=>`<span class="${c}" style="padding:3px 10px;border-radius:4px">${['Low','','Med','','High'][i]||''}</span>`).join('')}
        <span class="h-viol" style="padding:3px 10px;border-radius:4px">Oct–Dec Active</span>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    mkChart('c-cf-monthly','bar',{
      labels: MONTHS,
      datasets:[{ label:'Total Cashflow (AED)',
        data: MONTHS.map(m=>mTotals[m]),
        backgroundColor: MONTHS.map((_,i) => i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)
      }]
    },{ plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>fmtShort(v)}}} });
  });
}

// ═══════════════════════════════════════════════════════════
// VIEW 5 — BUDGET VARIANCE
// ═══════════════════════════════════════════════════════════
function renderVariance(state) {
  const { baseline, review } = state;
  const bBase = (baseline.budget || []);
  const bRev  = (review.budget  || []);

  // Build variance table
  const baseMap = {};
  bBase.forEach(r => {
    const k = `${r.projectName}||${r.taskName}||${r.financeTask}`;
    baseMap[k] = (baseMap[k]||0) + (r.budget2026||r.baseline||0);
  });

  const rows = [];
  const revMap = {};
  bRev.forEach(r => {
    const k = `${r.projectName}||${r.taskName}||${r.financeTask}`;
    revMap[k] = (revMap[k]||0) + (r.budget2026||r.baseline||0);
  });

  const allKeys = new Set([...Object.keys(baseMap), ...Object.keys(revMap)]);
  allKeys.forEach(k => {
    const [proj, task, ft] = k.split('||');
    const fin = baseMap[k]||0;
    const tac = revMap[k]||0;
    const diff = fin - tac;
    const pct  = fin ? (diff/fin*100).toFixed(1) : null;
    rows.push({
      project: proj, task, financeTask: ft,
      finance: fin, tactical: tac, variance: diff, variancePct: parseFloat(pct||0),
      lockStatus: getTaskInfo(ft).lockStatus,
    });
  });
  rows.sort((a,b)=>Math.abs(b.variance)-Math.abs(a.variance));

  const totFin = rows.reduce((s,r)=>s+r.finance,0);
  const totTac = rows.reduce((s,r)=>s+r.tactical,0);
  const totVar = totFin - totTac;

  const top10 = rows.slice(0,10);
  const maxAbs = Math.max(...top10.map(r=>Math.abs(r.variance)), 1);

  const fltLock = state.filters.lock || '';

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Budget vs Tactical Plan Variance</div>

    <div class="grid3 mb20">
      <div class="kpi-card kpi-info"><div class="kpi-label">Total Finance Budget</div><div class="kpi-value">${fmtShort(totFin)}</div><div class="kpi-sub">AED</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">Total Tactical Plan</div><div class="kpi-value">${fmtShort(totTac)}</div><div class="kpi-sub">AED</div></div>
      <div class="kpi-card ${totVar<0?'kpi-danger':'kpi-success'}"><div class="kpi-label">Total Variance</div><div class="kpi-value ${totVar<0?'t-red':'t-green'}">${totVar<0?'−':''}${fmtShort(Math.abs(totVar))}</div><div class="kpi-sub">${totVar<0?'Tactical exceeds Finance':'Finance exceeds Tactical'}</div></div>
    </div>

    <div class="card mb20">
      <div class="section-hd" style="font-size:.9rem">Top 10 Variance Items</div>
      ${top10.map(r => {
        const barW = Math.min(Math.abs(r.variance)/maxAbs*100, 100).toFixed(1);
        return `<div class="waterfall-row">
          <div class="wf-label" title="${r.project} — ${r.task}">${r.project} — ${r.task}</div>
          <div class="wf-bar-wrap"><div class="wf-bar ${r.variance>=0?'pos':'neg'}" style="width:${barW}%"></div></div>
          <div class="wf-val ${r.variance>=0?'t-green':'t-red'}">${r.variance>=0?'+':''}${fmtNum(r.variance)}</div>
          <span class="badge ${r.lockStatus==='Locked'?'b-locked':'b-unlocked'}" style="margin-left:8px">${r.lockStatus}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="card">
      <div class="flex-between mb16">
        <div class="section-hd" style="font-size:.9rem;margin:0;border:none">Full Variance Table</div>
        <div class="flex-gap">
          <span class="badge b-high">${rows.filter(r=>r.variance<0&&r.lockStatus==='Locked').length} Locked Overruns</span>
        </div>
      </div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Project</th><th>Task</th>
            <th class="th-r">Finance (AED)</th><th class="th-r">Tactical (AED)</th>
            <th class="th-r">Variance (AED)</th><th class="th-r">Variance %</th>
            <th>Lock Status</th><th>Flag</th>
          </tr></thead>
          <tbody>
            ${rows.filter(r => !fltLock || r.lockStatus===fltLock).map(r => {
              const flag = r.variance<0 && r.lockStatus==='Locked' ? '<span class="badge b-high">⚠ Overrun on Locked</span>' : '';
              return `<tr class="${r.variance<0&&r.lockStatus==='Locked'?'row-flag':r.variance<0?'row-warn':''}">
                <td>${r.project}</td><td>${r.task||r.financeTask}</td>
                <td class="td-r t-mono">${fmtNum(r.finance)}</td>
                <td class="td-r t-mono">${fmtNum(r.tactical)}</td>
                <td class="td-r t-mono ${r.variance<0?'t-red':'t-green'}">${r.variance>=0?'+':''}${fmtNum(r.variance)}</td>
                <td class="td-r ${r.variancePct<0?'t-red':'t-green'}">${r.variancePct>=0?'+':''}${r.variancePct}%</td>
                <td><span class="badge ${r.lockStatus==='Locked'?'b-locked':'b-unlocked'}">${r.lockStatus}</span></td>
                <td>${flag}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// VIEW 6 — MISSIONS & TRAVEL OWNER MAP
// ═══════════════════════════════════════════════════════════
function renderMissions(state) {
  const acts = (state.review.tacticalDetails || [])
    .filter(a => /mission|travel/i.test(a.activityType || a.activityName));

  const markets = [...new Set(acts.map(a=>a.market))].sort();
  const owners  = [...new Set(acts.map(a=>a.owner).filter(Boolean))].sort();

  // Build matrix
  const matrix = {};
  markets.forEach(m => { matrix[m] = {}; owners.forEach(o => { matrix[m][o]=0; }); });
  acts.forEach(a => { if(matrix[a.market]) matrix[a.market][a.owner||'Unassigned'] = (matrix[a.market][a.owner||'Unassigned']||0)+1; });

  const ownerTotals = {};
  owners.forEach(o => { ownerTotals[o] = acts.filter(a=>a.owner===o).length; });
  const ownersSorted = [...owners].sort((a,b)=>(ownerTotals[b]||0)-(ownerTotals[a]||0));

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Mission & Travel — Activity Owner Map <small>${acts.length} total activities</small></div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Activities per Owner</div>
        <div class="chart-wrap"><canvas id="c-owner-bar"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Mission List</div>
        <div class="tbl-scroll tbl-scroll-h">
          <table class="dt">
            <thead><tr><th>Market</th><th>Activity</th><th>Owner</th><th>Budget (AED)</th></tr></thead>
            <tbody>
              ${acts.sort((a,b)=>a.market.localeCompare(b.market)).map(a=>`
                <tr><td>${a.market}</td><td>${a.activityName}</td>
                <td>${a.owner||'<span class="t-red">Unassigned</span>'}</td>
                <td class="td-r t-mono">${fmtNum(a.budget)}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    ${owners.length > 0 ? `
    <div class="card">
      <div class="section-hd" style="font-size:.9rem">Owner × Market Matrix</div>
      <div class="heatmap-wrap">
        <table class="matrix">
          <thead><tr>
            <th class="mkt-hd">Market</th>
            ${ownersSorted.map(o=>`<th title="${o}">${o.split(' ')[0]}</th>`).join('')}
            <th>Total</th>
          </tr></thead>
          <tbody>
            ${markets.map(m=>`
              <tr>
                <td class="mkt-name">${m}</td>
                ${ownersSorted.map(o=>{
                  const c = matrix[m][o]||0;
                  return `<td>${c>0?`<span class="matrix-count">${c}</span>`:''}</td>`;
                }).join('')}
                <td style="text-align:center;font-weight:700">${acts.filter(a=>a.market===m).length}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
  `;

  requestAnimationFrame(() => {
    mkChart('c-owner-bar','bar',{
      labels: ownersSorted.map(o=>o.split(' ').slice(0,2).join(' ')),
      datasets:[{ label:'Activities', data: ownersSorted.map(o=>ownerTotals[o]||0), backgroundColor:'#2E5FA3' }]
    },{ indexAxis:'y', plugins:{legend:{display:false}} });
  });
}

// ═══════════════════════════════════════════════════════════
// VIEW 7 — MARKET DEEP DIVE
// ═══════════════════════════════════════════════════════════
function renderMarket(state, selectedMarket) {
  const acts   = state.review.tacticalDetails || [];
  const budget = state.review.budget || [];
  const markets= [...new Set(acts.map(a=>a.market).filter(Boolean))].sort();
  const mkt    = selectedMarket || markets[0] || '';

  const mActs  = acts.filter(a => a.market === mkt);
  const mBudget= budget.filter(r => r.projectName === mkt);

  // Monthly cashflow for this market
  const mCF = { Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0 };
  mBudget.forEach(r => MONTHS.forEach(m => { mCF[m] += r.monthly[m]||0; }));
  const H1 = MONTHS.slice(0,6).reduce((s,m)=>s+mCF[m],0);
  const H2 = MONTHS.slice(6).reduce((s,m)=>s+mCF[m],0);

  // Budget by task type
  const typeMap = {};
  mBudget.forEach(r => {
    const t = getTaskInfo(r.financeTask).display || r.taskName || 'Other';
    typeMap[t] = (typeMap[t]||0) + (r.budget2026||r.baseline||0);
  });

  // Compliance checks
  const hasOthers    = mActs.some(a=>/^others?$/i.test(a.activityType||''));
  const q34viol      = H2 > H1;
  const contractsQ34 = mActs.some(a=>isJMP(a.activityName,a.activityType,a.jmpStatus)&&a.endDate&&a.endDate.getMonth()>=6);
  const RAM_START_2  = new Date(2026,2,1), RAM_END_2 = new Date(2026,3,30);
  const ramadanActs  = mActs.filter(a=>{
    const inR = (d=>d&&d>=RAM_START_2&&d<=RAM_END_2);
    return inR(a.startDate)||inR(a.endDate);
  });
  const ramZero      = ramadanActs.filter(a=>a.budget===0).length;
  const famOk        = mActs.filter(a=>isMegaFAM(a.activityName)).every(a=>a.attendees>=50);
  const missionCount = mActs.filter(a=>isSalesMission(a.activityName,a.activityType)).length;
  const missingKPI   = mActs.filter(a=>!a.revenue&&!a.attendees).length;
  const trainingP1   = mActs.some(a=>isTraining(a.activityName,a.activityType)&&a.priority===1);

  function chk(pass, text) {
    return `<div class="check-item ${pass?'pass':'fail'}">
      <span class="check-icon">${pass?'✅':'❌'}</span>
      <span>${text}</span>
    </div>`;
  }

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Market Deep Dive</div>

    <div class="market-selector">
      <label>Select Market:</label>
      <select id="mkt-select">
        ${markets.map(m=>`<option value="${m}" ${m===mkt?'selected':''}>${m}</option>`).join('')}
      </select>
      <span class="t-muted" style="font-size:.78rem">${mActs.length} activities | Budget: ${fmtAED(Object.values(typeMap).reduce((s,v)=>s+v,0))}</span>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Monthly Cashflow</div>
        <div class="chart-wrap"><canvas id="c-mkt-cf"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Budget by Task Type</div>
        <div class="chart-wrap"><canvas id="c-mkt-type"></canvas></div>
      </div>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Compliance Checklist</div>
        <div class="checklist">
          ${chk(!hasOthers,    'No "Others" activity types')}
          ${chk(!q34viol,      `H1 ≥ H2 cashflow (H1=${fmtAED(H1)}, H2=${fmtAED(H2)})`)}
          ${chk(!contractsQ34, 'All JMP contract closures in Q1/Q2')}
          ${chk(ramZero>=2,    `Ramadan zero-budget activities: ${ramZero}/2 required`)}
          ${chk(famOk,         'Mega FAM Trips ≥ 50 participants')}
          ${chk(missionCount<=1, `Sales missions: ${missionCount} (max 1)`)}
          ${chk(missingKPI===0,  `Activities missing KPIs: ${missingKPI}`)}
          ${chk(!trainingP1,   'No training activities at Priority 1')}
        </div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Market Summary</div>
        <table class="dt">
          <tbody>
            <tr><td>Total Activities</td><td class="td-r"><strong>${mActs.length}</strong></td></tr>
            <tr><td>Total Budget (AED)</td><td class="td-r t-mono">${fmtNum(Object.values(typeMap).reduce((s,v)=>s+v,0))}</td></tr>
            <tr><td>H1 Cashflow</td><td class="td-r t-mono">${fmtNum(H1)}</td></tr>
            <tr><td>H2 Cashflow</td><td class="td-r t-mono ${H2>H1?'t-red':''}">${fmtNum(H2)}</td></tr>
            <tr><td>Unique Owners</td><td class="td-r">${[...new Set(mActs.map(a=>a.owner).filter(Boolean))].length}</td></tr>
            <tr><td>JMP Activities</td><td class="td-r">${mActs.filter(a=>isJMP(a.activityName,a.activityType,a.jmpStatus)).length}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="section-hd" style="font-size:.9rem">Activity List</div>
      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th>Activity Name</th><th>Type</th><th class="td-c">Priority</th>
            <th>Start</th><th>End</th>
            <th class="th-r">Budget</th><th class="th-r">Revenue</th>
            <th class="th-r">Attendees</th>
            <th>Owner</th><th>JMP Status</th>
          </tr></thead>
          <tbody>
            ${mActs.map(a=>{
              const typeFlag = /^others?$/i.test(a.activityType||'') ? 't-red' : '';
              return `<tr class="${(!a.revenue&&!a.attendees)?'row-warn':''}">
                <td>${a.activityName}</td>
                <td class="${typeFlag}">${a.activityType||'—'}</td>
                <td class="td-c">${a.priority||'—'}</td>
                <td>${fmtDate(a.startDate)}</td>
                <td>${fmtDate(a.endDate)}</td>
                <td class="td-r t-mono">${fmtNum(a.budget)}</td>
                <td class="td-r t-mono">${fmtNum(a.revenue)}</td>
                <td class="td-r">${a.attendees||'—'}</td>
                <td>${a.owner||'—'}</td>
                <td>${a.jmpStatus||'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('mkt-select').addEventListener('change', e => {
    renderMarket(state, e.target.value);
  });

  requestAnimationFrame(() => {
    mkChart('c-mkt-cf','bar',{
      labels: MONTHS,
      datasets:[{ label:'Cashflow (AED)', data: MONTHS.map(m=>mCF[m]),
        backgroundColor: MONTHS.map((_,i)=>i<3?QCOLS.Q1:i<6?QCOLS.Q2:i<9?QCOLS.Q3:QCOLS.Q4)
      }]
    },{ plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>fmtShort(v)}}} });

    const typeLabels = Object.keys(typeMap);
    mkChart('c-mkt-type','doughnut',{
      labels: typeLabels,
      datasets:[{ data: typeLabels.map(t=>typeMap[t]), backgroundColor: BLUE_PALETTE }]
    },{ plugins:{legend:{position:'right'}} });
  });
}

// ═══════════════════════════════════════════════════════════
// VIEW 8 — RULE VIOLATIONS
// ═══════════════════════════════════════════════════════════
function renderViolations(state) {
  let viols = state.violations;
  let fltSev = '', fltMkt = '', fltRule = '';
  const sum = summarise(viols);

  function filteredViols() {
    return viols.filter(v =>
      (!fltSev  || v.severity === fltSev) &&
      (!fltMkt  || v.market   === fltMkt) &&
      (!fltRule || v.ruleId   === fltRule)
    );
  }

  function renderTable() {
    const fv = filteredViols();
    document.getElementById('viol-count-label').textContent = `${fv.length} violation${fv.length!==1?'s':''}`;
    document.getElementById('viol-tbody').innerHTML = fv.map((v,i) => {
      const real_i = viols.indexOf(v);
      return `<tr class="${v.justified?'':'v.severity==='HIGH'?'row-flag':v.severity==='MEDIUM'?'row-warn':''}"
               style="${v.justified?'opacity:.5':''}">
        <td class="td-c"><span class="badge b-${v.severity.toLowerCase()}">${v.severity}</span></td>
        <td><code style="font-size:.72rem;color:var(--blue)">${v.ruleId}</code></td>
        <td style="font-size:.78rem">${v.ruleName}</td>
        <td>${v.market}</td>
        <td style="font-size:.78rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${v.item}">${v.item}</td>
        <td style="font-size:.76rem;color:var(--g700);max-width:280px">${v.detail}</td>
        <td class="td-c">
          <input type="checkbox" class="justify-checkbox" data-idx="${real_i}"
            ${v.justified?'checked':''} title="Mark as justified">
        </td>
        <td>
          <input type="text" class="justify-input" placeholder="Add justification note…"
            data-idx="${real_i}" value="${v.justificationNote||''}">
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--g400)">No violations match this filter.</td></tr>`;
  }

  document.getElementById('view-area').innerHTML = `
    <div class="section-hd">Rule Violation Summary</div>

    <div class="grid3 mb20" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card kpi-danger">
        <div class="kpi-label">HIGH</div>
        <div class="kpi-value t-red">${sum.counts.HIGH}</div>
        <div class="kpi-sub">violations</div>
      </div>
      <div class="kpi-card kpi-warning">
        <div class="kpi-label">MEDIUM</div>
        <div class="kpi-value" style="color:var(--amber)">${sum.counts.MEDIUM}</div>
        <div class="kpi-sub">violations</div>
      </div>
      <div class="kpi-card kpi-info">
        <div class="kpi-label">LOW</div>
        <div class="kpi-value">${sum.counts.LOW}</div>
        <div class="kpi-sub">violations</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Top Market</div>
        <div class="kpi-value" style="font-size:1rem">${sum.topMarkets[0]?.market||'—'}</div>
        <div class="kpi-sub">${sum.topMarkets[0]?.count||0} violations</div>
      </div>
    </div>

    <div class="grid2 mb20">
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Top Markets by Violations</div>
        <div class="chart-wrap-sm"><canvas id="c-viol-mkt"></canvas></div>
      </div>
      <div class="card">
        <div class="section-hd" style="font-size:.9rem">Violations by Rule</div>
        <div class="chart-wrap-sm"><canvas id="c-viol-rule"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="flex-between mb16">
        <div class="flex-gap">
          <span class="section-hd" style="font-size:.9rem;margin:0;border:none">All Violations</span>
          <span id="viol-count-label" class="t-muted" style="font-size:.78rem"></span>
        </div>
        <div class="flex-gap">
          <select class="flt-select" id="flt-viol-sev">
            <option value="">All Severity</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <select class="flt-select" id="flt-viol-mkt">
            <option value="">All Markets</option>
            ${[...new Set(viols.map(v=>v.market))].sort().map(m=>`<option value="${m}">${m}</option>`).join('')}
          </select>
          <select class="flt-select" id="flt-viol-rule">
            <option value="">All Rules</option>
            ${[...new Set(viols.map(v=>v.ruleId))].sort().map(r=>`<option value="${r}">${r} — ${RULE_META[r]?.name||r}</option>`).join('')}
          </select>
          <button class="btn-export" id="btn-export-excel">⬇ Export Excel</button>
          <button class="btn-secondary" id="btn-export-csv">⬇ CSV</button>
        </div>
      </div>

      <div class="tbl-scroll tbl-scroll-h">
        <table class="dt">
          <thead><tr>
            <th class="td-c">Severity</th><th>Rule</th><th>Rule Name</th>
            <th>Market</th><th>Activity / Item</th><th>Detail</th>
            <th class="td-c">Justified</th><th>Note</th>
          </tr></thead>
          <tbody id="viol-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderTable();

  // Filter listeners
  ['flt-viol-sev','flt-viol-mkt','flt-viol-rule'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', e => {
      if (id==='flt-viol-sev') fltSev=e.target.value;
      if (id==='flt-viol-mkt') fltMkt=e.target.value;
      if (id==='flt-viol-rule') fltRule=e.target.value;
      renderTable();
    });
  });

  // Justify checkbox + note
  document.getElementById('viol-tbody').addEventListener('change', e => {
    const idx = e.target.dataset.idx;
    if (e.target.classList.contains('justify-checkbox') && idx !== undefined) {
      viols[idx].justified = e.target.checked;
      const row = e.target.closest('tr');
      if (e.target.checked) row.style.opacity = '.5';
      else row.style.opacity = '1';
      updateViolationBadge(viols);
    }
  });
  document.getElementById('viol-tbody').addEventListener('input', e => {
    if (e.target.classList.contains('justify-input')) {
      const idx = e.target.dataset.idx;
      if (idx !== undefined) viols[idx].justificationNote = e.target.value;
    }
  });

  // Export
  document.getElementById('btn-export-excel')?.addEventListener('click', () => {
    exportViolationsToExcel(viols);
  });
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    exportViolationsToCSV(viols);
  });

  requestAnimationFrame(() => {
    const top8mkts = sum.topMarkets.slice(0,8);
    mkChart('c-viol-mkt','bar',{
      labels: top8mkts.map(m=>m.market),
      datasets:[{ label:'Violations', data: top8mkts.map(m=>m.count),
        backgroundColor: ['#C00000','#D32F2F','#E53935','#EF5350','#EF9A9A','#FFCDD2','#F8D7DA','#FCE4EC']
      }]
    },{ indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{stepSize:1}}} });

    const ruleGroups = {};
    viols.forEach(v=>{ ruleGroups[v.ruleId]=(ruleGroups[v.ruleId]||0)+1; });
    const topRules = Object.entries(ruleGroups).sort((a,b)=>b[1]-a[1]).slice(0,8);
    mkChart('c-viol-rule','bar',{
      labels: topRules.map(([r])=>r),
      datasets:[{ label:'Count', data: topRules.map(([,c])=>c),
        backgroundColor: topRules.map(([r])=> RULE_META[r]?.severity==='HIGH'?'#C00000':RULE_META[r]?.severity==='MEDIUM'?'#D97706':'#8D94A6')
      }]
    },{ plugins:{legend:{display:false}}, scales:{y:{ticks:{stepSize:1}}} });
  });
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function fmtShort(n) {
  if (!n || n===0) return '0';
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(0)+'K';
  return n.toFixed(0);
}

function applyFilters(data, filters, marketKey) {
  if (!filters) return data;
  const mKey = marketKey || 'market';
  return data.filter(r => {
    if (filters.market && r[mKey] && r[mKey] !== filters.market) return false;
    if (filters.type && r.activityType && r.activityType !== filters.type) return false;
    if (filters.priority && r.priority && String(r.priority) !== filters.priority) return false;
    if (filters.lock && r.lockStatus && r.lockStatus !== filters.lock) return false;
    return true;
  });
}

function updateViolationBadge(viols) {
  const active = viols.filter(v=>!v.justified).length;
  const el = document.getElementById('nav-viol-count');
  if (el) el.textContent = active;
}

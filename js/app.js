/* ═══════════════════════════════════════════════════════════
   APP.JS — Main controller: upload, state, navigation, KPIs
═══════════════════════════════════════════════════════════ */

// ── Global State ─────────────────────────────────────────
const APP = {
  baseline:   null,   // parsed baseline workbook data
  review:     null,   // parsed review workbook data
  violations: [],     // computed violations array
  activeView: 'overview',
  filters:    { market:'', type:'', priority:'', lock:'' },
};

// ── DOM Refs ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Upload screen logic ───────────────────────────────────
function setupUpload() {
  const inputBase   = $('input-baseline');
  const inputReview = $('input-review');
  const btnAnalyze  = $('btn-analyze');

  let baseFile   = null;
  let reviewFile = null;

  function onFileSelect(file, isBaseline) {
    if (!file) return;
    if (isBaseline) {
      baseFile = file;
      $('fname-baseline').textContent = file.name;
      $('ok-baseline').classList.remove('hidden');
      $('card-baseline').classList.add('loaded');
    } else {
      reviewFile = file;
      $('fname-review').textContent = file.name;
      $('ok-review').classList.remove('hidden');
      $('card-review').classList.add('loaded');
    }
    btnAnalyze.disabled = !(baseFile && reviewFile);
  }

  inputBase.addEventListener('change',   e => onFileSelect(e.target.files[0], true));
  inputReview.addEventListener('change', e => onFileSelect(e.target.files[0], false));

  btnAnalyze.addEventListener('click', async () => {
    if (!baseFile || !reviewFile) return;
    $('loading-overlay').classList.remove('hidden');

    try {
      const [baseline, review] = await Promise.all([
        parseWorkbook(baseFile),
        parseWorkbook(reviewFile),
      ]);

      APP.baseline = baseline;
      APP.review   = review;

      // Run all rules
      APP.violations = runRules(baseline, review);

      // Populate filter dropdowns from review data
      populateFilters(review);

      // Update header info
      $('dash-sub').textContent = `Baseline: ${baseFile.name} → Review: ${reviewFile.name}`;

      // Render initial view
      renderKPIStrip();
      updateSeverityPills();
      renderView('overview');

      // Switch screens
      $('upload-screen').classList.add('hidden');
      $('dashboard').classList.remove('hidden');

    } catch (err) {
      console.error('Parse error:', err);
      alert('Error reading file:\n' + err.message + '\n\nCheck that sheet names match:\n• Tactical\n• Budget\n• JMP Targets per Market\n• Tactical Details');
    } finally {
      $('loading-overlay').classList.add('hidden');
    }
  });

  $('btn-new-upload')?.addEventListener('click', () => {
    $('dashboard').classList.add('hidden');
    $('upload-screen').classList.remove('hidden');
    APP.baseline = APP.review = null;
    APP.violations = [];
    destroyCharts();
    inputBase.value = inputReview.value = '';
    btnAnalyze.disabled = true;
    baseFile = reviewFile = null;
    ['baseline','review'].forEach(t => {
      $(`fname-${t}`).textContent = 'No file selected';
      $(`ok-${t}`).classList.add('hidden');
      $(`card-${t}`).classList.remove('loaded');
    });
  });
}

// ── Populate filter dropdowns ─────────────────────────────
function populateFilters(review) {
  const acts = review.tacticalDetails || [];

  const markets = [...new Set(acts.map(a=>a.market).filter(Boolean))].sort();
  const types   = [...new Set(acts.map(a=>a.activityType).filter(Boolean))].sort();

  const mktSel = $('flt-market');
  markets.forEach(m => { const o=document.createElement('option'); o.value=m; o.textContent=m; mktSel.appendChild(o); });

  const typSel = $('flt-type');
  types.forEach(t => { const o=document.createElement('option'); o.value=t; o.textContent=t; typSel.appendChild(o); });
}

// ── Navigation ────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      APP.activeView = btn.dataset.view;
      destroyCharts();
      renderView(APP.activeView);
    });
  });
}

// ── Filters ───────────────────────────────────────────────
function setupFilters() {
  ['market','type','priority','lock'].forEach(key => {
    $(`flt-${key}`)?.addEventListener('change', e => {
      APP.filters[key] = e.target.value;
      destroyCharts();
      renderView(APP.activeView);
    });
  });

  $('btn-reset-flt')?.addEventListener('click', () => {
    APP.filters = { market:'', type:'', priority:'', lock:'' };
    ['market','type','priority','lock'].forEach(k => { const el=$(`flt-${k}`); if(el) el.value=''; });
    destroyCharts();
    renderView(APP.activeView);
  });
}

// ── Route view ────────────────────────────────────────────
function renderView(viewId) {
  const state = {
    baseline:   APP.baseline,
    review:     APP.review,
    violations: APP.violations,
    filters:    APP.filters,
  };
  switch(viewId) {
    case 'overview':    renderOverview(state);   break;
    case 'activities':  renderActivities(state); break;
    case 'jmp':         renderJMP(state);         break;
    case 'cashflow':    renderCashflow(state);    break;
    case 'variance':    renderVariance(state);    break;
    case 'missions':    renderMissions(state);    break;
    case 'market':      renderMarket(state);      break;
    case 'violations':  renderViolations(state);  break;
    default:            renderOverview(state);
  }
}

// ── KPI Banner ────────────────────────────────────────────
function renderKPIStrip() {
  const rev  = APP.review;
  const acts = rev.tacticalDetails || [];
  const bud  = rev.budget || [];
  const sum  = summarise(APP.violations);

  const totCF   = bud.reduce((s,r) => s + Object.values(r.monthly).reduce((a,b)=>a+b,0), 0);
  const totBud  = bud.reduce((s,r) => s + (r.budget2026||r.baseline||0), 0);
  const markets = [...new Set(acts.map(a=>a.market).filter(Boolean))].length;
  const active  = APP.violations.filter(v=>!v.justified).length;

  $('kpi-strip').innerHTML = `
    <div class="kpi-card kpi-info">
      <div class="kpi-label">Total Budget</div>
      <div class="kpi-value">${fmtShort(totBud)}</div>
      <div class="kpi-sub">AED</div>
    </div>
    <div class="kpi-card kpi-warning">
      <div class="kpi-label">Total Cashflow</div>
      <div class="kpi-value">${fmtShort(totCF)}</div>
      <div class="kpi-sub">AED</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Activities</div>
      <div class="kpi-value">${acts.length}</div>
      <div class="kpi-sub">across all markets</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Markets Covered</div>
      <div class="kpi-value">${markets}</div>
      <div class="kpi-sub">active markets</div>
    </div>
    <div class="kpi-card ${active>0?'kpi-danger':'kpi-success'}">
      <div class="kpi-label">Rule Violations</div>
      <div class="kpi-value ${active>0?'t-red':''}">${active}</div>
      <div class="kpi-sub">${sum.counts.HIGH} high · ${sum.counts.MEDIUM} medium</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">JMP Targets</div>
      <div class="kpi-value">${fmtShort(rev.jmpTargets?.reduce((s,j)=>s+j.io2026,0)||0)}</div>
      <div class="kpi-sub">IO 2026 visitors</div>
    </div>
  `;
}

function updateSeverityPills() {
  const sum = summarise(APP.violations);
  $('sev-pills').innerHTML = `
    <div class="sev-pill high">${sum.counts.HIGH} HIGH</div>
    <div class="sev-pill medium">${sum.counts.MEDIUM} MED</div>
    <div class="sev-pill low">${sum.counts.LOW} LOW</div>
  `;
  $('nav-viol-count').textContent = sum.total;
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupUpload();
  setupNav();
  setupFilters();
  console.log('DCT Tactical Plan Analysis Tool — Ready');
});

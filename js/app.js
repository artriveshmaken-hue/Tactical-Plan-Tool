/* app.js — Upload, state, navigation, KPI strip, region filter */
const APP={baseline:null,review:null,violations:[],comparison:null,activeView:'overview',filters:{market:'',type:'',priority:'',lock:'',region:''},allMarkets:[]};
const $=id=>document.getElementById(id);

function setupUpload(){
  let baseFile=null,reviewFile=null;
  function onFile(file,isBase){
    if(!file)return;
    if(isBase){baseFile=file;$('fname-baseline').textContent=file.name;$('ok-baseline').classList.remove('hidden');$('card-baseline').classList.add('loaded');}
    else{reviewFile=file;$('fname-review').textContent=file.name;$('ok-review').classList.remove('hidden');$('card-review').classList.add('loaded');}
    $('btn-analyze').disabled=!(baseFile&&reviewFile);
  }
  $('input-baseline').addEventListener('change',e=>onFile(e.target.files[0],true));
  $('input-review').addEventListener('change',e=>onFile(e.target.files[0],false));
  $('btn-analyze').addEventListener('click',async()=>{
    $('loading-overlay').classList.remove('hidden');
    $('loading-msg').textContent='Parsing 2026 Baseline…';
    try{
      const [baseline,review]=await Promise.all([parseWorkbook(baseFile),parseWorkbook(reviewFile)]);
      APP.baseline=baseline;APP.review=review;
      $('loading-msg').textContent='Running rule checks…';
      await new Promise(r=>setTimeout(r,50));
      APP.violations=runRules(baseline,review);
      APP.comparison=compareYears(baseline,review);
      populateFilters(review);
      $('dash-sub').textContent=`${baseFile.name} (2026) vs ${reviewFile.name} (2027) — ${review.activities.length} activities`;
      renderKPIs();updatePills();renderView('overview');
      $('upload-screen').classList.add('hidden');$('dashboard').classList.remove('hidden');
    }catch(err){
      console.error(err);
      alert('Error reading file:\n'+err.message+'\n\nMake sure both files have a "Tactical Details" sheet.');
    }finally{$('loading-overlay').classList.add('hidden');}
  });
  $('btn-new-upload')?.addEventListener('click',()=>{
    $('dashboard').classList.add('hidden');$('upload-screen').classList.remove('hidden');
    APP.baseline=APP.review=APP.comparison=null;APP.violations=[];APP.allMarkets=[];
    destroyCharts();
    $('input-baseline').value=$('input-review').value='';$('btn-analyze').disabled=true;
    baseFile=reviewFile=null;
    ['baseline','review'].forEach(t=>{$(`fname-${t}`).textContent='No file selected';$(`ok-${t}`).classList.add('hidden');$(`card-${t}`).classList.remove('loaded');});
  });
}

function populateFilters(review){
  const acts=review.activities||[];
  APP.allMarkets=[...new Set(acts.map(a=>a.market).filter(Boolean))].sort();
  const types=[...new Set(acts.map(a=>a.activityType).filter(Boolean))].sort();
  const mktSel=$('flt-market'),typSel=$('flt-type');
  APP.allMarkets.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;mktSel.appendChild(o);});
  types.forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;typSel.appendChild(o);});
}

function updateMarketDropdown(region){
  const mktSel=$('flt-market');
  const current=mktSel.value;
  mktSel.innerHTML='<option value="">All Markets</option>';
  const mkts=region?REGIONS[region]?.filter(r=>APP.allMarkets.some(m=>m.toLowerCase().includes(r.toLowerCase())||r.toLowerCase().includes(m.toLowerCase())))||[]:APP.allMarkets;
  mkts.forEach(m=>{
    const real=APP.allMarkets.find(am=>am.toLowerCase().includes(m.toLowerCase())||m.toLowerCase().includes(am.toLowerCase()));
    if(real){const o=document.createElement('option');o.value=real;o.textContent=real;if(real===current)o.selected=true;mktSel.appendChild(o);}
  });
}

function setupFilters(){
  $('flt-region')?.addEventListener('change',e=>{
    APP.filters.region=e.target.value;APP.filters.market='';
    updateMarketDropdown(e.target.value);
    destroyCharts();renderView(APP.activeView);
  });
  ['market','type','priority','lock'].forEach(k=>{
    $(`flt-${k}`)?.addEventListener('change',e=>{APP.filters[k]=e.target.value;destroyCharts();renderView(APP.activeView);});
  });
  $('btn-reset-flt')?.addEventListener('click',()=>{
    APP.filters={market:'',type:'',priority:'',lock:'',region:''};
    ['region','market','type','priority','lock'].forEach(k=>{const el=$(`flt-${k}`);if(el)el.value='';});
    updateMarketDropdown('');
    destroyCharts();renderView(APP.activeView);
  });
}

function setupNav(){
  document.querySelectorAll('.nav-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');APP.activeView=btn.dataset.view;
      destroyCharts();renderView(APP.activeView);
    });
  });
}

function renderView(id){
  const state={baseline:APP.baseline,review:APP.review,violations:APP.violations,comparison:APP.comparison,filters:APP.filters};
  switch(id){
    case 'overview':   renderOverview(state);   break;
    case 'comparison': renderComparison(state); break;
    case 'activities': renderActivities(state); break;
    case 'cashflow':   renderCashflow(state);   break;
    case 'market':     renderMarket(state);     break;
    case 'owners':     renderOwners(state);     break;
    case 'violations': renderViolations(state); break;
    default:           renderOverview(state);
  }
}

function renderKPIs(){
  const acts27=APP.review.activities||[],acts26=APP.baseline.activities||[];
  const sum=summarise(APP.violations);
  const {added,removed}=APP.comparison;
  const tot27=acts27.reduce((s,a)=>s+a.cashflow,0),tot26=acts26.reduce((s,a)=>s+a.cashflow,0);
  const mkts27=[...new Set(acts27.map(a=>a.market))].length;
  $('kpi-strip').innerHTML=`
    <div class="kpi-card kpi-info"><div class="kpi-label">2027 Cashflow</div><div class="kpi-value">${fmtShort(tot27)}</div><div class="kpi-sub">AED total</div></div>
    <div class="kpi-card ${tot27>tot26?'kpi-danger':'kpi-success'}"><div class="kpi-label">vs 2026</div><div class="kpi-value ${tot27>tot26?'t-red':'t-green'}">${tot27>=tot26?'+':''}${fmtShort(tot27-tot26)}</div><div class="kpi-sub">${tot26?((tot27-tot26)/tot26*100).toFixed(1)+'%':''}</div></div>
    <div class="kpi-card"><div class="kpi-label">Activities 2027</div><div class="kpi-value">${acts27.length}</div><div class="kpi-sub">vs ${acts26.length} in 2026</div></div>
    <div class="kpi-card"><div class="kpi-label">Markets</div><div class="kpi-value">${mkts27}</div><div class="kpi-sub">in 2027 plan</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">New Activities</div><div class="kpi-value t-green">${added.length}</div><div class="kpi-sub">added in 2027</div></div>
    <div class="kpi-card kpi-danger"><div class="kpi-label">Removed</div><div class="kpi-value t-red">${removed.length}</div><div class="kpi-sub">dropped from 2026</div></div>
    <div class="kpi-card ${sum.total>0?'kpi-danger':'kpi-success'}"><div class="kpi-label">Rule Violations</div><div class="kpi-value ${sum.total>0?'t-red':''}">${sum.total}</div><div class="kpi-sub">${sum.counts.HIGH} high · ${sum.counts.MEDIUM} med</div></div>`;
}

function updatePills(){
  const sum=summarise(APP.violations);
  $('sev-pills').innerHTML=`<div class="sev-pill high">${sum.counts.HIGH} HIGH</div><div class="sev-pill medium">${sum.counts.MEDIUM} MED</div><div class="sev-pill low">${sum.counts.LOW} LOW</div>`;
  $('nav-viol-count').textContent=sum.total;
}

document.addEventListener('DOMContentLoaded',()=>{setupUpload();setupNav();setupFilters();});

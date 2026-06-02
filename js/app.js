/* app.js — 3-tab app controller */
const APP={baseline:null,review:null,violations:[],comparison:null,activeView:'overview',filters:{region:'',market:'',type:'',priority:'',lock:''},allMarkets:[]};
const $=id=>document.getElementById(id);

const REGIONS={'Europe & CIS':['France','Germany','Italy','Spain','Poland','Romania','Belgium','Netherlands','Russia','Armenia','Kazakhstan','Uzbekistan'],'APAC':['India','China','Japan','Korea','South Korea'],'GCC':['KSA','Saudi Arabia','Kuwait','Egypt','Domestic'],'UK & US':['UK','United Kingdom','USA','United States','Canada'],'PR':['PR','PR & Marketing','B2B PR and Marketing']};

function getRegion(market){if(!market)return'Other';for(const[r,ms]of Object.entries(REGIONS)){if(ms.some(m=>market.toLowerCase().includes(m.toLowerCase())||m.toLowerCase().includes(market.toLowerCase())))return r;}return'Other';}

function setupUpload(){
  let bF=null,rF=null;
  function onFile(f,isBase){if(!f)return;if(isBase){bF=f;$('fname-baseline').textContent=f.name;$('ok-baseline').classList.remove('hidden');$('card-baseline').classList.add('loaded');}else{rF=f;$('fname-review').textContent=f.name;$('ok-review').classList.remove('hidden');$('card-review').classList.add('loaded');}$('btn-analyze').disabled=!(bF&&rF);}
  $('input-baseline').addEventListener('change',e=>onFile(e.target.files[0],true));
  $('input-review').addEventListener('change',e=>onFile(e.target.files[0],false));
  $('btn-analyze').addEventListener('click',async()=>{
    $('loading-overlay').classList.remove('hidden');$('loading-msg').textContent='Parsing 2026 baseline…';
    try{
      const[b,r]=await Promise.all([parseWorkbook(bF),parseWorkbook(rF)]);
      APP.baseline=b;APP.review=r;
      $('loading-msg').textContent='Running compliance rules…';await new Promise(x=>setTimeout(x,50));
      APP.violations=runRules(b,r);APP.comparison=compareYears(b,r);
      populateFilters(r);
      $('dash-sub').textContent=`${bF.name} (2026) vs ${rF.name} (2027) — ${r.activities.length} activities`;
      renderKPIs();updatePills();renderView('overview');
      $('upload-screen').classList.add('hidden');$('dashboard').classList.remove('hidden');
    }catch(e){console.error(e);alert('Error:\n'+e.message+'\n\nBoth files must have a "Tactical Details" sheet.');}
    finally{$('loading-overlay').classList.add('hidden');}
  });
  $('btn-new-upload')?.addEventListener('click',()=>{
    $('dashboard').classList.add('hidden');$('upload-screen').classList.remove('hidden');
    APP.baseline=APP.review=APP.comparison=null;APP.violations=[];APP.allMarkets=[];
    destroyCharts();$('input-baseline').value=$('input-review').value='';$('btn-analyze').disabled=true;bF=rF=null;
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

function setupFilters(){
  $('flt-region')?.addEventListener('change',e=>{
    APP.filters.region=e.target.value;APP.filters.market='';
    // cascade market dropdown
    const ms=$('flt-market');ms.innerHTML='<option value="">All Markets</option>';
    const show=e.target.value?REGIONS[e.target.value]||[]:null;
    APP.allMarkets.forEach(m=>{
      if(!show||show.some(s=>m.toLowerCase().includes(s.toLowerCase())||s.toLowerCase().includes(m.toLowerCase()))){const o=document.createElement('option');o.value=m;o.textContent=m;ms.appendChild(o);}
    });
    destroyCharts();renderView(APP.activeView);
  });
  ['market','type','priority','lock'].forEach(k=>{$(`flt-${k}`)?.addEventListener('change',e=>{APP.filters[k]=e.target.value;destroyCharts();renderView(APP.activeView);});});
  $('btn-reset-flt')?.addEventListener('click',()=>{
    APP.filters={region:'',market:'',type:'',priority:'',lock:''};
    ['region','market','type','priority','lock'].forEach(k=>{const el=$(`flt-${k}`);if(el)el.value='';});
    // restore all markets
    const ms=$('flt-market');ms.innerHTML='<option value="">All Markets</option>';
    APP.allMarkets.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;ms.appendChild(o);});
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
  const s={baseline:APP.baseline,review:APP.review,violations:APP.violations,comparison:APP.comparison,filters:APP.filters};
  if(id==='overview')renderOverview(s);
  else if(id==='market')renderMarket(s);
  else if(id==='calendar')renderCalendar(s);
  else if(id==='violations')renderViolations(s);
  else renderOverview(s);
}

function renderKPIs(){
  const a27=APP.review.activities||[],a26=APP.baseline.activities||[];
  const sum=summarise(APP.violations);
  const{added,removed}=APP.comparison;
  const t27=a27.reduce((s,a)=>s+a.cashflow,0),t26=a26.reduce((s,a)=>s+a.cashflow,0);
  $('kpi-strip').innerHTML=`
    <div class="kpi-card kpi-info"><div class="kpi-label">2027 Cashflow</div><div class="kpi-value">${fmtShort(t27)}</div><div class="kpi-sub">AED total</div></div>
    <div class="kpi-card ${t27>t26?'kpi-danger':'kpi-success'}"><div class="kpi-label">vs 2026</div><div class="kpi-value ${t27>t26?'t-red':'t-green'}">${t27>=t26?'+':''}${fmtShort(t27-t26)}</div><div class="kpi-sub">${t26?((t27-t26)/t26*100).toFixed(1)+'%':''}</div></div>
    <div class="kpi-card"><div class="kpi-label">Activities 2027</div><div class="kpi-value">${a27.length}</div><div class="kpi-sub">vs ${a26.length} in 2026</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">New in 2027</div><div class="kpi-value t-green">${added.length}</div><div class="kpi-sub">added activities</div></div>
    <div class="kpi-card kpi-danger"><div class="kpi-label">Removed</div><div class="kpi-value t-red">${removed.length}</div><div class="kpi-sub">dropped from 2026</div></div>
    <div class="kpi-card ${sum.total>0?'kpi-danger':'kpi-success'}"><div class="kpi-label">Violations</div><div class="kpi-value ${sum.total>0?'t-red':''}">${sum.total}</div><div class="kpi-sub">${sum.counts.HIGH} HIGH · ${sum.counts.MEDIUM} MED</div></div>`;
}

function updatePills(){
  const s=summarise(APP.violations);
  $('sev-pills').innerHTML=`<div class="sev-pill high">${s.counts.HIGH} HIGH</div><div class="sev-pill medium">${s.counts.MEDIUM} MED</div><div class="sev-pill low">${s.counts.LOW} LOW</div>`;
  $('nav-viol-count').textContent=s.total;
}

document.addEventListener('DOMContentLoaded',()=>{setupUpload();setupNav();setupFilters();});

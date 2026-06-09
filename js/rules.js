/* rules.js — v7 FINAL — all rules corrected and structured */

const VALID_TYPES = new Set([
  'fam','e-learning','roadshow','events / workshops','webinars','new jmp',
  'b2b pr fam trip','exhibitions','stakeholder engagement','mall activation',
  'existing jmp','b2b comms','expenses','mission & travel','gsa retainer fee',
  'corporate activation','newsletter','cruise jmp','b2c conversion',
  'content partnership','manpower','projects','admin','mega fam','marketplace',
  'travel trade partnership','co-host industry event','stand build','space rent',
  'hospitality','experience abu dhabi workshop','destination sponsorship','others',
  'fam trip','mega fam trip','b2b pr fam trip','showcase','consultant',
  'sales calls','partners appreciation event','corporate policies',
]);

// Activity types that are trade promotions (including FAMs)
const TRADE_PROMO_TYPES = new Set([
  'Trade Promotion','Trade Promotions','trade promotion',
  'FAM','FAM Trip','Mega FAM','Mega FAM Trip','GCC Fam-Trip',
  'B2B PR FAM Trip','Roadshow','Events / WorkShops','Events / Workshops',
  'Co-Host Industry Event','Co-Host Industry event',
  'Travel Trade Partnership','Experience Abu Dhabi Workshop',
  'Stakeholder Engagement','Partners Appreciation Event',
]);

const RULE_META = {
  '0.1': { name:'Activity type not in predefined list',       severity:'HIGH',   cat:'Data Quality'  },
  '1.1': { name:'Budget increased >10% vs 2026 baseline',    severity:'HIGH',   cat:'Budget'        },
  '1.2': { name:'Q4 cashflow >30% of annual',                severity:'HIGH',   cat:'Cashflow'      },
  '1.3': { name:'Nov/Dec spend >15% of annual total',        severity:'MEDIUM', cat:'Cashflow'      },
  '1.4': { name:'New JMP cashflow in signing year',          severity:'MEDIUM', cat:'JMP'           },
  '1.5': { name:'Webinar has non-zero budget',               severity:'MEDIUM', cat:'Activity'      },
  '1.6': { name:'Admin Miscellaneous line present',          severity:'LOW',    cat:'Data Quality'  },
  '1.7': { name:'Locked Existing JMP cashflow = 0',          severity:'HIGH',   cat:'JMP'           },
  '2.2': { name:'JMP contract closes in Q4',                 severity:'HIGH',   cat:'JMP'           },
  '2.6': { name:'JMP missing Hotel Guest target',            severity:'HIGH',   cat:'JMP'           },
  '3.1': { name:'Activity type is "Others"',                 severity:'HIGH',   cat:'Data Quality'  },
  '3.2': { name:'Duplicate: same name AND same type',        severity:'MEDIUM', cat:'Data Quality'  },
  '3.3': { name:'Training/Workshop spans >1 month',          severity:'MEDIUM', cat:'Activity'      },
  '3.6': { name:'Webinar at Priority 1 (must be P2 or P3)', severity:'MEDIUM', cat:'Activity'      },
  '3.8': { name:'Activity missing KPIs',                     severity:'HIGH',   cat:'KPI'           },
  '4.1': { name:'Mega FAM target < 50 participants',         severity:'MEDIUM', cat:'Activity'      },
  '4.3': { name:'FAM trip outside Ramadan/Early Summer',     severity:'LOW',    cat:'Activity'      },
  '5.1': { name:'< 2 zero-budget Ramadan activities',        severity:'HIGH',   cat:'Planning'      },
  '6.1': { name:'2 sales missions in same quarter',          severity:'MEDIUM', cat:'Activity'      },
  '6.3': { name:'Exhibition with no revenue KPI',            severity:'MEDIUM', cat:'KPI'           },
  '8.4': { name:'New non-JMP activity >500K — no 2026 ref', severity:'MEDIUM', cat:'Budget'        },
  'B.1': { name:'Cost efficiency outlier (>15% above median)',severity:'MEDIUM',cat:'Benchmark'     },
};

const RAM_S = new Date(2027,1,18), RAM_E = new Date(2027,2,20);
const THRESH = { INC_PCT:10, INC_AED:50000, Q4_PCT:30, ND_PCT:15, NEW_CF:500000, OUTLIER_PCT:15 };

// Tier definitions
const TIER1_MARKETS = ['China','France','Germany','India','Italy','Kuwait','Russia','Saudi Arabia','UAE','United Kingdom','United States'];
const TIER2_MARKETS = ['Armenia','Bahrain','Belgium','Canada','Egypt','Japan','Kazakhstan','Netherlands','Oman','Poland','Qatar','Romania','South Korea','Spain','Uzbekistan'];

const REGIONS = {
  'Europe & CIS':['France','Germany','Italy','Spain','Poland','Romania','Belgium','Netherlands','Russia','Armenia','Kazakhstan','Uzbekistan'],
  'APAC':['India','China','Japan','Korea','South Korea'],
  'GCC':['KSA','Saudi Arabia','Kuwait','Egypt','Domestic','UAE','Bahrain','Qatar','Oman'],
  'UK & US':['UK','United Kingdom','USA','United States','Canada'],
  'PR':['PR','PR & Marketing','B2B PR and Marketing'],
  'Global':['Global Partnerships','Exhibitions','IO Office','Global','International'],
};

function getRegion(market) {
  if (!market) return 'Other';
  const ml = market.toLowerCase();
  for (const [r, ms] of Object.entries(REGIONS)) {
    if (ms.some(m => ml.includes(m.toLowerCase()) || m.toLowerCase().includes(ml))) return r;
  }
  return 'Other';
}

function getTier(market) {
  if (!market) return 3;
  const ml = market.toLowerCase();
  if (TIER1_MARKETS.some(m => ml.includes(m.toLowerCase()) || m.toLowerCase().includes(ml))) return 1;
  if (TIER2_MARKETS.some(m => ml.includes(m.toLowerCase()) || m.toLowerCase().includes(ml))) return 2;
  return 3;
}

function getQuarter(d) {
  if (!d) return null;
  const m = d.getMonth();
  return m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
}

function mSum(mo, months) { return months.reduce((s,m) => s+(mo[m]||0), 0); }
const Q4M = ['Oct','Nov','Dec'], NDM = ['Nov','Dec'];

function V(ruleId, a, detail) {
  const meta = RULE_META[ruleId] || { name:ruleId, severity:'LOW', cat:'Other' };
  return {
    ruleId, ruleName:meta.name, severity:meta.severity, category:meta.cat,
    market: a?.market||'—', region: getRegion(a?.market||''), tier: getTier(a?.market||''),
    activityId: a?.id||'—', activityName: a?.activityName||'—', activityType: a?.activityType||'—',
    detail, status:'pending', comment:'',
  };
}
function Vm(ruleId, market, label, detail) {
  const meta = RULE_META[ruleId] || { name:ruleId, severity:'LOW', cat:'Other' };
  return {
    ruleId, ruleName:meta.name, severity:meta.severity, category:meta.cat,
    market, region:getRegion(market), tier:getTier(market),
    activityId:'Market-level', activityName:label, activityType:'—',
    detail, status:'pending', comment:'',
  };
}

// Type helpers — regex-based, handles typos
function isJMP(a)       { return /jmp|existing\s*mp/i.test(a.activityType||''); }
function isNewJMP(a)    { return /new\s+jmp/i.test(a.activityType||''); }
function isExistJMP(a)  { return /exist\w*\s*(jmp|mp)/i.test(a.activityType||''); }
function isMission(a)   { return /mis+ion/i.test((a.activityType||'')+' '+(a.activityName||'')); }
function isGSA(a)       { return /gsa/i.test(a.activityType||''); }
function isWebinar(a)   { return /webinar/i.test(a.activityType||''); }
function isFAM(a)       { return /\bfam\b/i.test((a.activityType||'')+' '+(a.activityName||'')); }
function isMegaFAM(a)   { return /mega.?fam/i.test((a.activityType||'')+' '+(a.activityName||'')); }
function isExhibition(a){ return /^(exhibitions?|stand.?build|space.?rent|hospitality)$/i.test(a.activityType||'')||/exhibition|exhibit|\bitb\b|\bwtm\b|\batm\b/i.test((a.activityType||'')+' '+(a.activityName||'')); }
function isTradePromo(a){ return TRADE_PROMO_TYPES.has(normTypeCheck(a.activityType||'')); }
function normTypeCheck(t){ const k=t.toLowerCase().replace(/\s+/g,' ').trim(); const found=[...TRADE_PROMO_TYPES].find(v=>v.toLowerCase()===k); return found||t; }
function inRam(d)       { return d && d>=RAM_S && d<=RAM_E; }
function exhPrefix(a)   { return (a.activityName||'').replace(/\s*[-:]\s*(space.?rent|stand.?build|hospitality|venue|design.?build).*/i,'').trim().toLowerCase(); }

function isKPIExempt(a) {
  return isJMP(a)||isMission(a)||isGSA(a)||
    /^(manpower|admin|projects|expenses|stand.?build|hospitality|commitment)$/i.test(a.activityType||'');
}

// Median helper
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
}

function runRules(baseline26, review27) {
  const violations = [];
  const A27 = review27.activities   || [];
  const A26 = baseline26.activities || [];

  const map26 = {};
  A26.forEach(a => {
    const k = `${a.market}||${(a.activityName||'').toLowerCase().trim()}`;
    map26[k] = (map26[k]||0) + a.cashflow;
  });

  // 0.1 — Invalid type
  A27.forEach(a => {
    const t = (a.activityType||'').trim();
    if (!t||t==='—') return;
    if (!VALID_TYPES.has(t.toLowerCase()))
      violations.push(V('0.1',a,`"${t}" is not in the predefined activity type list.`));
  });

  // 1.1 — Budget increase >10% AND >50K
  A27.forEach(a => {
    const k = `${a.market}||${(a.activityName||'').toLowerCase().trim()}`;
    const prev = map26[k]||0;
    if (prev>0 && a.cashflow>prev) {
      const pct = ((a.cashflow-prev)/prev)*100, abs = a.cashflow-prev;
      if (pct>THRESH.INC_PCT && abs>THRESH.INC_AED)
        violations.push(V('1.1',a,`${fmtAED(prev)} (2026) → ${fmtAED(a.cashflow)} (2027). +${fmtAED(abs)} (+${pct.toFixed(1)}%)`));
    }
  });

  // 1.2 Q4>30% + 1.3 Nov-Dec>15% per market
  const mktCF = {};
  A27.forEach(a => {
    if (!mktCF[a.market]) mktCF[a.market] = MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
    MONTH_LABELS.forEach(m => { mktCF[a.market][m] += a.monthly[m]||0; });
  });
  Object.entries(mktCF).forEach(([mkt,mo]) => {
    const tot = MONTH_LABELS.reduce((s,m)=>s+mo[m],0);
    if (tot<50000) return;
    const q4=mSum(mo,Q4M), nd=mSum(mo,NDM);
    if ((q4/tot)*100>THRESH.Q4_PCT)
      violations.push(Vm('1.2',mkt,'Q4 Cashflow',`Q4=${fmtAED(q4)} (${((q4/tot)*100).toFixed(1)}% of annual). Back-loading into Oct-Dec must be justified.`));
    if ((nd/tot)*100>THRESH.ND_PCT)
      violations.push(Vm('1.3',mkt,'Nov-Dec Spend',`Nov-Dec=${fmtAED(nd)} (${((nd/tot)*100).toFixed(1)}% of annual). Very late in financial year.`));
  });

  // 1.4 — New JMP cashflow in signing year
  A27.filter(isNewJMP).forEach(a => {
    if (a.cashflow<=0) return;
    const cross = a.endDate && a.endDate.getFullYear()>2027;
    violations.push(V('1.4',a, cross
      ? `Cross-year JMP (ends ${fmtDate(a.endDate)}): ${fmtAED(a.cashflow)} in 2027. Confirm partial payment only.`
      : `Ends ${fmtDate(a.endDate)}: ${fmtAED(a.cashflow)} in signing year. Payment should follow contract close.`));
  });

  // 1.5 — Webinar budget >0
  A27.filter(isWebinar).forEach(a => {
    if (a.cashflow>0) violations.push(V('1.5',a,`Webinar has ${fmtAED(a.cashflow)}. Webinars must be zero-cost.`));
  });

  // 1.6 — Admin Misc
  A27.forEach(a => {
    if (/admin.misc|miscellaneous/i.test(`${a.activityName||''} ${a.activityType||''}`))
      violations.push(V('1.6',a,'Admin Miscellaneous must be removed. Use specific task codes.'));
  });

  // 1.7 — Locked Existing JMP cashflow=0
  A27.filter(isExistJMP).forEach(a => {
    if (a.cashflow===0 && a.locked==='Locked')
      violations.push(V('1.7',a,'Locked Existing JMP cashflow=0. Contract value may be missing.'));
  });

  // 2.2 — JMP closes in Q4 (Oct-Dec) — Q1/Q2/Q3 are acceptable
  A27.filter(isJMP).forEach(a => {
    if (!a.endDate) return;
    if (a.endDate.getMonth()>=9) // Oct=9, Nov=10, Dec=11
      violations.push(V('2.2',a,`JMP ends ${fmtDate(a.endDate)} (Q4). Contracts should not close in Q4 — payments create year-end cash pressure.`));
  });

  // 2.6 — JMP missing Hotel Guest target
  A27.filter(isJMP).forEach(a => {
    if (!a.hotelGuests || a.hotelGuests===0)
      violations.push(V('2.6',a,'JMP has no Hotel Guest target. All JMPs require a hotel guest/overnight stay target.'));
  });

  // 3.1 — Others type
  A27.filter(a=>/^others$/i.test(a.activityType||'')).forEach(a =>
    violations.push(V('3.1',a,'Type is "Others". Must be reclassified to a valid specific type.')));

  // 3.2 — Duplicate: same name AND same type
  const seen = {};
  A27.forEach(a => {
    const k = `${a.market}||${(a.activityName||'').toLowerCase().trim()}||${(a.activityType||'').toLowerCase().trim()}`;
    if (seen[k]) violations.push(V('3.2',a,`Duplicate name+type in ${a.market}. Same name with different types is acceptable.`));
    seen[k] = true;
  });

  // 3.3 — Training/Workshop spans >31 days
  const TRAIN_RE = /^(events \/ workshops|webinars|e-learning|experience abu dhabi workshop)$/i;
  A27.filter(a=>TRAIN_RE.test(a.activityType||'')||/training|workshop/i.test(a.activityName||'')).forEach(a => {
    if (!a.startDate||!a.endDate) return;
    const days = (a.endDate-a.startDate)/864e5;
    if (days>31) violations.push(V('3.3',a,`Spans ${Math.round(days)} days (${fmtDate(a.startDate)}→${fmtDate(a.endDate)}). Activities >1 month suggest bundled sessions. Split into individual lines.`));
  });

  // 3.6 — Webinar P1 only
  A27.filter(isWebinar).forEach(a => {
    if (a.priority===1) violations.push(V('3.6',a,'Webinar is Priority 1. Must be P2 or P3 (P2 is acceptable).'));
  });

  // 3.8 — Missing KPIs (exempt: JMPs, GSA, Mission, Manpower, Admin)
  const exhGroups = {};
  A27.filter(isExhibition).forEach(a => { const p=exhPrefix(a); if(!exhGroups[p])exhGroups[p]=[]; exhGroups[p].push(a); });
  A27.forEach(a => {
    if (isKPIExempt(a)) return;
    if (isWebinar(a)) return;
    if (/^others$/i.test(a.activityType||'')) return;
    if (isExhibition(a)) {
      const p=exhPrefix(a), grp=exhGroups[p]||[];
      if (grp.length>1 && !/^space.?rent$/i.test(a.activityType||'') && grp[0].id!==a.id) return;
    }
    if (!a.revenue && !a.attendees)
      violations.push(V('3.8',a,'No revenue and no attendee/KPI target. At least one KPI required for this activity type.'));
  });

  // 4.1 — Mega FAM <50
  A27.filter(isMegaFAM).forEach(a => {
    if (a.attendees<50) violations.push(V('4.1',a,`Mega FAM targets ${a.attendees||0} participants. Minimum is 50.`));
  });

  // 4.3 — FAM outside Feb-Jun
  A27.filter(isFAM).filter(a=>!isMegaFAM(a)).forEach(a => {
    if (a.startDate&&(a.startDate.getMonth()<1||a.startDate.getMonth()>5))
      violations.push(V('4.3',a,`FAM starts ${fmtDate(a.startDate)} — outside Feb-Jun (Ramadan/Early Summer) window.`));
  });

  // 5.1 — <2 Ramadan zero-budget
  const mkts27 = [...new Set(A27.map(a=>a.market).filter(Boolean))];
  mkts27.forEach(mkt => {
    const rz = A27.filter(a=>a.market===mkt&&(inRam(a.startDate)||inRam(a.endDate))&&a.cashflow===0);
    if (rz.length<2) violations.push(Vm('5.1',mkt,'Ramadan Planning',`Only ${rz.length} zero-budget Ramadan activit${rz.length===1?'y':'ies'}. Min 2 required.`));
  });

  // 6.1 — >1 mission in same quarter
  mkts27.forEach(mkt => {
    const ms = A27.filter(a=>a.market===mkt&&isMission(a));
    if (ms.length<=1) return;
    const byQ = {Q1:[],Q2:[],Q3:[],Q4:[]};
    ms.forEach(a=>{ const q=a.startDate?getQuarter(a.startDate):null; if(q)byQ[q].push(a); });
    Object.entries(byQ).forEach(([q,qs])=>{
      if (qs.length>1) violations.push(Vm('6.1',mkt,`${qs.length} missions in ${q}`,`${qs.length} missions in ${q}. Max 1 per quarter — missions in different quarters are fine.`));
    });
  });

  // 6.3 — Exhibition no revenue (primary only)
  A27.filter(isExhibition).forEach(a => {
    const p=exhPrefix(a), grp=exhGroups[p]||[];
    if (grp.length>1 && !/^space.?rent$/i.test(a.activityType||'') && grp[0].id!==a.id) return;
    if (!a.revenue) violations.push(V('6.3',a,'Exhibition has no revenue KPI. Must be justified by expected returns.'));
  });

  // 8.4 — New non-JMP >500K, no 2026 ref
  A27.forEach(a => {
    if (isJMP(a)||isGSA(a)||isMission(a)) return;
    const k = `${a.market}||${(a.activityName||'').toLowerCase().trim()}`;
    if (!map26[k] && a.cashflow>THRESH.NEW_CF)
      violations.push(V('8.4',a,`New activity ${fmtAED(a.cashflow)} — no 2026 equivalent. Document rationale.`));
  });

  // B.1 — Cost efficiency outliers (>15% above median cost per attendee/stakeholder)
  const typeGroups = {};
  A27.filter(a=>!isJMP(a)).forEach(a => {
    if (!typeGroups[a.activityType]) typeGroups[a.activityType] = {};
    if (!typeGroups[a.activityType][a.market]) typeGroups[a.activityType][a.market] = {cf:0,att:0,stak:0};
    typeGroups[a.activityType][a.market].cf += a.cashflow;
    typeGroups[a.activityType][a.market].att += a.attendees||0;
    typeGroups[a.activityType][a.market].stak += a.stakeholders||0;
  });

  Object.entries(typeGroups).forEach(([type, byMkt]) => {
    // Cost per attendee
    const cpaEntries = Object.entries(byMkt).filter(([,d])=>d.att>0&&d.cf>0).map(([m,d])=>({m,v:d.cf/d.att}));
    if (cpaEntries.length>=3) {
      const med = median(cpaEntries.map(x=>x.v));
      cpaEntries.filter(x=>x.v>med*(1+THRESH.OUTLIER_PCT/100)).forEach(({m,v})=>{
        const mockA = {market:m, id:'—', activityName:type, activityType:type};
        violations.push(V('B.1',mockA,`Cost/attendee for ${type}: ${fmtAED(Math.round(v))} vs portfolio median ${fmtAED(Math.round(med))} (+${(((v/med)-1)*100).toFixed(0)}% above median). Review spend efficiency.`));
      });
    }
    // Cost per stakeholder
    const cpStakEntries = Object.entries(byMkt).filter(([,d])=>d.stak>0&&d.cf>0).map(([m,d])=>({m,v:d.cf/d.stak}));
    if (cpStakEntries.length>=3) {
      const med = median(cpStakEntries.map(x=>x.v));
      cpStakEntries.filter(x=>x.v>med*(1+THRESH.OUTLIER_PCT/100)).forEach(({m,v})=>{
        const mockA = {market:m, id:'—', activityName:type, activityType:type};
        violations.push(V('B.1',mockA,`Cost/stakeholder for ${type}: ${fmtAED(Math.round(v))} vs portfolio median ${fmtAED(Math.round(med))} (+${(((v/med)-1)*100).toFixed(0)}% above median). Review spend efficiency.`));
      });
    }
  });

  return violations;
}

function summarise(violations) {
  const active = violations.filter(v=>v.status!=='accepted');
  const counts = {HIGH:0,MEDIUM:0,LOW:0};
  active.forEach(v=>{counts[v.severity]=(counts[v.severity]||0)+1;});
  const byMarket = {};
  active.forEach(v=>{byMarket[v.market]=(byMarket[v.market]||0)+1;});
  const topMarkets = Object.entries(byMarket).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([market,count])=>({market,count}));
  return {counts, topMarkets, total:active.length};
}

function compareYears(b26, r27) {
  const A26=b26.activities||[], A27=r27.activities||[];
  const m26={}, m27={};
  A26.forEach(a=>{m26[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]=a;});
  A27.forEach(a=>{m27[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]=a;});
  const added=A27.filter(a=>!m26[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]);
  const removed=A26.filter(a=>!m27[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]);
  const changed=[];
  Object.entries(m27).forEach(([k,a27])=>{
    const a26=m26[k]; if(!a26) return;
    const ch=[];
    if (Math.abs(a27.cashflow-a26.cashflow)>1000) ch.push({field:'Cashflow',from:a26.cashflow,to:a27.cashflow,diff:a27.cashflow-a26.cashflow});
    if (a27.priority!==a26.priority&&a27.priority&&a26.priority) ch.push({field:'Priority',from:a26.priority,to:a27.priority,diff:0});
    if (a27.activityType!==a26.activityType) ch.push({field:'Type',from:a26.activityType,to:a27.activityType,diff:0});
    if (a27.locked!==a26.locked) ch.push({field:'Lock',from:a26.locked,to:a27.locked,diff:0});
    if (ch.length) changed.push({a27,a26,changes:ch});
  });
  return {added,removed,changed};
}

/* rules.js — v6 FINAL */

const VALID_TYPES = new Set([
  'fam','e-learning','roadshow','events / workshops','webinars',
  'new jmp','b2b pr fam trip','exhibitions','stakeholder engagement',
  'mall activation','existing jmp','b2b comms','expenses',
  'mission & travel','gsa retainer fee','corporate activation',
  'newsletter','cruise jmp','b2c conversion','content partnership',
  'manpower','projects','admin','mega fam','marketplace',
  'travel trade partnership','co-host industry event','stand build',
  'space rent','hospitality','experience abu dhabi workshop',
  'destination sponsorship','others','fam trip','mega fam trip',
]);

const RULE_META = {
  '0.1': { name:'Activity type not in predefined list',      severity:'HIGH'   },
  '1.1': { name:'Budget increased >10% vs 2026 baseline',   severity:'HIGH'   },
  '1.2': { name:'Q4 cashflow >30% of annual',               severity:'HIGH'   },
  '1.3': { name:'Nov/Dec spend >15% of annual total',       severity:'MEDIUM' },
  '1.4': { name:'New JMP cashflow in signing year',         severity:'MEDIUM' },
  '1.5': { name:'Webinar has non-zero budget',              severity:'MEDIUM' },
  '1.6': { name:'Admin Miscellaneous line present',         severity:'LOW'    },
  '1.7': { name:'Locked Existing JMP cashflow = 0',         severity:'HIGH'   },
  '2.2': { name:'JMP closes Q3 — payment lands in H2',      severity:'MEDIUM' },
  '3.1': { name:'Activity type is "Others"',                severity:'HIGH'   },
  '3.2': { name:'Duplicate: same name AND same type',       severity:'MEDIUM' },
  '3.3': { name:'Training spans >1 month (likely bundled)', severity:'MEDIUM' },
  '3.6': { name:'Webinar at Priority 1 (must be P2 or P3)',severity:'MEDIUM' },
  '3.8': { name:'Activity missing KPIs',                    severity:'HIGH'   },
  '4.1': { name:'Mega FAM target < 50 participants',        severity:'MEDIUM' },
  '4.3': { name:'FAM trip outside Ramadan/Early Summer',    severity:'LOW'    },
  '5.1': { name:'< 2 zero-budget Ramadan activities',       severity:'HIGH'   },
  '6.1': { name:'2 sales missions in same quarter',         severity:'MEDIUM' },
  '6.3': { name:'Exhibition with no revenue KPI',           severity:'MEDIUM' },
  '8.4': { name:'New non-JMP activity >500K — no 2026 ref',severity:'MEDIUM' },
};

const RAM_S=new Date(2027,1,18), RAM_E=new Date(2027,2,20);
const Q4_MONTHS=['Oct','Nov','Dec'], NOVDEC=['Nov','Dec'];
const THRESH={INC_PCT:10,INC_AED:50000,Q4_PCT:30,ND_PCT:15,NEW_CF:500000};

const REGIONS={
  'Europe & CIS':['France','Germany','Italy','Spain','Poland','Romania','Belgium','Netherlands','Russia','Armenia','Kazakhstan','Uzbekistan'],
  'APAC':['India','China','Japan','Korea','South Korea'],
  'GCC':['KSA','Saudi Arabia','Kuwait','Egypt','Domestic'],
  'UK & US':['UK','United Kingdom','USA','United States','Canada'],
  'PR':['PR','PR & Marketing','B2B PR and Marketing'],
  'Global':['Global Partnerships','Exhibitions','IO Office','Global','International','Exhibition'],
};

function getRegion(market){
  if(!market)return'Other';
  const ml=market.toLowerCase();
  for(const[r,ms]of Object.entries(REGIONS)){
    if(ms.some(m=>ml.includes(m.toLowerCase())||m.toLowerCase().includes(ml)))return r;
  }
  return'Other';
}

function getQuarter(d){
  if(!d)return null;
  const m=d.getMonth();
  return m<3?'Q1':m<6?'Q2':m<9?'Q3':'Q4';
}

function mSum(mo,months){return months.reduce((s,m)=>s+(mo[m]||0),0);}

/* ── Violation factories ── */
function V(ruleId,a,detail){
  const meta=RULE_META[ruleId]||{name:ruleId,severity:'LOW'};
  return{ruleId,ruleName:meta.name,severity:meta.severity,
    market:a?.market||'—',region:getRegion(a?.market||''),
    activityId:a?.id||'—',activityName:a?.activityName||'—',
    activityType:a?.activityType||'—',detail,status:'pending',comment:''};
}
function Vm(ruleId,market,label,detail){
  const meta=RULE_META[ruleId]||{name:ruleId,severity:'LOW'};
  return{ruleId,ruleName:meta.name,severity:meta.severity,
    market,region:getRegion(market),
    activityId:'Market-level',activityName:label,activityType:'—',
    detail,status:'pending',comment:''};
}

/* ── Type helpers — regex-based, handles all typos ── */
function isJMP(a)      {return /jmp|existing\s*mp/i.test(a.activityType||'');}
function isNewJMP(a)   {return /new\s+jmp/i.test(a.activityType||'');}
function isExistJMP(a) {return /exist\w*\s*(jmp|mp)/i.test(a.activityType||'');}
function isMission(a)  {return /mis+ion/i.test((a.activityType||'')+' '+(a.activityName||''));}
function isGSA(a)      {return /gsa/i.test(a.activityType||'');}
function isWebinar(a)  {return /webinar/i.test(a.activityType||'');}
function isFAM(a)      {return /\bfam\b/i.test((a.activityType||'')+' '+(a.activityName||''));}
function isMegaFAM(a)  {return /mega.?fam/i.test((a.activityType||'')+' '+(a.activityName||''));}
function isExhibition(a){return /^(exhibitions?|stand.?build|space.?rent|hospitality)$/i.test(a.activityType||'')||/exhibition|exhibit|\bitb\b|\bwtm\b|\batm\b/i.test((a.activityType||'')+' '+(a.activityName||''));}
function inRam(d){return d&&d>=RAM_S&&d<=RAM_E;}

/* KPI-exempt: JMPs (all variants), GSA, Mission, Manpower, Admin, Projects, Expenses, Stand Build, Hospitality */
function isKPIExempt(a){
  return isJMP(a)||isMission(a)||isGSA(a)||
    /^(manpower|admin|projects|expenses|stand.?build|hospitality)$/i.test(a.activityType||'');
}

function exhPrefix(a){
  return(a.activityName||'').replace(/\s*[-:]\s*(space.?rent|stand.?build|hospitality|venue|design.?build).*/i,'').trim().toLowerCase();
}

/* ══ MAIN RULE RUNNER ══ */
function runRules(baseline26,review27){
  const violations=[];
  const A27=review27.activities||[];
  const A26=baseline26.activities||[];

  const map26={};
  A26.forEach(a=>{const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}`;map26[k]=(map26[k]||0)+a.cashflow;});

  /* 0.1 — Invalid type */
  A27.forEach(a=>{
    const t=(a.activityType||'').trim();
    if(!t||t==='—')return;
    if(!VALID_TYPES.has(t.toLowerCase()))
      violations.push(V('0.1',a,`"${t}" is not in the predefined activity type list.`));
  });

  /* 1.1 — Budget increase >10% AND >50K */
  A27.forEach(a=>{
    const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}`;
    const prev=map26[k]||0;
    if(prev>0&&a.cashflow>prev){
      const pct=((a.cashflow-prev)/prev)*100, abs=a.cashflow-prev;
      if(pct>THRESH.INC_PCT&&abs>THRESH.INC_AED)
        violations.push(V('1.1',a,`${fmtAED(prev)} (2026) → ${fmtAED(a.cashflow)} (2027). +${fmtAED(abs)} (+${pct.toFixed(1)}%)`));
    }
  });

  /* 1.2 Q4 >30% per market + 1.3 Nov-Dec >15% */
  const mktCF={};
  A27.forEach(a=>{
    if(!mktCF[a.market])mktCF[a.market]=MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
    MONTH_LABELS.forEach(m=>{mktCF[a.market][m]+=a.monthly[m]||0;});
  });
  Object.entries(mktCF).forEach(([mkt,mo])=>{
    const tot=MONTH_LABELS.reduce((s,m)=>s+mo[m],0);
    if(tot<50000)return;
    const q4=mSum(mo,Q4_MONTHS), nd=mSum(mo,NOVDEC);
    if((q4/tot)*100>THRESH.Q4_PCT)
      violations.push(Vm('1.2',mkt,'Q4 Cashflow',`Q4=${fmtAED(q4)} (${((q4/tot)*100).toFixed(1)}% of annual). Payments concentrated in Oct-Dec must be justified.`));
    if((nd/tot)*100>THRESH.ND_PCT)
      violations.push(Vm('1.3',mkt,'Nov-Dec Spend',`Nov-Dec=${fmtAED(nd)} (${((nd/tot)*100).toFixed(1)}% of annual). Very late in financial year.`));
  });

  /* 1.4 — New JMP cashflow in signing year */
  A27.filter(isNewJMP).forEach(a=>{
    if(a.cashflow<=0)return;
    const cross=a.endDate&&a.endDate.getFullYear()>2027;
    violations.push(V('1.4',a,cross
      ?`Cross-year JMP (ends ${fmtDate(a.endDate)}): ${fmtAED(a.cashflow)} in 2027. Confirm partial — not full contract.`
      :`Ends ${fmtDate(a.endDate)}: ${fmtAED(a.cashflow)} in signing year. Payment should follow contract close.`));
  });

  /* 1.5 — Webinar budget >0 */
  A27.filter(isWebinar).forEach(a=>{
    if(a.cashflow>0)violations.push(V('1.5',a,`Webinar has ${fmtAED(a.cashflow)}. Must be zero-cost.`));
  });

  /* 1.6 — Admin Misc */
  A27.forEach(a=>{
    if(/admin.misc|miscellaneous/i.test(`${a.activityName||''} ${a.activityType||''}`))
      violations.push(V('1.6',a,'Admin Miscellaneous must be removed. Use specific task codes.'));
  });

  /* 1.7 — Locked Existing JMP cashflow=0 */
  A27.filter(isExistJMP).forEach(a=>{
    if(a.cashflow===0&&a.locked==='Locked')
      violations.push(V('1.7',a,'Locked Existing JMP cashflow=0. Contract value may be missing.'));
  });

  /* 2.2 — JMP closes Q3 2027 only */
  A27.filter(isJMP).forEach(a=>{
    if(!a.endDate)return;
    if(a.endDate.getFullYear()===2027&&a.endDate.getMonth()>=6&&a.endDate.getMonth()<=8)
      violations.push(V('2.2',a,`JMP ends ${fmtDate(a.endDate)} (Q3). Payment falls in H2 — consider H1 closure.`));
  });

  /* RULE 2.6 REMOVED — JMPs, GSA, Missions have no KPI targets in this system */

  /* 3.1 — Others type */
  A27.filter(a=>/^others$/i.test(a.activityType||'')).forEach(a=>
    violations.push(V('3.1',a,'Type is "Others". Reclassify to a valid specific type.')));

  /* 3.2 — Duplicate: same name AND same type (different types = not duplicate) */
  const seen={};
  A27.forEach(a=>{
    const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}||${(a.activityType||'').toLowerCase().trim()}`;
    if(seen[k])violations.push(V('3.2',a,`Duplicate name+type in ${a.market}. Same name with different types is acceptable.`));
    seen[k]=true;
  });

  /* 3.3 — Training spans >31 days */
  const TRAIN_RE=/^(events \/ workshops|webinars|e-learning|experience abu dhabi workshop)$/i;
  A27.filter(a=>TRAIN_RE.test(a.activityType||'')||/training|workshop/i.test(a.activityName||'')).forEach(a=>{
    if(!a.startDate||!a.endDate)return;
    const days=(a.endDate-a.startDate)/(864e5);
    if(days>31)violations.push(V('3.3',a,`Spans ${Math.round(days)} days (${fmtDate(a.startDate)}→${fmtDate(a.endDate)}). >1 month suggests bundled sessions. Split into individual lines.`));
  });

  /* 3.6 — Webinar Priority 1 only (P2 acceptable) */
  A27.filter(isWebinar).forEach(a=>{
    if(a.priority===1)violations.push(V('3.6',a,'Webinar is Priority 1. Must be P2 or P3 (P2 is acceptable).'));
  });

  /* 3.8 — Missing KPIs — exempt: JMPs (all variants), GSA, Mission, Manpower, Admin, Expenses, Stand Build, Hospitality */
  const exhGroups={};
  A27.filter(isExhibition).forEach(a=>{const p=exhPrefix(a);if(!exhGroups[p])exhGroups[p]=[];exhGroups[p].push(a);});
  A27.forEach(a=>{
    if(isKPIExempt(a))return;
    if(isWebinar(a))return;
    if(/^others$/i.test(a.activityType||''))return;
    if(isExhibition(a)){
      const p=exhPrefix(a),grp=exhGroups[p]||[];
      if(grp.length>1){
        const isSpR=/^space.?rent$/i.test(a.activityType||'');
        if(!isSpR&&grp[0].id!==a.id)return;
      }
    }
    if(!a.revenue&&!a.attendees)
      violations.push(V('3.8',a,'No revenue and no attendee/KPI target. At least one KPI required for this activity type.'));
  });

  /* 4.1 — Mega FAM <50 */
  A27.filter(isMegaFAM).forEach(a=>{
    if(a.attendees<50)violations.push(V('4.1',a,`Mega FAM targets ${a.attendees||0} participants. Minimum 50.`));
  });

  /* 4.3 — FAM outside Feb-Jun */
  A27.filter(isFAM).filter(a=>!isMegaFAM(a)).forEach(a=>{
    if(a.startDate&&(a.startDate.getMonth()<1||a.startDate.getMonth()>5))
      violations.push(V('4.3',a,`FAM starts ${fmtDate(a.startDate)} — outside Feb-Jun (Ramadan/Early Summer) window.`));
  });

  /* 5.1 — <2 Ramadan zero-budget per market */
  const mkts27=[...new Set(A27.map(a=>a.market).filter(Boolean))];
  mkts27.forEach(mkt=>{
    const rz=A27.filter(a=>a.market===mkt&&(inRam(a.startDate)||inRam(a.endDate))&&a.cashflow===0);
    if(rz.length<2)violations.push(Vm('5.1',mkt,'Ramadan Planning',`Only ${rz.length} zero-budget Ramadan activit${rz.length===1?'y':'ies'}. Min 2 required.`));
  });

  /* 6.1 — >1 mission in SAME quarter */
  mkts27.forEach(mkt=>{
    const ms=A27.filter(a=>a.market===mkt&&isMission(a));
    if(ms.length<=1)return;
    const byQ={Q1:[],Q2:[],Q3:[],Q4:[]};
    ms.forEach(a=>{const q=a.startDate?getQuarter(a.startDate):null;if(q)byQ[q].push(a);});
    Object.entries(byQ).forEach(([q,qs])=>{
      if(qs.length>1)violations.push(Vm('6.1',mkt,`${qs.length} missions in ${q}`,`${qs.length} missions in ${q}. Max 1 per quarter — missions in different quarters are acceptable.`));
    });
  });

  /* 6.3 — Exhibition no revenue (primary only) */
  A27.filter(isExhibition).forEach(a=>{
    const p=exhPrefix(a),grp=exhGroups[p]||[];
    if(grp.length>1){const isSpR=/^space.?rent$/i.test(a.activityType||'');if(!isSpR&&grp[0].id!==a.id)return;}
    if(!a.revenue)violations.push(V('6.3',a,'Exhibition has no revenue KPI.'));
  });

  /* 8.4 — New non-JMP activity >500K, no 2026 ref */
  A27.forEach(a=>{
    if(isJMP(a)||isGSA(a)||isMission(a))return;
    const k=`${a.market}||${(a.activityName||'').toLowerCase().trim()}`;
    if(!map26[k]&&a.cashflow>THRESH.NEW_CF)
      violations.push(V('8.4',a,`New activity ${fmtAED(a.cashflow)} — no 2026 equivalent. Document rationale.`));
  });

  return violations;
}

function summarise(violations){
  const active=violations.filter(v=>v.status!=='accepted');
  const counts={HIGH:0,MEDIUM:0,LOW:0};
  active.forEach(v=>{counts[v.severity]=(counts[v.severity]||0)+1;});
  const byMarket={};
  active.forEach(v=>{byMarket[v.market]=(byMarket[v.market]||0)+1;});
  const topMarkets=Object.entries(byMarket).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([market,count])=>({market,count}));
  return{counts,topMarkets,total:active.length};
}

function compareYears(b26,r27){
  const A26=b26.activities||[],A27=r27.activities||[];
  const m26={},m27={};
  A26.forEach(a=>{m26[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]=a;});
  A27.forEach(a=>{m27[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]=a;});
  const added=A27.filter(a=>!m26[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]);
  const removed=A26.filter(a=>!m27[`${a.market}||${(a.activityName||'').toLowerCase().trim()}`]);
  const changed=[];
  Object.entries(m27).forEach(([k,a27])=>{
    const a26=m26[k];if(!a26)return;
    const ch=[];
    if(Math.abs(a27.cashflow-a26.cashflow)>1000)ch.push({field:'Cashflow',from:a26.cashflow,to:a27.cashflow,diff:a27.cashflow-a26.cashflow});
    if(a27.priority!==a26.priority&&a27.priority&&a26.priority)ch.push({field:'Priority',from:a26.priority,to:a27.priority,diff:0});
    if(a27.activityType!==a26.activityType)ch.push({field:'Type',from:a26.activityType,to:a27.activityType,diff:0});
    if(a27.locked!==a26.locked)ch.push({field:'Lock',from:a26.locked,to:a27.locked,diff:0});
    if(ch.length)changed.push({a27,a26,changes:ch});
  });
  return{added,removed,changed};
}

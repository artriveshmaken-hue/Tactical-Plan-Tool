/* ═══════════════════════════════════════════════════════════
   RULES.JS — Calibrated rule engine
   Key fixes:
   - Rule 1.4: cross-year New JMPs OK to have partial CF
   - Rule 2.2: only flag Q3 closures
   - Rule 3.8: JMPs exempt; exhibitions grouped by name prefix
   - activityId on every violation; status replaces justified
═══════════════════════════════════════════════════════════ */

const RULE_META = {
  '1.1': { name: 'Budget increased >10% vs 2026 baseline',        severity: 'HIGH'   },
  '1.2': { name: 'H2 cashflow > 75% of annual (extreme)',         severity: 'HIGH'   },
  '1.3': { name: 'Oct-Dec spend > 20% of market total',           severity: 'MEDIUM' },
  '1.4': { name: 'New JMP cashflow in signing year — review',     severity: 'MEDIUM' },
  '1.5': { name: 'Virtual/Webinar has non-zero budget',           severity: 'MEDIUM' },
  '1.6': { name: 'Admin Miscellaneous line present',              severity: 'LOW'    },
  '1.7': { name: 'Signed/Active JMP cashflow = 0',                severity: 'HIGH'   },
  '2.2': { name: 'JMP contract closes in Q3 — payment falls H2',  severity: 'MEDIUM' },
  '2.6': { name: 'JMP missing hotel guest target',                severity: 'MEDIUM' },
  '3.1': { name: 'Activity type classified as "Others"',          severity: 'HIGH'   },
  '3.2': { name: 'Duplicate activity name in market',             severity: 'MEDIUM' },
  '3.3': { name: 'Bundled training sessions',                     severity: 'MEDIUM' },
  '3.6': { name: 'Training at Priority 1 / Webinar not P3',       severity: 'MEDIUM' },
  '3.8': { name: 'Activity missing KPIs (no revenue/attendees)',  severity: 'HIGH'   },
  '4.1': { name: 'Mega FAM target < 50 participants',             severity: 'MEDIUM' },
  '4.3': { name: 'FAM trip outside Ramadan/Early Summer',         severity: 'LOW'    },
  '5.1': { name: 'Market < 2 zero-budget Ramadan activities',     severity: 'HIGH'   },
  '6.1': { name: 'More than 1 sales mission per market',          severity: 'MEDIUM' },
  '6.3': { name: 'Exhibition with no revenue KPI',                severity: 'MEDIUM' },
  '8.4': { name: 'New high-value activity, no 2026 reference',    severity: 'MEDIUM' },
};

const RAM_2027_START = new Date(2027, 1, 18);
const RAM_2027_END   = new Date(2027, 2, 20);

const THRESH = {
  BUDGET_INCREASE_PCT: 10,
  BUDGET_INCREASE_AED: 50000,
  H2_EXTREME_PCT:      75,
  LATE_PAYMENT_PCT:    20,
  NEW_ACT_MIN_CF:      500000,
};

const REGIONS = {
  'Europe & CIS': ['France','Germany','Italy','Spain','Poland','Romania','Belgium','Netherlands','Russia','Armenia','Kazakhstan','Uzbekistan'],
  'APAC':    ['India','China','Japan','Korea','South Korea'],
  'GCC':     ['KSA','Kuwait','Egypt','Domestic'],
  'UK & US': ['UK','United Kingdom','USA','Canada'],
  'PR':      ['PR','B2B PR and Marketing','PR & Marketing'],
};

function getRegion(market) {
  if (!market) return 'Other';
  for (const [region, markets] of Object.entries(REGIONS)) {
    if (markets.some(m => market.toLowerCase().includes(m.toLowerCase()) ||
        m.toLowerCase().includes(market.toLowerCase()))) return region;
  }
  return 'Other';
}

function V(ruleId, market, item, detail, activityId) {
  const meta = RULE_META[ruleId] || { name: ruleId, severity: 'LOW' };
  return {
    ruleId, ruleName: meta.name, severity: meta.severity,
    market: market || 'E2014',
    region: getRegion(market || ''),
    item:   item   || 'E2014',
    detail,
    activityId: activityId || 'E2014',
    status:  'pending',
    comment: '',
  };
}

function sumM(monthly){ return MONTH_LABELS.reduce((s,m)=>s+(monthly[m]||0),0); }
function H1sum(m){ return (m.Jan||0)+(m.Feb||0)+(m.Mar||0)+(m.Apr||0)+(m.May||0)+(m.Jun||0); }
function H2sum(m){ return (m.Jul||0)+(m.Aug||0)+(m.Sep||0)+(m.Oct||0)+(m.Nov||0)+(m.Dec||0); }
function latePay(m){ return (m.Oct||0)+(m.Nov||0)+(m.Dec||0); }

function isWebinar(a)    { return /webinar|virtual|online/i.test(a.activityType+' '+a.activityName); }
function isNewJMP(a)     { return /^new jmp$/i.test(a.activityType); }
function isExistingJMP(a){ return /^existing jmp$/i.test(a.activityType); }
function isJMP(a)        { return /jmp/i.test(a.activityType); }
function isMission(a)    { return /mission/i.test(a.activityType+' '+a.activityName); }
function isFAM(a)        { return /\bfam\b/i.test(a.activityType+' '+a.activityName); }
function isMegaFAM(a)    { return /mega.?fam/i.test(a.activityType+' '+a.activityName); }
function isTraining(a)   { return /training|workshop/i.test(a.activityType+' '+a.activityName); }
function isExhibition(a) { return /exhibition|exhibit|\bitb\b|\bwtm\b|\batm\b/i.test(a.activityType+' '+a.activityName+' '+(a.market||'')); }
function inRamadan27(d)  { return d && d >= RAM_2027_START && d <= RAM_2027_END; }

function exhPrefix(a) {
  return a.activityName
    .replace(/\s*[-:]\s*(space.?rent|stand.?build|hospitality|venue|design.?build).*/i,'')
    .trim().toLowerCase();
}

function runRules(baseline26, review27) {
  const violations = [];
  const acts26 = baseline26.activities || [];
  const acts27 = review27.activities   || [];

  const map26 = {};
  acts26.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    map26[k] = (map26[k]||0) + a.cashflow;
  });

  // 1.1
  acts27.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    const prev = map26[k]||0;
    if (prev>0 && a.cashflow>prev) {
      const pct = ((a.cashflow-prev)/prev)*100;
      const abs = a.cashflow-prev;
      if (pct>THRESH.BUDGET_INCREASE_PCT && abs>THRESH.BUDGET_INCREASE_AED) {
        violations.push(V('1.1', a.market, a.activityName,
          `${fmtAED(prev)} (2026) to ${fmtAED(a.cashflow)} (2027). Increase: ${fmtAED(abs)} (+${pct.toFixed(1)}%).`, a.id));
      }
    }
  });

  // 1.2 + 1.3
  const mktCF = {};
  acts27.forEach(a => {
    if (!mktCF[a.market]) mktCF[a.market]={Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0};
    MONTH_LABELS.forEach(m=>{ mktCF[a.market][m]+=a.monthly[m]||0; });
  });
  Object.entries(mktCF).forEach(([mkt,mo])=>{
    const h1=H1sum(mo), h2=H2sum(mo), tot=h1+h2;
    if (tot<50000) return;
    if ((h2/tot)*100 > THRESH.H2_EXTREME_PCT)
      violations.push(V('1.2', mkt, 'Cashflow Distribution',
        `H2 = ${((h2/tot)*100).toFixed(1)}% (${fmtAED(h2)}). Extreme back-loading — portfolio avg ~68% H2.`));
    const late=latePay(mo);
    if (tot>0 && (late/tot)*100>THRESH.LATE_PAYMENT_PCT)
      violations.push(V('1.3', mkt, 'Late Payment Oct-Dec',
        `Oct-Dec = ${fmtAED(late)} (${((late/tot)*100).toFixed(1)}%). Threshold >${THRESH.LATE_PAYMENT_PCT}%.`));
  });

  // 1.4 — New JMP cashflow in signing year
  // Cross-year JMP (ends 2028+): MEDIUM — partial acceptable, flag for review
  // Same-year JMP (ends 2027): HIGH — full payment in signing year
  acts27.filter(isNewJMP).forEach(a=>{
    if (a.cashflow<=0) return;
    const crossYear = a.endDate && a.endDate.getFullYear()>2027;
    if (crossYear) {
      violations.push(V('1.4', a.market, a.activityName,
        `Cross-year JMP (ends ${fmtDate(a.endDate)}) has ${fmtAED(a.cashflow)} in 2027. Partial payment acceptable — verify this is not full contract value.`,
        a.id));
    } else {
      violations.push(V('1.4', a.market, a.activityName,
        `New JMP ending ${fmtDate(a.endDate)} has ${fmtAED(a.cashflow)} in signing year. Payment should follow contract close.`,
        a.id));
    }
  });

  // 1.5
  acts27.filter(isWebinar).forEach(a=>{
    if (a.cashflow>0) violations.push(V('1.5', a.market, a.activityName,
      `Webinar has cashflow ${fmtAED(a.cashflow)}. Must be zero-cost.`, a.id));
  });

  // 1.6
  acts27.forEach(a=>{
    if (/admin.misc|miscellaneous/i.test(a.activityName+' '+a.activityType))
      violations.push(V('1.6', a.market, a.activityName, 'Admin Miscellaneous must be removed.', a.id));
  });

  // 1.7
  acts27.filter(isExistingJMP).forEach(a=>{
    if (a.cashflow===0 && a.locked==='Locked')
      violations.push(V('1.7', a.market, a.activityName,
        'Locked Existing JMP cashflow = 0. Contract value may be missing.', a.id));
  });

  // 2.2 — only Q3 closures (Jul-Sep 2027)
  acts27.filter(isJMP).forEach(a=>{
    if (!a.endDate) return;
    const yr=a.endDate.getFullYear(), mo=a.endDate.getMonth();
    if (yr===2027 && mo>=6 && mo<=8)
      violations.push(V('2.2', a.market, a.activityName,
        `JMP ends ${fmtDate(a.endDate)} (Q3 2027) — payment due Q3/Q4, adding to H2 heaviness. Consider H1 closure.`, a.id));
  });

  // 2.6
  acts27.filter(isJMP).forEach(a=>{
    if (!a.revenue && !a.attendees && !a.description)
      violations.push(V('2.6', a.market, a.activityName,
        'JMP has no hotel guest target, no KPI and no description. Hotel guest targets required.', a.id));
  });

  // 3.1
  acts27.filter(a=>/^others$/i.test(a.activityType)).forEach(a=>{
    violations.push(V('3.1', a.market, a.activityName,
      'Type is "Others". Must be reclassified to a specific valid type.', a.id));
  });

  // 3.2
  const seen={};
  acts27.forEach(a=>{
    const k=`${a.market}||${a.activityName.toLowerCase().trim()}`;
    if (seen[k]) violations.push(V('3.2', a.market, a.activityName,
      `Duplicate activity name in ${a.market}.`, a.id));
    seen[k]=true;
  });

  // 3.3
  acts27.filter(isTraining).forEach(a=>{
    if (/annual|multiple|series|throughout|sessions/i.test(a.activityName))
      violations.push(V('3.3', a.market, a.activityName,
        'Training bundles multiple sessions. Each must be a separate line.', a.id));
  });

  // 3.6
  acts27.filter(isTraining).forEach(a=>{
    if (a.priority===1) violations.push(V('3.6', a.market, a.activityName,
      'Training is Priority 1. Must be P2 or P3.', a.id));
  });
  acts27.filter(isWebinar).forEach(a=>{
    if (a.priority && a.priority!==3) violations.push(V('3.6', a.market, a.activityName,
      `Webinar is Priority ${a.priority}. Must be P3.`, a.id));
  });

  // 3.8 — KPI check with JMP exemption and exhibition grouping
  const exhGroups={};
  acts27.filter(isExhibition).forEach(a=>{
    const p=exhPrefix(a);
    if (!exhGroups[p]) exhGroups[p]=[];
    exhGroups[p].push(a);
  });

  acts27.forEach(a=>{
    if (isJMP(a)) return;                     // JMPs fully exempt
    if (isWebinar(a)) return;                  // webinars exempt
    if (/^admin$/i.test(a.activityType)) return; // admin exempt
    if (isExhibition(a)) {
      const p=exhPrefix(a);
      const grp=exhGroups[p]||[];
      if (grp.length>1) {
        // Only flag the primary row (first or Space Rent)
        const isSpaceRent=/space.?rent/i.test(a.activityName+' '+a.activityType);
        const isFirst=grp[0].id===a.id;
        if (!isSpaceRent && !isFirst) return; // skip sub-component
      }
    }
    if (!a.revenue && !a.attendees)
      violations.push(V('3.8', a.market, a.activityName,
        'No revenue figure and no attendee/KPI target. All non-JMP activities need at least one KPI.', a.id));
  });

  // 4.1
  acts27.filter(isMegaFAM).forEach(a=>{
    if (a.attendees<50) violations.push(V('4.1', a.market, a.activityName,
      `Mega FAM targets ${a.attendees} participants. Minimum 50.`, a.id));
  });

  // 4.3
  acts27.filter(isFAM).filter(a=>!isMegaFAM(a)).forEach(a=>{
    if (a.startDate && (a.startDate.getMonth()<1||a.startDate.getMonth()>5))
      violations.push(V('4.3', a.market, a.activityName,
        `FAM starts ${fmtDate(a.startDate)} — outside Ramadan/Early Summer window (Feb-Jun).`, a.id));
  });

  // 5.1
  const markets27=[...new Set(acts27.map(a=>a.market).filter(Boolean))];
  markets27.forEach(mkt=>{
    const ramZero=acts27.filter(a=>a.market===mkt&&(inRamadan27(a.startDate)||inRamadan27(a.endDate))&&a.cashflow===0);
    if (ramZero.length<2)
      violations.push(V('5.1', mkt, 'Ramadan Planning',
        `Only ${ramZero.length} zero-budget Ramadan activit${ramZero.length===1?'y':'ies'} found. Min 2 required.`));
  });

  // 6.1
  markets27.forEach(mkt=>{
    const m=acts27.filter(a=>a.market===mkt&&isMission(a));
    if (m.length>1) violations.push(V('6.1', mkt, `${m.length} missions`,
      `${m.length} sales missions. Only 1 permitted per market per year.`));
  });

  // 6.3 — only primary exhibition component
  acts27.filter(isExhibition).forEach(a=>{
    const p=exhPrefix(a); const grp=exhGroups[p]||[];
    if (grp.length>1) {
      const isSpaceRent=/space.?rent/i.test(a.activityName+' '+a.activityType);
      const isFirst=grp[0].id===a.id;
      if (!isSpaceRent && !isFirst) return;
    }
    if (!a.revenue) violations.push(V('6.3', a.market, a.activityName,
      'Exhibition has no revenue KPI.', a.id));
  });

  // 8.4
  acts27.forEach(a=>{
    const k=`${a.market}||${a.activityName.toLowerCase().trim()}`;
    if (!map26[k] && a.cashflow>THRESH.NEW_ACT_MIN_CF)
      violations.push(V('8.4', a.market, a.activityName,
        `New activity with ${fmtAED(a.cashflow)} — no 2026 equivalent. Document rationale.`, a.id));
  });

  return violations;
}

function summarise(violations) {
  const counts={HIGH:0,MEDIUM:0,LOW:0};
  const active=violations.filter(v=>v.status!=='accepted');
  active.forEach(v=>{ counts[v.severity]=(counts[v.severity]||0)+1; });
  const byMarket={};
  active.forEach(v=>{ byMarket[v.market]=(byMarket[v.market]||0)+1; });
  const topMarkets=Object.entries(byMarket).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([market,count])=>({market,count}));
  return { counts, topMarkets, total: active.length };
}

function compareYears(baseline26, review27) {
  const acts26=baseline26.activities||[], acts27=review27.activities||[];
  const map26={}, map27={};
  acts26.forEach(a=>{ map26[`${a.market}||${a.activityName.toLowerCase().trim()}`]=a; });
  acts27.forEach(a=>{ map27[`${a.market}||${a.activityName.toLowerCase().trim()}`]=a; });
  const added  =acts27.filter(a=>!map26[`${a.market}||${a.activityName.toLowerCase().trim()}`]);
  const removed=acts26.filter(a=>!map27[`${a.market}||${a.activityName.toLowerCase().trim()}`]);
  const changed=[];
  Object.entries(map27).forEach(([k,a27])=>{
    const a26=map26[k]; if (!a26) return;
    const changes=[];
    if (Math.abs(a27.cashflow-a26.cashflow)>1000) changes.push({field:'Cashflow',from:a26.cashflow,to:a27.cashflow});
    if (a27.priority!==a26.priority&&a27.priority&&a26.priority) changes.push({field:'Priority',from:a26.priority,to:a27.priority});
    if (a27.activityType!==a26.activityType) changes.push({field:'Type',from:a26.activityType,to:a27.activityType});
    if (a27.locked!==a26.locked) changes.push({field:'Lock',from:a26.locked,to:a27.locked});
    if (changes.length) changed.push({activity:a27,changes});
  });
  return {added,removed,changed};
}

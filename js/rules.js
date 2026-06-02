/* rules.js — Fully calibrated rule engine v4 */

// ── Predefined activity types (from AOP_Activities_KPIs.csv) ─
const VALID_TYPES = new Set([
  'FAM','E-Learning','Roadshow','Events / WorkShops','Webinars',
  'New JMP','B2B PR FAM Trip','Exhibitions','Stakeholder Engagement',
  'Mall Activation','Existing JMP','B2B Comms','Expenses',
  'Mission & Travel','GSA Retainer Fee','Corporate Activation',
  'Newsletter','Cruise JMP','B2C Conversion','Content Partnership',
  'Manpower','Projects','Admin','Mega FAM','Marketplace',
  'Travel Trade Partnership','Co-Host Industry Event','Stand Build',
  'Space Rent','Hospitality','Experience Abu Dhabi Workshop',
  'Destination Sponsorship','Others',
]);

// Types where KPI check is not applicable (no measurable KPI in the system)
const KPI_EXEMPT_TYPES = new Set([
  'GSA Retainer Fee','Mission & Travel','Manpower','Projects',
  'Admin','Stand Build','Hospitality','Expenses',
  'New JMP','Existing JMP','Cruise JMP',  // JMP KPIs tracked separately
]);

const RULE_META = {
  '0.1': { name: 'Activity type not in predefined list',        severity: 'HIGH'   },
  '1.1': { name: 'Budget increased >10% vs 2026 baseline',      severity: 'HIGH'   },
  '1.2': { name: 'Q4 cashflow >30% of annual (back-loaded)',    severity: 'HIGH'   },
  '1.3': { name: 'Nov/Dec spend >15% of annual total',          severity: 'MEDIUM' },
  '1.4': { name: 'New JMP cashflow in signing year',            severity: 'MEDIUM' },
  '1.5': { name: 'Webinar has non-zero budget',                 severity: 'MEDIUM' },
  '1.6': { name: 'Admin Miscellaneous line present',            severity: 'LOW'    },
  '1.7': { name: 'Locked Existing JMP cashflow = 0',            severity: 'HIGH'   },
  '2.2': { name: 'JMP closes Q3 — payment lands in H2',         severity: 'MEDIUM' },
  '2.6': { name: 'JMP missing hotel guest target',              severity: 'MEDIUM' },
  '3.1': { name: 'Activity type is "Others"',                   severity: 'HIGH'   },
  '3.2': { name: 'Duplicate activity — same name + same type',  severity: 'MEDIUM' },
  '3.3': { name: 'Training activity spans >1 month (bundled)',  severity: 'MEDIUM' },
  '3.6': { name: 'Webinar at Priority 1 (must be P2 or P3)',   severity: 'MEDIUM' },
  '3.8': { name: 'Activity missing KPIs',                       severity: 'HIGH'   },
  '4.1': { name: 'Mega FAM target < 50 participants',           severity: 'MEDIUM' },
  '4.3': { name: 'FAM trip outside Ramadan/Early Summer',       severity: 'LOW'    },
  '5.1': { name: '< 2 zero-budget Ramadan activities',          severity: 'HIGH'   },
  '6.1': { name: '2 sales missions in same quarter',            severity: 'MEDIUM' },
  '6.3': { name: 'Exhibition with no revenue KPI',              severity: 'MEDIUM' },
  '8.4': { name: 'New non-JMP activity >500K — no 2026 ref',   severity: 'MEDIUM' },
};

const RAM_2027_S = new Date(2027,1,18), RAM_2027_E = new Date(2027,2,20);
const THRESH = { INC_PCT:10, INC_AED:50000, Q4_PCT:30, NOVDEC_PCT:15, NEW_CF:500000 };

// ── Region mapping — complete and correct ─────────────────────
const REGIONS = {
  'Europe & CIS': [
    'France','Germany','Italy','Spain','Poland','Romania','Belgium',
    'Netherlands','Russia','Armenia','Kazakhstan','Uzbekistan',
  ],
  'APAC': ['India','China','Japan','Korea','South Korea'],
  'GCC':  ['KSA','Saudi Arabia','Kuwait','Egypt','Domestic'],
  'UK & US': ['UK','United Kingdom','USA','United States','Canada'],
  'PR':   ['PR','PR & Marketing','B2B PR and Marketing'],
  'Global': [
    'Global Partnerships','Exhibitions','IO Office',
    'Global','International','Exhibition',
  ],
};

function getRegion(market) {
  if (!market) return 'Other';
  const ml = market.toLowerCase();
  for (const [region, markets] of Object.entries(REGIONS)) {
    if (markets.some(m => ml.includes(m.toLowerCase()) || m.toLowerCase().includes(ml))) return region;
  }
  return 'Other';
}

// ── Quarter helpers ───────────────────────────────────────────
function getQuarter(date) {
  if (!date) return null;
  const m = date.getMonth(); // 0-based
  return m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
}

function monthSum(monthly, months) {
  return months.reduce((s, m) => s + (monthly[m] || 0), 0);
}

const Q1_MONTHS = ['Jan','Feb','Mar'];
const Q2_MONTHS = ['Apr','May','Jun'];
const Q3_MONTHS = ['Jul','Aug','Sep'];
const Q4_MONTHS = ['Oct','Nov','Dec'];
const NOVDEC    = ['Nov','Dec'];

// ── Violation factories ───────────────────────────────────────
function V(ruleId, activity, detail) {
  const meta = RULE_META[ruleId] || { name: ruleId, severity: 'LOW' };
  return {
    ruleId, ruleName: meta.name, severity: meta.severity,
    market:       activity?.market       || '—',
    region:       getRegion(activity?.market || ''),
    activityId:   activity?.id           || '—',
    activityName: activity?.activityName || '—',
    activityType: activity?.activityType || '—',
    detail, status: 'pending', comment: '',
  };
}

// Market-level violation (no specific activity — Ramadan, missions count, etc.)
function Vm(ruleId, market, label, detail) {
  const meta = RULE_META[ruleId] || { name: ruleId, severity: 'LOW' };
  return {
    ruleId, ruleName: meta.name, severity: meta.severity,
    market, region: getRegion(market),
    activityId:   'Market-level',
    activityName: label,
    activityType: '—',
    detail, status: 'pending', comment: '',
  };
}

// ── Type helpers ──────────────────────────────────────────────
function isWebinar(a)   { return /webinar/i.test(a.activityType); }
function isNewJMP(a)    { return /^new jmp$/i.test(a.activityType); }
function isExistJMP(a)  { return /^existing jmp$/i.test(a.activityType); }
function isJMP(a)       { return /jmp/i.test(a.activityType); }
function isMission(a)   { return /mission/i.test(`${a.activityType} ${a.activityName}`); }
function isFAM(a)       { return /\bfam\b/i.test(`${a.activityType} ${a.activityName}`); }
function isMegaFAM(a)   { return /mega.?fam/i.test(`${a.activityType} ${a.activityName}`); }
function isTraining(a)  { return /^(events \/ workshops|webinars|e-learning|experience abu dhabi workshop)$/i.test(a.activityType) || /training|workshop/i.test(a.activityName); }
function isExhibition(a){ return /^(exhibitions|stand build|space rent|hospitality)$/i.test(a.activityType) || /exhibition|exhibit|\bitb\b|\bwtm\b|\batm\b/i.test(`${a.activityType} ${a.activityName}`); }
function inRam27(d)     { return d && d >= RAM_2027_S && d <= RAM_2027_E; }

function exhPrefix(a) {
  return a.activityName.replace(/\s*[-:]\s*(space.?rent|stand.?build|hospitality|venue|design.?build).*/i,'').trim().toLowerCase();
}

// ── MAIN RULE RUNNER ──────────────────────────────────────────
function runRules(baseline26, review27) {
  const violations = [];
  const A27 = review27.activities   || [];
  const A26 = baseline26.activities || [];

  // 2026 lookup
  const map26 = {};
  A26.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    map26[k] = (map26[k] || 0) + a.cashflow;
  });

  // ── 0.1 Invalid activity type ─────────────────────────────
  A27.forEach(a => {
    if (!a.activityType || a.activityType === '—') return;
    // Normalise for check
    const typeNorm = a.activityType.trim();
    // Check against valid types (case-insensitive)
    const valid = [...VALID_TYPES].some(t => t.toLowerCase() === typeNorm.toLowerCase());
    if (!valid) {
      violations.push(V('0.1', a,
        `"${typeNorm}" is not a predefined activity type. Valid types: ${[...VALID_TYPES].filter(t=>!/^others$/i.test(t)).slice(0,8).join(', ')}…`));
    }
  });

  // ── 1.1 Budget increased >10% AND >50K ───────────────────
  A27.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    const prev = map26[k] || 0;
    if (prev > 0 && a.cashflow > prev) {
      const pct = ((a.cashflow - prev) / prev) * 100;
      const abs = a.cashflow - prev;
      if (pct > THRESH.INC_PCT && abs > THRESH.INC_AED)
        violations.push(V('1.1', a,
          `${fmtAED(prev)} (2026) → ${fmtAED(a.cashflow)} (2027). Increase: ${fmtAED(abs)} (+${pct.toFixed(1)}%)`));
    }
  });

  // ── 1.2 Q4 cashflow > 30% of annual per market ───────────
  // ── 1.3 Nov/Dec cashflow > 15% of annual ─────────────────
  const mktCF = {};
  A27.forEach(a => {
    if (!mktCF[a.market]) mktCF[a.market] = MONTH_LABELS.reduce((o,m)=>({...o,[m]:0}),{});
    MONTH_LABELS.forEach(m => { mktCF[a.market][m] += a.monthly[m] || 0; });
  });

  Object.entries(mktCF).forEach(([mkt, mo]) => {
    const tot = MONTH_LABELS.reduce((s,m) => s + mo[m], 0);
    if (tot < 50000) return;
    const q4  = monthSum(mo, Q4_MONTHS);
    const novdec = monthSum(mo, NOVDEC);
    const q4pct = (q4 / tot) * 100;
    const ndpct = (novdec / tot) * 100;
    if (q4pct > THRESH.Q4_PCT)
      violations.push(Vm('1.2', mkt, 'Q4 Cashflow',
        `Q4 = ${fmtAED(q4)} (${q4pct.toFixed(1)}% of annual). Threshold >${THRESH.Q4_PCT}%. Back-loading into Oct-Dec must be justified.`));
    if (ndpct > THRESH.NOVDEC_PCT)
      violations.push(Vm('1.3', mkt, 'Nov-Dec Spend',
        `Nov-Dec = ${fmtAED(novdec)} (${ndpct.toFixed(1)}% of annual). Payments in Nov-Dec are very late in the financial year.`));
  });

  // ── 1.4 New JMP cashflow in signing year ─────────────────
  A27.filter(isNewJMP).forEach(a => {
    if (a.cashflow <= 0) return;
    const crossYear = a.endDate && a.endDate.getFullYear() > 2027;
    violations.push(V('1.4', a, crossYear
      ? `Cross-year JMP (ends ${fmtDate(a.endDate)}): ${fmtAED(a.cashflow)} in 2027. Partial payment may be acceptable — confirm not full contract value.`
      : `Ends ${fmtDate(a.endDate)}, ${fmtAED(a.cashflow)} in signing year. Payment should follow contract close.`));
  });

  // ── 1.5 Webinar with budget > 0 ──────────────────────────
  A27.filter(isWebinar).forEach(a => {
    if (a.cashflow > 0)
      violations.push(V('1.5', a, `Webinar has ${fmtAED(a.cashflow)} cashflow. Webinars must be zero-cost.`));
  });

  // ── 1.6 Admin Miscellaneous ───────────────────────────────
  A27.forEach(a => {
    if (/admin.misc|miscellaneous/i.test(`${a.activityName} ${a.activityType}`))
      violations.push(V('1.6', a, 'Admin Miscellaneous must be removed. Use specific task codes.'));
  });

  // ── 1.7 Locked Existing JMP, cashflow = 0 ────────────────
  A27.filter(isExistJMP).forEach(a => {
    if (a.cashflow === 0 && a.locked === 'Locked')
      violations.push(V('1.7', a, 'Locked Existing JMP cashflow = 0. Contract value may be missing.'));
  });

  // ── 2.2 JMP closes Q3 of 2027 ────────────────────────────
  A27.filter(isJMP).forEach(a => {
    if (!a.endDate) return;
    if (a.endDate.getFullYear() === 2027 && a.endDate.getMonth() >= 6 && a.endDate.getMonth() <= 8)
      violations.push(V('2.2', a,
        `JMP ends ${fmtDate(a.endDate)} (Q3). Payment due Q3/Q4 — contributes to back-loading. Consider H1 closure.`));
  });

  // ── 2.6 JMP missing hotel guest target ───────────────────
  A27.filter(isJMP).forEach(a => {
    if (!a.revenue && !a.attendees && !a.description)
      violations.push(V('2.6', a, 'JMP has no hotel guest target, no KPI and no description.'));
  });

  // ── 3.1 ActivityType = Others ─────────────────────────────
  A27.filter(a => /^others$/i.test(a.activityType)).forEach(a =>
    violations.push(V('3.1', a, 'Type is "Others". Must be reclassified to a valid specific type.')));

  // ── 3.2 Duplicate: same name AND same type per market ────
  const seen = {};
  A27.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}||${a.activityType.toLowerCase().trim()}`;
    if (seen[k])
      violations.push(V('3.2', a, `Duplicate activity name + type in ${a.market}. Same name with different types is acceptable.`));
    seen[k] = true;
  });

  // ── 3.3 Training spans > 31 days (bundled sessions) ──────
  // Only flag if start and end date differ by more than 31 days
  A27.filter(isTraining).forEach(a => {
    if (!a.startDate || !a.endDate) return;
    const diffDays = (a.endDate - a.startDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 31)
      violations.push(V('3.3', a,
        `Training spans ${Math.round(diffDays)} days (${fmtDate(a.startDate)} to ${fmtDate(a.endDate)}). Activities running >1 month suggest bundled sessions — each must be a separate line.`));
  });

  // ── 3.6 Webinar at Priority 1 only (P2 is acceptable) ────
  A27.filter(isWebinar).forEach(a => {
    if (a.priority === 1)
      violations.push(V('3.6', a, `Webinar is Priority 1. Webinars must be Priority 2 or 3 (P2 is acceptable, P1 is not).`));
  });

  // ── 3.8 Missing KPIs (exempt: JMPs, GSA, Mission, Admin, etc.) ──
  const exhGroups = {};
  A27.filter(isExhibition).forEach(a => {
    const p = exhPrefix(a);
    if (!exhGroups[p]) exhGroups[p] = [];
    exhGroups[p].push(a);
  });

  A27.forEach(a => {
    // Full exemptions
    if (KPI_EXEMPT_TYPES.has(a.activityType)) return;
    if (isWebinar(a)) return; // webinars have Attendees KPI but we can't check it
    if (/^others$/i.test(a.activityType)) return; // already flagged under 3.1
    // Exhibition sub-components: only flag primary (Space Rent or first)
    if (isExhibition(a)) {
      const p = exhPrefix(a), grp = exhGroups[p] || [];
      if (grp.length > 1) {
        const isSpaceRent = /^space.?rent$/i.test(a.activityType);
        const isFirst = grp[0].id === a.id;
        if (!isSpaceRent && !isFirst) return;
      }
    }
    if (!a.revenue && !a.attendees)
      violations.push(V('3.8', a,
        `No revenue and no attendee/KPI target. All activities (except JMPs, GSA, Admin, Mission) must have at least one KPI.`));
  });

  // ── 4.1 Mega FAM < 50 participants ───────────────────────
  A27.filter(isMegaFAM).forEach(a => {
    if (a.attendees < 50)
      violations.push(V('4.1', a, `Mega FAM targets ${a.attendees} participants. Minimum is 50.`));
  });

  // ── 4.3 FAM outside Ramadan/Early Summer ─────────────────
  A27.filter(isFAM).filter(a => !isMegaFAM(a)).forEach(a => {
    if (a.startDate && (a.startDate.getMonth() < 1 || a.startDate.getMonth() > 5))
      violations.push(V('4.3', a, `FAM starts ${fmtDate(a.startDate)} — outside Feb-Jun window.`));
  });

  // ── 5.1 < 2 zero-budget Ramadan activities ───────────────
  const markets27 = [...new Set(A27.map(a => a.market).filter(Boolean))];
  markets27.forEach(mkt => {
    const ramZero = A27.filter(a =>
      a.market === mkt && (inRam27(a.startDate) || inRam27(a.endDate)) && a.cashflow === 0
    );
    if (ramZero.length < 2)
      violations.push(Vm('5.1', mkt, 'Ramadan Planning',
        `Only ${ramZero.length} zero-budget Ramadan activit${ramZero.length === 1 ? 'y' : 'ies'} found. Min 2 required.`));
  });

  // ── 6.1 > 1 sales mission in the SAME quarter ────────────
  markets27.forEach(mkt => {
    const missions = A27.filter(a => a.market === mkt && isMission(a));
    if (missions.length <= 1) return;
    // Group by quarter based on startDate
    const byQ = { Q1:[], Q2:[], Q3:[], Q4:[] };
    missions.forEach(a => {
      const q = a.startDate ? getQuarter(a.startDate) : null;
      if (q) byQ[q].push(a);
    });
    Object.entries(byQ).forEach(([q, ms]) => {
      if (ms.length > 1)
        violations.push(Vm('6.1', mkt, `${ms.length} missions in ${q}`,
          `${ms.length} sales missions in ${q}. Only 1 mission per quarter per market. Missions in different quarters are acceptable.`));
    });
  });

  // ── 6.3 Exhibition with no revenue KPI (primary only) ────
  A27.filter(isExhibition).forEach(a => {
    const p = exhPrefix(a), grp = exhGroups[p] || [];
    if (grp.length > 1) {
      const isSpaceRent = /^space.?rent$/i.test(a.activityType);
      const isFirst = grp[0].id === a.id;
      if (!isSpaceRent && !isFirst) return;
    }
    if (!a.revenue)
      violations.push(V('6.3', a, 'Exhibition has no revenue KPI.'));
  });

  // ── 8.4 New non-JMP activity > 500K, no 2026 equivalent ──
  A27.forEach(a => {
    if (isJMP(a)) return; // JMP cross-year payments are expected
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    if (!map26[k] && a.cashflow > THRESH.NEW_CF)
      violations.push(V('8.4', a,
        `New activity with ${fmtAED(a.cashflow)} — no 2026 equivalent. Document rationale for budget allocation.`));
  });

  return violations;
}

function summarise(violations) {
  const active = violations.filter(v => v.status !== 'accepted');
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  active.forEach(v => { counts[v.severity] = (counts[v.severity] || 0) + 1; });
  const byMarket = {};
  active.forEach(v => { byMarket[v.market] = (byMarket[v.market] || 0) + 1; });
  const topMarkets = Object.entries(byMarket).sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([market, count]) => ({ market, count }));
  return { counts, topMarkets, total: active.length };
}

function compareYears(b26, r27) {
  const A26 = b26.activities || [], A27 = r27.activities || [];
  const m26 = {}, m27 = {};
  A26.forEach(a => { m26[`${a.market}||${a.activityName.toLowerCase().trim()}`] = a; });
  A27.forEach(a => { m27[`${a.market}||${a.activityName.toLowerCase().trim()}`] = a; });
  const added   = A27.filter(a => !m26[`${a.market}||${a.activityName.toLowerCase().trim()}`]);
  const removed = A26.filter(a => !m27[`${a.market}||${a.activityName.toLowerCase().trim()}`]);
  const changed = [];
  Object.entries(m27).forEach(([k, a27]) => {
    const a26 = m26[k]; if (!a26) return;
    const ch = [];
    if (Math.abs(a27.cashflow - a26.cashflow) > 1000) ch.push({field:'Cashflow',from:a26.cashflow,to:a27.cashflow,diff:a27.cashflow-a26.cashflow});
    if (a27.priority !== a26.priority && a27.priority && a26.priority) ch.push({field:'Priority',from:a26.priority,to:a27.priority,diff:0});
    if (a27.activityType !== a26.activityType) ch.push({field:'Type',from:a26.activityType,to:a27.activityType,diff:0});
    if (a27.locked !== a26.locked) ch.push({field:'Lock',from:a26.locked,to:a27.locked,diff:0});
    if (ch.length) changed.push({ a27, a26, changes: ch });
  });
  return { added, removed, changed };
}

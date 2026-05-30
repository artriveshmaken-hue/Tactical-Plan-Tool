/* ═══════════════════════════════════════════════════════════
   RULES.JS — Rule engine operating on Tactical Details only
   Thresholds calibrated against real 2026/2027 data:
   - Both years are naturally H2-heavy (~68% H2) — flag only >75%
   - Rule 1.1 flags only increases >10% AND >50K AED
   - Rule 1.3 flags only if Oct-Dec > 20% of market total
═══════════════════════════════════════════════════════════ */

const RULE_META = {
  '1.1': { name: 'Budget increased >10% vs 2026 baseline',   severity: 'HIGH'   },
  '1.2': { name: 'H2 cashflow > 75% of annual (extreme)',    severity: 'HIGH'   },
  '1.3': { name: 'Oct–Dec spend > 20% of market total',      severity: 'MEDIUM' },
  '1.4': { name: 'New JMP carries in-year cashflow',         severity: 'HIGH'   },
  '1.5': { name: 'Virtual/Webinar has non-zero budget',      severity: 'MEDIUM' },
  '1.6': { name: 'Admin Miscellaneous line present',         severity: 'LOW'    },
  '1.7': { name: 'Signed/Active JMP cashflow = 0',           severity: 'HIGH'   },
  '2.2': { name: 'JMP contract closes in Q3 or Q4',          severity: 'HIGH'   },
  '2.6': { name: 'JMP missing attendee/revenue target',      severity: 'MEDIUM' },
  '3.1': { name: 'Activity type classified as "Others"',     severity: 'HIGH'   },
  '3.2': { name: 'Duplicate activity name in market',        severity: 'MEDIUM' },
  '3.3': { name: 'Bundled training sessions',                severity: 'MEDIUM' },
  '3.6': { name: 'Training at Priority 1 / Webinar not P3', severity: 'MEDIUM' },
  '3.8': { name: 'Activity missing KPIs (no revenue/att.)', severity: 'HIGH'   },
  '4.1': { name: 'Mega FAM target < 50 participants',        severity: 'MEDIUM' },
  '4.3': { name: 'FAM trip outside Ramadan/Early Summer',    severity: 'LOW'    },
  '5.1': { name: 'Market < 2 zero-budget Ramadan activities',severity: 'HIGH'   },
  '6.1': { name: 'More than 1 sales mission per market',     severity: 'MEDIUM' },
  '6.3': { name: 'Exhibition with no revenue KPI',           severity: 'MEDIUM' },
  '8.4': { name: 'New high-value activity with no 2026 ref', severity: 'MEDIUM' },
};

// Ramadan 2027 window (approximate — update when confirmed)
const RAM_2027_START = new Date(2027, 1, 18); // Feb 18
const RAM_2027_END   = new Date(2027, 2, 20); // Mar 20

// ── Thresholds (calibrated to real data) ─────────────────
const THRESH = {
  BUDGET_INCREASE_PCT:  10,      // Rule 1.1: flag if increase > 10%
  BUDGET_INCREASE_AED:  50000,   // Rule 1.1: AND absolute increase > 50K AED
  H2_EXTREME_PCT:       75,      // Rule 1.2: flag only if H2 > 75% (not just H2>H1)
  LATE_PAYMENT_PCT:     20,      // Rule 1.3: flag if Oct-Dec > 20% of market total
  NEW_ACT_MIN_CF:       500000,  // Rule 8.4: only flag new acts with CF > 500K
};

function V(ruleId, market, item, detail) {
  const meta = RULE_META[ruleId] || { name: ruleId, severity: 'LOW' };
  return {
    ruleId, ruleName: meta.name, severity: meta.severity,
    market: market || '—', item: item || '—', detail,
    justified: false, justificationNote: '',
  };
}

// ── Monthly helpers ───────────────────────────────────────
function sumM(monthly) {
  return MONTH_LABELS.reduce((s,m) => s + (monthly[m]||0), 0);
}
function H1sum(m) {
  return (m.Jan||0)+(m.Feb||0)+(m.Mar||0)+(m.Apr||0)+(m.May||0)+(m.Jun||0);
}
function H2sum(m) {
  return (m.Jul||0)+(m.Aug||0)+(m.Sep||0)+(m.Oct||0)+(m.Nov||0)+(m.Dec||0);
}
function latePay(m) {
  return (m.Oct||0)+(m.Nov||0)+(m.Dec||0);
}

// ── Activity type helpers ─────────────────────────────────
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

// ── MAIN RULE RUNNER ──────────────────────────────────────
function runRules(baseline26, review27) {
  const violations = [];
  const acts26 = baseline26.activities || [];
  const acts27 = review27.activities   || [];

  // Build 2026 lookup by market+name
  const map26 = {};
  acts26.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    map26[k] = (map26[k] || 0) + a.cashflow;
  });

  // ── 1.1 Budget increased >10% AND >50K vs 2026 ──────────
  acts27.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    const prev = map26[k] || 0;
    if (prev > 0 && a.cashflow > prev) {
      const pct = ((a.cashflow - prev) / prev) * 100;
      const abs = a.cashflow - prev;
      if (pct > THRESH.BUDGET_INCREASE_PCT && abs > THRESH.BUDGET_INCREASE_AED) {
        violations.push(V('1.1', a.market, a.activityName,
          `Cashflow: ${fmtAED(prev)} (2026) → ${fmtAED(a.cashflow)} (2027). Increase: ${fmtAED(abs)} (+${pct.toFixed(1)}%). Threshold: >${THRESH.BUDGET_INCREASE_PCT}% AND >${fmtAED(THRESH.BUDGET_INCREASE_AED)}.`));
      }
    }
  });

  // ── 1.2 H2 > 75% of annual per market (extreme concentration) ──
  // Note: both 2026 and 2027 are naturally ~68% H2 across the portfolio.
  // Rule only fires when a specific market is extremely back-loaded (>75%).
  const mktCF = {};
  acts27.forEach(a => {
    if (!mktCF[a.market]) mktCF[a.market] = { Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0 };
    MONTH_LABELS.forEach(m => { mktCF[a.market][m] += a.monthly[m]||0; });
  });

  Object.entries(mktCF).forEach(([mkt, mo]) => {
    const h1 = H1sum(mo), h2 = H2sum(mo), tot = h1 + h2;
    if (tot < 50000) return; // skip near-zero markets
    const h2pct = (h2 / tot) * 100;
    if (h2pct > THRESH.H2_EXTREME_PCT) {
      violations.push(V('1.2', mkt, 'Cashflow Distribution',
        `H2 = ${h2pct.toFixed(1)}% of annual spend (${fmtAED(h2)}). Extreme back-loading — threshold is >${THRESH.H2_EXTREME_PCT}%. Note: portfolio average is ~68% H2.`));
    }

    // ── 1.3 Oct–Dec > 20% of market total ─────────────────
    const late = latePay(mo);
    if (tot > 0 && (late / tot) * 100 > THRESH.LATE_PAYMENT_PCT) {
      violations.push(V('1.3', mkt, 'Late Payment (Oct–Dec)',
        `Oct–Dec = ${fmtAED(late)} (${(late/tot*100).toFixed(1)}% of market total). Threshold: >${THRESH.LATE_PAYMENT_PCT}%. Payments should not extend into Q4.`));
    }
  });

  // ── 1.4 New JMP with in-year cashflow ─────────────────────
  acts27.filter(isNewJMP).forEach(a => {
    const cf = sumM(a.monthly);
    if (cf > 0) violations.push(V('1.4', a.market, a.activityName,
      `New JMP has in-year cashflow of ${fmtAED(cf)}. New JMPs must not carry cashflow in the same year.`));
  });

  // ── 1.5 Webinar / virtual with budget > 0 ────────────────
  acts27.filter(isWebinar).forEach(a => {
    if (a.cashflow > 0) violations.push(V('1.5', a.market, a.activityName,
      `Webinar/virtual activity has cashflow ${fmtAED(a.cashflow)}. Must be zero-cost.`));
  });

  // ── 1.6 Admin Miscellaneous ───────────────────────────────
  acts27.forEach(a => {
    if (/admin.misc|miscellaneous/i.test(a.activityName + ' ' + a.activityType)) {
      violations.push(V('1.6', a.market, a.activityName,
        'Admin Miscellaneous line must be removed. Use specific task codes.'));
    }
  });

  // ── 1.7 Existing/Locked JMP with cashflow = 0 ────────────
  acts27.filter(isExistingJMP).forEach(a => {
    if (a.cashflow === 0 && a.locked === 'Locked') {
      violations.push(V('1.7', a.market, a.activityName,
        'Locked Existing JMP has cashflow = 0. Contract value may be missing.'));
    }
  });

  // ── 2.2 JMP contract closes in Q3/Q4 ─────────────────────
  acts27.filter(isJMP).forEach(a => {
    if (a.endDate && a.endDate.getMonth() >= 6) {
      const qtr = a.endDate.getMonth() >= 9 ? 'Q4' : 'Q3';
      violations.push(V('2.2', a.market, a.activityName,
        `JMP end date is ${fmtDate(a.endDate)} (${qtr}). JMP contracts must close in Q1 or Q2.`));
    }
  });

  // ── 2.6 JMP missing targets ───────────────────────────────
  acts27.filter(isJMP).forEach(a => {
    if (!a.attendees && !a.revenue) {
      violations.push(V('2.6', a.market, a.activityName,
        'JMP has no attendee count and no revenue target. Both required.'));
    }
  });

  // ── 3.1 ActivityType = Others ─────────────────────────────
  acts27.filter(a => /^others$/i.test(a.activityType)).forEach(a => {
    violations.push(V('3.1', a.market, a.activityName,
      `Type is "Others". Must be reclassified to a valid specific type.`));
  });

  // ── 3.2 Duplicate activity names per market ───────────────
  const seen = {};
  acts27.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    if (seen[k]) {
      violations.push(V('3.2', a.market, a.activityName,
        `Duplicate activity name in ${a.market}. Each activity must have a unique name.`));
    }
    seen[k] = true;
  });

  // ── 3.3 Bundled training sessions ────────────────────────
  acts27.filter(isTraining).forEach(a => {
    if (/annual|multiple|series|throughout|q[1-4].*q[1-4]|sessions/i.test(a.activityName)) {
      violations.push(V('3.3', a.market, a.activityName,
        'Training appears to bundle multiple sessions. Each session must be a separate line.'));
    }
  });

  // ── 3.6 Training P1 / Webinar not P3 ─────────────────────
  acts27.filter(isTraining).forEach(a => {
    if (a.priority === 1) violations.push(V('3.6', a.market, a.activityName,
      `Training is Priority 1. Training activities must be Priority 2 or 3.`));
  });
  acts27.filter(isWebinar).forEach(a => {
    if (a.priority && a.priority !== 3) violations.push(V('3.6', a.market, a.activityName,
      `Webinar is Priority ${a.priority}. Webinars/virtual activities must be Priority 3.`));
  });

  // ── 3.8 Missing KPIs ─────────────────────────────────────
  acts27.forEach(a => {
    if (!a.revenue && !a.attendees && !isWebinar(a) && a.activityType !== 'Admin') {
      violations.push(V('3.8', a.market, a.activityName,
        'No revenue figure and no attendee/KPI target. All activities must have at least one KPI.'));
    }
  });

  // ── 4.1 Mega FAM < 50 participants ───────────────────────
  acts27.filter(isMegaFAM).forEach(a => {
    if (a.attendees < 50) violations.push(V('4.1', a.market, a.activityName,
      `Mega FAM targets ${a.attendees} participants. Minimum required is 50.`));
  });

  // ── 4.3 FAM outside Ramadan / Early Summer ───────────────
  acts27.filter(isFAM).filter(a => !isMegaFAM(a)).forEach(a => {
    if (a.startDate) {
      const mo = a.startDate.getMonth();
      if (mo < 1 || mo > 5) {
        violations.push(V('4.3', a.market, a.activityName,
          `FAM trip starts ${fmtDate(a.startDate)} — outside Ramadan/Early Summer window (Feb–Jun).`));
      }
    }
  });

  // ── 5.1 < 2 zero-budget Ramadan activities per market ────
  const markets27 = [...new Set(acts27.map(a => a.market).filter(Boolean))];
  markets27.forEach(mkt => {
    const mActs = acts27.filter(a => a.market === mkt);
    const ramZero = mActs.filter(a => {
      const inR = inRamadan27(a.startDate) || inRamadan27(a.endDate);
      return inR && a.cashflow === 0;
    });
    if (ramZero.length < 2) {
      violations.push(V('5.1', mkt, 'Ramadan Planning',
        `Only ${ramZero.length} zero-budget Ramadan activit${ramZero.length===1?'y':'ies'} found. Minimum 2 required (webinars/virtual preferred).`));
    }
  });

  // ── 6.1 > 1 sales mission per market ─────────────────────
  markets27.forEach(mkt => {
    const missions = acts27.filter(a => a.market === mkt && isMission(a));
    if (missions.length > 1) violations.push(V('6.1', mkt,
      `${missions.length} missions`,
      `${missions.length} sales mission entries found. Only 1 mission permitted per market per year.`));
  });

  // ── 6.3 Exhibition with no revenue KPI ───────────────────
  acts27.filter(isExhibition).forEach(a => {
    if (!a.revenue) violations.push(V('6.3', a.market, a.activityName,
      'Exhibition has no revenue KPI. Participation must be justified by expected returns.'));
  });

  // ── 8.4 New high-value activity with no 2026 equivalent ──
  acts27.forEach(a => {
    const k = `${a.market}||${a.activityName.toLowerCase().trim()}`;
    if (!map26[k] && a.cashflow > THRESH.NEW_ACT_MIN_CF) {
      violations.push(V('8.4', a.market, a.activityName,
        `New activity with ${fmtAED(a.cashflow)} cashflow has no 2026 equivalent. Ensure targets are based on prior-year data or a clear rationale is documented.`));
    }
  });

  return violations;
}

// ── Summary ───────────────────────────────────────────────
function summarise(violations) {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const unjustified = violations.filter(v => !v.justified);
  unjustified.forEach(v => { counts[v.severity] = (counts[v.severity]||0)+1; });
  const byMarket = {};
  unjustified.forEach(v => { byMarket[v.market] = (byMarket[v.market]||0)+1; });
  const topMarkets = Object.entries(byMarket)
    .sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([market,count]) => ({ market, count }));
  return { counts, topMarkets, total: unjustified.length };
}

// ── Year-on-year comparison ───────────────────────────────
function compareYears(baseline26, review27) {
  const acts26 = baseline26.activities || [];
  const acts27 = review27.activities   || [];

  const map26 = {};
  acts26.forEach(a => { map26[`${a.market}||${a.activityName.toLowerCase().trim()}`] = a; });
  const map27 = {};
  acts27.forEach(a => { map27[`${a.market}||${a.activityName.toLowerCase().trim()}`] = a; });

  const added   = acts27.filter(a => !map26[`${a.market}||${a.activityName.toLowerCase().trim()}`]);
  const removed = acts26.filter(a => !map27[`${a.market}||${a.activityName.toLowerCase().trim()}`]);
  const changed = [];

  Object.entries(map27).forEach(([k, a27]) => {
    const a26 = map26[k];
    if (!a26) return;
    const changes = [];
    if (Math.abs(a27.cashflow - a26.cashflow) > 1000)
      changes.push({ field:'Cashflow', from: a26.cashflow, to: a27.cashflow });
    if (a27.priority !== a26.priority && a27.priority && a26.priority)
      changes.push({ field:'Priority', from: a26.priority, to: a27.priority });
    if (a27.activityType !== a26.activityType)
      changes.push({ field:'Type', from: a26.activityType, to: a27.activityType });
    if (a27.locked !== a26.locked)
      changes.push({ field:'Lock', from: a26.locked, to: a27.locked });
    if (changes.length) changed.push({ activity: a27, changes });
  });

  return { added, removed, changed };
}

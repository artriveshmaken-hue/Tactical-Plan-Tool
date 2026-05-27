/* ═══════════════════════════════════════════════════════════
   RULES.JS — Automated rule engine
   Implements all rules from Tactical Plan Review Rules doc
═══════════════════════════════════════════════════════════ */

const RULE_META = {
  '1.1': { name: 'Budget increased year-on-year',            severity: 'HIGH'   },
  '1.2': { name: 'Q3/Q4 cashflow disproportionate',          severity: 'HIGH'   },
  '1.3': { name: 'Payment milestone after June',             severity: 'MEDIUM' },
  '1.4': { name: 'New JMP with in-year cashflow',            severity: 'HIGH'   },
  '1.5': { name: 'Virtual activity with non-zero budget',    severity: 'MEDIUM' },
  '1.6': { name: 'Admin Miscellaneous budget line present',  severity: 'LOW'    },
  '1.7': { name: 'Active JMP with cashflow = 0',             severity: 'HIGH'   },
  '2.2': { name: 'Contract closure in Q3 or Q4',             severity: 'HIGH'   },
  '2.6': { name: 'JMP missing hotel guest / attendee target',severity: 'MEDIUM' },
  '3.1': { name: 'Activity Type = "Others"',                 severity: 'HIGH'   },
  '3.2': { name: 'Duplicate activity name',                  severity: 'MEDIUM' },
  '3.3': { name: 'Multiple training sessions bundled',       severity: 'MEDIUM' },
  '3.6': { name: 'Training at Priority 1 / virtual not P3', severity: 'MEDIUM' },
  '3.8': { name: 'Activity missing KPIs',                    severity: 'HIGH'   },
  '4.1': { name: 'Mega FAM Trip target < 50 participants',   severity: 'MEDIUM' },
  '4.3': { name: 'FAM trip outside Ramadan / Early Summer',  severity: 'LOW'    },
  '5.1': { name: 'Market has < 2 zero-budget Ramadan acts',  severity: 'HIGH'   },
  '6.1': { name: 'More than 1 sales mission per market',     severity: 'MEDIUM' },
  '6.3': { name: 'Exhibition with no revenue KPI',           severity: 'MEDIUM' },
  '8.4': { name: 'Targets not based on prior-year data',     severity: 'MEDIUM' },
};

// Ramadan 2026 window (Mar–Apr)
const RAM_START = new Date(2026, 2, 1);
const RAM_END   = new Date(2026, 3, 30);

// ── Activity type helpers ────────────────────────────────
function isVirtual(name, type) {
  const t = `${name||''} ${type||''}`.toLowerCase();
  return /webinar|virtual|online|e-?learning/.test(t);
}
function isSalesMission(name, type) {
  return `${name||''} ${type||''}`.toLowerCase().includes('mission');
}
function isFAM(name, type) {
  return /\bfam\b|familiari[sz]ation/.test(`${name||''} ${type||''}`.toLowerCase());
}
function isMegaFAM(name) {
  return /mega.?fam/i.test(name || '');
}
function isTraining(name, type) {
  return /training|workshop/.test(`${name||''} ${type||''}`.toLowerCase());
}
function isExhibition(name, type) {
  return /exhibition|exhibit|\bitb\b|\bwtm\b|\batm\b/.test(`${name||''} ${type||''}`.toLowerCase());
}
function isJMP(name, type, status) {
  return /jmp|joint marketing/.test(`${name||''} ${type||''}`.toLowerCase()) || !!(status && status.trim());
}
function inRamadan(d) {
  return d && d >= RAM_START && d <= RAM_END;
}

// ── Violation factory ────────────────────────────────────
function V(ruleId, market, item, detail) {
  const meta = RULE_META[ruleId] || { name: ruleId, severity: 'LOW' };
  return {
    ruleId, ruleName: meta.name, severity: meta.severity,
    market: market || '—', item: item || '—', detail,
    justified: false, justificationNote: '',
  };
}

// ── Monthly cashflow helpers ─────────────────────────────
function sumMonthly(monthly) {
  return MONTHS.reduce((s, m) => s + (monthly[m] || 0), 0);
}
function q1(m) { return (m.Jan||0)+(m.Feb||0)+(m.Mar||0); }
function q2(m) { return (m.Apr||0)+(m.May||0)+(m.Jun||0); }
function q3(m) { return (m.Jul||0)+(m.Aug||0)+(m.Sep||0); }
function q4(m) { return (m.Oct||0)+(m.Nov||0)+(m.Dec||0); }

// ── MAIN RULE RUNNER ────────────────────────────────────
function runRules(baselineData, reviewData) {
  const violations = [];
  const acts    = (reviewData.tacticalDetails || []);
  const budget  = (reviewData.budget          || []);
  const tactical= (reviewData.tactical        || []);
  const jmpTgts = (reviewData.jmpTargets      || []);

  // ── 1.1 Budget increased vs baseline ────────────────────
  if (baselineData && baselineData.budget && reviewData.budget) {
    const base = {};
    baselineData.budget.forEach(r => {
      const k = `${r.projectName}|${r.taskName}`;
      base[k] = (base[k] || 0) + (r.budget2026 || r.baseline || 0);
    });
    const rev = {};
    reviewData.budget.forEach(r => {
      const k = `${r.projectName}|${r.taskName}`;
      rev[k] = (rev[k] || 0) + (r.budget2026 || r.baseline || 0);
    });
    Object.entries(rev).forEach(([k, val]) => {
      const bv = base[k] || 0;
      if (val > bv && bv > 0) {
        const [mkt, task] = k.split('|');
        violations.push(V('1.1', mkt, task,
          `Budget rose from ${fmtAED(bv)} to ${fmtAED(val)} (+${fmtAED(val-bv)})`));
      }
    });
  }

  // ── 1.2 Q3/Q4 disproportionate per market ───────────────
  const cfByMkt = {};
  budget.forEach(r => {
    const m = r.projectName || 'Unknown';
    if (!cfByMkt[m]) cfByMkt[m] = { Jan:0,Feb:0,Mar:0,Apr:0,May:0,Jun:0,Jul:0,Aug:0,Sep:0,Oct:0,Nov:0,Dec:0 };
    MONTHS.forEach(mo => { cfByMkt[m][mo] += r.monthly[mo] || 0; });
  });
  Object.entries(cfByMkt).forEach(([mkt, mo]) => {
    const H1 = q1(mo)+q2(mo), H2 = q3(mo)+q4(mo), tot = H1+H2;
    if (tot > 0 && H2 > H1) {
      const pct = (H2/tot*100).toFixed(1);
      violations.push(V('1.2', mkt, 'Cashflow Distribution',
        `Q3+Q4 = ${pct}% of annual spend (H1 = ${(H1/tot*100).toFixed(1)}%). Majority must fall in Q1/Q2.`));
    }
    // 1.3 — payment after June
    const late = (mo.Jul||0)+(mo.Aug||0)+(mo.Sep||0)+(mo.Oct||0)+(mo.Nov||0)+(mo.Dec||0);
    if (late > 0 && tot > 0 && late/tot > 0.1) {
      violations.push(V('1.3', mkt, 'Late Payment',
        `Payments scheduled Jul–Dec = ${fmtAED(late)} (${(late/tot*100).toFixed(1)}%). Last permitted month is June.`));
    }
  });

  // ── 1.4 New JMP with in-year cashflow ───────────────────
  acts.filter(a => /new/i.test(a.jmpStatus || '')).forEach(a => {
    const cf = sumMonthly(a.monthly);
    if (cf > 0) violations.push(V('1.4', a.market, a.activityName,
      `New JMP carries in-year cashflow of ${fmtAED(cf)}. Must be zero.`));
  });

  // ── 1.5 Virtual activity non-zero budget ────────────────
  acts.filter(a => isVirtual(a.activityName, a.activityType) && a.budget > 0).forEach(a => {
    violations.push(V('1.5', a.market, a.activityName,
      `Virtual/webinar activity has budget ${fmtAED(a.budget)}. Must be zero.`));
  });

  // ── 1.6 Admin Miscellaneous ──────────────────────────────
  [...acts, ...tactical].forEach(r => {
    const nm = (r.activityName || r.taskName || r.financeTask || '').toLowerCase();
    if (nm.includes('admin misc') || nm.includes('miscellaneous')) {
      violations.push(V('1.6', r.market || r.projectName, r.activityName || r.taskName,
        'Admin Miscellaneous line must be removed. Replace with specific task codes.'));
    }
  });

  // ── 1.7 Active JMP cashflow = 0 ─────────────────────────
  acts.filter(a => isJMP(a.activityName, a.activityType, a.jmpStatus)).forEach(a => {
    const cf = sumMonthly(a.monthly);
    const st = (a.jmpStatus || '').toLowerCase();
    if (cf === 0 && a.budget === 0 && (st.includes('existing') || st.includes('signed'))) {
      violations.push(V('1.7', a.market, a.activityName,
        'Active/Signed JMP has cashflow = 0. Investigate — may be missing contract value.'));
    }
  });

  // ── 2.2 Contract closure in Q3/Q4 ───────────────────────
  acts.filter(a => isJMP(a.activityName, a.activityType, a.jmpStatus)).forEach(a => {
    if (a.endDate && a.endDate.getMonth() >= 6) {
      violations.push(V('2.2', a.market, a.activityName,
        `JMP contract ends ${fmtDate(a.endDate)} (${a.endDate.getMonth()>=9?'Q4':'Q3'}). Must close in Q1 or Q2.`));
    }
  });

  // ── 2.6 JMP missing targets ─────────────────────────────
  acts.filter(a => isJMP(a.activityName, a.activityType, a.jmpStatus)).forEach(a => {
    if (!a.attendees && !a.revenue) {
      violations.push(V('2.6', a.market, a.activityName,
        'JMP is missing hotel guest / attendee targets. All JMPs must have numeric targets.'));
    }
  });

  // ── 3.1 Activity Type = Others ──────────────────────────
  acts.filter(a => /^others?$/i.test((a.activityType || '').trim())).forEach(a => {
    violations.push(V('3.1', a.market, a.activityName,
      `Activity type is "${a.activityType}". Must be reclassified to a specific valid type.`));
  });

  // ── 3.2 Duplicate activity names per market ─────────────
  const actsByMkt = {};
  acts.forEach(a => {
    const m = a.market || 'Unknown';
    if (!actsByMkt[m]) actsByMkt[m] = {};
    const key = (a.activityName || '').toLowerCase().trim();
    if (key) {
      if (actsByMkt[m][key]) {
        violations.push(V('3.2', m, a.activityName,
          `Duplicate activity name found in ${m}. Merge or remove one entry.`));
      }
      actsByMkt[m][key] = true;
    }
  });

  // ── 3.3 Multiple training sessions bundled ───────────────
  acts.filter(a => isTraining(a.activityName, a.activityType)).forEach(a => {
    const nm = (a.activityName || '').toLowerCase();
    if (/annual|multiple|series|q1.*q2|q2.*q3|sessions|throughout/.test(nm)) {
      violations.push(V('3.3', a.market, a.activityName,
        'Training entry appears to bundle multiple sessions. Each session must be a separate activity.'));
    }
  });

  // ── 3.6 Training Priority 1 / virtual not Priority 3 ────
  acts.filter(a => isTraining(a.activityName, a.activityType) && a.priority === 1).forEach(a => {
    violations.push(V('3.6', a.market, a.activityName,
      `Training activity is Priority 1. Training must not be Priority 1.`));
  });
  acts.filter(a => isVirtual(a.activityName, a.activityType) && a.priority && a.priority !== 3).forEach(a => {
    violations.push(V('3.6', a.market, a.activityName,
      `Virtual activity is Priority ${a.priority}. Virtual activities must be Priority 3.`));
  });

  // ── 3.8 Activity missing KPIs ───────────────────────────
  acts.forEach(a => {
    if (!a.revenue && !a.attendees) {
      violations.push(V('3.8', a.market, a.activityName,
        'Activity has no revenue figure and no attendee/KPI target.'));
    }
  });

  // ── 4.1 Mega FAM Trip < 50 participants ─────────────────
  acts.filter(a => isMegaFAM(a.activityName)).forEach(a => {
    if (a.attendees < 50) {
      violations.push(V('4.1', a.market, a.activityName,
        `Mega FAM Trip targets ${a.attendees || 0} participants. Minimum is 50.`));
    }
  });

  // ── 4.3 FAM trip outside Ramadan / Early Summer ─────────
  acts.filter(a => isFAM(a.activityName, a.activityType)).forEach(a => {
    if (a.startDate) {
      const mo = a.startDate.getMonth(); // 0-based
      if (mo < 2 || mo > 5) { // outside Mar(2)–Jun(5)
        violations.push(V('4.3', a.market, a.activityName,
          `FAM trip starts ${fmtDate(a.startDate)} — outside Ramadan/Early Summer window (Mar–Jun).`));
      }
    }
  });

  // ── 5.1 Market < 2 zero-budget Ramadan activities ────────
  const markets = [...new Set(acts.map(a => a.market).filter(Boolean))];
  markets.forEach(mkt => {
    const mActs = acts.filter(a => a.market === mkt);
    const ramZero = mActs.filter(a => {
      const inRam = inRamadan(a.startDate) || inRamadan(a.endDate);
      return inRam && a.budget === 0;
    });
    if (ramZero.length < 2) {
      violations.push(V('5.1', mkt, 'Ramadan Planning',
        `Only ${ramZero.length} zero-budget Ramadan activity found (minimum 2 required). Webinars/virtual sessions preferred.`));
    }
  });

  // ── 6.1 More than 1 sales mission ───────────────────────
  markets.forEach(mkt => {
    const missions = acts.filter(a => a.market === mkt && isSalesMission(a.activityName, a.activityType));
    if (missions.length > 1) {
      violations.push(V('6.1', mkt, `${missions.length} Sales Missions`,
        `Market has ${missions.length} sales missions. Only 1 permitted per country per year.`));
    }
  });

  // ── 6.3 Exhibition with no revenue KPI ──────────────────
  acts.filter(a => isExhibition(a.activityName, a.activityType)).forEach(a => {
    if (!a.revenue) {
      violations.push(V('6.3', a.market, a.activityName,
        'Exhibition participation has no revenue KPI. Must be justified by expected returns.'));
    }
  });

  // ── 8.4 JMP targets with no prior-year reference ─────────
  jmpTgts.forEach(j => {
    if (j.io2026 > 0 && !j.target2025 && !j.target2024) {
      violations.push(V('8.4', j.market, 'JMP Target',
        `${j.market} has a 2026 IO target of ${fmtNum(j.io2026)} but no prior-year reference data.`));
    }
    // Flag markets with 0 target but showing budget
    if (j.io2026 === 0) {
      const hasBudget = budget.some(b => b.projectName === j.market && (b.budget2026 || b.baseline) > 0);
      if (hasBudget) {
        violations.push(V('8.4', j.market, 'Zero Target / Active Budget',
          `Market shows no 2026 visitor target (0) but has active budget. JMP assessment may be missing.`));
      }
    }
  });

  return violations;
}

// ── Summarise violations ─────────────────────────────────
function summarise(violations) {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  violations.forEach(v => { if (!v.justified) counts[v.severity] = (counts[v.severity] || 0) + 1; });
  const byMarket = {};
  violations.filter(v => !v.justified).forEach(v => {
    byMarket[v.market] = (byMarket[v.market] || 0) + 1;
  });
  const topMarkets = Object.entries(byMarket)
    .sort((a,b) => b[1]-a[1]).slice(0,5)
    .map(([m,c]) => ({ market: m, count: c }));
  return { counts, topMarkets, total: violations.filter(v=>!v.justified).length };
}

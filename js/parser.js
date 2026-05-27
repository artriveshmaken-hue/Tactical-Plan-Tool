/* ═══════════════════════════════════════════════════════════
   PARSER.JS — Excel parsing for all four sheet types
   Handles: Tactical | Budget | JMP Targets per Market | Tactical Details
═══════════════════════════════════════════════════════════ */

const SHEET = {
  TACTICAL:   'Tactical',
  BUDGET:     'Budget',
  JMP:        'JMP Targets per Market',
  DETAILS:    'Tactical Details'
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Market name normalisation ────────────────────────────
const MARKET_MAP = {
  'egypt-overseas office':                  'Egypt',
  'overseas office - egypt':                'Egypt',
  'overseas office - france':               'France',
  'france-overseas office':                 'France',
  'overseas office - united kingdom':       'United Kingdom',
  'uk-overseas office':                     'United Kingdom',
  'united kingdom-overseas office':         'United Kingdom',
  'oveseas office - russia':                'Russia',
  'overseas office - russia':               'Russia',
  'russia-overseas office':                 'Russia',
  'korea-overseas office':                  'South Korea',
  'overseas office - south korea':          'South Korea',
  'south korea-overseas office':            'South Korea',
  'ttmd global partnerships':               'Global Partnerships',
  'global partnerships':                    'Global Partnerships',
  'exhibition - atm, dubai':                'Exhibition: ATM',
  'exhibition atm dubai':                   'Exhibition: ATM',
  'exhibition - itb berlin':                'Exhibition: ITB Berlin',
  'exhibition itb berlin':                  'Exhibition: ITB Berlin',
  'exhibiton - wtm, london':                'Exhibition: WTM London',
  'exhibition - wtm, london':               'Exhibition: WTM London',
  'exhibition wtm london':                  'Exhibition: WTM London',
};

function normMarket(raw) {
  if (!raw) return '';
  const key = raw.toString().trim().toLowerCase();
  return MARKET_MAP[key] || raw.toString().trim();
}

// ── Task category mapping ────────────────────────────────
const TASK_MAP = {
  'trade promotion':         { display: 'Trade Promotion',       category: 'Activity'    },
  'trade partners':          { display: 'Trade Partners (JMP)',  category: 'JMP'         },
  'gsa retainer':            { display: 'GSA Retainer Fee',      category: 'Admin'       },
  'mission & travel':        { display: 'Mission & Travel',      category: 'Travel'      },
  'mission and travel':      { display: 'Mission & Travel',      category: 'Travel'      },
  'admin expenses':          { display: 'Admin Expenses',        category: 'Admin'       },
  'design & build':          { display: 'Design & Build',        category: 'Exhibition'  },
  'venue&room rent':         { display: 'Venue & Room Rent',     category: 'Exhibition'  },
  'venue & room rent':       { display: 'Venue & Room Rent',     category: 'Exhibition'  },
  'hospitality':             { display: 'Hospitality',           category: 'Exhibition'  },
  'prmgmnt e-e rtnr':        { display: 'PR Management Retainer',category: 'Admin'       },
  'content partner':         { display: 'Content Partnership',   category: 'Marketing'   },
  'managementadvice':        { display: 'Management Advisory',   category: 'Admin'       },
  'freelancers':             { display: 'Freelancers',           category: 'Admin'       },
};

function getTaskInfo(ft) {
  if (!ft) return { display: '', category: 'Other', lockStatus: 'Not Locked' };
  const raw = ft.toString().trim();
  const lockStatus = raw.endsWith('-L') ? 'Locked' : 'Not Locked';
  const base = raw.replace(/-[LN]$/i, '').trim().toLowerCase();
  const info = TASK_MAP[base] || { display: raw.replace(/-[LN]$/i, '').trim(), category: 'Other' };
  return { ...info, lockStatus };
}

// ── Numeric parser ───────────────────────────────────────
function pNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(v.toString().replace(/[,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ── Date parser ──────────────────────────────────────────
function pDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'number') {
    // Excel serial number
    const d = new Date(Math.round((v - 25569) * 864e5));
    return isNaN(d) ? null : d;
  }
  const d = new Date(v.toString());
  return isNaN(d) ? null : d;
}

// ── Helpers ──────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function fmtNum(n) {
  if (!n) return '0';
  return Math.round(n).toLocaleString('en-AE');
}

function fmtAED(n) { return 'AED ' + fmtNum(n); }

// ── Parse TACTICAL sheet ─────────────────────────────────
function parseTactical(wb) {
  const ws = wb.Sheets[SHEET.TACTICAL];
  if (!ws) { console.warn('Sheet not found:', SHEET.TACTICAL); return []; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] && !r[1]) continue;
    const ft = r[2] ? r[2].toString().trim() : '';
    const info = getTaskInfo(ft);
    result.push({
      projectNo:    r[0] ? String(r[0]).trim() : '',
      projectName:  normMarket(r[1]),
      financeTask:  ft,
      taskName:     r[3] ? String(r[3]).trim() : info.display,
      lockStatus:   r[4] ? String(r[4]).trim() : info.lockStatus,
      cashflow:     pNum(r[5]),
      taskDisplay:  info.display,
      taskCategory: info.category,
    });
  }
  return result;
}

// ── Parse BUDGET sheet ───────────────────────────────────
function parseBudget(wb) {
  const ws = wb.Sheets[SHEET.BUDGET];
  if (!ws) { console.warn('Sheet not found:', SHEET.BUDGET); return []; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] && !r[1]) continue;
    const monthly = {};
    MONTHS.forEach((m, idx) => { monthly[m] = pNum(r[10 + idx]); }); // cols K=10..V=21
    const ft = r[2] ? String(r[2]).trim() : '';
    result.push({
      projectName:  normMarket(r[0]),
      projectNo:    r[1] ? String(r[1]).trim() : '',
      financeTask:  ft,
      taskName:     r[3] ? String(r[3]).trim() : '',
      glAccount:    r[4] ? String(r[4]).trim() : '',
      baseline:     pNum(r[5]),
      version:      r[6],
      procurement:  pNum(r[7]),
      committed:    pNum(r[8]),
      planned:      pNum(r[9]),
      monthly,
      prior2025:    pNum(r[22]),  // col W
      budget2026:   pNum(r[23]),  // col X
      lockStatus:   getTaskInfo(ft).lockStatus,
    });
  }
  return result;
}

// ── Parse JMP TARGETS sheet ──────────────────────────────
function parseJMP(wb) {
  const ws = wb.Sheets[SHEET.JMP];
  if (!ws) { console.warn('Sheet not found:', SHEET.JMP); return []; }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue;
    result.push({
      market:     normMarket(r[1]),
      io2026:     pNum(r[2]),
      newJMPs:    pNum(r[3]),
      yoyGrowth:  pNum(r[4]),
      target2025: pNum(r[5]),
      target2024: pNum(r[6]),
    });
  }
  return result;
}

// ── Parse TACTICAL DETAILS sheet ────────────────────────
function parseDetails(wb) {
  const ws = wb.Sheets[SHEET.DETAILS];
  if (!ws) { console.warn('Sheet not found:', SHEET.DETAILS); return []; }

  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  if (!rawRows.length) return [];

  const keys = Object.keys(rawRows[0]);

  function fk(...parts) {
    return keys.find(k => parts.some(p => k.toLowerCase().replace(/[\s_-]/g,'').includes(p.toLowerCase().replace(/[\s_-]/g,''))));
  }

  const cName  = fk('ActivityName','activityname','name');
  const cType  = fk('ActivityType','activitytype','type');
  const cID    = fk('ActivityID','activityid','id');
  const cPrio  = fk('Priority','priority');
  const cMkt   = fk('Market','market');
  const cStart = fk('ActivityStart','StartDate','start');
  const cEnd   = fk('ActivityEnd','EndDate','end');
  const cBudget= fk('Budget','budget');
  const cRev   = fk('Revenue','revenue');
  const cAtt   = fk('Attendees','NumberOfAttendees','attendees','participants');
  const cJMP   = fk('JMPStatus','JMP Status','jmpstatus');
  const cOwner = fk('ActivityOwner','Owner','owner');
  const cDesc  = fk('ActivityDescription','Description','description');

  return rawRows.map(r => {
    const monthly = {};
    MONTHS.forEach(m => {
      const mk = fk(m);
      monthly[m] = mk ? pNum(r[mk]) : 0;
    });
    return {
      activityName: cName  ? String(r[cName]  || '').trim() : '',
      activityType: cType  ? String(r[cType]  || '').trim() : '',
      activityID:   cID    ? String(r[cID]    || '').trim() : '',
      priority:     cPrio  ? pNum(r[cPrio])  : 0,
      market:       cMkt   ? normMarket(r[cMkt] || '') : '',
      startDate:    cStart ? pDate(r[cStart]) : null,
      endDate:      cEnd   ? pDate(r[cEnd])   : null,
      budget:       cBudget? pNum(r[cBudget]) : 0,
      revenue:      cRev   ? pNum(r[cRev])    : 0,
      attendees:    cAtt   ? pNum(r[cAtt])    : 0,
      jmpStatus:    cJMP   ? String(r[cJMP]   || '').trim() : '',
      owner:        cOwner ? String(r[cOwner] || '').trim() : '',
      description:  cDesc  ? String(r[cDesc]  || '').trim() : '',
      monthly,
    };
  }).filter(r => r.activityName || r.market);
}

// ── Master parse entry point ─────────────────────────────
function parseWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: false });
        console.log('Sheets in workbook:', wb.SheetNames);
        resolve({
          tactical:        parseTactical(wb),
          budget:          parseBudget(wb),
          jmpTargets:      parseJMP(wb),
          tacticalDetails: parseDetails(wb),
          sheetNames:      wb.SheetNames,
        });
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

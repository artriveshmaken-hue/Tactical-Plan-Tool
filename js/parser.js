/* parser.js — Reads Tactical Details tab from both files */

const SHEET_NAME = 'Tactical Details';
const MONTH_COLS = ['Jan','Feb','Mar','Apr','May','Jun','July','Aug','Sep','Oct','Nov','Dec'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TYPE_NORM = {
  'existing jmp':'Existing JMP','existing jmp ':'Existing JMP',
  'exsisting jmp':'Existing JMP','existing mp':'Existing JMP',
  'new jmp':'New JMP','new jmp ':'New JMP',
  'co-host industry event':'Co-Host Industry Event',
  'co-host industry events':'Co-Host Industry Event',
  'co-host industry event ':'Co-Host Industry Event',
  'trade promotion':'Trade Promotion','trade promotion ':'Trade Promotion',
  'trade promotions':'Trade Promotion',
  'mission & travel':'Mission & Travel','misison':'Mission & Travel',
  'fam trip':'FAM','gcc fam-trip':'FAM','gcc fam-trip':'FAM',
  'fam':'FAM','mega fam':'Mega FAM',
  'events / workshops':'Events / WorkShops',
  'events / workshops  ':'Events / WorkShops',
  'events / workshop':'Events / WorkShops',
  'webinars':'Webinars','webinar':'Webinars',
  'gsa retainer fee':'GSA Retainer Fee',
  'manpower':'Manpower','manpower ':'Manpower',
  'admin':'Admin','admin ':'Admin',
  'roadshow':'Roadshow','roadshow ':'Roadshow',
  'sales calls':'Sales Calls',
  'others':'Others','showcase':'Showcase',
  'hospitality':'Hospitality','space rent':'Space Rent',
  'stand build':'Stand Build','content partnership':'Content Partnership',
  'destination sponsorship':'Destination Sponsorship',
  'travel trade partnership':'Travel Trade Partnership',
  'partners appreciation event':'Partners Appreciation Event',
  'experience abu dhabi workshop':'Experience Abu Dhabi Workshop',
  'corporate policies':'Corporate Policies',
  'consultant':'Consultant','b2b pr fam trip':'B2B PR FAM Trip',
  'exhibitions':'Exhibitions','exhibition':'Exhibitions',
  'stakeholder engagement':'Stakeholder Engagement',
  'mall activation':'Mall Activation','marketplace':'Marketplace',
  'b2c conversion':'B2C Conversion','newsletter':'Newsletter',
  'cruise jmp':'Cruise JMP','b2b comms':'B2B Comms',
  'expenses':'Expenses','projects':'Projects',
};

function normType(raw) {
  if (!raw) return 'Others';
  return TYPE_NORM[raw.toString().trim().toLowerCase()] || raw.toString().trim();
}

function pNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(v.toString().replace(/[,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function pDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 864e5));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v.toString());
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function fmtNum(n) {
  if (!n && n !== 0) return '0';
  return Math.round(n).toLocaleString('en-AE');
}
function fmtAED(n) { return 'AED ' + fmtNum(n); }
function fmtShort(n) {
  if (!n || n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (a >= 1e3) return (n/1e3).toFixed(0)+'K';
  return Math.round(n).toString();
}

function parseTacticalDetails(wb) {
  let ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    const match = Object.keys(wb.Sheets).find(k =>
      k.toLowerCase().replace(/\s+/g,'') === 'tacticaldetails'
    );
    if (match) ws = wb.Sheets[match];
  }
  if (!ws) { console.warn('Tactical Details not found. Sheets:', Object.keys(wb.Sheets)); return []; }

  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  if (!rawRows.length) return [];

  const keys = Object.keys(rawRows[0]);
  function fk(...variants) {
    return keys.find(k =>
      variants.some(v => k.toLowerCase().replace(/[\s_-]/g,'') === v.toLowerCase().replace(/[\s_-]/g,''))
    ) || null;
  }

  const C = {
    market:      fk('Market','market'),
    id:          fk('Id','ID','id'),
    type:        fk('ActivityType','activitytype','type'),
    name:        fk('ActivityName','activityname','name'),
    start:       fk('ActivityStart','activitystart','startdate','start'),
    end:         fk('ActivityEnd','activityend','enddate','end'),
    destination: fk('Destination','destination'),
    internalProj:fk('Internal Project','InternalProject','internalproject'),
    projectNo:   fk('ProjectNo','projectno'),
    projectName: fk('ProjectName','projectname'),
    task:        fk('Task','task'),
    demandPlan:  fk('DemandPlan','demandplan'),
    locked:      fk('Locked','locked'),
    cashflow:    fk('Cashflow','cashflow'),
    commitment:  fk('Commitment','commitment'),
    priority:    fk('Priority','priority'),
    owner:       fk('ActivityOwner','activityowner','owner'),
    newProjName: fk('NewProjectName','newprojectname'),
    attendees:   fk('Attendees','attendees'),
    stakeholders:fk('Stakeholders','stakeholders'),
    revenue:     fk('Revenue','revenue'),
    costPerAgent:fk('CostPerAgent','costperagent'),
    hotelGuests: fk('HotelGuests','hotelguests','hotel guests','hotelgueststarget'),
    description: fk('Description','description'),
    comments:    fk('Comments','comments'),
  };

  const monthKeys = MONTH_COLS.map(m => fk(m));

  return rawRows.map(r => {
    if (!r[C.market] && !r[C.name]) return null;
    const mkt = C.market ? String(r[C.market] || '').trim() : '';
    if (!mkt || /^(total|grand total|subtotal)$/i.test(mkt)) return null;

    const monthly = {};
    MONTH_LABELS.forEach((label, i) => {
      monthly[label] = monthKeys[i] ? pNum(r[monthKeys[i]]) : 0;
    });

    const lockedRaw = C.locked ? String(r[C.locked] || '').trim() : '';
    const isLocked = /^locked$/i.test(lockedRaw) || /^true$/i.test(lockedRaw) || /^1$/.test(lockedRaw);

    return {
      market:       mkt,
      id:           C.id          ? String(r[C.id]          || '').trim() : '',
      activityType: normType(C.type ? r[C.type] : ''),
      activityName: C.name        ? String(r[C.name]        || '').trim() : '',
      startDate:    C.start       ? pDate(r[C.start])       : null,
      endDate:      C.end         ? pDate(r[C.end])         : null,
      destination:  C.destination ? String(r[C.destination] || '').trim() : '',
      projectNo:    C.projectNo   ? String(r[C.projectNo]   || '').trim() : '',
      projectName:  C.projectName ? String(r[C.projectName] || '').trim() : '',
      task:         C.task        ? String(r[C.task]        || '').trim() : '',
      locked:       isLocked ? 'Locked' : 'Not Locked',
      cashflow:     C.cashflow    ? pNum(r[C.cashflow])     : 0,
      priority:     C.priority    ? pNum(r[C.priority])     : 0,
      owner:        C.owner       ? String(r[C.owner]       || '').trim() : '',
      attendees:    C.attendees   ? pNum(r[C.attendees])    : 0,
      stakeholders: C.stakeholders? pNum(r[C.stakeholders]) : 0,
      revenue:      C.revenue     ? pNum(r[C.revenue])      : 0,
      costPerAgent: C.costPerAgent? pNum(r[C.costPerAgent]) : 0,
      hotelGuests:  C.hotelGuests ? pNum(r[C.hotelGuests])  : 0,
      description:  C.description ? String(r[C.description] || '').trim() : '',
      monthly,
    };
  }).filter(Boolean).filter(r => r.activityName || r.cashflow > 0);
}

function parseWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array', cellDates:false });
        console.log('Sheets:', wb.SheetNames);
        const activities = parseTacticalDetails(wb);
        console.log('Activities parsed:', activities.length);
        resolve({ activities, sheetNames: wb.SheetNames });
      } catch(err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

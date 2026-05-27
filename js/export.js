/* ═══════════════════════════════════════════════════════════
   EXPORT.JS — CSV and Excel export with justification notes
═══════════════════════════════════════════════════════════ */

function exportViolationsToExcel(violations, filename) {
  filename = filename || 'DCT_Tactical_Violations_' + yyyymmdd() + '.xlsx';

  const rows = violations.map((v, i) => ({
    '#':                   i + 1,
    'Rule ID':             v.ruleId,
    'Rule Name':           v.ruleName,
    'Severity':            v.severity,
    'Market':              v.market,
    'Activity / Item':     v.item,
    'Detail':              v.detail,
    'Justified':           v.justified ? 'Yes' : 'No',
    'Justification Note':  v.justificationNote || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 8 }, { wch: 38 }, { wch: 10 },
    { wch: 22 }, { wch: 35 }, { wch: 70 }, { wch: 10 }, { wch: 40 }
  ];

  // Header row styles (xlsx.full.min doesn't support cell styles without Pro)
  // We'll use conditional formatting markers instead via a notes sheet

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Violations');

  // Summary sheet
  const summary = buildSummarySheet(violations);
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');

  XLSX.writeFile(wb, filename);
}

function buildSummarySheet(violations) {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  violations.forEach(v => { counts[v.severity] = (counts[v.severity]||0) + 1; });

  const byMarket = {};
  violations.forEach(v => { byMarket[v.market] = (byMarket[v.market]||0) + 1; });
  const topMkts = Object.entries(byMarket).sort((a,b)=>b[1]-a[1]).slice(0,10);

  const byRule = {};
  violations.forEach(v => { byRule[v.ruleId] = (byRule[v.ruleId]||0) + 1; });

  const summaryRows = [
    ['DCT Tactical Plan — Violations Summary', ''],
    ['Generated:', new Date().toLocaleDateString('en-AE')],
    ['', ''],
    ['SEVERITY COUNTS', ''],
    ['HIGH',   counts.HIGH],
    ['MEDIUM', counts.MEDIUM],
    ['LOW',    counts.LOW],
    ['TOTAL',  violations.length],
    ['', ''],
    ['TOP MARKETS BY VIOLATIONS', ''],
    ...topMkts.map(([m,c]) => [m, c]),
    ['', ''],
    ['VIOLATIONS BY RULE', ''],
    ...Object.entries(byRule).sort((a,b)=>b[1]-a[1]).map(([r,c]) => {
      const meta = RULE_META[r];
      return [r + ' — ' + (meta ? meta.name : r), c];
    }),
  ];

  return XLSX.utils.aoa_to_sheet(summaryRows);
}

function exportViolationsToCSV(violations, filename) {
  filename = filename || 'DCT_Tactical_Violations_' + yyyymmdd() + '.csv';
  const headers = ['Rule ID','Rule Name','Severity','Market','Activity / Item','Detail','Justified','Justification Note'];
  const rows = violations.map(v => [
    v.ruleId, v.ruleName, v.severity, v.market, v.item,
    v.detail, v.justified ? 'Yes' : 'No', v.justificationNote || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(cell => {
    const s = String(cell || '').replace(/"/g,'""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  }).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function yyyymmdd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

/* ═══════════════════════════════════════════════════════════
   EXPORT.JS — Excel + CSV export with justification notes
═══════════════════════════════════════════════════════════ */

function yyyymmdd() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function exportViolationsToExcel(violations) {
  const rows = violations.map((v,i) => ({
    '#':                  i+1,
    'Rule ID':            v.ruleId,
    'Rule Name':          v.ruleName,
    'Severity':           v.severity,
    'Market':             v.market,
    'Activity / Item':    v.item,
    'Detail':             v.detail,
    'Justified':          v.justified ? 'Yes' : 'No',
    'Justification Note': v.justificationNote || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    {wch:4},{wch:8},{wch:40},{wch:10},
    {wch:22},{wch:36},{wch:70},{wch:10},{wch:45}
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Violations');

  // Summary sheet
  const counts = {HIGH:0,MEDIUM:0,LOW:0};
  violations.forEach(v => { counts[v.severity]=(counts[v.severity]||0)+1; });
  const byMkt = {};
  violations.forEach(v => { byMkt[v.market]=(byMkt[v.market]||0)+1; });

  const sumRows = [
    ['DCT Tactical Plan Review — Violations Summary',''],
    ['Generated:', new Date().toLocaleDateString('en-AE')],
    ['',''],
    ['HIGH Violations',   counts.HIGH],
    ['MEDIUM Violations', counts.MEDIUM],
    ['LOW Violations',    counts.LOW],
    ['TOTAL',             violations.length],
    ['',''],
    ['TOP MARKETS','COUNT'],
    ...Object.entries(byMkt).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([m,c])=>[m,c]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'Summary');
  XLSX.writeFile(wb, `DCT_Violations_2027_${yyyymmdd()}.xlsx`);
}

function exportViolationsToCSV(violations) {
  const headers = ['Rule ID','Rule Name','Severity','Market','Activity / Item','Detail','Justified','Note'];
  const rows = violations.map(v => [
    v.ruleId, v.ruleName, v.severity, v.market,
    v.item, v.detail,
    v.justified?'Yes':'No', v.justificationNote||''
  ]);
  const csv = [headers,...rows].map(r =>
    r.map(c => { const s=String(c||'').replace(/"/g,'""'); return (s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s}"`:s; }).join(',')
  ).join('\n');

  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`DCT_Violations_2027_${yyyymmdd()}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

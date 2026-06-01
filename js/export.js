/* ═══════════════════════════════════════════════════════
   EXPORT.JS — Excel + CSV with status and comment fields
═══════════════════════════════════════════════════════ */
function yyyymmdd(){const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;}

function exportViolationsToExcel(violations){
  const rows=violations.map((v,i)=>({
    '#':i+1,'Tactical ID':v.activityId,
    'Rule ID':v.ruleId,'Rule Name':v.ruleName,'Severity':v.severity,
    'Region':v.region,'Market':v.market,'Activity Type': v.activityType||'—',
    'Activity / Item':v.item,'Detail':v.detail,
    'Status':v.status==='accepted'?'Accepted':v.status==='action-required'?'Action Required':'Pending Review',
    'What Needs to Change':v.comment||'',
  }));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:4},{wch:12},{wch:8},{wch:42},{wch:10},{wch:14},{wch:22},{wch:22},{wch:36},{wch:70},{wch:16},{wch:50}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Violations');
  const counts={HIGH:0,MEDIUM:0,LOW:0};
  violations.forEach(v=>{counts[v.severity]=(counts[v.severity]||0)+1;});
  const byMkt={};
  violations.forEach(v=>{byMkt[v.market]=(byMkt[v.market]||0)+1;});
  const sumRows=[
    ['DCT Tactical Plan Review — Violations Summary',''],
    ['Generated:',new Date().toLocaleDateString('en-AE')],
    ['',''],['HIGH',counts.HIGH],['MEDIUM',counts.MEDIUM],['LOW',counts.LOW],
    ['TOTAL',violations.length],['',''],['TOP MARKETS','COUNT'],
    ...Object.entries(byMkt).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([m,c])=>[m,c]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(sumRows),'Summary');
  XLSX.writeFile(wb,`DCT_Violations_2027_${yyyymmdd()}.xlsx`);
}

function exportViolationsToCSV(violations){
  const headers=['Tactical ID','Rule ID','Rule Name','Severity','Region','Market','Activity / Item','Detail','Status','What Needs to Change'];
  const rows=violations.map(v=>[
    v.activityId,v.ruleId,v.ruleName,v.severity,v.region,v.market,v.item,v.detail,
    v.status==='accepted'?'Accepted':v.status==='action-required'?'Action Required':'Pending',
    v.comment||''
  ]);
  const csv=[headers,...rows].map(r=>r.map(c=>{const s=String(c||'').replace(/"/g,'""');return (s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s}"`:s;}).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`DCT_Violations_2027_${yyyymmdd()}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

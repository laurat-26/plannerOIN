(() => {
  const INITIAL = Array.isArray(window.OIN_INITIAL_DATA) ? window.OIN_INITIAL_DATA : [];
  const q = s => document.querySelector(s);
  const qa = s => [...document.querySelectorAll(s)];
  const clean = v => (v ?? '').toString().trim();
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const PLACEHOLDER_PREFIXES = ['pendiente por asignar','asignación por corregir','asignacion por corregir','asignación por validar','asignacion por validar','pendiente por asociar'];
  const isRealUser = u => u && !PLACEHOLDER_PREFIXES.some(p => u.toLowerCase().startsWith(p));
  const MANUAL_DEFAULT = ['272','274','271','275','203','99','269'];

  let data = loadLocalData() || INITIAL;
  let currentMinutes = [];
  let history = loadHistory();
  let uploadedData = null;

  function loadLocalData(){
    try { const x = localStorage.getItem('oin_data_session'); return x ? JSON.parse(x) : null; } catch(e){ return null; }
  }
  function saveLocalData(){
    try { localStorage.setItem('oin_data_session', JSON.stringify(data)); } catch(e){}
  }
  function loadHistory(){
    try { return JSON.parse(localStorage.getItem('oin_meeting_history') || '[]'); } catch(e){ return []; }
  }
  function saveHistory(){
    try { localStorage.setItem('oin_meeting_history', JSON.stringify(history)); } catch(e){}
  }
  function statusClass(s){ return s==='Hecho'?'done':s==='Vencido'?'late':s==='En curso'?'course':'pending'; }
  function users(){ return uniq(data.map(x=>x.owner).filter(isRealUser)); }
  function pct(v){ const n=Number(v)||0; return Math.max(0,Math.min(100,Math.round(n))); }

  function normalizeStatus(rec, manualClosed=[]){
    const id = clean(rec.ticket);
    const bucket = clean(rec.bucket);
    const raw = clean(rec.rawStatus);
    const due = clean(rec.dueState);
    const blob = (bucket+' '+raw).toLowerCase();
    if (manualClosed.includes(id) || Number(rec.progress)>=100 || bucket.toLowerCase().includes('hecho') || raw.toLowerCase().includes('complet')) {
      rec.status='Hecho'; rec.progress=100; rec.bucket='Hecho'; rec.rawStatus='Completado'; rec.dueState='No aplica — completada';
    } else if (due.toLowerCase().includes('vencid') || blob.includes('vencid')) {
      rec.status='Vencido';
    } else if (['haciendo','en curso','en progreso','progreso'].some(k=>blob.includes(k))) {
      rec.status='En curso';
    } else {
      rec.status='Pendiente';
    }
    const meetBlob = (rec.bucket+' '+rec.rawStatus+' '+rec.dueState).toLowerCase();
    const meetKeys=['demoras','qué hacer','que hacer','vencid','en curso','haciendo','en progreso','no iniciada','no iniciado','pendiente'];
    rec.meetingEligible = rec.status!=='Hecho' && meetKeys.some(k=>meetBlob.includes(k));
    return rec;
  }

  function currentFiltered(){
    return data.filter(r =>
      (!q('#filterUser').value || r.owner===q('#filterUser').value) &&
      (!q('#filterState').value || r.status===q('#filterState').value) &&
      (!q('#filterBucket').value || r.bucket===q('#filterBucket').value) &&
      (!q('#filterPriority').value || r.priority===q('#filterPriority').value)
    );
  }

  function fillSelect(el, values, preserveFirst=false){
    const first = preserveFirst ? el.querySelector('option')?.outerHTML || '' : '';
    el.innerHTML = first;
    values.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o); });
  }

  function refreshSelectors(){
    fillSelect(q('#filterUser'), users(), true);
    fillSelect(q('#filterState'), uniq(data.map(x=>x.status)), true);
    fillSelect(q('#filterBucket'), uniq(data.map(x=>x.bucket)), true);
    fillSelect(q('#filterPriority'), uniq(data.map(x=>x.priority)), true);
    fillSelect(q('#personSelect'), users());

    const meetingUsers = users().filter(u=>data.some(r=>r.owner===u && r.meetingEligible));
    fillSelect(q('#meetingUser'), meetingUsers);

    const histUsers = users();
    fillSelect(q('#historyUser'), histUsers, true);

    q('#attendees').innerHTML = users().map(u=>`<label><input type="checkbox" value="${escapeHtml(u)}"> ${escapeHtml(shortName(u))}</label>`).join('');
  }

  function escapeHtml(s){
    return clean(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function shortName(n){ return clean(n).split(/\s+/).slice(0,2).join(' '); }

  function renderSummary(){
    q('#loadedCount').textContent = data.length;
    const arr=currentFiltered(), done=arr.filter(x=>x.status==='Hecho'), course=arr.filter(x=>x.status==='En curso'), late=arr.filter(x=>x.status==='Vencido');
    q('#kTotal').textContent=arr.length; q('#kDone').textContent=done.length; q('#kCourse').textContent=course.length; q('#kLate').textContent=late.length;
    const donePct=arr.length?Math.round(done.length/arr.length*100):0; q('#kDonePct').textContent=donePct+'% del total'; q('#donutValue').textContent=donePct+'%';
    q('#donut').style.background=`conic-gradient(var(--green) 0 ${donePct}%, #ead7b7 ${donePct}% 100%)`;
    q('#stateLegend').innerHTML=`<div class="legend-row"><span class="dot" style="background:var(--green)"></span>Completadas: <strong>${done.length}</strong></div>
      <div class="legend-row"><span class="dot" style="background:var(--blue)"></span>En curso: <strong>${course.length}</strong></div>
      <div class="legend-row"><span class="dot" style="background:var(--red)"></span>Vencidas: <strong>${late.length}</strong></div>`;

    const counts={};
    arr.forEach(r=>counts[r.owner]=(counts[r.owner]||0)+1);
    const pairs=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const max=Math.max(1,...pairs.map(x=>x[1]));
    q('#userBars').innerHTML=pairs.map(([u,n])=>`<div class="bar-row"><span title="${escapeHtml(u)}">${escapeHtml(shortName(u))}</span><div class="bar-track"><div class="bar-fill" style="width:${n/max*100}%"></div></div><strong>${n}</strong></div>`).join('') || '<div class="empty">Sin datos.</div>';

    const attention=arr.filter(r=>r.status!=='Hecho').sort((a,b)=>(b.status==='Vencido')-(a.status==='Vencido')).slice(0,14);
    q('#attentionCount').textContent=attention.length+' hallazgos';
    q('#attentionTable').innerHTML=attention.length?attention.map(r=>`<tr><td><strong>#${escapeHtml(r.ticket)}</strong></td><td>${escapeHtml(r.task)}</td><td>${escapeHtml(r.owner)}</td><td><strong>${pct(r.progress)}%</strong></td><td><span class="status ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td><td>${escapeHtml(r.dueDate||r.dueState||'Sin fecha')}</td></tr>`).join(''):'<tr><td colspan="6">Sin tareas para seguimiento con estos filtros.</td></tr>';
  }

  function renderPerson(){
    const u=q('#personSelect').value;
    const base=data.filter(r=>r.owner===u);
    const filter=q('#complianceSelect').value;
    const arr=filter==='Todos'?base:base.filter(r=>r.status===filter);
    const avg=base.length?Math.round(base.reduce((s,r)=>s+pct(r.progress),0)/base.length):0;
    q('#personName').textContent=u||'Selecciona un usuario';
    q('#personStats').textContent=u?`${base.length} tickets · ${base.filter(x=>x.status==='Hecho').length} hechos · ${base.filter(x=>x.status==='Vencido').length} vencidos`:'';
    q('#personPct').textContent=avg+'%'; q('#personCount').textContent=arr.length+' visibles';
    q('#personTasks').innerHTML=arr.length?arr.map(r=>`<article class="task ${statusClass(r.status)}"><div><h3>#${escapeHtml(r.ticket)} · ${escapeHtml(r.task.replace(/^#\d+_?/,'').replaceAll('_',' '))}</h3><p>${escapeHtml(r.area)} · Bucket: ${escapeHtml(r.bucket||'—')}</p><p>${escapeHtml(r.description).slice(0,190)}${clean(r.description).length>190?'…':''}</p></div><div class="task-side"><strong>${pct(r.progress)}%</strong><span class="status ${statusClass(r.status)}">${escapeHtml(r.status)}</span></div></article>`).join(''):'<div class="empty">No hay tickets con este cumplimiento.</div>';
  }

  function eligibleForMeeting(r){ return !!r.meetingEligible; }

  function refreshMeetingTickets(){
    const u=q('#meetingUser').value;
    const tickets=data.filter(r=>r.owner===u && eligibleForMeeting(r));
    fillSelect(q('#meetingTicket'), tickets.map(r=>r.ticket));
    renderMeetingContext();
  }

  function currentMeetingTask(){
    return data.find(r=>r.owner===q('#meetingUser').value && r.ticket===q('#meetingTicket').value);
  }

  function renderMeetingContext(){
    const r=currentMeetingTask();
    if(!r){ q('#meetingContext').innerHTML='<strong>Este usuario no tiene tickets activos para reunión.</strong>'; return; }
    const prev=history.find(h=>h.ticket===r.ticket && h.owner===r.owner);
    q('#meetingContext').innerHTML=`<strong>#${escapeHtml(r.ticket)} · ${escapeHtml(r.task.replace(/^#\d+_?/,'').replaceAll('_',' '))}</strong>
      <p>${escapeHtml(r.owner)} · ${escapeHtml(r.area)} · Estado: ${escapeHtml(r.status)} · Bucket: ${escapeHtml(r.bucket||'—')} · Progreso ${pct(r.progress)}%</p>
      <div class="ticket-progress"><span style="width:${pct(r.progress)}%"></span></div>
      ${prev?`<p><b>Último seguimiento:</b> ${escapeHtml(prev.note)} <span>(${escapeHtml(formatDateTime(prev.dateTime))})</span></p>`:''}`;
  }

  function renderMeetingLog(){
    q('#meetingCounter').textContent=currentMinutes.length+' intervenciones';
    q('#meetingLog').innerHTML=currentMinutes.length?currentMinutes.map((x,i)=>`<div class="log-item"><strong>${i+1}. #${escapeHtml(x.ticket)} · ${escapeHtml(x.task)}</strong><small>${escapeHtml(x.owner)} · ${x.progress}% · ${escapeHtml(x.status)} · ${escapeHtml(formatDateTime(x.dateTime))}</small><p>${escapeHtml(x.note)}</p></div>`).join(''):'<div class="empty">Aún no has agregado conversaciones al acta.</div>';
  }

  function formatDateTime(v){
    if(!v) return '';
    const [d,t=''] = v.split('T');
    return `${d} ${t}`;
  }

  function nowLocal(){
    const d=new Date(), p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function getMeetingMeta(){
    return {
      acta:q('#actaNumber').value.trim(),
      name:q('#meetingName').value.trim()||'Seguimiento OIN',
      dateTime:q('#meetingDateTime').value,
      attendees:qa('#attendees input:checked').map(x=>x.value),
      processes:qa('#processes input:checked').map(x=>x.value),
      objective:q('#meetingObjective').value.trim(),
      agenda:q('#meetingAgenda').value.trim(),
      preparedBy:q('#preparedBy').value.trim(),
      approvedBy:q('#approvedBy').value.trim()
    };
  }

  function buildActaHtml(){
    const m=getMeetingMeta();
    const dt=m.dateTime||nowLocal(), [date,time]=dt.split('T');
    const distinctTickets=[...new Set(currentMinutes.map(x=>x.ticket))];
    const development=distinctTickets.map(id=>{
      const items=currentMinutes.filter(x=>x.ticket===id), last=items[items.length-1];
      return `<div class="dev"><h3>Ticket #${escapeHtml(id)} · ${escapeHtml(last.task)}</h3><p><b>Responsable:</b> ${escapeHtml(last.owner)} &nbsp; <b>Estado:</b> ${escapeHtml(last.status)} &nbsp; <b>Progreso:</b> ${last.progress}%</p><ol>${items.map(x=>`<li>${escapeHtml(x.note)}</li>`).join('')}</ol></div>`;
    }).join('');
    const taskRows=distinctTickets.map((id,i)=>{
      const items=currentMinutes.filter(x=>x.ticket===id), last=items[items.length-1];
      const combined=items.map(x=>x.note).join(' / ');
      return `<tr><td>${i+1}</td><td>#${escapeHtml(id)}</td><td>${escapeHtml(combined)}</td><td>${last.progress}%</td><td>${escapeHtml(last.owner)}</td></tr>`;
    }).join('');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acta ${escapeHtml(m.acta||'')} · Seguimiento OIN</title><style>
      body{font-family:Arial,sans-serif;color:#111;margin:28px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:7px;vertical-align:top}
      .top td{font-weight:bold;font-size:13px}.title{font-size:22px;text-align:center}.gray{background:#e7e7e7;text-align:center;font-weight:bold}.section{margin-top:0}.list{padding:12px 25px;min-height:40px;border:1px solid #333;border-top:0}.dev{border:1px solid #333;padding:10px;margin-top:-1px}.dev h3{margin:0 0 5px;font-size:12px}
      .logo{max-width:180px;max-height:58px}.meta td{height:46px}.foot{margin-top:28px}.small{font-size:10px}
      @media print{body{margin:10mm}}
    </style></head><body>
      <table class="top"><tr><td style="width:28%"><img src="assets/logo-gelsa-oin.png" class="logo"></td><td class="title">ACTA</td><td style="width:25%">Código: SDG-GC-R-06<br>Versión: 06<br>Página 1 de 1</td></tr></table>
      <table class="meta"><tr><td style="width:12%"><b>Acta Nro.</b><br>${escapeHtml(m.acta)}</td><td><b>Reunión:</b><br>${escapeHtml(m.name)}</td><td style="width:20%"><b>Fecha:</b><br>${escapeHtml(date)}</td><td style="width:16%"><b>Hora:</b><br>${escapeHtml(time)}</td></tr></table>
      <div class="gray section" style="border:1px solid #333;padding:5px">Asistentes</div><div class="list"><ul>${m.attendees.map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>No registrados</li>'}</ul></div>
      <div class="gray" style="border:1px solid #333;padding:5px">Procesos</div><div class="list"><ul>${m.processes.map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>No registrados</li>'}</ul></div>
      <div class="gray" style="border:1px solid #333;padding:5px">Seguimiento</div>
      <div style="border:1px solid #333;border-top:0;padding:10px"><b>Objetivo de la Reunión:</b><p>${escapeHtml(m.objective).replace(/\n/g,'<br>')}</p></div>
      <div class="gray" style="border:1px solid #333;padding:5px">Agenda</div><div class="list">${escapeHtml(m.agenda).replace(/\n/g,'<br>')}</div>
      <div class="gray" style="border:1px solid #333;padding:5px">Desarrollo de los objetivos</div>${development||'<div class="list">Sin intervenciones registradas.</div>'}
      <div class="gray" style="border:1px solid #333;padding:5px">Tareas de la Reunión</div>
      <table><thead><tr><th>Nro.</th><th>Ticket</th><th>Avance / observación</th><th>Progreso</th><th>Responsable</th></tr></thead><tbody>${taskRows}</tbody></table>
      <table class="foot"><tr><td style="width:25%"><b>Elaboró Acta:</b></td><td>${escapeHtml(m.preparedBy)}</td></tr><tr><td><b>Aprobó Acta:</b></td><td>${escapeHtml(m.approvedBy)}</td></tr></table>
      <p class="small">Acta generada desde el Panel de Seguimiento OIN. Incluye todas las intervenciones registradas durante la reunión.</p>
    </body></html>`;
  }

  function previewActa(){
    if(!currentMinutes.length){ flash('Agrega al menos una observación.'); return; }
    const html=buildActaHtml();
    const w=window.open('','_blank');
    if(!w){ flash('El navegador bloqueó la vista previa.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(()=>w.print(),500);
  }

  function downloadActa(){
    if(!currentMinutes.length){ flash('Agrega al menos una observación.'); return; }
    const blob=new Blob([buildActaHtml()],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    const d=(q('#meetingDateTime').value||nowLocal()).slice(0,10);
    a.href=url; a.download=`Acta_Seguimiento_OIN_${d}.html`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function flash(msg){
    q('#meetingMessage').textContent=msg;
    setTimeout(()=>q('#meetingMessage').textContent='',1900);
  }

  function addMeetingNote(){
    const r=currentMeetingTask(), note=q('#meetingNote').value.trim();
    if(!r){ flash('Selecciona un ticket.'); return; }
    if(!note){ flash('Escribe la observación.'); return; }
    const item={ticket:r.ticket,task:r.task.replace(/^#\d+_?/, '').replaceAll('_',' '),owner:r.owner,progress:pct(r.progress),status:r.status,bucket:r.bucket,dateTime:q('#meetingDateTime').value||nowLocal(),note};
    currentMinutes.push(item); history.unshift(item); saveHistory(); q('#meetingNote').value='';
    flash('Agregado al acta ✓'); renderMeetingLog(); refreshHistoryTicketSelect(); renderHistory();
  }

  function newMeeting(){
    currentMinutes=[]; q('#meetingDateTime').value=nowLocal(); q('#actaNumber').value=''; q('#meetingNote').value='';
    qa('#attendees input,#processes input').forEach(x=>x.checked=false); renderMeetingLog();
  }

  function refreshHistoryTicketSelect(){
    fillSelect(q('#historyTicket'), uniq(history.map(x=>x.ticket)), true);
  }
  function renderHistory(){
    const u=q('#historyUser').value,t=q('#historyTicket').value;
    const arr=history.filter(x=>(!u||x.owner===u)&&(!t||x.ticket===t));
    q('#historyCount').textContent=arr.length+' registros';
    q('#historyList').innerHTML=arr.length?arr.map(x=>`<div class="history-item"><small>${escapeHtml(formatDateTime(x.dateTime))} · ${escapeHtml(x.owner)} · Ticket #${escapeHtml(x.ticket)} · ${x.progress}% · ${escapeHtml(x.status)}</small><p>${escapeHtml(x.note)}</p></div>`).join(''):'<div class="empty">Todavía no hay observaciones registradas.</div>';
  }

  function showView(v){
    qa('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
    qa('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));
    if(v==='history') renderHistory();
  }

  // Excel updater
  function parseUploadedWorkbook(file){
    if(!window.XLSX){ q('#updateSummary').textContent='No se pudo cargar el lector de Excel. Revisa tu conexión a internet.'; return; }
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array',cellDates:true});
        const sheet=wb.Sheets['Tickets'] || wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
        const hidx=rows.findIndex(row=>row.includes('Ticket') && row.includes('Tarea Planner'));
        if(hidx<0) throw new Error('No se encontró el encabezado Ticket / Tarea Planner.');
        const head=rows[hidx], objects=rows.slice(hidx+1).filter(r=>r[head.indexOf('Ticket')]!=='').map(row=>{
          const o={}; head.forEach((h,i)=>{ if(h) o[h]=row[i]; }); return o;
        });
        const manual=parseManualClosed();
        uploadedData=objects.map(o=>convertExcelRow(o,manual)).filter(Boolean);
        const oldIds=new Set(data.map(x=>x.ticket)), newIds=new Set(uploadedData.map(x=>x.ticket));
        const added=[...newIds].filter(x=>!oldIds.has(x)), removed=[...oldIds].filter(x=>!newIds.has(x));
        q('#updateSummary').innerHTML=`Archivo leído correctamente.<br><b>${uploadedData.length}</b> tickets detectados · <b>${added.length}</b> nuevos · <b>${removed.length}</b> ya no aparecen en la nueva base.<br>Se aplicarán también los cierres manuales indicados.`;
        q('#applyUploadedData').disabled=false;
      }catch(err){
        uploadedData=null; q('#applyUploadedData').disabled=true; q('#updateSummary').textContent='No se pudo leer el archivo: '+err.message;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseManualClosed(){
    return q('#manualClosedInput').value.split(/[,;\s]+/).map(x=>x.replace('#','').trim()).filter(Boolean);
  }

  function excelDate(v){
    if(!v) return '';
    if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
    if(typeof v==='number' && window.XLSX?.SSF){ const d=XLSX.SSF.parse_date_code(v); if(d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`; }
    return clean(v).slice(0,10);
  }

  function convertExcelRow(o,manual){
    const ticket=clean(o['Ticket']).replace(/\.0$/,''); if(!ticket) return null;
    const rec={
      ticket, task:clean(o['Tarea Planner'])||`Ticket #${ticket}`, description:clean(o['Descripción completa']),
      area:clean(o['Área / Proceso']), requestType:clean(o['Tipo solicitud']), owner:clean(o['Responsable operativo (Planner)'])||'Sin responsable',
      manager:clean(o['Gestor de asignación']), priority:clean(o['Prioridad']), bucket:clean(o['Bucket']),
      rawStatus:clean(o['Estado']), progress:Number(o['% completado'])||0, dueDate:excelDate(o['Fecha vencimiento']), dueState:clean(o['Estado de vencimiento']), meetingEligible:false
    };
    return normalizeStatus(rec,manual);
  }

  function applyUploaded(){
    if(!uploadedData) return;
    const manual=parseManualClosed();
    data=uploadedData.map(r=>normalizeStatus(r,manual));
    // Add manual closed not in the uploaded workbook
    const ids=new Set(data.map(x=>x.ticket));
    manual.filter(id=>!ids.has(id)).forEach(id=>data.push({
      ticket:id,task:`Ticket #${id} · cierre confirmado manualmente`,description:'Cierre confirmado manualmente; pendiente asociación cuando aparezca en el próximo Excel.',
      area:'Actualización manual',requestType:'',owner:'Pendiente por asociar',manager:'',priority:'',bucket:'Hecho',rawStatus:'Completado',status:'Hecho',progress:100,dueDate:'',dueState:'No aplica — completada',meetingEligible:false
    }));
    saveLocalData(); closeUpdate(); refreshAll();
  }

  function exportDataJs(){
    const text='window.OIN_INITIAL_DATA = '+JSON.stringify(data,null,2)+';\n';
    const blob=new Blob([text],{type:'text/javascript;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='data.js';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function openUpdate(){ q('#updateModal').classList.remove('hidden'); }
  function closeUpdate(){ q('#updateModal').classList.add('hidden'); }

  function refreshAll(){
    refreshSelectors(); renderSummary(); renderPerson(); refreshMeetingTickets(); refreshHistoryTicketSelect(); renderHistory(); renderMeetingLog();
  }

  // Events
  qa('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  qa('#filterUser,#filterState,#filterBucket,#filterPriority').forEach(el=>el.addEventListener('change',renderSummary));
  q('#clearFilters').addEventListener('click',()=>{qa('#filterUser,#filterState,#filterBucket,#filterPriority').forEach(x=>x.value='');renderSummary();});
  q('#personSelect').addEventListener('change',renderPerson); q('#complianceSelect').addEventListener('change',renderPerson);
  q('#meetingUser').addEventListener('change',refreshMeetingTickets); q('#meetingTicket').addEventListener('change',renderMeetingContext);
  q('#addMeetingNote').addEventListener('click',addMeetingNote); q('#previewActa').addEventListener('click',previewActa); q('#downloadActa').addEventListener('click',downloadActa); q('#newMeeting').addEventListener('click',newMeeting);
  q('#historyUser').addEventListener('change',renderHistory); q('#historyTicket').addEventListener('change',renderHistory);
  q('#openUpdate').addEventListener('click',openUpdate); q('#closeUpdate').addEventListener('click',closeUpdate);
  q('#updateModal').addEventListener('click',e=>{if(e.target===q('#updateModal'))closeUpdate();});
  q('#excelUpload').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)parseUploadedWorkbook(f);});
  q('#applyUploadedData').addEventListener('click',applyUploaded); q('#exportDataJs').addEventListener('click',exportDataJs);

  q('#meetingDateTime').value=nowLocal();
  refreshAll();
})();
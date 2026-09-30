
(() => {
 const raw = window.OIN_DATA || [];
 const q = s => document.querySelector(s);
 const qa = s => [...document.querySelectorAll(s)];
 const clean = v => (v ?? '').toString().trim();
 const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const users = uniq(raw.map(x=>clean(x['Responsable operativo (Planner)'])).filter(x=>x && !x.toLowerCase().startsWith('asignación') && !x.toLowerCase().startsWith('pendiente')));
 const fill = (id, vals) => { const el=q(id); vals.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);}); };
 fill('#filterUser', users);
 fill('#filterState', uniq(raw.map(x=>clean(x.Estado))));
 fill('#filterBucket', uniq(raw.map(x=>clean(x.Bucket))));
 fill('#filterPriority', uniq(raw.map(x=>clean(x.Prioridad))));
 q('#totalRegistros').textContent = raw.length;

 function filtered(){
   return raw.filter(r =>
     (!q('#filterUser').value || clean(r['Responsable operativo (Planner)'])===q('#filterUser').value) &&
     (!q('#filterState').value || clean(r.Estado)===q('#filterState').value) &&
     (!q('#filterBucket').value || clean(r.Bucket)===q('#filterBucket').value) &&
     (!q('#filterPriority').value || clean(r.Prioridad)===q('#filterPriority').value)
   );
 }
 const isDone = r => clean(r.Estado).toLowerCase().includes('complet') || Number(r['% completado']) >= 100 || clean(r.Bucket).toLowerCase()==='hecho';
 const isLate = r => clean(r['Estado de vencimiento']).toLowerCase().includes('vencida');
 const pct = n => Math.max(0, Math.min(100, Number(n)||0));

 function render(){
   const data = filtered();
   const done = data.filter(isDone);
   const late = data.filter(isLate);
   const progress = data.filter(r=>!isDone(r) && Number(r['% completado'])>0);
   q('#kpiTotal').textContent=data.length;
   q('#kpiDone').textContent=done.length;
   q('#kpiProgress').textContent=progress.length;
   q('#kpiLate').textContent=late.length;
   const doneP = data.length ? Math.round(done.length/data.length*100) : 0;
   q('#donePct').textContent=doneP+'% del total';
   q('#donutValue').textContent=doneP+'%';
   q('#donut').style.background=`conic-gradient(var(--green) 0 ${doneP}%, var(--sand) ${doneP}% 100%)`;

   const counts={};
   data.forEach(r=>{const u=clean(r['Responsable operativo (Planner)'])||'Sin asignar';counts[u]=(counts[u]||0)+1});
   const pairs=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
   const max=Math.max(1,...pairs.map(x=>x[1]));
   q('#userBars').innerHTML=pairs.map(([u,n])=>`<div class="bar-row"><span title="${u}">${u.split(' ').slice(0,2).join(' ')}</span><div class="bar-track"><div class="bar-fill" style="width:${n/max*100}%"></div></div><strong>${n}</strong></div>`).join('') || '<p>Sin datos para los filtros seleccionados.</p>';

   const stateCounts={Completadas:done.length,'En curso':progress.length,Vencidas:late.length};
   const colors={Completadas:'var(--green)','En curso':'var(--blue)',Vencidas:'var(--red)'};
   q('#stateLegend').innerHTML=Object.entries(stateCounts).map(([k,v])=>`<div class="legend-item"><span class="dot" style="background:${colors[k]}"></span><span>${k}: <strong>${v}</strong></span></div>`).join('');

   const attention=data.filter(r=>isLate(r)||(!isDone(r)&&Number(r['% completado'])<100)).sort((a,b)=>(isLate(b)?1:0)-(isLate(a)?1:0)).slice(0,12);
   q('#attentionCount').textContent=attention.length+' hallazgos';
   q('#attentionTable').innerHTML=attention.map(r=>`<tr>
      <td>#${clean(r.Ticket)}</td>
      <td>${clean(r['Tarea Planner'])||clean(r['Descripción completa']).slice(0,80)}</td>
      <td>${clean(r['Responsable operativo (Planner)'])}</td>
      <td><strong>${pct(r['% completado'])}%</strong></td>
      <td><span class="status ${isLate(r)?'late':''}">${clean(r.Estado)||clean(r.Bucket)}</span></td>
      <td>${clean(r['Fecha vencimiento'])||'Sin fecha'}</td>
   </tr>`).join('') || '<tr><td colspan="6">No hay tareas que requieran seguimiento con estos filtros.</td></tr>';

   renderUser(data);
   renderMeeting(data, done, late, progress);
 }
 function renderUser(data){
   const selected=q('#filterUser').value;
   const subset=selected ? data : [];
   q('#userTitle').textContent=selected || 'Selecciona un usuario';
   q('#userSubtitle').textContent=selected ? `${subset.length} tareas visibles con los filtros actuales.` : 'Elige una persona en el filtro superior para ver su resumen.';
   const avg=subset.length?Math.round(subset.reduce((s,r)=>s+pct(r['% completado']),0)/subset.length):0;
   q('#userPct').textContent=avg+'%';
   q('#uTotal').textContent=subset.length;
   q('#uDone').textContent=subset.filter(isDone).length;
   q('#uPending').textContent=subset.filter(r=>!isDone(r)).length;
   q('#uLate').textContent=subset.filter(isLate).length;
   q('#userTasks').innerHTML=subset.slice(0,30).map(r=>`<article class="task">
      <div><h3>#${clean(r.Ticket)} · ${clean(r['Tarea Planner'])}</h3><p>${clean(r['Área / Proceso'])} · ${clean(r['Tipo solicitud'])}</p><p>${clean(r['Descripción completa']).slice(0,170)}${clean(r['Descripción completa']).length>170?'…':''}</p></div>
      <div class="task-meta"><strong>${pct(r['% completado'])}%</strong><span>${clean(r.Bucket)}</span><br><span>${isLate(r)?'⚠ Vencida':clean(r['Fecha vencimiento'])||'Sin vencimiento'}</span></div>
   </article>`).join('') || '<p>Selecciona un usuario para ver sus tareas.</p>';
 }
 function renderMeeting(data, done, late, progress){
   const user=q('#filterUser').value;
   const subject=user||'Equipo OIN';
   const urgent=data.filter(isLate).slice(0,6);
   const active=data.filter(r=>!isDone(r)).sort((a,b)=>Number(b['% completado'])-Number(a['% completado'])).slice(0,6);
   q('#meetingSummary').innerHTML=`
    <article class="meeting-card"><p class="eyebrow">RESUMEN EJECUTIVO</p><h3>${subject}</h3>
      <p>En la vista actual hay <strong>${data.length}</strong> tareas: <strong>${done.length}</strong> completadas, <strong>${progress.length}</strong> en curso y <strong>${late.length}</strong> vencidas.</p>
    </article>
    <article class="meeting-card"><p class="eyebrow">PUNTOS PARA REVISAR</p><h3>Alertas y pendientes</h3>
      ${urgent.length?`<ul>${urgent.map(r=>`<li><strong>#${clean(r.Ticket)}</strong> ${clean(r['Tarea Planner'])} — ${pct(r['% completado'])}% — ${clean(r['Responsable operativo (Planner)'])}</li>`).join('')}</ul>`:'<p>No aparecen tareas vencidas en esta vista.</p>'}
    </article>
    <article class="meeting-card"><p class="eyebrow">AVANCE</p><h3>Tareas activas destacadas</h3>
      ${active.length?`<ul>${active.map(r=>`<li><strong>#${clean(r.Ticket)}</strong> ${clean(r['Tarea Planner'])} — avance ${pct(r['% completado'])}% — ${clean(r.Bucket)}</li>`).join('')}</ul>`:'<p>No hay tareas activas con los filtros actuales.</p>'}
    </article>
    <article class="meeting-card"><p class="eyebrow">SIGUIENTE FASE</p><h3>Observaciones y compromisos</h3>
      <p>Este bloque quedará preparado para registrar observación de reunión, compromiso, responsable, fecha acordada y estado del compromiso cuando conectemos el almacenamiento.</p>
    </article>`;
 }
 qa('.filters select').forEach(el=>el.addEventListener('change',render));
 q('#clearFilters').addEventListener('click',()=>{qa('.filters select').forEach(x=>x.value='');render()});
 qa('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
   qa('.nav-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
   qa('.view').forEach(x=>x.classList.remove('active'));q('#view-'+btn.dataset.view).classList.add('active');
 }));
 q('#printMeeting').addEventListener('click',()=>window.print());
 render();
})();

// Control Operacional Preventivo — lógica de la aplicación (SPA con rutas por hash).

const view = document.getElementById('view');
const MAX_FOTOS = 6;

// ---------- Utilidades ----------

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function ahoraLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const hoy = () => ahoraLocal().slice(0, 10);

const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const fmtDia = (ymd) => (ymd ? new Date(`${ymd}T00:00`).toLocaleDateString('es-CL') : '—');

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- RUT chileno ----------

const limpiarRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();

function validarRut(rut) {
  const c = limpiarRut(rut);
  if (c.length < 2) return false;
  const cuerpo = c.slice(0, -1);
  const dv = c.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const r = 11 - (suma % 11);
  return dv === (r === 11 ? '0' : r === 10 ? 'K' : String(r));
}

function formatRut(rut) {
  const c = limpiarRut(rut);
  if (c.length < 2) return rut;
  return `${c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${c.slice(-1)}`;
}

function bindRut(input) {
  input.addEventListener('blur', () => {
    if (input.value) input.value = formatRut(input.value);
    input.classList.toggle('invalid', !!input.value && !validarRut(input.value));
  });
}

// ---------- Fotos ----------

async function comprimirImagen(file, max = 1280, calidad = 0.7) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const campoFotos = (id, titulo = 'Fotografías') => `
  <div class="field-photos" id="${id}">
    <div class="card-head">
      <h3>${titulo} <span class="hint">(máx. ${MAX_FOTOS})</span></h3>
      <label class="btn btn-ghost btn-sm">📷 Agregar
        <input type="file" accept="image/*" capture="environment" multiple hidden>
      </label>
    </div>
    <div class="photos"></div>
  </div>`;

function bindFotos(root, fotos) {
  const input = root.querySelector('input[type=file]');
  const grid = root.querySelector('.photos');
  const draw = () => {
    grid.innerHTML = fotos.map((src, i) => `
      <div class="photo"><img src="${src}" alt="Foto ${i + 1}">
        <button type="button" data-i="${i}" aria-label="Quitar foto">×</button></div>`).join('');
  };
  grid.addEventListener('click', (e) => {
    const i = e.target.dataset.i;
    if (i !== undefined) { fotos.splice(Number(i), 1); draw(); }
  });
  input.addEventListener('change', async () => {
    for (const f of input.files) {
      if (fotos.length >= MAX_FOTOS) { toast(`Máximo ${MAX_FOTOS} fotos`); break; }
      try { fotos.push(await comprimirImagen(f)); } catch { toast('No se pudo leer la imagen'); }
    }
    input.value = '';
    draw();
  });
  draw();
}

// ---------- Firma ----------

function crearFirma(canvas) {
  const ctx = canvas.getContext('2d');
  let dibujando = false;
  let vacia = true;

  function ajustar() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    vacia = true;
  }

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    dibujando = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dibujando) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    vacia = false;
  });
  const fin = () => { dibujando = false; };
  canvas.addEventListener('pointerup', fin);
  canvas.addEventListener('pointercancel', fin);

  requestAnimationFrame(ajustar);

  return {
    limpiar: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); vacia = true; },
    vacia: () => vacia,
    dataURL: () => (vacia ? '' : canvas.toDataURL('image/png')),
  };
}

const campoFirma = (titulo) => `
  <div>
    <div class="card-head"><h3>${titulo}</h3>
      <button type="button" class="btn btn-ghost btn-sm" data-limpiar-firma>Limpiar</button></div>
    <div class="sig-wrap"><canvas aria-label="Área de firma"></canvas></div>
  </div>`;

function bindFirma(root) {
  const firma = crearFirma(root.querySelector('.sig-wrap canvas'));
  root.querySelector('[data-limpiar-firma]').addEventListener('click', firma.limpiar);
  return firma;
}

// ---------- Datos derivados ----------

function estadoObs(r) {
  if (r.estado === 'Cerrada') return 'Cerrada';
  if (r.fechaCompromiso && r.fechaCompromiso < hoy()) return 'Vencida';
  return 'Abierta';
}

const tagEstado = (e) => `<span class="tag ${{ Cerrada: 'tag-ok', Vencida: 'tag-bad', Abierta: 'tag-warn' }[e]}">${e}</span>`;

const tagPotencial = (p) => `<span class="tag ${{ Alto: 'tag-bad', Medio: 'tag-warn', Bajo: 'tag-info' }[p] || ''}">${esc(p)}</span>`;

function calcCumplimiento(items) {
  const c = items.filter((i) => i.estado === 'C').length;
  const nc = items.filter((i) => i.estado === 'NC').length;
  return c + nc ? Math.round((c / (c + nc)) * 100) : null;
}

function tarjetaRegistro(r) {
  if (r.tipo === 'inspeccion') {
    const nc = r.items.filter((i) => i.estado === 'NC').length;
    return `<a class="list-item ${nc ? 'b-bad' : 'b-ok'}" href="#/registro/${r.id}">
      <div class="row"><span class="t">✅ ${esc(r.plantilla)}</span>
        <span class="tag ${nc ? 'tag-bad' : 'tag-ok'}">${r.cumplimiento ?? '—'}%</span>
        ${r.synced ? '' : '<span class="tag">No sincronizado</span>'}</div>
      <div class="m">${esc(r.area)} · ${esc(r.inspector)} · ${fmtFecha(r.fecha)}${nc ? ` · ${nc} no cumple` : ''}</div>
    </a>`;
  }
  const est = estadoObs(r);
  return `<a class="list-item ${{ Cerrada: 'b-ok', Vencida: 'b-bad', Abierta: 'b-warn' }[est]}" href="#/registro/${r.id}">
    <div class="row"><span class="t">👁️ ${esc(r.clase)}</span> ${tagEstado(est)} ${r.potencial ? tagPotencial(r.potencial) : ''}
      ${r.synced ? '' : '<span class="tag">No sincronizado</span>'}</div>
    <div class="m">${esc(r.riesgo || 'Sin riesgo crítico')} · ${esc(r.area)} · ${fmtFecha(r.fecha)}</div>
  </a>`;
}

// ---------- Sincronización ----------

async function sincronizar() {
  const cfg = Settings.load();
  const pendientes = (await DB.all()).filter((r) => !r.synced);
  if (!pendientes.length) return toast('No hay registros pendientes.');
  if (!cfg.endpoint) return toast('Configura la URL del servidor en Ajustes para sincronizar.');
  if (!navigator.onLine) return toast('Sin conexión. Los registros siguen guardados en el dispositivo.');
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}) },
      body: JSON.stringify({ registros: pendientes }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    for (const r of pendientes) await DB.put({ ...r, synced: true, syncedAt: new Date().toISOString() });
    toast(`Sincronizados ${pendientes.length} registros.`);
  } catch (err) {
    toast(`Error al sincronizar: ${err.message}`);
  }
  router();
}

// ---------- Vistas ----------

async function vistaInicio() {
  const regs = await DB.all();
  const insp = regs.filter((r) => r.tipo === 'inspeccion');
  const obs = regs.filter((r) => r.tipo === 'observacion');
  const conCump = insp.filter((r) => r.cumplimiento != null);
  const promedio = conCump.length ? Math.round(conCump.reduce((s, r) => s + r.cumplimiento, 0) / conCump.length) : null;
  const abiertas = obs.filter((r) => estadoObs(r) !== 'Cerrada');
  const vencidas = obs.filter((r) => estadoObs(r) === 'Vencida');
  const pendientes = regs.filter((r) => !r.synced).length;

  view.innerHTML = `
    <section class="kpis">
      <div class="kpi"><div class="v">${insp.length}</div><div class="l">Inspecciones</div></div>
      <div class="kpi"><div class="v" style="color:var(--ok)">${promedio ?? '—'}${promedio != null ? '%' : ''}</div><div class="l">Cumplimiento promedio</div></div>
      <div class="kpi"><div class="v" style="color:var(--warn)">${abiertas.length}</div><div class="l">Observaciones abiertas</div></div>
      <div class="kpi"><div class="v" style="color:var(--bad)">${vencidas.length}</div><div class="l">Acciones vencidas</div></div>
    </section>

    <section class="actions">
      <a class="btn btn-primary" href="#/inspeccion">✅ Nueva inspección</a>
      <a class="btn btn-ghost" href="#/observacion">👁️ Nueva observación</a>
    </section>

    <section class="card">
      <div class="card-head">
        <div><h3>${pendientes} registros pendientes</h3><p class="hint">Guardados en este dispositivo, sin enviar al servidor.</p></div>
        <button class="btn btn-primary btn-sm" id="btn-sync" ${pendientes ? '' : 'disabled'}>Sincronizar</button>
      </div>
    </section>

    ${vencidas.length ? `<section class="card"><h2>⚠️ Acciones vencidas</h2><div class="list">${vencidas.map(tarjetaRegistro).join('')}</div></section>` : ''}

    <section class="card">
      <div class="card-head"><h2>Actividad reciente</h2><a href="#/registros" class="hint">Ver todo →</a></div>
      <div class="list">${regs.slice(0, 5).map(tarjetaRegistro).join('') || '<p class="empty">Aún no hay registros. Comienza con una inspección.</p>'}</div>
    </section>`;

  document.getElementById('btn-sync').addEventListener('click', sincronizar);
}

async function vistaInspeccion(_, query) {
  const cfg = Settings.load();
  const plantilla = CHECKLISTS.find((c) => c.id === query.get('lista'));

  if (!plantilla) {
    view.innerHTML = `
      <section class="card">
        <div><h2>Nueva inspección</h2><p class="hint">Selecciona la lista de verificación a aplicar.</p></div>
        <div class="list">${CHECKLISTS.map((c) => `
          <a class="list-item b-info" href="#/inspeccion?lista=${c.id}">
            <span class="t">${esc(c.nombre)}</span><span class="m">${c.items.length} puntos de control</span></a>`).join('')}
        </div>
      </section>`;
    return;
  }

  const fotos = [];
  view.innerHTML = `
    <form id="f" class="card" novalidate>
      <div class="card-head">
        <div><h2>${esc(plantilla.nombre)}</h2><p class="hint">Lista de verificación · Control operacional</p></div>
        <a class="btn btn-ghost btn-sm" href="#/inspeccion">Cambiar</a>
      </div>

      <div class="grid-2">
        <label class="field">Fecha y hora<input type="datetime-local" name="fecha" value="${ahoraLocal()}" required></label>
        <label class="field">Turno<select name="turno">${TURNOS.map((t) => `<option>${t}</option>`).join('')}</select></label>
        <label class="field">Área / frente de trabajo<input name="area" required placeholder="Ej: Chancado 01"></label>
        <label class="field">Empresa<input name="empresa" value="${esc(cfg.empresa)}" placeholder="Empresa ejecutora"></label>
        <label class="field">Actividad / tarea<input name="actividad" placeholder="Ej: Cambio de liners"></label>
        <label class="field">Supervisor responsable<input name="responsable" placeholder="Nombre"></label>
        <label class="field">Inspector<input name="inspector" required value="${esc(cfg.inspector)}" placeholder="Nombre y apellido"></label>
        <label class="field">RUT inspector<input name="rut" required value="${esc(cfg.rut)}" placeholder="12.345.678-9" inputmode="text"></label>
      </div>

      <div>
        <div class="card-head"><h3>Puntos de control</h3><span class="hint" id="avance">0/${plantilla.items.length}</span></div>
        <div class="progress" style="margin-top:6px"><div id="barra" style="width:0%"></div></div>
      </div>

      ${plantilla.items.map((texto, i) => `
        <div class="check-item">
          <p><strong>${i + 1}.</strong> ${esc(texto)}</p>
          <div class="seg" role="radiogroup" aria-label="${esc(texto)}">
            <input type="radio" id="i${i}c" name="i${i}" value="C"><label class="c" for="i${i}c">Cumple</label>
            <input type="radio" id="i${i}n" name="i${i}" value="NC"><label class="nc" for="i${i}n">No cumple</label>
            <input type="radio" id="i${i}a" name="i${i}" value="NA"><label class="na" for="i${i}a">N/A</label>
          </div>
          <textarea name="c${i}" placeholder="Describe la desviación y la acción inmediata" hidden></textarea>
        </div>`).join('')}

      <label class="field">Comentarios generales<textarea name="comentarios" placeholder="Opcional"></textarea></label>

      ${campoFotos('fotos')}
      ${campoFirma('Firma del inspector')}

      <button class="btn btn-ok btn-block" type="submit">Guardar inspección</button>
    </form>`;

  const form = document.getElementById('f');
  bindRut(form.rut);
  bindFotos(document.getElementById('fotos'), fotos);
  const firma = bindFirma(form);

  const total = plantilla.items.length;
  form.addEventListener('change', (e) => {
    const m = /^i(\d+)$/.exec(e.target.name || '');
    if (m) {
      const ta = form[`c${m[1]}`];
      ta.hidden = e.target.value !== 'NC';
      if (!ta.hidden) ta.focus();
    }
    const respondidas = plantilla.items.filter((_, i) => form[`i${i}`].value).length;
    document.getElementById('avance').textContent = `${respondidas}/${total}`;
    document.getElementById('barra').style.width = `${(respondidas / total) * 100}%`;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const faltan = ['area', 'inspector', 'rut'].filter((n) => !form[n].value.trim());
    if (faltan.length) { form[faltan[0]].focus(); return toast('Completa los campos obligatorios.'); }
    if (!validarRut(form.rut.value)) { form.rut.focus(); return toast('RUT del inspector no válido.'); }
    const sinResp = plantilla.items.findIndex((_, i) => !form[`i${i}`].value);
    if (sinResp >= 0) { form[`i${sinResp}c`].scrollIntoView({ block: 'center' }); return toast(`Falta responder el punto ${sinResp + 1}.`); }
    const ncSinDetalle = plantilla.items.findIndex((_, i) => form[`i${i}`].value === 'NC' && !form[`c${i}`].value.trim());
    if (ncSinDetalle >= 0) { form[`c${ncSinDetalle}`].focus(); return toast(`Describe la desviación del punto ${ncSinDetalle + 1}.`); }
    if (firma.vacia()) return toast('Falta la firma del inspector.');

    const items = plantilla.items.map((texto, i) => ({
      texto,
      estado: form[`i${i}`].value,
      comentario: form[`i${i}`].value === 'NC' ? form[`c${i}`].value.trim() : '',
    }));
    const rec = {
      id: uid('INS'),
      tipo: 'inspeccion',
      fecha: new Date(form.fecha.value).toISOString(),
      plantillaId: plantilla.id,
      plantilla: plantilla.nombre,
      turno: form.turno.value,
      area: form.area.value.trim(),
      empresa: form.empresa.value.trim(),
      actividad: form.actividad.value.trim(),
      responsable: form.responsable.value.trim(),
      inspector: form.inspector.value.trim(),
      rut: formatRut(form.rut.value),
      items,
      cumplimiento: calcCumplimiento(items),
      comentarios: form.comentarios.value.trim(),
      fotos,
      firma: firma.dataURL(),
      synced: false,
      creado: new Date().toISOString(),
    };
    await DB.put(rec);
    toast('✅ Inspección guardada en el dispositivo.');
    location.hash = `#/registro/${rec.id}`;
  });
}

async function vistaObservacion(_, query) {
  const cfg = Settings.load();
  const fotos = [];
  let origen = null;
  let pre = {};

  const desde = query.get('desde');
  if (desde) {
    const insp = await DB.get(desde);
    const idx = Number(query.get('item'));
    const item = insp?.items?.[idx];
    if (item) {
      origen = { inspeccionId: insp.id, item: idx };
      pre = {
        clase: 'Condición insegura',
        area: insp.area,
        empresa: insp.empresa,
        descripcion: `Hallazgo en inspección "${insp.plantilla}" — punto ${idx + 1}: ${item.texto}.${item.comentario ? `\n${item.comentario}` : ''}`,
      };
    }
  }

  view.innerHTML = `
    <form id="f" class="card" novalidate>
      <div><h2>Reporte de observación</h2>
        <p class="hint">${origen ? `Generada desde la inspección ${esc(origen.inspeccionId)}` : 'Acto, condición o buena práctica observada en terreno.'}</p></div>

      <label class="field">Tipo de observación
        <select name="clase" required>
          ${['Acto inseguro', 'Condición insegura', 'Buena práctica'].map((c) => `<option ${pre.clase === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select></label>

      <div class="grid-2">
        <label class="field">Fecha y hora<input type="datetime-local" name="fecha" value="${ahoraLocal()}" required></label>
        <label class="field">Riesgo crítico asociado
          <select name="riesgo"><option value="">— Seleccionar —</option>${RIESGOS_CRITICOS.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>
        <label class="field">Área / frente de trabajo<input name="area" required value="${esc(pre.area)}" placeholder="Ej: Planta de filtros"></label>
        <label class="field">Empresa<input name="empresa" value="${esc(pre.empresa ?? cfg.empresa)}"></label>
      </div>

      <label class="field">Descripción de lo observado<textarea name="descripcion" required placeholder="¿Qué se observó? ¿Quién estaba expuesto?">${esc(pre.descripcion)}</textarea></label>

      <div id="bloque-riesgo" class="card" style="background:var(--surface-2)">
        <label class="field">Potencial de gravedad
          <select name="potencial"><option>Alto</option><option selected>Medio</option><option>Bajo</option></select></label>
        <label class="field">Acción inmediata realizada<textarea name="accionInmediata" placeholder="Ej: Se detuvo la tarea y se segregó el área"></textarea></label>
        <label class="field">Acción correctiva propuesta<textarea name="accionCorrectiva" placeholder="Qué se debe hacer para eliminar la causa"></textarea></label>
        <div class="grid-2">
          <label class="field">Responsable de la acción<input name="responsable" placeholder="Nombre / cargo"></label>
          <label class="field">Fecha compromiso<input type="date" name="fechaCompromiso" min="${hoy()}"></label>
        </div>
      </div>

      <div class="grid-2">
        <label class="field">Observador<input name="observador" required value="${esc(cfg.inspector)}"></label>
        <label class="field">RUT observador<input name="rut" required value="${esc(cfg.rut)}" placeholder="12.345.678-9"></label>
      </div>

      ${campoFotos('fotos')}
      ${campoFirma('Firma del observador (opcional)')}

      <button class="btn btn-ok btn-block" type="submit">Guardar observación</button>
    </form>`;

  const form = document.getElementById('f');
  bindRut(form.rut);
  bindFotos(document.getElementById('fotos'), fotos);
  const firma = bindFirma(form);

  const bloque = document.getElementById('bloque-riesgo');
  const toggle = () => { bloque.hidden = form.clase.value === 'Buena práctica'; };
  form.clase.addEventListener('change', toggle);
  toggle();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const positiva = form.clase.value === 'Buena práctica';
    const faltan = ['area', 'descripcion', 'observador', 'rut'].filter((n) => !form[n].value.trim());
    if (faltan.length) { form[faltan[0]].focus(); return toast('Completa los campos obligatorios.'); }
    if (!validarRut(form.rut.value)) { form.rut.focus(); return toast('RUT del observador no válido.'); }
    if (!positiva && !form.accionCorrectiva.value.trim() && !form.accionInmediata.value.trim()) {
      form.accionInmediata.focus();
      return toast('Indica al menos una acción (inmediata o correctiva).');
    }

    const rec = {
      id: uid('OBS'),
      tipo: 'observacion',
      fecha: new Date(form.fecha.value).toISOString(),
      clase: form.clase.value,
      riesgo: form.riesgo.value,
      area: form.area.value.trim(),
      empresa: form.empresa.value.trim(),
      descripcion: form.descripcion.value.trim(),
      potencial: positiva ? '' : form.potencial.value,
      accionInmediata: positiva ? '' : form.accionInmediata.value.trim(),
      accionCorrectiva: positiva ? '' : form.accionCorrectiva.value.trim(),
      responsable: positiva ? '' : form.responsable.value.trim(),
      fechaCompromiso: positiva ? '' : form.fechaCompromiso.value,
      observador: form.observador.value.trim(),
      rut: formatRut(form.rut.value),
      fotos,
      firma: firma.dataURL(),
      estado: positiva ? 'Cerrada' : 'Abierta',
      cierre: null,
      origen,
      synced: false,
      creado: new Date().toISOString(),
    };
    await DB.put(rec);

    if (origen) {
      const insp = await DB.get(origen.inspeccionId);
      if (insp) {
        insp.items[origen.item].observacionId = rec.id;
        insp.synced = false;
        await DB.put(insp);
      }
    }
    toast('✅ Observación guardada en el dispositivo.');
    location.hash = `#/registro/${rec.id}`;
  });
}

const filtros = { tipo: '', estado: '', texto: '' };

async function vistaRegistros() {
  const regs = await DB.all();
  view.innerHTML = `
    <section class="card">
      <h2>Registros</h2>
      <div class="filters">
        <select id="f-tipo">
          <option value="">Todos los tipos</option>
          <option value="inspeccion">Inspecciones</option>
          <option value="observacion">Observaciones</option>
        </select>
        <select id="f-estado">
          <option value="">Todos los estados</option>
          <option value="Abierta">Obs. abiertas</option>
          <option value="Vencida">Obs. vencidas</option>
          <option value="Cerrada">Obs. cerradas</option>
          <option value="nc">Inspecciones con no cumple</option>
          <option value="pend">No sincronizados</option>
        </select>
        <input id="f-texto" type="search" placeholder="Buscar por área, persona, riesgo…">
      </div>
      <p class="hint" id="conteo"></p>
    </section>
    <section class="list" id="lista"></section>`;

  const $tipo = document.getElementById('f-tipo');
  const $estado = document.getElementById('f-estado');
  const $texto = document.getElementById('f-texto');
  $tipo.value = filtros.tipo;
  $estado.value = filtros.estado;
  $texto.value = filtros.texto;

  const pintar = () => {
    filtros.tipo = $tipo.value;
    filtros.estado = $estado.value;
    filtros.texto = $texto.value;
    const q = filtros.texto.trim().toLowerCase();
    const lista = regs.filter((r) => {
      if (filtros.tipo && r.tipo !== filtros.tipo) return false;
      if (filtros.estado === 'pend' && r.synced) return false;
      if (filtros.estado === 'nc' && !(r.tipo === 'inspeccion' && r.items.some((i) => i.estado === 'NC'))) return false;
      if (['Abierta', 'Vencida', 'Cerrada'].includes(filtros.estado) && !(r.tipo === 'observacion' && estadoObs(r) === filtros.estado)) return false;
      if (q) {
        const hay = [r.id, r.area, r.empresa, r.inspector, r.observador, r.plantilla, r.riesgo, r.clase, r.descripcion, r.responsable].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    document.getElementById('conteo').textContent = `${lista.length} de ${regs.length} registros`;
    document.getElementById('lista').innerHTML = lista.map(tarjetaRegistro).join('') || '<p class="empty">Sin resultados.</p>';
  };
  [$tipo, $estado].forEach((el) => el.addEventListener('change', pintar));
  $texto.addEventListener('input', pintar);
  pintar();
}

async function vistaRegistro(id) {
  const r = await DB.get(id);
  if (!r) {
    view.innerHTML = '<section class="card"><p class="empty">Registro no encontrado.</p><a class="btn btn-ghost" href="#/registros">Volver</a></section>';
    return;
  }

  const fotosHtml = (fotos) => (fotos?.length ? `<div class="photos">${fotos.map((f, i) => `<div class="photo"><img src="${f}" alt="Foto ${i + 1}"></div>`).join('')}</div>` : '');
  const firmaHtml = (src, quien) => (src ? `<div><h3>Firma</h3><img class="sig-img" src="${src}" alt="Firma de ${esc(quien)}"></div>` : '');
  const sync = r.synced ? '<span class="tag tag-ok">Sincronizado</span>' : '<span class="tag">Pendiente de sincronizar</span>';

  let cuerpo;
  if (r.tipo === 'inspeccion') {
    cuerpo = `
      <section class="card">
        <div class="card-head"><div><h2>${esc(r.plantilla)}</h2><p class="hint">${esc(r.id)}</p></div>
          <span class="tag ${r.items.some((i) => i.estado === 'NC') ? 'tag-bad' : 'tag-ok'}">Cumplimiento ${r.cumplimiento ?? '—'}%</span></div>
        <dl class="kv">
          <dt>Fecha</dt><dd>${fmtFecha(r.fecha)} · Turno ${esc(r.turno)}</dd>
          <dt>Área</dt><dd>${esc(r.area)}</dd>
          <dt>Empresa</dt><dd>${esc(r.empresa) || '—'}</dd>
          <dt>Actividad</dt><dd>${esc(r.actividad) || '—'}</dd>
          <dt>Supervisor</dt><dd>${esc(r.responsable) || '—'}</dd>
          <dt>Inspector</dt><dd>${esc(r.inspector)} · ${esc(r.rut)}</dd>
          <dt>Estado</dt><dd>${sync}</dd>
        </dl>
      </section>
      <section class="card">
        <h3>Puntos de control</h3>
        <table class="items">${r.items.map((it, i) => `
          <tr><td>${i + 1}. ${esc(it.texto)}
            ${it.comentario ? `<div class="hint">↳ ${esc(it.comentario)}</div>` : ''}
            ${it.estado === 'NC' ? (it.observacionId
              ? `<div><a href="#/registro/${it.observacionId}" class="hint">Ver observación ${esc(it.observacionId)}</a></div>`
              : `<div class="no-print"><a class="btn btn-ghost btn-sm" style="margin-top:6px" href="#/observacion?desde=${r.id}&item=${i}">➕ Generar observación</a></div>`) : ''}
          </td><td>${{ C: '<span class="tag tag-ok">Cumple</span>', NC: '<span class="tag tag-bad">No cumple</span>', NA: '<span class="tag">N/A</span>' }[it.estado]}</td></tr>`).join('')}
        </table>
        ${r.comentarios ? `<div><h3>Comentarios</h3><p>${esc(r.comentarios)}</p></div>` : ''}
        ${fotosHtml(r.fotos)}
        ${firmaHtml(r.firma, r.inspector)}
      </section>`;
  } else {
    const est = estadoObs(r);
    cuerpo = `
      <section class="card">
        <div class="card-head"><div><h2>${esc(r.clase)}</h2><p class="hint">${esc(r.id)}</p></div>
          <div class="row">${tagEstado(est)} ${r.potencial ? tagPotencial(r.potencial) : ''}</div></div>
        <dl class="kv">
          <dt>Fecha</dt><dd>${fmtFecha(r.fecha)}</dd>
          <dt>Riesgo crítico</dt><dd>${esc(r.riesgo) || '—'}</dd>
          <dt>Área</dt><dd>${esc(r.area)}</dd>
          <dt>Empresa</dt><dd>${esc(r.empresa) || '—'}</dd>
          <dt>Observador</dt><dd>${esc(r.observador)} · ${esc(r.rut)}</dd>
          ${r.origen ? `<dt>Origen</dt><dd><a href="#/registro/${r.origen.inspeccionId}">Inspección ${esc(r.origen.inspeccionId)}</a></dd>` : ''}
          <dt>Sincronización</dt><dd>${sync}</dd>
        </dl>
        <div><h3>Descripción</h3><p style="white-space:pre-wrap">${esc(r.descripcion)}</p></div>
        ${r.clase !== 'Buena práctica' ? `
          <dl class="kv">
            <dt>Acción inmediata</dt><dd>${esc(r.accionInmediata) || '—'}</dd>
            <dt>Acción correctiva</dt><dd>${esc(r.accionCorrectiva) || '—'}</dd>
            <dt>Responsable</dt><dd>${esc(r.responsable) || '—'}</dd>
            <dt>Compromiso</dt><dd>${fmtDia(r.fechaCompromiso)}</dd>
          </dl>` : ''}
        ${fotosHtml(r.fotos)}
        ${firmaHtml(r.firma, r.observador)}
      </section>
      ${r.cierre ? `
        <section class="card">
          <h3>Cierre de la observación</h3>
          <dl class="kv"><dt>Fecha</dt><dd>${fmtFecha(r.cierre.fecha)}</dd><dt>Cerrada por</dt><dd>${esc(r.cierre.por) || '—'}</dd></dl>
          <p style="white-space:pre-wrap">${esc(r.cierre.comentario)}</p>
          ${fotosHtml(r.cierre.fotos)}
        </section>` : ''}
      ${est !== 'Cerrada' ? `
        <form id="f-cierre" class="card no-print" novalidate>
          <h3>Cerrar observación</h3>
          <label class="field">Evidencia / descripción del cierre<textarea name="comentario" required placeholder="Qué se hizo para corregir la desviación"></textarea></label>
          <label class="field">Cerrada por<input name="por" value="${esc(Settings.load().inspector)}"></label>
          ${campoFotos('fotos-cierre', 'Fotos de evidencia')}
          <button class="btn btn-ok btn-block" type="submit">Cerrar observación</button>
        </form>` : ''}`;
  }

  view.innerHTML = `
    <div class="row no-print">
      <a class="btn btn-ghost btn-sm" href="#/registros">← Registros</a>
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" id="btn-print">🖨️ PDF</button>
      <button class="btn btn-danger btn-sm" id="btn-del">Eliminar</button>
    </div>
    ${cuerpo}`;

  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-del').addEventListener('click', async () => {
    if (!confirm('¿Eliminar este registro del dispositivo? Esta acción no se puede deshacer.')) return;
    await DB.remove(r.id);
    toast('Registro eliminado.');
    location.hash = '#/registros';
  });

  const fc = document.getElementById('f-cierre');
  if (fc) {
    const fotosCierre = [];
    bindFotos(document.getElementById('fotos-cierre'), fotosCierre);
    fc.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!fc.comentario.value.trim()) { fc.comentario.focus(); return toast('Describe la evidencia de cierre.'); }
      await DB.put({
        ...r,
        estado: 'Cerrada',
        cierre: { fecha: new Date().toISOString(), comentario: fc.comentario.value.trim(), por: fc.por.value.trim(), fotos: fotosCierre },
        synced: false,
      });
      toast('✅ Observación cerrada.');
      router();
    });
  }
}

// ---------- Exportación ----------

function csv(filas) {
  const celda = (v) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Separador ";" y BOM para que Excel en configuración regional es-CL lo abra correctamente.
  return `﻿${filas.map((f) => f.map(celda).join(';')).join('\r\n')}`;
}

async function exportarInspecciones() {
  const regs = (await DB.all()).filter((r) => r.tipo === 'inspeccion');
  const filas = [['ID', 'Fecha', 'Turno', 'Lista', 'Área', 'Empresa', 'Actividad', 'Supervisor', 'Inspector', 'RUT', 'Punto', 'Resultado', 'Comentario', 'Cumplimiento %']];
  for (const r of regs) {
    for (const it of r.items) {
      filas.push([r.id, fmtFecha(r.fecha), r.turno, r.plantilla, r.area, r.empresa, r.actividad, r.responsable, r.inspector, r.rut,
        it.texto, { C: 'Cumple', NC: 'No cumple', NA: 'N/A' }[it.estado], it.comentario, r.cumplimiento ?? '']);
    }
  }
  descargar(`inspecciones_${hoy()}.csv`, csv(filas), 'text/csv;charset=utf-8');
}

async function exportarObservaciones() {
  const regs = (await DB.all()).filter((r) => r.tipo === 'observacion');
  const filas = [['ID', 'Fecha', 'Tipo', 'Riesgo crítico', 'Potencial', 'Área', 'Empresa', 'Descripción', 'Acción inmediata', 'Acción correctiva', 'Responsable', 'Fecha compromiso', 'Estado', 'Fecha cierre', 'Comentario cierre', 'Observador', 'RUT']];
  for (const r of regs) {
    filas.push([r.id, fmtFecha(r.fecha), r.clase, r.riesgo, r.potencial, r.area, r.empresa, r.descripcion, r.accionInmediata, r.accionCorrectiva,
      r.responsable, fmtDia(r.fechaCompromiso), estadoObs(r), r.cierre ? fmtFecha(r.cierre.fecha) : '', r.cierre?.comentario, r.observador, r.rut]);
  }
  descargar(`observaciones_${hoy()}.csv`, csv(filas), 'text/csv;charset=utf-8');
}

// ---------- Ajustes ----------

async function vistaAjustes() {
  const cfg = Settings.load();
  view.innerHTML = `
    <form id="f-cfg" class="card" novalidate>
      <h2>Datos del inspector</h2>
      <p class="hint">Se usan para completar automáticamente los formularios.</p>
      <div class="grid-2">
        <label class="field">Nombre<input name="inspector" value="${esc(cfg.inspector)}"></label>
        <label class="field">RUT<input name="rut" value="${esc(cfg.rut)}" placeholder="12.345.678-9"></label>
        <label class="field">Empresa<input name="empresa" value="${esc(cfg.empresa)}"></label>
      </div>
      <h2>Servidor de sincronización</h2>
      <p class="hint">Los registros pendientes se envían por POST como JSON <code>{"registros": [...]}</code>. Sin URL, los datos solo quedan en este dispositivo.</p>
      <label class="field">URL del endpoint<input name="endpoint" type="url" value="${esc(cfg.endpoint)}" placeholder="https://mi-servidor/api/registros"></label>
      <label class="field">Token (opcional)<input name="token" type="password" value="${esc(cfg.token)}" autocomplete="off"></label>
      <button class="btn btn-primary" type="submit">Guardar ajustes</button>
    </form>

    <section class="card">
      <h2>Exportar datos</h2>
      <div class="actions">
        <button class="btn btn-ghost" id="x-insp">📊 Inspecciones (CSV)</button>
        <button class="btn btn-ghost" id="x-obs">📊 Observaciones (CSV)</button>
        <button class="btn btn-ghost" id="x-json">💾 Respaldo completo</button>
        <label class="btn btn-ghost">📂 Restaurar respaldo<input type="file" id="x-import" accept="application/json,.json" hidden></label>
      </div>
    </section>

    <section class="card">
      <h2>Zona de riesgo</h2>
      <p class="hint">Borra todos los registros guardados en este dispositivo, incluidos los no sincronizados.</p>
      <button class="btn btn-danger" id="x-clear">Borrar todos los registros</button>
    </section>`;

  const f = document.getElementById('f-cfg');
  bindRut(f.rut);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (f.rut.value && !validarRut(f.rut.value)) { f.rut.focus(); return toast('RUT no válido.'); }
    Settings.save({
      inspector: f.inspector.value.trim(),
      rut: f.rut.value ? formatRut(f.rut.value) : '',
      empresa: f.empresa.value.trim(),
      endpoint: f.endpoint.value.trim(),
      token: f.token.value,
    });
    toast('Ajustes guardados.');
  });

  document.getElementById('x-insp').addEventListener('click', exportarInspecciones);
  document.getElementById('x-obs').addEventListener('click', exportarObservaciones);
  document.getElementById('x-json').addEventListener('click', async () => {
    const data = { app: 'control-operacional', version: 1, exportado: new Date().toISOString(), registros: await DB.all() };
    descargar(`respaldo_control_operacional_${hoy()}.json`, JSON.stringify(data), 'application/json');
  });
  document.getElementById('x-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const regs = Array.isArray(data.registros) ? data.registros.filter((r) => r && r.id && (r.tipo === 'inspeccion' || r.tipo === 'observacion')) : [];
      if (!regs.length) throw new Error('sin registros válidos');
      for (const r of regs) await DB.put(r);
      toast(`Restaurados ${regs.length} registros.`);
    } catch (err) {
      toast(`Archivo no válido (${err.message}).`);
    }
    e.target.value = '';
  });
  document.getElementById('x-clear').addEventListener('click', async () => {
    const pend = (await DB.all()).filter((r) => !r.synced).length;
    const aviso = pend ? `Hay ${pend} registros sin sincronizar que se perderán. ` : '';
    if (!confirm(`${aviso}¿Borrar todos los registros del dispositivo?`)) return;
    await DB.clear();
    toast('Registros eliminados.');
  });
}

// ---------- Router ----------

const RUTAS = {
  inicio: vistaInicio,
  inspeccion: vistaInspeccion,
  observacion: vistaObservacion,
  registros: vistaRegistros,
  registro: vistaRegistro,
  ajustes: vistaAjustes,
};

async function router() {
  const [ruta, qs = ''] = (location.hash.slice(2) || 'inicio').split('?');
  const [nombre, param] = ruta.split('/');
  const fn = RUTAS[nombre] || vistaInicio;
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const activo = a.dataset.route === nombre || (nombre === 'registro' && a.dataset.route === 'registros');
    a.classList.toggle('active', activo);
  });
  try {
    await fn(param ? decodeURIComponent(param) : undefined, new URLSearchParams(qs));
  } catch (err) {
    console.error(err);
    view.innerHTML = `<section class="card"><p class="empty">Ocurrió un error: ${esc(err.message)}</p></section>`;
  }
}

function estadoRed() {
  const el = document.getElementById('net-status');
  el.className = `pill ${navigator.onLine ? 'pill-ok' : 'pill-bad'}`;
  document.getElementById('net-text').textContent = navigator.onLine ? 'EN LÍNEA' : 'SIN CONEXIÓN';
}

window.addEventListener('hashchange', () => { router(); window.scrollTo(0, 0); });
window.addEventListener('online', estadoRed);
window.addEventListener('offline', estadoRed);
estadoRed();
router();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker no registrado:', err));
}

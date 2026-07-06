// ==========================================================================
// SIETE — app.js VERSIÓN 7 (con gráfica de días corregida)
// ==========================================================================

const FIREBASE_USUARIOS = "https://siete-1b82d-default-rtdb.firebaseio.com/usuarios_autorizados.json";
const FIREBASE_DELITOS  = "https://siete-1b82d-default-rtdb.firebaseio.com/delitos";

const formularioLogin     = document.getElementById('formulario-login');
const pantallaLogin       = document.getElementById('pantalla-login');
const contenidoPlataforma = document.getElementById('contenido-plataforma');
const mensajeError        = document.getElementById('error-login');
const btnCerrarSesion     = document.getElementById('btn-cerrar-sesion');

let mapa, capaActual, capaCalor;
let todosLosDelitos = {};
let registrosFiltrados = [];
let graficaModalidad, graficaTipo, graficaMes, graficaDia; // ← graficaDia agregada

const COLORES = {
    homicidios:         '#ef4444',
    lesiones:           '#f97316',
    hurto_personas:     '#eab308',
    hurto_residencias:  '#84cc16',
    hurto_comercio:     '#06b6d4',
    hurto_bancos:       '#8b5cf6',
    hurto_abigeato:     '#ec4899',
    hurto_automotores:  '#14b8a6',
    hurto_motocicletas: '#f59e0b',
    hurto_celulares:    '#3b82f6',
    hurto_bicicletas:   '#10b981',
    extorsion:          '#6366f1',
    secuestro:          '#dc2626',
    terrorismo:         '#1f2937',
};

const NOMBRES = {
    homicidios:         'Homicidios',
    lesiones:           'Lesiones Personales',
    hurto_personas:     'Hurto a Personas',
    hurto_residencias:  'Hurto Residencias',
    hurto_comercio:     'Hurto Comercio',
    hurto_bancos:       'Hurto Bancos',
    hurto_abigeato:     'Hurto Abigeato',
    hurto_automotores:  'Hurto Automotores',
    hurto_motocicletas: 'Hurto Motocicletas',
    hurto_celulares:    'Hurto Celulares',
    hurto_bicicletas:   'Hurto Bicicletas',
    extorsion:          'Extorsión',
    secuestro:          'Secuestro',
    terrorismo:         'Terrorismo',
};

const FILTRO_CONDUCTA = {
    homicidios: '103',
    lesiones:   '111',
};

const ORDEN_MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const ORDEN_DIAS = ['Lunes','Martes','Mi\u00e9rcoles','Jueves','Viernes','S\u00e1bado','Domingo'];


// ==========================================================================
// FORMATO
// ==========================================================================
function aNumero(valor) {
    if (valor === undefined || valor === null) return NaN;
    if (typeof valor === 'number') return valor;
    return parseFloat(String(valor).replace(',', '.'));
}

function aFecha(valor) {
    if (!valor) return null;
    const num = Number(valor);
    if (!isNaN(num) && num > 40000) {
        return new Date(Date.UTC(1899, 11, 30) + num * 86400000);
    }
    const f = new Date(valor);
    return isNaN(f) ? null : f;
}

function formatearFecha(valor) {
    if (!valor) return '';
    const num = Number(valor);
    if (!isNaN(num) && num > 40000) {
        const fecha = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
        return `${String(fecha.getUTCDate()).padStart(2,'0')}/${String(fecha.getUTCMonth()+1).padStart(2,'0')}/${fecha.getUTCFullYear()}`;
    }
    return valor;
}

function formatearHora(valor) {
    if (!valor) return '';
    const num = Number(valor);
    if (!isNaN(num) && num >= 0 && num < 1) {
        const totalMin = Math.round(num * 24 * 60);
        return `${String(Math.floor(totalMin/60)).padStart(2,'0')}:${String(totalMin%60).padStart(2,'0')}`;
    }
    return valor;
}

// ==========================================================================
// LOGIN
// ==========================================================================
formularioLogin.addEventListener('submit', async (event) => {
    event.preventDefault();
    const usuarioDigitado  = document.getElementById('usuario-nombre').value.trim();
    const passwordDigitado = document.getElementById('usuario-password').value.trim();
    mensajeError.innerText = "Conectando con SIETE...";
    try {
        const respuesta = await fetch(FIREBASE_USUARIOS);
        const usuariosBaseDatos = await respuesta.json();
        if (!usuariosBaseDatos) { mensajeError.innerText = "Error: Base de datos vacía."; return; }
        if (usuariosBaseDatos[usuarioDigitado]) {
            if (passwordDigitado === usuariosBaseDatos[usuarioDigitado].clave) {
                iniciarSistema();
            } else {
                mensajeError.innerText = "Contraseña incorrecta.";
            }
        } else {
            mensajeError.innerText = "El usuario no está autorizado.";
        }
    } catch (error) {
        console.error(error);
        mensajeError.innerText = "Error de conexión con Firebase.";
    }
});

// ==========================================================================
// INICIAR SISTEMA
// ==========================================================================
async function iniciarSistema() {
    pantallaLogin.style.display = 'none';
    contenidoPlataforma.style.display = 'flex';
    if (!mapa) {
        mapa = L.map('mapa').setView([6.2518, -75.5636], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapa);
        setTimeout(() => { mapa.invalidateSize(); }, 200);
    }
    mostrarNotificacion("⏳ Cargando datos desde Firebase...");
    await cargarTodosLosDelitos();
    aplicarFiltros();
    mostrarNotificacion("✅ Datos cargados correctamente");
}

// ==========================================================================
// CARGAR DATOS
// ==========================================================================
async function cargarTodosLosDelitos() {
    for (const tipo of Object.keys(COLORES)) {
        try {
            const datos = await (await fetch(`${FIREBASE_DELITOS}/${tipo}.json`)).json();
            todosLosDelitos[tipo] = datos ? Object.values(datos).filter(r => r !== null) : [];
            console.log(`✅ ${tipo}: ${todosLosDelitos[tipo].length} registros`);
        } catch (e) {
            todosLosDelitos[tipo] = [];
        }
    }
}

// ==========================================================================
// APLICAR FILTROS
// ==========================================================================
function aplicarFiltros() {
    const tipoSeleccionado     = document.getElementById('filtro-delito').value;
    const estacionSeleccionada = document.getElementById('filtro-estacion').value.toUpperCase().trim();
    const fechaInicio          = document.getElementById('filtro-fecha-inicio').value;
    const fechaFin             = document.getElementById('filtro-fecha-fin').value;
    const modoCalor            = document.getElementById('filtro-modo').value === 'calor';

    const dInicio = fechaInicio ? new Date(fechaInicio + 'T00:00:00Z') : null;
    const dFin    = fechaFin    ? new Date(fechaFin    + 'T23:59:59Z') : null;

    if (capaActual) { mapa.removeLayer(capaActual); capaActual = null; }
    if (capaCalor)  { mapa.removeLayer(capaCalor);  capaCalor  = null; }

    const tiposAMostrar = tipoSeleccionado === 'todos' ? Object.keys(COLORES) : [tipoSeleccionado];
    const puntosCalor = [];
    capaActual = L.layerGroup();
    registrosFiltrados = [];
    let totalPuntos = 0;

    for (const tipo of tiposAMostrar) {
        const registros = todosLosDelitos[tipo] || [];
        const color  = COLORES[tipo] || '#94a3b8';
        const nombre = NOMBRES[tipo] || tipo;
        const articuloFiltro = FILTRO_CONDUCTA[tipo] || null;

        for (const registro of registros) {
            if (!registro) continue;
            if (articuloFiltro) {
                const conducta = String(registro.DESCRIPCION_CONDUCTA || '').toUpperCase();
                if (!conducta.includes(articuloFiltro)) continue;
            }
            if (estacionSeleccionada) {
                const estacion = String(registro['JURIS_ESTACIÓN _ ÁREA'] || '').toUpperCase();
                if (!estacion.includes(estacionSeleccionada)) continue;
            }
            if (dInicio || dFin) {
                const fechaR = aFecha(registro.FECHA_HECHO);
                if (!fechaR) continue;
                if (dInicio && fechaR < dInicio) continue;
                if (dFin    && fechaR > dFin)    continue;
            }
            const lat = aNumero(registro.LATITUD || registro.LATITUD_HECHO);
            const lon = aNumero(registro.LONGITUD || registro.LONGITUD_HECHO);
            if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) continue;

            registrosFiltrados.push({ ...registro, _tipo: nombre, _color: color });

            if (modoCalor) {
                puntosCalor.push([lat, lon, 1]);
            } else {
                const circulo = L.circleMarker([lat, lon], {
                    radius: 5, fillColor: color, color: '#fff',
                    weight: 1, opacity: 0.9, fillOpacity: 0.8
                });
                circulo.bindPopup(construirPopup(registro, nombre, color), { maxWidth: 320 });
                capaActual.addLayer(circulo);
            }
            totalPuntos++;
        }
    }

    if (modoCalor && puntosCalor.length > 0) {
        capaCalor = L.heatLayer(puntosCalor, {
            radius: 20, blur: 25, maxZoom: 17,
            gradient: { 0.2: '#3b82f6', 0.4: '#10b981', 0.6: '#eab308', 0.8: '#f97316', 1.0: '#ef4444' }
        }).addTo(mapa);
    } else {
        capaActual.addTo(mapa);
    }

    mostrarNotificacion(`📍 ${totalPuntos.toLocaleString()} registros encontrados`);
}

// ==========================================================================
// POPUP
// ==========================================================================
function construirPopup(registro, nombreDelito, color) {
    const columnas = [
        'FECHA_HECHO','HORA_HECHO','DIA_SEMANA','MES',
        'DESCRIPCION_CONDUCTA','MODALIDAD','ARMAS_MEDIOS',
        'BARRIOS_HECHO','COMUNAS_ZONAS_DESCRIPCION','DIRECCION_HECHO',
        'JURIS_CAI','JURIS_ESTACIÓN _ ÁREA','ZONA',
        'GENERO','EDAD','ESTADO_CIVIL_PERSONA'
    ];
    let filas = '';
    for (const clave of columnas) {
        let valor = registro[clave];
        if (!valor || valor === 'null' || valor === 'None') continue;
        if (clave === 'FECHA_HECHO') valor = formatearFecha(valor);
        if (clave === 'HORA_HECHO')  valor = formatearHora(valor);
        filas += `<tr>
            <td style="font-weight:600;color:#94a3b8;padding:3px 8px 3px 0;font-size:0.72rem;white-space:nowrap;">${clave.replace(/_/g,' ').replace(' HECHO','')}</td>
            <td style="color:#e2e8f0;padding:3px 0;font-size:0.72rem;">${valor}</td>
        </tr>`;
    }
    return `<div style="background:#1e293b;color:white;border-radius:8px;min-width:240px;">
        <div style="background:${color};padding:8px 12px;border-radius:8px 8px 0 0;font-weight:bold;font-size:0.85rem;">🚨 ${nombreDelito}</div>
        <div style="padding:10px 12px;max-height:280px;overflow-y:auto;">
            <table style="border-collapse:collapse;width:100%;">${filas}</table>
        </div>
    </div>`;
}

// ==========================================================================
// PANEL DE ESTADÍSTICAS CON GRÁFICAS
// ==========================================================================
function abrirEstadisticas() {
    if (registrosFiltrados.length === 0) {
        mostrarNotificacion("⚠️ Primero aplica un filtro para ver estadísticas");
        return;
    }

    // ← PRIMERO calculamos todos los datos
    const porModalidad = {};
    const porTipo      = {};
    const porMes       = {};
    const porDia       = {};

    for (const r of registrosFiltrados) {
        const mod  = r.MODALIDAD  || 'SIN DATO';
        const tipo = r._tipo      || 'SIN DATO';
        const mes  = String(r.MES || '').toLowerCase().trim() || 'sin dato';
        const dia  = String(r.DIA_SEMANA || '').trim() || 'SIN DATO';

        porModalidad[mod]  = (porModalidad[mod]  || 0) + 1;
        porTipo[tipo]      = (porTipo[tipo]       || 0) + 1;
        porMes[mes]        = (porMes[mes]         || 0) + 1;
        porDia[dia]        = (porDia[dia]         || 0) + 1;
    }

    const modalidadOrdenada = Object.entries(porModalidad).sort((a,b) => b[1]-a[1]).slice(0,10);
    const mesesOrdenados    = ORDEN_MESES.filter(m => porMes[m]).map(m => [m, porMes[m]]);
    const diasOrdenados     = ORDEN_DIAS.map(d => [d, porDia[d] || 0]);

    // ← LUEGO creamos el panel HTML
    let panel = document.getElementById('panel-estadisticas');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'panel-estadisticas';
    panel.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:#1e293b; color:white; border-radius:12px;
        width:680px; max-width:96vw; max-height:90vh;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
        border:1px solid #334155; z-index:99999;
        display:flex; flex-direction:column; overflow:hidden;
    `;

    panel.innerHTML = `
        <div style="background:#0f172a;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #38bdf8;flex-shrink:0;">
            <div>
                <h2 style="margin:0;font-size:1.1rem;color:#38bdf8;">📊 Panel de Estadísticas</h2>
                <small style="color:#94a3b8;">${registrosFiltrados.length.toLocaleString()} registros filtrados</small>
            </div>
            <button onclick="document.getElementById('panel-estadisticas').remove()"
                style="background:#334155;border:none;color:white;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:1rem;">✕</button>
        </div>

        <div style="padding:12px 20px;display:flex;gap:10px;flex-shrink:0;border-bottom:1px solid #334155;">
            <button onclick="exportarExcel()" style="flex:1;background:#10b981;color:white;border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:bold;">📥 Exportar Excel</button>
            <button onclick="exportarPDF()"   style="flex:1;background:#ef4444;color:white;border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:bold;">📄 Exportar PDF</button>
        </div>

        <div style="overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:24px;">

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
                <div style="background:#0f172a;padding:14px;border-radius:8px;text-align:center;border-left:4px solid #38bdf8;">
                    <div style="font-size:1.8rem;font-weight:bold;color:#38bdf8;">${registrosFiltrados.length.toLocaleString()}</div>
                    <div style="font-size:0.75rem;color:#94a3b8;">Total Registros</div>
                </div>
                <div style="background:#0f172a;padding:14px;border-radius:8px;text-align:center;border-left:4px solid #10b981;">
                    <div style="font-size:1.8rem;font-weight:bold;color:#10b981;">${Object.keys(porModalidad).length}</div>
                    <div style="font-size:0.75rem;color:#94a3b8;">Modalidades</div>
                </div>
                <div style="background:#0f172a;padding:14px;border-radius:8px;text-align:center;border-left:4px solid #f97316;">
                    <div style="font-size:1.8rem;font-weight:bold;color:#f97316;">${Object.keys(porTipo).length}</div>
                    <div style="font-size:0.75rem;color:#94a3b8;">Tipos de Delito</div>
                </div>
            </div>

            <div style="background:#0f172a;padding:16px;border-radius:8px;">
                <h3 style="margin:0 0 12px;font-size:0.9rem;color:#cbd5e1;">🔹 Top 10 Modalidades</h3>
                <canvas id="graficaModalidad" height="200"></canvas>
            </div>

            <div style="background:#0f172a;padding:16px;border-radius:8px;">
                <h3 style="margin:0 0 12px;font-size:0.9rem;color:#cbd5e1;">🍕 Por Tipo de Delito</h3>
                <canvas id="graficaTipo" height="220"></canvas>
            </div>

            <div style="background:#0f172a;padding:16px;border-radius:8px;">
                <h3 style="margin:0 0 12px;font-size:0.9rem;color:#cbd5e1;">📈 Tendencia por Mes</h3>
                <canvas id="graficaMes" height="180"></canvas>
            </div>

            <div style="background:#0f172a;padding:16px;border-radius:8px;">
                <h3 style="margin:0 0 12px;font-size:0.9rem;color:#cbd5e1;">📅 Casos por Día de Semana</h3>
                <canvas id="graficaDia" height="160"></canvas>
            </div>

        </div>
    `;

    document.body.appendChild(panel);

    // ← Destruir gráficas anteriores
    if (graficaModalidad) graficaModalidad.destroy();
    if (graficaTipo)      graficaTipo.destroy();
    if (graficaMes)       graficaMes.destroy();
    if (graficaDia)       graficaDia.destroy();

    const opcionesBase = {
        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
        scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } },
            y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } }
        }
    };

    // GRÁFICA 1 — Barras horizontales por modalidad
    graficaModalidad = new Chart(document.getElementById('graficaModalidad'), {
        type: 'bar',
        data: {
            labels: modalidadOrdenada.map(([k]) => k.length > 20 ? k.slice(0,20)+'…' : k),
            datasets: [{ label: 'Casos', data: modalidadOrdenada.map(([,v]) => v), backgroundColor: '#38bdf8', borderRadius: 4 }]
        },
        options: { ...opcionesBase, plugins: { legend: { display: false } }, indexAxis: 'y' }
    });

    // GRÁFICA 2 — Torta por tipo de delito
    const tiposEntradas = Object.entries(porTipo);
    graficaTipo = new Chart(document.getElementById('graficaTipo'), {
        type: 'doughnut',
        data: {
            labels: tiposEntradas.map(([k]) => k),
            datasets: [{
                data: tiposEntradas.map(([,v]) => v),
                backgroundColor: tiposEntradas.map(([k]) => COLORES[Object.keys(NOMBRES).find(n => NOMBRES[n]===k)] || '#94a3b8'),
                borderWidth: 2, borderColor: '#0f172a'
            }]
        },
        options: { plugins: { legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 10 }, boxWidth: 12 } } } }
    });

    // GRÁFICA 3 — Línea de tiempo por mes
    graficaMes = new Chart(document.getElementById('graficaMes'), {
        type: 'line',
        data: {
            labels: mesesOrdenados.map(([m]) => m.toUpperCase()),
            datasets: [{
                label: 'Casos por mes',
                data: mesesOrdenados.map(([,v]) => v),
                borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)',
                pointBackgroundColor: '#38bdf8', pointRadius: 5, fill: true, tension: 0.3
            }]
        },
        options: opcionesBase
    });

    // GRÁFICA 4 — Barras por día de semana con colores
    graficaDia = new Chart(document.getElementById('graficaDia'), {
        type: 'bar',
        data: {
            labels: diasOrdenados.map(([d]) => d),
            datasets: [{
                label: 'Casos',
                data: diasOrdenados.map(([,v]) => v),
                backgroundColor: ['#ef4444','#f97316','#eab308','#10b981','#3b82f6','#8b5cf6','#ec4899'],
                borderRadius: 4,
            }]
        },
        options: { ...opcionesBase, plugins: { legend: { display: false } } }
    });
}

// ==========================================================================
// EXPORTAR EXCEL
// ==========================================================================
function exportarExcel() {
    if (registrosFiltrados.length === 0) { mostrarNotificacion("⚠️ No hay datos para exportar"); return; }
    const columnas = Object.keys(registrosFiltrados[0]).filter(c => !c.startsWith('_'));
    let csv = columnas.join(';') + '\n';
    for (const r of registrosFiltrados) {
        const fila = columnas.map(col => {
            let val = r[col] ?? '';
            if (col === 'FECHA_HECHO') val = formatearFecha(val);
            if (col === 'HORA_HECHO')  val = formatearHora(val);
            return `"${String(val).replace(/"/g,'""')}"`;
        });
        csv += fila.join(';') + '\n';
    }
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `SIETE_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    mostrarNotificacion("✅ Excel descargado");
}

// ==========================================================================
// EXPORTAR PDF
// ==========================================================================
function exportarPDF() {
    if (registrosFiltrados.length === 0) { mostrarNotificacion("⚠️ No hay datos para exportar"); return; }
    const porModalidad = {};
    const porDia = {};
    for (const r of registrosFiltrados) {
        const mod = r.MODALIDAD  || 'SIN DATO';
        const dia = r.DIA_SEMANA || 'SIN DATO';
        porModalidad[mod] = (porModalidad[mod] || 0) + 1;
        porDia[dia]       = (porDia[dia]       || 0) + 1;
    }
    const filasM = Object.entries(porModalidad).sort((a,b)=>b[1]-a[1])
        .map(([k,v]) => `<tr><td>${k}</td><td style="text-align:right">${v}</td></tr>`).join('');
    const filasD = ORDEN_DIAS.map(d => `<tr><td>${d}</td><td style="text-align:right">${porDia[d]||0}</td></tr>`).join('');

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SIETE - Reporte</title>
    <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#1e293b;}
        h1{color:#0f172a;border-bottom:3px solid #38bdf8;padding-bottom:10px;}
        h2{color:#334155;margin-top:25px;font-size:1rem;}
        table{width:100%;border-collapse:collapse;margin-top:10px;font-size:0.85rem;}
        th{background:#1e293b;color:white;padding:8px 12px;text-align:left;}
        td{padding:6px 12px;border-bottom:1px solid #e2e8f0;}
        tr:nth-child(even){background:#f8fafc;}
        .cards{display:flex;gap:15px;margin:20px 0;}
        .card{background:#0f172a;color:white;padding:15px;border-radius:8px;text-align:center;flex:1;}
        .num{font-size:2rem;font-weight:bold;color:#38bdf8;}
        .pie{margin-top:30px;font-size:0.75rem;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;}
    </style></head><body>
    <h1>🛡️ SIETE — Reporte de Delitos</h1>
    <p>Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}</p>
    <div class="cards">
        <div class="card"><div class="num">${registrosFiltrados.length}</div>Total</div>
        <div class="card"><div class="num">${Object.keys(porModalidad).length}</div>Modalidades</div>
        <div class="card"><div class="num">${Object.keys(porDia).length}</div>Días con casos</div>
    </div>
    <h2>Por Modalidad</h2>
    <table><tr><th>Modalidad</th><th style="text-align:right">Casos</th></tr>${filasM}</table>
    <h2>Por Día de Semana</h2>
    <table><tr><th>Día</th><th style="text-align:right">Casos</th></tr>${filasD}</table>
    <div class="pie">Sistema de Información Estadístico Territorial — SIETE</div>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>`);
    w.document.close();
}

// ==========================================================================
// NOTIFICACIONES
// ==========================================================================
function mostrarNotificacion(mensaje) {
    let notif = document.getElementById('notificacion-mapa');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'notificacion-mapa';
        notif.style.cssText = `position:fixed;bottom:20px;right:20px;background:#1e293b;color:white;
            padding:10px 16px;border-radius:8px;font-size:0.85rem;font-weight:600;
            box-shadow:0 4px 12px rgba(0,0,0,0.3);border-left:4px solid #38bdf8;
            z-index:9999;transition:opacity 0.3s;`;
        document.body.appendChild(notif);
    }
    notif.innerText = mensaje;
    notif.style.opacity = '1';
    clearTimeout(notif._timeout);
    notif._timeout = setTimeout(() => { notif.style.opacity = '0'; }, 4000);
}

// ==========================================================================
// CERRAR SESIÓN
// ==========================================================================
btnCerrarSesion.addEventListener('click', () => {
    contenidoPlataforma.style.display = 'none';
    pantallaLogin.style.display = 'flex';
    formularioLogin.reset();
    mensajeError.innerText = "";
    if (capaActual) { mapa.removeLayer(capaActual); capaActual = null; }
    if (capaCalor)  { mapa.removeLayer(capaCalor);  capaCalor  = null; }
});

// ==========================================================================
// LIMPIAR FILTROS
// ==========================================================================
function limpiarFiltros() {
    document.getElementById('filtro-delito').value = 'todos';
    document.getElementById('filtro-fecha-inicio').value = '';
    document.getElementById('filtro-fecha-fin').value = '';
    document.getElementById('filtro-estacion').value = '';
    document.getElementById('filtro-modo').value = 'puntos';
    aplicarFiltros();
}

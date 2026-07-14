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
const ORDEN_DIAS  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

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

// ==========================================================================
// MÓDULO DE PREDICCIONES
// Analiza el historial de todos los delitos y predice por estación
// ==========================================================================
function abrirPredicciones() {
    if (Object.keys(todosLosDelitos).length === 0) {
        mostrarNotificacion("⚠️ Espera a que carguen los datos primero");
        return;
    }

    mostrarNotificacion("🔄 Calculando predicciones...");

    // Recopilar TODOS los registros de todas las hojas
    const todos = [];
    for (const [tipo, registros] of Object.entries(todosLosDelitos)) {
        const artFiltro = FILTRO_CONDUCTA[tipo] || null;
        for (const r of registros) {
            if (!r) continue;
            if (artFiltro) {
                const conducta = String(r.DESCRIPCION_CONDUCTA || '').toUpperCase();
                if (!conducta.includes(artFiltro)) continue;
            }
            todos.push({ ...r, _tipo: NOMBRES[tipo] || tipo });
        }
    }

    // Agrupar por estación
    const porEstacion = {};
    for (const r of todos) {
        const estacion = String(r['JURIS_ESTACIÓN _ ÁREA'] || 'SIN ESTACIÓN').trim();
        if (!porEstacion[estacion]) porEstacion[estacion] = [];
        porEstacion[estacion].push(r);
    }

    // Calcular predicción por estación
    const predicciones = [];
    for (const [estacion, registros] of Object.entries(porEstacion)) {
        if (estacion === 'SIN ESTACIÓN' || estacion === 'TOTAL') continue;

        const dias    = {};
        const horas   = {};
        const meses   = {};
        const tipos   = {};

        for (const r of registros) {
            const dia  = String(r.DIA_SEMANA || '').trim();
            const mes  = String(r.MES || '').toLowerCase().trim();
            const tipo = r._tipo || 'SIN DATO';
            const horaVal = Number(r.HORA_HECHO);
            let bloque = 'SIN DATO';
            if (!isNaN(horaVal) && horaVal >= 0 && horaVal < 1) {
                const h = Math.floor(horaVal * 24);
                if (h >= 0  && h < 6)  bloque = '🌙 00:00 - 05:59 (Madrugada)';
                else if (h >= 6  && h < 12) bloque = '🌅 06:00 - 11:59 (Mañana)';
                else if (h >= 12 && h < 18) bloque = '☀️ 12:00 - 17:59 (Tarde)';
                else                         bloque = '🌆 18:00 - 23:59 (Noche)';
            }

            if (dia)   dias[dia]     = (dias[dia]     || 0) + 1;
            if (mes)   meses[mes]    = (meses[mes]    || 0) + 1;
            if (bloque !== 'SIN DATO') horas[bloque] = (horas[bloque] || 0) + 1;
            tipos[tipo] = (tipos[tipo] || 0) + 1;
        }

        const maxDia   = Object.entries(dias).sort((a,b)=>b[1]-a[1])[0];
        const maxHora  = Object.entries(horas).sort((a,b)=>b[1]-a[1])[0];
        const maxMes   = Object.entries(meses).sort((a,b)=>b[1]-a[1])[0];
        const maxTipo  = Object.entries(tipos).sort((a,b)=>b[1]-a[1])[0];

        // Nivel de riesgo basado en total de casos
        const total = registros.length;
        let nivel = '🟢 Bajo';
        let colorNivel = '#10b981';
        if (total > 3000) { nivel = '🔴 Alto';  colorNivel = '#ef4444'; }
        else if (total > 1000) { nivel = '🟡 Medio'; colorNivel = '#eab308'; }

        predicciones.push({
            estacion,
            total,
            nivel,
            colorNivel,
            diaPeligroso:  maxDia  ? `${maxDia[0]} (${maxDia[1]} casos)`   : 'Sin dato',
            horaPeligrosa: maxHora ? `${maxHora[0]} (${maxHora[1]} casos)` : 'Sin dato',
            mesPeligroso:  maxMes  ? `${maxMes[0].toUpperCase()} (${maxMes[1]} casos)` : 'Sin dato',
            delitoPrincipal: maxTipo ? `${maxTipo[0]} (${maxTipo[1]} casos)` : 'Sin dato',
        });
    }

    // Ordenar por total de casos (mayor riesgo primero)
    predicciones.sort((a,b) => b.total - a.total);

    // Construir panel
    let panel = document.getElementById('panel-predicciones');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'panel-predicciones';
    panel.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:#1e293b; color:white; border-radius:12px;
        width:780px; max-width:96vw; max-height:90vh;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
        border:1px solid #334155; z-index:99999;
        display:flex; flex-direction:column; overflow:hidden;
    `;

    const filasHTML = predicciones.map(p => `
        <tr style="border-bottom:1px solid #334155;">
            <td style="padding:10px 12px;font-weight:600;font-size:0.82rem;white-space:nowrap;">${p.estacion.replace('ESTACION ','')}</td>
            <td style="padding:10px 12px;text-align:center;">
                <span style="background:${p.colorNivel}22;color:${p.colorNivel};padding:3px 8px;border-radius:20px;font-size:0.78rem;font-weight:bold;">${p.nivel}</span>
            </td>
            <td style="padding:10px 12px;text-align:center;font-weight:bold;color:#38bdf8;">${p.total.toLocaleString()}</td>
            <td style="padding:10px 12px;font-size:0.8rem;color:#cbd5e1;">${p.diaPeligroso}</td>
            <td style="padding:10px 12px;font-size:0.8rem;color:#cbd5e1;">${p.horaPeligrosa}</td>
            <td style="padding:10px 12px;font-size:0.8rem;color:#cbd5e1;">${p.mesPeligroso}</td>
            <td style="padding:10px 12px;font-size:0.8rem;color:#f97316;">${p.delitoPrincipal}</td>
        </tr>
    `).join('');

    panel.innerHTML = `
        <div style="background:#0f172a;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #6366f1;flex-shrink:0;">
            <div>
                <h2 style="margin:0;font-size:1.1rem;color:#6366f1;">🔮 Panel de Predicciones por Estación</h2>
                <small style="color:#94a3b8;">Basado en ${todos.length.toLocaleString()} registros históricos de 2022</small>
            </div>
            <button onclick="document.getElementById('panel-predicciones').remove()"
                style="background:#334155;border:none;color:white;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:1rem;">✕</button>
        </div>

        <div style="padding:12px 20px;background:#0f172a;flex-shrink:0;border-bottom:1px solid #334155;">
            <p style="margin:0;font-size:0.82rem;color:#94a3b8;">
                💡 Esta tabla muestra para cada estación: el día, hora y mes con más casos históricos, 
                el delito más frecuente y el nivel de riesgo general. 
                Úsala para orientar patrullajes y operativos preventivos.
            </p>
        </div>

        <div style="overflow:auto;flex:1;">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;min-width:700px;">
                <thead style="position:sticky;top:0;background:#0f172a;z-index:1;">
                    <tr>
                        <th style="padding:10px 12px;text-align:left;color:#38bdf8;border-bottom:2px solid #334155;">Estación</th>
                        <th style="padding:10px 12px;text-align:center;color:#38bdf8;border-bottom:2px solid #334155;">Riesgo</th>
                        <th style="padding:10px 12px;text-align:center;color:#38bdf8;border-bottom:2px solid #334155;">Total Casos</th>
                        <th style="padding:10px 12px;color:#38bdf8;border-bottom:2px solid #334155;">Día más peligroso</th>
                        <th style="padding:10px 12px;color:#38bdf8;border-bottom:2px solid #334155;">Hora de mayor riesgo</th>
                        <th style="padding:10px 12px;color:#38bdf8;border-bottom:2px solid #334155;">Mes más crítico</th>
                        <th style="padding:10px 12px;color:#38bdf8;border-bottom:2px solid #334155;">Delito principal</th>
                    </tr>
                </thead>
                <tbody>${filasHTML}</tbody>
            </table>
        </div>

        <div style="padding:12px 20px;background:#0f172a;flex-shrink:0;border-top:1px solid #334155;display:flex;gap:16px;">
            <span style="font-size:0.78rem;color:#94a3b8;">🔴 Alto: más de 3,000 casos</span>
            <span style="font-size:0.78rem;color:#94a3b8;">🟡 Medio: 1,000 - 3,000 casos</span>
            <span style="font-size:0.78rem;color:#94a3b8;">🟢 Bajo: menos de 1,000 casos</span>
        </div>
    `;

    document.body.appendChild(panel);
    mostrarNotificacion("✅ Predicciones calculadas");
}

// ==========================================================================
// CONSULTOR DE RIESGO POR FECHA Y ESTACIÓN
// El usuario ingresa fecha + estación y el sistema muestra nivel de alerta
// basado en el historial de ese día de semana y mes
// ==========================================================================
function abrirConsultorRiesgo() {
    if (Object.keys(todosLosDelitos).length === 0) {
        mostrarNotificacion("⚠️ Espera a que carguen los datos primero");
        return;
    }

    let panel = document.getElementById('panel-consultor');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'panel-consultor';
    panel.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:#1e293b; color:white; border-radius:12px;
        width:600px; max-width:96vw; max-height:90vh;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
        border:1px solid #334155; z-index:99999;
        display:flex; flex-direction:column; overflow:hidden;
    `;

    // Lista de estaciones para el selector
    const estaciones = [
        "ESTACION ARANJUEZ","ESTACION BARBOSA","ESTACION BELEN","ESTACION BELLO",
        "ESTACION BUENOS AIRES","ESTACION CALDAS","ESTACION CANDELARIA","ESTACION CASTILLA",
        "ESTACION COPACABANA","ESTACION DOCE DE OCTUBRE","ESTACION ENVIGADO","ESTACION GIRARDOTA",
        "ESTACION ITAGUI","ESTACION LA ESTRELLA","ESTACION LAURELES","ESTACION MANRIQUE",
        "ESTACION POBLADO","ESTACION POPULAR","ESTACION SABANETA","ESTACION SAN ANTONIO DE PRADO",
        "ESTACION SAN JAVIER","ESTACION SANTA CRUZ","ESTACION VILLA HERMOSA"
    ];

    const opcionesEstacion = estaciones.map(e =>
        `<option value="${e}">${e.replace('ESTACION ','Estación ')}</option>`
    ).join('');

    panel.innerHTML = `
        <!-- HEADER -->
        <div style="background:#0f172a;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #6366f1;flex-shrink:0;">
            <div>
                <h2 style="margin:0;font-size:1.1rem;color:#6366f1;">🎯 Consultor de Riesgo por Fecha</h2>
                <small style="color:#94a3b8;">Basado en historial 2022 — orientativo para patrullaje</small>
            </div>
            <button onclick="document.getElementById('panel-consultor').remove()"
                style="background:#334155;border:none;color:white;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:1rem;">✕</button>
        </div>

        <!-- FORMULARIO -->
        <div style="padding:20px;display:flex;flex-direction:column;gap:14px;background:#0f172a;flex-shrink:0;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:6px;">📅 Fecha a consultar</label>
                    <input type="date" id="consultor-fecha"
                        style="width:100%;padding:10px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:white;font-size:0.9rem;">
                </div>
                <div>
                    <label style="color:#94a3b8;font-size:0.8rem;display:block;margin-bottom:6px;">🚔 Estación</label>
                    <select id="consultor-estacion"
                        style="width:100%;padding:10px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:white;font-size:0.85rem;">
                        ${opcionesEstacion}
                    </select>
                </div>
            </div>
            <button onclick="calcularRiesgo()"
                style="background:#6366f1;color:white;border:none;padding:12px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:1rem;">
                🔍 Calcular Nivel de Riesgo
            </button>
        </div>

        <!-- RESULTADO -->
        <div id="resultado-consultor" style="overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px;">
            <p style="color:#475569;text-align:center;margin-top:20px;">
                Selecciona una fecha y estación para ver el análisis de riesgo.
            </p>
        </div>
    `;

    document.body.appendChild(panel);

    // Poner fecha de hoy por defecto
    const hoy = new Date().toISOString().slice(0,10);
    document.getElementById('consultor-fecha').value = hoy;
}

function calcularRiesgo() {
    const fechaStr    = document.getElementById('consultor-fecha').value;
    const estacionVal = document.getElementById('consultor-estacion').value;

    if (!fechaStr) {
        mostrarNotificacion("⚠️ Selecciona una fecha");
        return;
    }

    const fecha   = new Date(fechaStr + 'T12:00:00');
    const diasES  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const mesesES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const diaConsulta = diasES[fecha.getDay()];
    const mesConsulta = mesesES[fecha.getMonth()];
    const fechaFormateada = fecha.toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    // Recopilar registros de esa estación
    const registrosEstacion = [];
    for (const [tipo, registros] of Object.entries(todosLosDelitos)) {
        const artFiltro = FILTRO_CONDUCTA[tipo] || null;
        for (const r of registros) {
            if (!r) continue;
            if (artFiltro) {
                const conducta = String(r.DESCRIPCION_CONDUCTA || '').toUpperCase();
                if (!conducta.includes(artFiltro)) continue;
            }
            const est = String(r['JURIS_ESTACIÓN _ ÁREA'] || '').toUpperCase();
            if (est.includes(estacionVal.replace('ESTACION ',''))) {
                registrosEstacion.push({ ...r, _tipo: NOMBRES[tipo] || tipo });
            }
        }
    }

    if (registrosEstacion.length === 0) {
        document.getElementById('resultado-consultor').innerHTML =
            '<p style="color:#ef4444;text-align:center;">No hay datos históricos para esta estación.</p>';
        return;
    }

    // Calcular riesgo por tipo de delito para ese día y mes
    const analisisPorTipo = {};
    const totalPorTipo    = {};

    for (const r of registrosEstacion) {
        const tipo = r._tipo || 'SIN DATO';
        if (!totalPorTipo[tipo]) totalPorTipo[tipo] = { total: 0, porDia: {}, porMes: {} };
        totalPorTipo[tipo].total++;

        const dia = String(r.DIA_SEMANA || '').trim();
        const mes = String(r.MES || '').toLowerCase().trim();
        if (dia) totalPorTipo[tipo].porDia[dia] = (totalPorTipo[tipo].porDia[dia] || 0) + 1;
        if (mes) totalPorTipo[tipo].porMes[mes] = (totalPorTipo[tipo].porMes[mes] || 0) + 1;
    }

    // Para cada tipo calcular score de riesgo para ese día y mes
    for (const [tipo, datos] of Object.entries(totalPorTipo)) {
        const casosDia = datos.porDia[diaConsulta] || 0;
        const casosMes = datos.porMes[mesConsulta]  || 0;
        const promDia  = datos.total / 7;
        const promMes  = datos.total / 12;

        // Score: qué tan por encima del promedio está ese día y mes
        const scoreDia = promDia > 0 ? casosDia / promDia : 0;
        const scoreMes = promMes > 0 ? casosMes / promMes : 0;
        const scoreTotal = (scoreDia * 0.6) + (scoreMes * 0.4); // día pesa más

        let nivel = 'BAJO';
        let color = '#10b981';
        let icono = '🟢';
        let recomendacion = 'Riesgo bajo. Patrullaje normal.';

        if (scoreTotal >= 1.3) {
            nivel = 'ALTO'; color = '#ef4444'; icono = '🔴';
            recomendacion = 'Riesgo elevado. Reforzar patrullaje y vigilancia en esta zona.';
        } else if (scoreTotal >= 0.9) {
            nivel = 'MEDIO'; color = '#eab308'; icono = '🟡';
            recomendacion = 'Riesgo moderado. Mantener atención especial en horarios pico.';
        }

        analisisPorTipo[tipo] = {
            nivel, color, icono, recomendacion,
            casosDia, casosMes, total: datos.total, scoreTotal,
            mejorHora: Object.entries(
                registrosEstacion
                    .filter(r => r._tipo === tipo)
                    .reduce((acc, r) => {
                        const h = Number(r.HORA_HECHO);
                        let bloque = 'Sin dato';
                        if (!isNaN(h) && h >= 0 && h < 1) {
                            const hr = Math.floor(h * 24);
                            if (hr < 6)       bloque = '🌙 Madrugada (00-06h)';
                            else if (hr < 12) bloque = '🌅 Mañana (06-12h)';
                            else if (hr < 18) bloque = '☀️ Tarde (12-18h)';
                            else              bloque = '🌆 Noche (18-24h)';
                        }
                        acc[bloque] = (acc[bloque] || 0) + 1;
                        return acc;
                    }, {})
            ).sort((a,b) => b[1]-a[1])[0]?.[0] || 'Sin dato'
        };
    }

    // Ordenar por score de riesgo
    const ordenado = Object.entries(analisisPorTipo).sort((a,b) => b[1].scoreTotal - a[1].scoreTotal);

    // Nivel general de la estación ese día
    const nivelGeneral = ordenado[0]?.[1]?.nivel || 'BAJO';
    const colorGeneral = ordenado[0]?.[1]?.color || '#10b981';
    const iconoGeneral = ordenado[0]?.[1]?.icono || '🟢';

    const tarjetasHTML = ordenado.map(([tipo, datos]) => `
        <div style="background:#0f172a;border-radius:8px;padding:14px;border-left:4px solid ${datos.color};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:bold;font-size:0.9rem;">${datos.icono} ${tipo}</span>
                <span style="background:${datos.color}22;color:${datos.color};padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:bold;">
                    ${datos.nivel}
                </span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                <div style="text-align:center;background:#1e293b;padding:8px;border-radius:6px;">
                    <div style="font-size:1.3rem;font-weight:bold;color:#38bdf8;">${datos.casosDia}</div>
                    <div style="font-size:0.7rem;color:#94a3b8;">Casos en ${diaConsulta}s históricos</div>
                </div>
                <div style="text-align:center;background:#1e293b;padding:8px;border-radius:6px;">
                    <div style="font-size:1.3rem;font-weight:bold;color:#38bdf8;">${datos.casosMes}</div>
                    <div style="font-size:0.7rem;color:#94a3b8;">Casos en ${mesConsulta.toUpperCase()} histórico</div>
                </div>
                <div style="text-align:center;background:#1e293b;padding:8px;border-radius:6px;">
                    <div style="font-size:1.3rem;font-weight:bold;color:#38bdf8;">${datos.total}</div>
                    <div style="font-size:0.7rem;color:#94a3b8;">Total histórico</div>
                </div>
            </div>
            <div style="font-size:0.78rem;color:#94a3b8;">
                ⏰ Hora de mayor riesgo histórico: <span style="color:#f97316;font-weight:bold;">${datos.mejorHora}</span>
            </div>
            <div style="font-size:0.78rem;color:#94a3b8;margin-top:4px;">
                💡 ${datos.recomendacion}
            </div>
        </div>
    `).join('');

    document.getElementById('resultado-consultor').innerHTML = `
        <!-- ENCABEZADO RESULTADO -->
        <div style="background:#0f172a;border-radius:8px;padding:16px;border:2px solid ${colorGeneral};text-align:center;">
            <div style="font-size:2rem;margin-bottom:4px;">${iconoGeneral}</div>
            <div style="font-size:1.1rem;font-weight:bold;color:${colorGeneral};">ALERTA ${nivelGeneral}</div>
            <div style="font-size:0.85rem;color:#cbd5e1;margin-top:4px;text-transform:capitalize;">${fechaFormateada}</div>
            <div style="font-size:0.8rem;color:#94a3b8;margin-top:2px;">${estacionVal.replace('ESTACION','Estación')}</div>
        </div>

        <!-- TARJETAS POR DELITO -->
        <div style="display:flex;flex-direction:column;gap:10px;">
            ${tarjetasHTML}
        </div>

        <!-- NOTA -->
        <div style="background:#0f172a;border-radius:8px;padding:12px;border-left:4px solid #475569;">
            <p style="margin:0;font-size:0.75rem;color:#64748b;">
                ⚠️ Este análisis es orientativo y se basa en patrones históricos de 2022. 
                No garantiza la ocurrencia de delitos. Úselo como apoyo para decisiones de patrullaje preventivo.
            </p>
        </div>
    `;
}

// ==========================================================================
// MÓDULO DE CAPAS GEOGRÁFICAS — Comunas y AMVA
// ==========================================================================
let capasComunas = null;
let capasAMVA = null;
let comunasVisibles = false;
let amvaVisible = false;

const COLORES_COMUNAS = [
    '#ef4444','#f97316','#eab308','#84cc16','#10b981',
    '#06b6d4','#3b82f6','#8b5cf6','#ec4899','#14b8a6',
    '#f59e0b','#6366f1','#dc2626','#0ea5e9','#65a30d','#d946ef'
];

async function toggleComunas() {
    const btn = document.getElementById('btn-comunas');

    if (comunasVisibles) {
        if (capasComunas) mapa.removeLayer(capasComunas);
        comunasVisibles = false;
        btn.style.background = '#334155';
        btn.innerText = '🗺️ Ver Comunas';
        return;
    }

    if (!capasComunas) {
        mostrarNotificacion("⏳ Cargando comunas...");
        try {
            const resp = await fetch('https://geo-data-col.github.io/siete/comunas_medellin.geojson');
            const data = await resp.json();

            let colorIndex = 0;
            capasComunas = L.geoJSON(data, {
                style: (feature) => ({
                    fillColor: COLORES_COMUNAS[colorIndex++ % COLORES_COMUNAS.length],
                    weight: 2,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: 0.25
                }),
                onEachFeature: (feature, layer) => {
                    const nombre = feature.properties.Nombre_Com || 'Sin nombre';
                    const numero = feature.properties.Numero_Com || '';
                    layer.bindPopup(`
                        <div style="background:#1e293b;color:white;padding:10px;border-radius:8px;min-width:150px;">
                            <div style="font-weight:bold;font-size:1rem;color:#38bdf8;">Comuna ${numero}</div>
                            <div style="font-size:0.9rem;margin-top:4px;">${nombre}</div>
                        </div>
                    `);
                    layer.on('mouseover', function() {
                        this.setStyle({ fillOpacity: 0.5, weight: 3 });
                    });
                    layer.on('mouseout', function() {
                        this.setStyle({ fillOpacity: 0.25, weight: 2 });
                    });
                }
            });
            mostrarNotificacion("✅ Comunas cargadas");
        } catch (e) {
            mostrarNotificacion("❌ Error cargando comunas");
            return;
        }
    }

    capasComunas.addTo(mapa);
    comunasVisibles = true;
    btn.style.background = '#10b981';
    btn.innerText = '✅ Ocultar Comunas';
}

async function toggleAMVA() {
    const btn = document.getElementById('btn-amva');

    if (amvaVisible) {
        if (capasAMVA) mapa.removeLayer(capasAMVA);
        amvaVisible = false;
        btn.style.background = '#334155';
        btn.innerText = '🏙️ Ver AMVA';
        return;
    }

    if (!capasAMVA) {
        mostrarNotificacion("⏳ Cargando municipios AMVA...");
        try {
            const resp = await fetch('https://geo-data-col.github.io/siete/amva_municipios.geojson');
            const data = await resp.json();

            capasAMVA = L.geoJSON(data, {
                style: () => ({
                    fillColor: '#6366f1',
                    weight: 2,
                    opacity: 1,
                    color: '#38bdf8',
                    dashArray: '5',
                    fillOpacity: 0.1
                }),
                onEachFeature: (feature, layer) => {
                    const nombre = feature.properties.MpNombre || 'Sin nombre';
                    layer.bindPopup(`
                        <div style="background:#1e293b;color:white;padding:10px;border-radius:8px;min-width:150px;">
                            <div style="font-weight:bold;font-size:1rem;color:#6366f1;">Municipio</div>
                            <div style="font-size:0.9rem;margin-top:4px;">${nombre}</div>
                        </div>
                    `);
                    layer.on('mouseover', function() {
                        this.setStyle({ fillOpacity: 0.3, weight: 3 });
                    });
                    layer.on('mouseout', function() {
                        this.setStyle({ fillOpacity: 0.1, weight: 2 });
                    });
                }
            });
            mostrarNotificacion("✅ Municipios AMVA cargados");
        } catch (e) {
            mostrarNotificacion("❌ Error cargando AMVA");
            return;
        }
    }

    capasAMVA.addTo(mapa);
    amvaVisible = true;
    btn.style.background = '#6366f1';
    btn.innerText = '✅ Ocultar AMVA';
}

// ==========================================================================
// MÓDULO FILTRO POR COMUNA + DESCARGA
// ==========================================================================

// Mapeo de nombre de comuna a valor en COMUNAS_ZONAS_DESCRIPCION
const MAPA_COMUNAS = {
    'Popular':          'POPULAR',
    'Santa Cruz':       'SANTA CRUZ',
    'Manrique':         'MANRIQUE',
    'Aranjuez':         'ARANJUEZ',
    'Castilla':         'CASTILLA',
    'Doce de Octubre':  'DOCE DE OCTUBRE',
    'Robledo':          'ROBLEDO',
    'Villa Hermosa':    'VILLA HERMOSA',
    'Buenos Aires':     'BUENOS AIRES',
    'La Candelaria':    'CANDELARIA',
    'Laureles Estadio': 'LAURELES',
    'La América':       'LA AMERICA',
    'San Javier':       'SAN JAVIER',
    'El Poblado':       'POBLADO',
    'Belén':            'BELEN',
    'Guayabal':         'GUAYABAL',
};

let comunaFiltradaActual = null;
let capaResaltadaComuna  = null;

function filtrarPorComuna() {
    const select = document.getElementById('filtro-comuna-select');
    const nombreComuna = select.value;

    // Limpiar resaltado anterior
    if (capaResaltadaComuna) {
        mapa.removeLayer(capaResaltadaComuna);
        capaResaltadaComuna = null;
    }

    if (!nombreComuna) {
        comunaFiltradaActual = null;
        aplicarFiltros();
        return;
    }

    comunaFiltradaActual = nombreComuna;

    // Resaltar el polígono de la comuna en el mapa
    if (capasComunas) {
        capasComunas.eachLayer(layer => {
            const nombre = layer.feature?.properties?.Nombre_Com;
            if (nombre === nombreComuna) {
                const bounds = layer.getBounds();
                mapa.fitBounds(bounds, { padding: [40, 40] });

                capaResaltadaComuna = L.geoJSON(layer.feature, {
                    style: {
                        fillColor: '#38bdf8',
                        weight: 3,
                        opacity: 1,
                        color: '#38bdf8',
                        fillOpacity: 0.15,
                        dashArray: null,
                    }
                }).addTo(mapa);
            }
        });
    }

    // Aplicar filtro de delitos
    aplicarFiltrosComunaCompleto();
}

function aplicarFiltrosComunaCompleto() {
    const nombreComuna     = comunaFiltradaActual;
    const valorBusqueda    = nombreComuna ? (MAPA_COMUNAS[nombreComuna] || nombreComuna.toUpperCase()) : null;
    const tipoSeleccionado = document.getElementById('filtro-delito').value;
    const estacionSel      = document.getElementById('filtro-estacion').value.toUpperCase().trim();
    const fechaInicio      = document.getElementById('filtro-fecha-inicio').value;
    const fechaFin         = document.getElementById('filtro-fecha-fin').value;
    const modoCalor        = document.getElementById('filtro-modo').value === 'calor';

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

            // Filtro por comuna
            if (valorBusqueda) {
                const comunaReg = String(registro.COMUNAS_ZONAS_DESCRIPCION || '').toUpperCase();
                if (!comunaReg.includes(valorBusqueda)) continue;
            }

            if (estacionSel) {
                const estacion = String(registro['JURIS_ESTACIÓN _ ÁREA'] || '').toUpperCase();
                if (!estacion.includes(estacionSel)) continue;
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

    mostrarNotificacion(`📍 ${totalPuntos.toLocaleString()} registros en ${nombreComuna || 'todos'}`);
}

// ==========================================================================
// DESCARGAR IMAGEN DEL MAPA
// ==========================================================================
function descargarImagenMapa() {
    const nombreComuna = comunaFiltradaActual || 'mapa';
    mostrarNotificacion("📸 Capturando imagen del mapa...");

    // Usar leaflet-image
    if (typeof leafletImage === 'undefined') {
        // Cargar librería dinámicamente
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/leaflet-image@0.4.0/leaflet-image.js';
        script.onload = () => capturarMapa(nombreComuna);
        document.head.appendChild(script);
    } else {
        capturarMapa(nombreComuna);
    }
}

function capturarMapa(nombreComuna) {
    leafletImage(mapa, (err, canvas) => {
        if (err) {
            mostrarNotificacion("❌ Error capturando el mapa");
            console.error(err);
            return;
        }

        // Agregar título al canvas
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, canvas.width, 50);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(`🛡️ SIETE — ${nombreComuna} — ${new Date().toLocaleDateString('es-CO')}`, 15, 32);

        // Descargar
        const link = document.createElement('a');
        link.download = `SIETE_mapa_${nombreComuna.replace(/ /g,'_')}_${new Date().toISOString().slice(0,10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        mostrarNotificacion("✅ Imagen del mapa descargada");
    });
}

// ==========================================================================
// PANEL DE DESCARGA POR COMUNA
// ==========================================================================
function abrirDescargaComuna() {
    const nombreComuna = comunaFiltradaActual;
    if (!nombreComuna) {
        mostrarNotificacion("⚠️ Primero selecciona una comuna en el filtro");
        return;
    }
    if (registrosFiltrados.length === 0) {
        mostrarNotificacion("⚠️ No hay registros para descargar");
        return;
    }

    let panel = document.getElementById('panel-descarga-comuna');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'panel-descarga-comuna';
    panel.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
        background:#1e293b; color:white; border-radius:12px;
        width:420px; max-width:96vw;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
        border:1px solid #334155; z-index:99999; overflow:hidden;
    `;

    // Contar por tipo
    const porTipo = {};
    for (const r of registrosFiltrados) {
        porTipo[r._tipo] = (porTipo[r._tipo] || 0) + 1;
    }
    const resumenTipos = Object.entries(porTipo)
        .sort((a,b) => b[1]-a[1])
        .map(([t,v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;">
            <span style="font-size:0.82rem;">${t}</span>
            <span style="font-weight:bold;color:#38bdf8;">${v}</span>
        </div>`).join('');

    panel.innerHTML = `
        <div style="background:#0f172a;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #38bdf8;">
            <div>
                <h2 style="margin:0;font-size:1.1rem;color:#38bdf8;">📥 Descargar — ${nombreComuna}</h2>
                <small style="color:#94a3b8;">${registrosFiltrados.length.toLocaleString()} registros encontrados</small>
            </div>
            <button onclick="document.getElementById('panel-descarga-comuna').remove()"
                style="background:#334155;border:none;color:white;padding:6px 14px;border-radius:6px;cursor:pointer;">✕</button>
        </div>

        <div style="padding:20px;display:flex;flex-direction:column;gap:12px;">

            <!-- Resumen -->
            <div style="background:#0f172a;border-radius:8px;padding:14px;">
                <h3 style="margin:0 0 10px;font-size:0.85rem;color:#94a3b8;">Resumen por delito</h3>
                ${resumenTipos}
            </div>

            <!-- Botones descarga -->
            <button onclick="exportarExcel();document.getElementById('panel-descarga-comuna').remove();"
                style="background:#10b981;color:white;border:none;padding:14px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.95rem;width:100%;">
                📊 Descargar Excel (${registrosFiltrados.length} registros)
            </button>

            <button onclick="exportarPDFComuna('${nombreComuna}');document.getElementById('panel-descarga-comuna').remove();"
                style="background:#ef4444;color:white;border:none;padding:14px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.95rem;width:100%;">
                📄 Descargar PDF Reporte
            </button>

            <button onclick="descargarImagenMapa();document.getElementById('panel-descarga-comuna').remove();"
                style="background:#6366f1;color:white;border:none;padding:14px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.95rem;width:100%;">
                🗺️ Descargar Imagen del Mapa
            </button>

        </div>
    `;

    document.body.appendChild(panel);
}

function exportarPDFComuna(nombreComuna) {
    const porTipo = {};
    const porDia  = {};
    const porMod  = {};
    for (const r of registrosFiltrados) {
        porTipo[r._tipo]              = (porTipo[r._tipo]              || 0) + 1;
        porDia[r.DIA_SEMANA || '?']   = (porDia[r.DIA_SEMANA || '?']  || 0) + 1;
        porMod[r.MODALIDAD  || '?']   = (porMod[r.MODALIDAD  || '?']  || 0) + 1;
    }

    const filasTipo = Object.entries(porTipo).sort((a,b)=>b[1]-a[1])
        .map(([k,v]) => `<tr><td>${k}</td><td style="text-align:right">${v}</td></tr>`).join('');
    const filasMod = Object.entries(porMod).sort((a,b)=>b[1]-a[1]).slice(0,10)
        .map(([k,v]) => `<tr><td>${k}</td><td style="text-align:right">${v}</td></tr>`).join('');
    const filasD = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
        .map(d => `<tr><td>${d}</td><td style="text-align:right">${porDia[d]||0}</td></tr>`).join('');

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>SIETE - ${nombreComuna}</title>
    <style>
        body{font-family:Arial,sans-serif;padding:30px;color:#1e293b;}
        h1{color:#0f172a;border-bottom:3px solid #38bdf8;padding-bottom:10px;}
        h2{color:#334155;margin-top:20px;font-size:1rem;}
        table{width:100%;border-collapse:collapse;margin-top:8px;font-size:0.85rem;}
        th{background:#1e293b;color:white;padding:8px 12px;text-align:left;}
        td{padding:6px 12px;border-bottom:1px solid #e2e8f0;}
        tr:nth-child(even){background:#f8fafc;}
        .cards{display:flex;gap:12px;margin:16px 0;}
        .card{background:#0f172a;color:white;padding:12px;border-radius:8px;text-align:center;flex:1;}
        .num{font-size:1.8rem;font-weight:bold;color:#38bdf8;}
        .sub{font-size:0.75rem;color:#94a3b8;}
        .pie{margin-top:20px;font-size:0.75rem;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;}
    </style></head><body>
    <h1>🛡️ SIETE — Reporte Comuna ${nombreComuna}</h1>
    <p>Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}</p>
    <div class="cards">
        <div class="card"><div class="num">${registrosFiltrados.length}</div><div class="sub">Total Casos</div></div>
        <div class="card"><div class="num">${Object.keys(porTipo).length}</div><div class="sub">Tipos Delito</div></div>
        <div class="card"><div class="num">${Object.keys(porMod).length}</div><div class="sub">Modalidades</div></div>
    </div>
    <h2>Por Tipo de Delito</h2>
    <table><tr><th>Delito</th><th style="text-align:right">Casos</th></tr>${filasTipo}</table>
    <h2>Top 10 Modalidades</h2>
    <table><tr><th>Modalidad</th><th style="text-align:right">Casos</th></tr>${filasMod}</table>
    <h2>Por Día de Semana</h2>
    <table><tr><th>Día</th><th style="text-align:right">Casos</th></tr>${filasD}</table>
    <div class="pie">Sistema de Información Estadístico Territorial — SIETE © 2026</div>
    <script>window.onload=()=>window.print();<\/script>
    </body></html>`);
    w.document.close();
}

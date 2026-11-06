/********************************************************************
 * RESTAURANTE CORONEL — Código.gs (v10)
 *
 * CAMBIOS v10:
 *  - Token, PIN y API key de OCR se configuran en las constantes de abajo.
 *    (La versión publicada en el repositorio usa placeholders; los valores
 *    reales viven en Codigo.local.gs, que no se versiona.)
 *  - Corregida la validación de la API key de OCR (detecta placeholders).
 *  - REQUIRIR_TOKEN_POST queda en false; cámbialo a true cuando el formulario envíe token.
 *  - Menú "Coronel" ampliado: Configurar todo y Verificar capa limpia.
 *  - La reconstrucción de Encuestas_Limpias repara IDs faltantes antes de leer.
 *
 * FLUJO GENERAL:
 *  - Encuestas: pestaña de captura (formulario/OCR).
 *  - Encuestas_Limpias: capa limpia y normalizada que consume el dashboard.
 *  - El dashboard NO llama a este script: lee la hoja pública con gviz.
 *
 * Al actualizar: Implementar → Gestionar implementaciones → ✏️ →
 * "Nueva versión" → Implementar. La URL /exec NO cambia.
 ********************************************************************/

const NOMBRE_HOJA = 'Encuestas';
const NOMBRE_HOJA_MESEROS = 'Meseros';

/* 🔐 TOKEN — debe coincidir EXACTAMENTE con TOKEN_APP del index.html */
const TOKEN_APP = 'PEGAR_TOKEN_AQUI';

/* 🔑 PIN para ELIMINAR meseros. */
const PIN_ADMIN = 'PEGAR_PIN_AQUI';

/* Si true, el POST de guardado también exigirá el token.
   Se deja en false para no romper el formulario si aún no envía "token" en el
   POST de guardado. Cuando lo confirmes, cámbialo a true (recomendado). */
const REQUIRIR_TOKEN_POST = false;

/* ⭐ OCR.space — API key propia (gratis en ocr.space/ocrapi).
   Vive solo aquí, nunca en index.html. */
const OCR_SPACE_API_KEY = 'PEGAR_API_KEY_OCR_AQUI';

const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const OCR_ENGINE_DEFAULT = '3';
const OCR_IDIOMA_DEFAULT = 'spa';

/* ID permanente, corto y legible; el contador vive en ScriptProperties. */
const PREFIJO_ID_UNICO = 'ENC-';

/* Límite del plan gratuito de OCR.space: 1 MB por imagen. */
const OCR_MAX_BYTES_IMAGEN = 1000000;

const CABECERAS = [
  'ID Único', 'Timestamp', 'ID Cliente', 'Nombre del Cliente',
  'Número de Contacto', 'Fecha de Cumpleaños', 'ID Mesero', 'ID Fuente',
  'Plato(s) Original(es)', 'Opinión del Producto y Mejoras',
  'Calidad del Producto', 'ID de Envío', 'Registrado Por Original'
];
const HOJA_PRODUCTOS = 'Productos';
const HOJA_RELACIONES = 'Encuesta_Productos';
const HOJA_CLIENTES = 'Clientes';
const HOJA_FUENTES = 'Fuentes';
const HOJA_LIMPIA = 'Encuestas_Limpias';


/* ═══════════════ POST (guardado de encuestas y OCR) ═══════════════ */
function doPost(e) {
  const salida = ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);
  let lock = null;
  let idEnvio = '';   // fuera del try para poder usarla también en el catch

  /* El cliente envía el POST en modo 'no-cors' para evitar problemas CORS,
     por lo que no puede leer la respuesta. Guardamos el resultado real en
     caché bajo idEnvio y el cliente lo confirma con doGet?action=estadoEnvio. */
  const responder = function (obj) {
    if (idEnvio) guardarEstadoEnvio(idEnvio, obj);
    return salida.setContent(JSON.stringify(obj));
  };

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Cuerpo de la petición vacío o inválido.');
    }

    const d = JSON.parse(e.postData.contents);
    idEnvio = String(d.idEnvio || '').trim();

    /* Acción OCR: proxy hacia OCR.space para que la API key nunca viaje al
       navegador. Requiere TOKEN_APP siempre. */
    if (String(d.accion || d.action || '') === 'ocr') {
      Logger.log('doPost: acción OCR recibida. idSolicitud=' + (d.idSolicitud || '(sin id)') +
                  ' | tamañoImagenAprox=' + String(d.imagen || '').length + ' caracteres');
      idEnvio = '';   // esta rama usa su propia caché (ocr_<idSolicitud>)
      return manejarOCR(d, salida);
    }

    if (REQUIRIR_TOKEN_POST && !tokenValido(d.token)) {
      throw new Error('Token inválido. Revise TOKEN_APP en index.html y Código.gs.');
    }

    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    const hoja = obtenerHoja();
    // Bajo el ScriptLock: repara filas importadas sin ID antes del alta.
    asegurarIdsUnicos(hoja);

    /* Evita duplicados por reintentos: si este idEnvio ya existe en las
       últimas ~300 filas, no se inserta otra vez. */
    if (idEnvio) {
      const colId = CABECERAS.indexOf('ID de Envío') + 1;
      const ultimaFila = hoja.getLastRow();
      const desde = Math.max(2, ultimaFila - 300);
      if (ultimaFila >= desde) {
        const idsExistentes = hoja.getRange(desde, colId, ultimaFila - desde + 1, 1).getValues();
        const yaExiste = idsExistentes.some(fila => String(fila[0] || '').trim() === idEnvio);
        if (yaExiste) {
          lock.releaseLock();
          lock = null;
          return responder({ status: 'ok', duplicado_evitado: true });
        }
      }
    }

    const nombre   = String(d.nombre   || '').trim();
    const contacto = String(d.contacto || '').trim();
    const cumple   = String(d.cumple   || '').trim();
    const plato    = String(d.plato    || '').trim();
    const opinion  = String(d.opinion  || '').trim();
    const mesero   = String(d.mesero   || '').trim();
    const calidad  = String(d.calidad  || '').trim();

    if (!nombre && !contacto && !cumple && !plato && !opinion && !calidad) {
      throw new Error('Encuesta vacía recibida (sin ningún campo con datos): no se guardó. ' +
        'Si ocurre justo después de escanear una foto, verifique que Código.gs tenga la ÚLTIMA versión implementada.');
    }

    const idUnico   = siguienteIdUnico_(hoja);
    const idCliente = obtenerOCrearCliente_(nombre, contacto, cumple);
    const idMesero  = obtenerOCrearMesero_(mesero);
    const idFuente  = normalizarTexto(mesero) === 'cliente (formulario web)' ? 'SRC-000001' : 'SRC-000002';

    hoja.appendRow([
      idUnico, new Date(), idCliente, nombre, contacto, cumple,
      idMesero, idFuente, plato, opinion, calidad, idEnvio, mesero
    ]);
    hoja.getRange(hoja.getLastRow(), 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    registrarProductosEncuesta_(idUnico, plato, calidad);

    lock.releaseLock();
    lock = null;

    return responder({ status: 'ok' });
  } catch (err) {
    if (lock) { try { lock.releaseLock(); } catch (_) {} }
    return responder({ status: 'error', mensaje: String(err) });
  }
}

/* Guarda el resultado REAL de un guardado (éxito o error) para que el cliente
   lo confirme después vía doGet (JSONP). */
function guardarEstadoEnvio(idEnvio, resultado) {
  try {
    CacheService.getScriptCache().put('env_' + idEnvio, JSON.stringify(resultado), 120);
  } catch (e) {
    Logger.log('guardarEstadoEnvio: ERROR al guardar en caché: ' + String(e));
  }
}

function accionEstadoEnvio(idParam) {
  const id = String(idParam || '').trim();
  if (!id) return { status: 'error', mensaje: 'Falta el idEnvio a consultar.' };

  const raw = CacheService.getScriptCache().get('env_' + id);
  if (!raw) return { status: 'ok', listo: false };

  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) { return { status: 'error', mensaje: 'Estado de envío corrupto o expirado.' }; }

  obj.listo = true;
  return obj;
}

/* ═══════════════ OCR (proxy hacia OCR.space, Engine 3) ═══════════════
   El cliente comprime la imagen a <1MB y la envía como Data URL base64
   junto a un idSolicitud único. Aquí se reenvía a OCR.space con la API key
   oculta y el resultado se guarda en caché bajo ese id. */
function manejarOCR(d, salida) {
  const idSolicitud = String(d.idSolicitud || '').trim();

  const responder = function (obj) {
    if (idSolicitud) guardarResultadoOCR(idSolicitud, obj);
    return salida.setContent(JSON.stringify(obj));
  };

  try {
    if (!tokenValido(d.token)) {
      return responder({ status: 'error', mensaje: 'Token inválido. Revise TOKEN_APP en index.html y Código.gs.' });
    }

    if (!OCR_SPACE_API_KEY || OCR_SPACE_API_KEY.indexOf('PEGAR') === 0 || OCR_SPACE_API_KEY.length < 20) {
      return responder({ status: 'error', mensaje: 'Falta configurar OCR_SPACE_API_KEY en Código.gs.' });
    }

    const base64Imagen = String(d.imagen || '').trim();
    if (!base64Imagen) throw new Error('No se recibió imagen para procesar.');

    const partesBase64 = base64Imagen.split(',');
    const soloBase64 = partesBase64.length > 1 ? partesBase64[1] : partesBase64[0];
    const tamanoAprox = Math.floor(soloBase64.length * 0.75);
    if (tamanoAprox > OCR_MAX_BYTES_IMAGEN * 1.05) {
      return responder({
        status: 'error',
        mensaje: 'La imagen supera ~1MB incluso tras comprimir. Intente de nuevo con mejor luz o más cerca del formulario.'
      });
    }

    const idioma = String(d.idioma || OCR_IDIOMA_DEFAULT);
    const engine = String(d.engine || OCR_ENGINE_DEFAULT);

    const payload = {
      apikey: OCR_SPACE_API_KEY,
      base64Image: base64Imagen,
      language: idioma,
      OCREngine: engine,
      isOverlayRequired: 'false',
      scale: 'true',
      detectOrientation: 'true'
    };

    const inicio = new Date().getTime();
    const respuesta = UrlFetchApp.fetch(OCR_SPACE_URL, { method: 'post', payload: payload, muteHttpExceptions: true });
    const duracionMs = new Date().getTime() - inicio;
    const codigoHttp = respuesta.getResponseCode();
    const textoResp = respuesta.getContentText();
    Logger.log('manejarOCR: OCR.space respondió en ' + duracionMs + 'ms con HTTP ' + codigoHttp +
                ' (idSolicitud=' + idSolicitud + ', engine=' + engine + ')');

    if (codigoHttp < 200 || codigoHttp >= 300) {
      return responder({
        status: 'error',
        mensaje: 'OCR.space respondió HTTP ' + codigoHttp + ': ' + textoResp.slice(0, 300)
      });
    }

    let json;
    try { json = JSON.parse(textoResp); }
    catch (eParse) {
      return responder({ status: 'error', mensaje: 'Respuesta de OCR.space no es JSON válido: ' + textoResp.slice(0, 300) });
    }

    if (json.IsErroredOnProcessing) {
      const msjErr = Array.isArray(json.ErrorMessage)
        ? json.ErrorMessage.join(' | ')
        : String(json.ErrorMessage || 'Error desconocido de OCR.space');
      return responder({ status: 'error', mensaje: msjErr });
    }

    const resultados = json.ParsedResults || [];
    const textoDetectado = resultados.length ? String(resultados[0].ParsedText || '') : '';

    return responder({ status: 'ok', texto: textoDetectado, motor: 'ocrspace-engine' + engine });

  } catch (err) {
    return responder({ status: 'error', mensaje: String(err) });
  }
}

function guardarResultadoOCR(idSolicitud, resultado) {
  try {
    CacheService.getScriptCache().put('ocr_' + idSolicitud, JSON.stringify(resultado), 300);
    Logger.log('guardarResultadoOCR: guardado ocr_' + idSolicitud + ' → status=' + resultado.status);
  } catch (e) {
    Logger.log('guardarResultadoOCR: ERROR al guardar en caché: ' + String(e));
  }
}

function accionOcrResultado(idParam) {
  const id = String(idParam || '').trim();
  if (!id) return { status: 'error', mensaje: 'Falta el id de la solicitud OCR.' };

  const raw = CacheService.getScriptCache().get('ocr_' + id);
  if (!raw) {
    Logger.log('accionOcrResultado: aún no hay resultado para ocr_' + id);
    return { status: 'ok', listo: false };
  }

  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) { return { status: 'error', mensaje: 'Resultado OCR corrupto o expirado.' }; }

  obj.listo = true;
  return obj;
}

/* ═══════════════ GET (lecturas y meseros) ═══════════════ */
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const callback = String(p.callback || '');
  let datos;

  try {
    if (['check', 'stats', 'recientes', 'meseros', 'addMesero', 'delMesero', 'ocrResultado', 'estadoEnvio'].indexOf(p.action) !== -1) {
      if (!tokenValido(p.token)) {
        datos = { status: 'error', mensaje: 'Token inválido o ausente. Revise TOKEN_APP en index.html y Código.gs.' };
      } else if (p.action === 'check') {
        datos = accionCheck(p.contacto);
      } else if (p.action === 'stats') {
        datos = accionStats();
      } else if (p.action === 'recientes') {
        datos = accionRecientes(p.cantidad);
      } else if (p.action === 'meseros') {
        datos = accionMeseros();
      } else if (p.action === 'addMesero') {
        datos = accionAddMeseros(p.nombres);
      } else if (p.action === 'ocrResultado') {
        datos = accionOcrResultado(p.id);
      } else if (p.action === 'estadoEnvio') {
        datos = accionEstadoEnvio(p.id);
      } else {
        datos = accionDelMesero(p.nombre, p.pin);
      }
    } else {
      datos = { status: 'ok', servicio: 'Encuestas Coronel', version: '14.0-server-unique-id', autorizado: tokenValido(p.token) };
    }
  } catch (err) {
    datos = { status: 'error', mensaje: String(err) };
  }

  const json = JSON.stringify(datos);

  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── check (también devuelve plato/calidad/opinión anteriores) ── */
function accionCheck(contactoParam) {
  const tel = normalizarTelefono(contactoParam);
  if (!tel || tel.length < 7) return { status: 'ok', duplicado: false };

  const valores = obtenerHoja().getDataRange().getValues();
  for (let i = valores.length - 1; i >= 1; i--) {
    if (normalizarTelefono(valores[i][4]) === tel) {
      return {
        status: 'ok',
        duplicado: true,
        fecha: formatearFechaSola(valores[i][1]),
        nombre: String(valores[i][3] || ''),
        mesero: nombreMeseroPorId_(valores[i][6]),
        cumple: cumpleComoTexto(valores[i][5]),
        plato: String(valores[i][8] || ''),
        calidad: String(valores[i][10] || ''),
        opinion: String(valores[i][9] || '')
      };
    }
  }
  return { status: 'ok', duplicado: false };
}

/* ── stats (incluye distribución de calidad) ── */
function accionStats() {
  const tz = Session.getScriptTimeZone();
  const valores = obtenerHoja().getDataRange().getValues();
  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioSemana = new Date(inicioHoy.getTime() - 6 * 24 * 60 * 60 * 1000);

  let total = 0, hoy = 0, semana = 0;
  const platosMap = {};
  const meserosMap = {};
  const diasMap = {};
  const calMap = { 'bueno': 0, 'regular': 0, 'malo': 0 };

  const claves = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(inicioHoy.getTime() - i * 24 * 60 * 60 * 1000);
    const k = Utilities.formatDate(d, tz, 'dd/MM');
    claves.push(k);
    diasMap[k] = 0;
  }

  for (let i = 1; i < valores.length; i++) {
    const f = aFecha(valores[i][1]);
    if (!f) continue;
    total++;
    if (f >= inicioHoy) hoy++;
    if (f >= inicioSemana) semana++;

    const k = Utilities.formatDate(f, tz, 'dd/MM');
    if (diasMap.hasOwnProperty(k)) diasMap[k]++;

    const plato = String(valores[i][8] || '').trim();
    if (plato) {
      const clave = normalizarTexto(plato);
      if (!platosMap[clave]) platosMap[clave] = { display: plato, veces: 0 };
      platosMap[clave].veces++;
    }

    const mesero = nombreMeseroPorId_(valores[i][6]);
    if (mesero) {
      const claveM = normalizarTexto(mesero);
      if (!meserosMap[claveM]) meserosMap[claveM] = { display: mesero, veces: 0 };
      meserosMap[claveM].veces++;
    }

    const cal = normalizarTexto(valores[i][10]);
    if (calMap.hasOwnProperty(cal)) calMap[cal]++;
  }

  const platos = Object.keys(platosMap)
    .map(function (k) { return platosMap[k]; })
    .sort(function (a, b) { return b.veces - a.veces; })
    .slice(0, 5)
    .map(function (p) { return { plato: p.display, veces: p.veces }; });

  const meseros = Object.keys(meserosMap)
    .map(function (k) { return meserosMap[k]; })
    .sort(function (a, b) { return b.veces - a.veces; })
    .slice(0, 5)
    .map(function (m) { return { nombre: m.display, veces: m.veces }; });

  const dias = claves.map(function (k) { return { dia: k, total: diasMap[k] }; });

  const calificaciones = ['Bueno', 'Regular', 'Malo'].map(function (n) {
    return { nombre: n, veces: calMap[n.toLowerCase()] };
  });

  const ultimas = [];
  for (let i = valores.length - 1; i >= 1 && ultimas.length < 5; i--) {
    const f = aFecha(valores[i][1]);
    if (!f) continue;
    ultimas.push({
      fecha: formatearFechaSola(f),
      nombre: String(valores[i][3] || '—'),
      plato: String(valores[i][8] || '—'),
      mesero: nombreMeseroPorId_(valores[i][6])
    });
  }

  return {
    status: 'ok', total: total, hoy: hoy, semana: semana,
    platos: platos, meseros: meseros, dias: dias, ultimas: ultimas,
    calificaciones: calificaciones,
    generada: formatearFecha(ahora)
  };
}

/* ── recientes ── */
function accionRecientes(cantidadParam) {
  const n = Math.min(20, Math.max(1, parseInt(cantidadParam, 10) || 5));
  const valores = obtenerHoja().getDataRange().getValues();
  const registros = [];

  for (let i = valores.length - 1; i >= 1 && registros.length < n; i--) {
    const f = aFecha(valores[i][1]);
    if (!f) continue;
    registros.push({
      fecha: formatearFechaSola(f),
      nombre: String(valores[i][3] || ''),
      contacto: String(valores[i][4] || ''),
      cumple: cumpleComoTexto(valores[i][5]),
      plato: String(valores[i][8] || ''),
      opinion: String(valores[i][9] || ''),
      mesero: nombreMeseroPorId_(valores[i][6]),
      calidad: String(valores[i][10] || '')
    });
  }
  return { status: 'ok', registros: registros };
}

/* ═════════════ MESEROS (hoja compartida) ═════════════ */
function accionMeseros() {
  return { status: 'ok', meseros: listarMeseros() };
}

function accionAddMeseros(jsonParam) {
  let nombres = [];
  try { nombres = JSON.parse(jsonParam || '[]'); } catch (_) {}
  if (!Array.isArray(nombres)) throw new Error('Lista de nombres inválida.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoja = obtenerHojaMeseros();

    const existentes = {};
    listarMeseros().forEach(function (n) { existentes[normalizarTexto(n)] = true; });

    const ahora = new Date();
    const agregados = [];

    nombres.forEach(function (raw) {
      const nombre = String(raw || '').trim().slice(0, 40);
      if (!nombre) return;
      const clave = normalizarTexto(nombre);
      if (existentes[clave]) return;
      existentes[clave] = true;
      hoja.appendRow([siguienteIdCatalogo_(hoja, 'MES-'), nombre, ahora, 'Sí']);
      agregados.push(nombre);
    });

    return { status: 'ok', agregados: agregados, meseros: listarMeseros() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function accionDelMesero(nombreParam, pin) {
  if (String(pin || '') !== PIN_ADMIN) {
    return { status: 'error', mensaje: 'PIN de administrador incorrecto.' };
  }
  const objetivo = normalizarTexto(nombreParam);
  if (!objetivo) throw new Error('Nombre requerido.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoja = obtenerHojaMeseros();
    const valores = hoja.getDataRange().getValues();
    let eliminado = 0;

    for (let i = valores.length - 1; i >= 1; i--) {
      if (normalizarTexto(valores[i][1]) === objetivo) {
        hoja.deleteRow(i + 1);
        eliminado++;
      }
    }

    return { status: 'ok', eliminado: eliminado, meseros: listarMeseros() };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ═══════════════════════ Utilidades ═══════════════════════ */
function tokenValido(tok) {
  return TOKEN_APP !== '' && TOKEN_APP.indexOf('PEGAR') !== 0 && String(tok || '') === TOKEN_APP;
}

function obtenerHoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(NOMBRE_HOJA);

  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA);
    hoja.appendRow(CABECERAS);

    const cab = hoja.getRange(1, 1, 1, CABECERAS.length);
    cab.setBackground('#14532D')
       .setFontColor('#FFFFFF')
       .setFontWeight('bold')
       .setHorizontalAlignment('center');

    hoja.setFrozenRows(1);
    hoja.setColumnWidth(1, 125);
    hoja.setColumnWidth(3, 125);
    hoja.setColumnWidth(7, 125);
    hoja.setColumnWidth(8, 125);
    hoja.setColumnWidth(6, 420);
    hoja.setColumnWidth(7, 150);
    hoja.setColumnWidth(8, 140);
    hoja.setColumnWidth(9, 220);
    hoja.setColumnWidth(10, 280);
    hoja.getRange(2, 6, Math.max(1, hoja.getMaxRows() - 1), 1).setNumberFormat('@');
    return hoja;
  }

  const ultimaCol = hoja.getLastColumn();
  if (ultimaCol < CABECERAS.length) {
    const faltantes = CABECERAS.slice(ultimaCol);
    hoja.getRange(1, ultimaCol + 1, 1, faltantes.length)
        .setValues([faltantes])
        .setBackground('#14532D')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    hoja.setColumnWidth(ultimaCol + 1, 220);
  }
  return hoja;
}

/* Garantiza que cada fila de Encuestas tenga un ID único, corto y legible. */
function asegurarIdsUnicos(hoja) {
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return;

  const rango = hoja.getRange(2, 1, ultimaFila - 1, 1);
  const valores = rango.getValues();
  const vistos = {};
  let cambio = false;

  for (let i = 0; i < valores.length; i++) {
    let id = String(valores[i][0] || '').trim();
    if (!/^ENC-\d{6,}$/.test(id) || vistos[id]) {
      id = siguienteIdUnico_(hoja);
      valores[i][0] = id;
      cambio = true;
    }
    vistos[id] = true;
  }

  if (cambio) rango.setValues(valores);
}

/* Devuelve ENC-000001, ENC-000002... y nunca reutiliza un número. */
function siguienteIdUnico_(hoja) {
  const props = PropertiesService.getScriptProperties();
  let ultimo = parseInt(props.getProperty('ULTIMO_ID_UNICO') || '0', 10) || 0;
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila >= 2) {
    const ids = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues();
    ids.forEach(function (fila) {
      const m = String(fila[0] || '').trim().match(/^ENC-(\d+)$/);
      if (m) ultimo = Math.max(ultimo, parseInt(m[1], 10));
    });
  }
  ultimo++;
  props.setProperty('ULTIMO_ID_UNICO', String(ultimo));
  return PREFIJO_ID_UNICO + ('000000' + ultimo).slice(-6);
}

function hojaPorNombre_(nombre, encabezados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(nombre);
  if (!h) { h = ss.insertSheet(nombre); h.appendRow(encabezados); }
  return h;
}

function siguienteIdCatalogo_(hoja, prefijo) {
  const props = PropertiesService.getScriptProperties();
  const key = 'ULTIMO_' + prefijo.replace('-', '');
  let n = parseInt(props.getProperty(key) || '0', 10) || 0;
  const last = hoja.getLastRow();
  if (last >= 2) {
    hoja.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) {
      const m = String(r[0] || '').match(new RegExp('^' + prefijo + '(\\d+)$'));
      if (m) n = Math.max(n, parseInt(m[1], 10));
    });
  }
  n++;
  props.setProperty(key, String(n));
  return prefijo + ('000000' + n).slice(-6);
}

function obtenerOCrearCliente_(nombre, contacto, cumple) {
  const h = hojaPorNombre_(HOJA_CLIENTES, ['ID Cliente', 'Nombre', 'Contacto', 'Fecha de Cumpleaños', 'Activo']);
  const key = normalizarTelefono(contacto) || ('N:' + normalizarTexto(nombre) + '|F:' + normalizarTexto(cumple));
  const vals = h.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    const k = normalizarTelefono(vals[i][2]) || ('N:' + normalizarTexto(vals[i][1]) + '|F:' + normalizarTexto(vals[i][3]));
    if (k === key) return String(vals[i][0]);
  }
  const id = siguienteIdCatalogo_(h, 'CLI-');
  h.appendRow([id, nombre, contacto, cumple, 'Sí']);
  return id;
}

function obtenerOCrearMesero_(nombre) {
  if (!nombre || normalizarTexto(nombre) === 'cliente (formulario web)') return '';
  const h = obtenerHojaMeseros();
  const vals = h.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (normalizarTexto(vals[i][1]) === normalizarTexto(nombre)) return String(vals[i][0]);
  }
  const id = siguienteIdCatalogo_(h, 'MES-');
  h.appendRow([id, nombre, new Date(), 'Sí']);
  return id;
}

function nombreMeseroPorId_(id) {
  if (!id) return '';
  const vals = obtenerHojaMeseros().getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) return String(vals[i][1]);
  }
  return String(id);
}

function registrarProductosEncuesta_(idEncuesta, raw, calidad) {
  const hp = hojaPorNombre_(HOJA_PRODUCTOS, ['ID Producto', 'Nombre', 'Categoría', 'Activo']);
  const hr = hojaPorNombre_(HOJA_RELACIONES, ['ID Relación', 'ID Encuesta', 'ID Producto', 'Producto Normalizado', 'Calidad de Encuesta']);
  const existentes = hp.getDataRange().getValues();
  const mapa = {};
  for (let i = 1; i < existentes.length; i++) mapa[normalizarTexto(existentes[i][1])] = String(existentes[i][0]);
  const partes = String(raw || 'Sin especificar')
    .split(/[\u0017-\u001F]|\s*\+\s*/)
    .map(function (x) { return x.trim(); })
    .filter(Boolean);
  partes.forEach(function (nombre) {
    const k = normalizarTexto(nombre);
    let pid = mapa[k];
    if (!pid) {
      pid = siguienteIdCatalogo_(hp, 'PROD-');
      hp.appendRow([pid, nombre, 'Plato/categoría', 'Sí']);
      mapa[k] = pid;
    }
    hr.appendRow([siguienteIdCatalogo_(hr, 'REL-'), idEncuesta, pid, nombre, calidad]);
  });
}

function obtenerHojaMeseros() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(NOMBRE_HOJA_MESEROS);

  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA_MESEROS);
    hoja.appendRow(['ID Mesero', 'Nombre', 'Fecha de Registro', 'Activo']);
    hoja.getRange(1, 1, 1, 4)
        .setBackground('#14532D')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    hoja.setFrozenRows(1);
    hoja.setColumnWidth(1, 125);
    hoja.setColumnWidth(2, 220);
    hoja.setColumnWidth(3, 160);
  }
  return hoja;
}

function listarMeseros() {
  const valores = obtenerHojaMeseros().getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < valores.length; i++) {
    const n = String(valores[i][1] || '').trim();
    if (n) lista.push(n);
  }
  return lista;
}

function aFecha(v) {
  if (v instanceof Date) return v;
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;

  // Acepta dd/mm/yyyy, d/m/yy, dd-mm-yyyy y con hora opcional.
  // Google Sheets puede devolver estas fechas como texto cuando la columna
  // viene de una importación, y `new Date('29/9/2026')` no las interpreta.
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    let anio = parseInt(m[3], 10);
    if (anio < 100) anio += anio <= 26 ? 2000 : 1900;
    const d = new Date(
      anio, parseInt(m[2], 10) - 1, parseInt(m[1], 10),
      parseInt(m[4] || '0', 10), parseInt(m[5] || '0', 10), parseInt(m[6] || '0', 10)
    );
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatearFecha(v) {
  const d = aFecha(v);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(v || '');
}

function formatearFechaSola(v) {
  const d = aFecha(v);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(v || '');
}

/* La columna "Fecha de Cumpleaños" se guarda como TEXTO, pero Sheets puede
   convertirla a Date. Esta función la devuelve siempre como "dd/MM/yyyy". */
function cumpleComoTexto(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(v || '').trim();
}

function normalizarTexto(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function normalizarTelefono(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length > 9) d = d.slice(-9);
  return d;
}

/* ═══════════════════════════════════════════════════════════════════════
 * CAPA DE DATOS LIMPIOS PARA DASHBOARD
 *
 * Encuestas permanece como fuente de entrada. Esta capa no la sobrescribe.
 * Encuestas_Limpias se reconstruye completa para reflejar altas, cambios y
 * eliminaciones. Una fila de salida representa una encuesta, no un producto.
 * ═══════════════════════════════════════════════════════════════════════ */

const ENCABEZADOS_LIMPIOS = [
  'ID Único', 'Timestamp', 'Fecha Encuesta', 'ID Cliente', 'Nombre Cliente',
  'Número Contacto', 'Cumpleaños Original', 'Día Cumpleaños', 'Mes Cumpleaños',
  'Año Cumpleaños', 'Tiene Año Cumpleaños', 'ID Mesero', 'Mesero', 'ID Fuente',
  'Fuente', 'Tipo Fuente', 'ID Envío', 'Platos Originales',
  'Productos Normalizados', 'Opinión Original', 'Opinión Limpia',
  'Comentario Válido', 'Calidad Original', 'Calidad Limpia', 'Estado Registro',
  'Fecha Procesamiento', 'Edad al Responder', 'Estado Edad', 'Rango Edad',
  // Contrato estable consumido por el dashboard web.
  'id', 'timestamp', 'clientName', 'phone', 'birthday', 'dish', 'comment',
  'registeredBy', 'quality', 'birthdayDay', 'birthdayMonth', 'birthdayYear',
  'birthdayContactDate', 'birthdayRule', 'ageAtSurvey', 'ageStatus', 'ageRange'
];

function texto_(v) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clave_(v) { return normalizarTexto(texto_(v)); }

/* Mayúsculas tipo título: "HUMBERTO julon LARA" → "Humberto Julon Lara".
   Mantiene en minúscula partículas de nombres (de, del, la, los, y, …). */
const PARTICULAS_NOMBRE_ = {
  de: 1, del: 1, la: 1, las: 1, los: 1, y: 1, e: 1,
  da: 1, das: 1, do: 1, dos: 1, van: 1, von: 1, di: 1, du: 1, le: 1, les: 1, des: 1
};

function titulo_(valor) {
  const base = texto_(valor).toLowerCase();
  if (!base) return '';

  // Casos especiales que no deben quedar como "Cliente (formulario web)".
  if (base === 'cliente (formulario web)') return 'Cliente (Formulario Web)';
  if (base === 'registro por mesero') return 'Registro por Mesero';

  return base.split(/\s+/).map(function (word, index) {
    if (index > 0 && PARTICULAS_NOMBRE_[word]) return word;
    return word.replace(/(^|[-'’])([a-záéíóúüñ])/g, function (_, sep, ch) {
      return sep + ch.toUpperCase();
    });
  }).join(' ');
}

function valorCampo_(obj, nombres) {
  for (let i = 0; i < nombres.length; i++) {
    const v = obj[nombres[i]];
    if (v !== undefined && v !== null && texto_(v) !== '') return v;
  }
  return '';
}

function leerTablaObjetos_(nombre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(nombre);
  if (!hoja || hoja.getLastRow() < 1 || hoja.getLastColumn() < 1) return [];
  const valores = hoja.getDataRange().getValues();
  const cab = valores[0].map(texto_);
  return valores.slice(1)
    .filter(function (f) { return f.some(function (v) { return texto_(v) !== ''; }); })
    .map(function (f) {
      const o = {};
      cab.forEach(function (c, i) { if (c) o[c] = f[i]; });
      return o;
    });
}

function indicePor_(filas, campo) {
  const m = {};
  filas.forEach(function (f) {
    const k = texto_(f[campo]);
    if (k) m[k] = f;
  });
  return m;
}

function parsearCumpleanos_(valor) {
  const original = cumpleComoTexto(valor);
  const partes = original.split('/').map(texto_).filter(Boolean);
  const dia = partes.length >= 1 ? parseInt(partes[0], 10) : null;
  const mes = partes.length >= 2 ? parseInt(partes[1], 10) : null;
  let anio = partes.length >= 3 ? parseInt(partes[2], 10) : null;
  if (anio !== null && !isFinite(anio)) anio = null;
  if (anio !== null && anio < 100) anio += anio <= 26 ? 2000 : 1900;
  const valido = Number.isInteger(dia) && dia >= 1 && dia <= 31 &&
    Number.isInteger(mes) && mes >= 1 && mes <= 12;
  const fechaReal = valido && Number.isInteger(anio) ? fechaSegura_(anio, mes, dia) : null;
  return {
    original: original, dia: valido ? dia : '', mes: valido ? mes : '',
    anio: valido && Number.isInteger(anio) ? anio : '',
    tieneAnio: valido && Number.isInteger(anio) ? 'Sí' : 'No',
    fechaReal: fechaReal
  };
}

function fechaSegura_(anio, mes, dia) {
  const d = new Date(anio, mes - 1, dia);
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
}

function bisiesto_(anio) {
  return anio % 400 === 0 || (anio % 4 === 0 && anio % 100 !== 0);
}

function proximaFechaCumpleanos_(dia, mes, hoy) {
  if (!dia || !mes) return { fecha: '', regla: '' };
  function fechaPara_(anio) {
    let d = dia;
    let regla = '';
    if (dia === 29 && mes === 2 && !bisiesto_(anio)) {
      d = 28;
      regla = '29/02 → 28/02 en año no bisiesto';
    }
    return { fecha: new Date(anio, mes - 1, d), regla: regla };
  }
  let candidato = fechaPara_(hoy.getFullYear());
  if (candidato.fecha < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
    candidato = fechaPara_(hoy.getFullYear() + 1);
  }
  return {
    fecha: Utilities.formatDate(candidato.fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    regla: candidato.regla || 'Fecha de cumpleaños original'
  };
}

function calcularEdad_(cumple, fechaEncuesta) {
  // Sin año de nacimiento no se inventa una edad.
  if (!cumple || !Number.isInteger(cumple.anio) || !cumple.dia || !cumple.mes) {
    return { edad: '', estado: 'Desconocida', rango: 'Edad desconocida' };
  }
  const fecha = fechaEncuesta instanceof Date ? fechaEncuesta : aFecha(fechaEncuesta);
  const nacimiento = fechaSegura_(cumple.anio, cumple.mes, cumple.dia);
  if (!fecha || !nacimiento) {
    return { edad: '', estado: 'Desconocida', rango: 'Edad desconocida' };
  }
  let edad = fecha.getFullYear() - cumple.anio;
  const antesDelCumple = fecha.getMonth() < cumple.mes - 1 ||
    (fecha.getMonth() === cumple.mes - 1 && fecha.getDate() < cumple.dia);
  if (antesDelCumple) edad--;
  if (nacimiento > fecha) {
    return { edad: '', estado: 'Revisar', rango: 'Edad a revisar' };
  }
  if (edad < 0 || edad > 120) {
    return { edad: '', estado: 'No válida', rango: 'Edad no válida' };
  }
  // No se descarta el registro, pero se marca para revisión: puede ser un niño
  // real o un año de nacimiento mal ingresado (por ejemplo, el año actual).
  if (edad < 12 || edad > 90) {
    return { edad: edad, estado: 'Revisar', rango: 'Edad a revisar' };
  }
  return { edad: edad, estado: 'Conocida', rango: rangoEdad_(edad) };
}

function rangoEdad_(edad) {
  if (!Number.isInteger(edad) || edad < 0) return 'Edad desconocida';
  if (edad < 18) return 'Menor de 18';
  if (edad <= 24) return '18–24';
  if (edad <= 34) return '25–34';
  if (edad <= 44) return '35–44';
  if (edad <= 54) return '45–54';
  if (edad <= 64) return '55–64';
  return '65+';
}

function comentarioLimpio_(valor) {
  let s = texto_(valor);
  const k = clave_(s);
  if (k === 'peabacio muchos ericias hasta la provins' ||
      k === 'inos encantarla celebrario juntos!') return 'Error de lectura';
  // Placeholder de la interfaz que a veces se cuela como "opinión".
  if (/^●/.test(s) || k.indexOf('que te parecio nuestro') !== -1) return '';
  return s;
}

function calidadLimpia_(valor) {
  const k = clave_(valor);
  if (k === 'bueno') return 'Bueno';
  if (k === 'regular') return 'Regular';
  if (k === 'malo') return 'Malo';
  return '';
}

function comentarioValido_(valor) {
  const k = clave_(valor);
  return k && k !== 's/c' && k !== 'error de lectura' ? 1 : 0;
}

function separarProductos_(valor) {
  return texto_(valor)
    .split(/[\u0017-\u001F]|\s*\+\s*/)
    .map(texto_)
    .filter(Boolean)
    .filter(function (v, i, a) { return a.findIndex(function (x) { return clave_(x) === clave_(v); }) === i; });
}

function reconstruirRelacionesProductos_() {
  const encuestas = leerTablaObjetos_(NOMBRE_HOJA);
  const hp = hojaPorNombre_(HOJA_PRODUCTOS, ['ID Producto', 'Nombre', 'Categoría', 'Activo']);
  const hr = hojaPorNombre_(HOJA_RELACIONES, ['ID Relación', 'ID Encuesta', 'ID Producto', 'Producto Normalizado', 'Calidad de Encuesta']);
  const productos = leerTablaObjetos_(HOJA_PRODUCTOS);
  const mapa = {};
  productos.forEach(function (p) {
    const nombre = texto_(p['Nombre']);
    if (nombre) mapa[clave_(nombre)] = texto_(p['ID Producto']);
  });
  const relaciones = [];
  encuestas.forEach(function (e) {
    const idEncuesta = texto_(e['ID Único']);
    if (!idEncuesta) return;
    const partes = separarProductos_(valorCampo_(e, ['Plato(s) Original(es)', 'Plato Elegido Hoy', 'Plato']));
    const calidad = texto_(valorCampo_(e, ['Calidad del Producto', 'Calidad']));
    partes.forEach(function (nombre) {
      const k = clave_(nombre);
      if (!k) return;
      let idProducto = mapa[k];
      if (!idProducto) {
        idProducto = siguienteIdCatalogo_(hp, 'PROD-');
        hp.appendRow([idProducto, nombre, 'Plato/categoría', 'Sí']);
        mapa[k] = idProducto;
      }
      relaciones.push([siguienteIdCatalogo_(hr, 'REL-'), idEncuesta, idProducto, nombre, calidad]);
    });
  });
  hr.clearContents();
  hr.getRange(1, 1, 1, 5).setValues([['ID Relación', 'ID Encuesta', 'ID Producto', 'Producto Normalizado', 'Calidad de Encuesta']]);
  if (relaciones.length) hr.getRange(2, 1, relaciones.length, 5).setValues(relaciones);
  hr.setFrozenRows(1);
}

function reconstruirEncuestasLimpias_() {
  // Repara IDs faltantes antes de leer, para que la capa limpia no marque
  // como advertencia filas que solo necesitaban un ID.
  const encSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA);
  if (encSheet && encSheet.getLastRow() > 1) asegurarIdsUnicos(encSheet);

  const encuestas = leerTablaObjetos_(NOMBRE_HOJA);
  const clientes = leerTablaObjetos_(HOJA_CLIENTES);
  const meseros = leerTablaObjetos_(NOMBRE_HOJA_MESEROS);
  const fuentes = leerTablaObjetos_(HOJA_FUENTES);
  reconstruirRelacionesProductos_();
  const relaciones = leerTablaObjetos_(HOJA_RELACIONES);
  const clienteId = indicePor_(clientes, 'ID Cliente');
  const meseroId = indicePor_(meseros, 'ID Mesero');
  const fuenteId = indicePor_(fuentes, 'ID Fuente');
  const productosPorEncuesta = {};

  relaciones.forEach(function (r) {
    const id = texto_(r['ID Encuesta']);
    const prod = texto_(r['Producto Normalizado']);
    if (!id || !prod) return;
    if (!productosPorEncuesta[id]) productosPorEncuesta[id] = [];
    if (!productosPorEncuesta[id].some(function (p) { return clave_(p) === clave_(prod); })) {
      productosPorEncuesta[id].push(prod);
    }
  });

  const ahora = new Date();
  const salida = encuestas.map(function (e) {
    const id = texto_(valorCampo_(e, ['ID Único', 'id']));
    const idCliente = texto_(valorCampo_(e, ['ID Cliente']));
    const idMesero = texto_(valorCampo_(e, ['ID Mesero']));
    const idFuente = texto_(valorCampo_(e, ['ID Fuente']));
    const cliente = clienteId[idCliente] || {};
    const mesero = meseroId[idMesero] || {};
    const fuente = fuenteId[idFuente] || {};
    const nombre = titulo_(valorCampo_(e, ['Nombre del Cliente', 'Nombre', 'clientName']) || cliente['Nombre']);
    const contacto = normalizarTelefono(valorCampo_(e, ['Número de Contacto', 'Contacto', 'phone'])) || normalizarTelefono(cliente['Contacto']);
    const cumple = parsearCumpleanos_(valorCampo_(e, ['Fecha de Cumpleaños', 'Cumpleaños Original', 'birthday']) || cliente['Fecha de Cumpleaños']);
    const platoOriginal = texto_(valorCampo_(e, ['Plato(s) Original(es)', 'Plato Elegido Hoy', 'Plato', 'dish']));
    const opinionOriginal = texto_(valorCampo_(e, ['Opinión del Producto y Mejoras', 'Opinión', 'comment']));
    const opinion = comentarioLimpio_(opinionOriginal);
    const calidadOriginal = texto_(valorCampo_(e, ['Calidad del Producto', 'Calidad', 'quality']));
    const calidad = calidadLimpia_(calidadOriginal);
    const productos = (productosPorEncuesta[id] || separarProductos_(platoOriginal)).map(titulo_);
    const timestamp = valorCampo_(e, ['Timestamp', 'timestamp']);
    const fecha = aFecha(timestamp);
    const edad = calcularEdad_(cumple, fecha);
    const prox = proximaFechaCumpleanos_(cumple.dia, cumple.mes, ahora);
    const estado = !id ? 'Advertencia: sin ID Único' : (!fecha ? 'Advertencia: fecha inválida' : 'Válido');
    const registrados = titulo_(valorCampo_(e, ['Registrado Por Original', 'Registrado Por', 'registeredBy']));
    const esRegistroWeb = normalizarTexto(registrados).indexOf('formulario web') !== -1 ||
      normalizarTexto(registrados).indexOf('cliente (formulario') !== -1;
    const nombreMesero = texto_(mesero['Nombre'])
      ? titulo_(mesero['Nombre'])
      : (idMesero ? idMesero : (esRegistroWeb ? '' : registrados));
    const fuenteNombre = titulo_(fuente['Nombre']);
    const fuenteTipo = titulo_(fuente['Tipo']);
    return [
      id, timestamp, fecha ? Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy') : '',
      idCliente, nombre, contacto, cumple.original, cumple.dia, cumple.mes, cumple.anio,
      cumple.tieneAnio, idMesero, nombreMesero, idFuente, fuenteNombre,
      fuenteTipo, texto_(valorCampo_(e, ['ID de Envío'])), platoOriginal,
      productos.join('; '), opinionOriginal, opinion, comentarioValido_(opinion), calidadOriginal,
      calidad, estado, ahora, edad.edad, edad.estado, edad.rango,
      id, timestamp, nombre, contacto, cumple.original,
      productos.join('; '), opinion, nombreMesero || registrados, calidad, cumple.dia,
      cumple.mes, cumple.anio, prox.fecha, prox.regla,
      edad.edad, edad.estado, edad.rango
    ];
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_LIMPIA);
  if (!hoja) hoja = ss.insertSheet(HOJA_LIMPIA);
  hoja.clearContents();
  hoja.getRange(1, 1, 1, ENCABEZADOS_LIMPIOS.length).setValues([ENCABEZADOS_LIMPIOS]);
  if (salida.length) hoja.getRange(2, 1, salida.length, ENCABEZADOS_LIMPIOS.length).setValues(salida);
  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, 1, ENCABEZADOS_LIMPIOS.length)
    .setBackground('#14532D').setFontColor('#FFFFFF').setFontWeight('bold');
  const totalFilas = Math.max(1, salida.length);
  // Timestamp con hora (si se deja como fecha simple se pierde la hora).
  hoja.getRange(2, 2, totalFilas, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  // Fecha de procesamiento con hora.
  hoja.getRange(2, 26, totalFilas, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  // Cumpleaños y sus partes como texto (evita que Sheets las reconvierta).
  hoja.getRange(2, 3, totalFilas, 1).setNumberFormat('@');
  hoja.getRange(2, 6, totalFilas, 1).setNumberFormat('@');
  hoja.getRange(2, 7, totalFilas, 1).setNumberFormat('@');
  hoja.getRange(2, 8, totalFilas, 3).setNumberFormat('@');
  // Contrato: birthday y birthdayDay/Month/Year como texto.
  hoja.getRange(2, 34, totalFilas, 1).setNumberFormat('@');
  hoja.getRange(2, 39, totalFilas, 3).setNumberFormat('@');
}

function actualizarEncuestasLimpias() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    reconstruirEncuestasLimpias_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const limpia = ss.getSheetByName(HOJA_LIMPIA);
    const filas = limpia ? Math.max(0, limpia.getLastRow() - 1) : 0;
    Logger.log('Encuestas_Limpias actualizada · filas: ' + filas);
  } finally {
    lock.releaseLock();
  }
}

function instalarActualizacionCada15Minutos() {
  const fn = 'actualizarEncuestasLimpias';
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(15).create();
  Logger.log('Trigger instalado: actualizarEncuestasLimpias cada 15 minutos.');
}

/* Utilidad de diagnóstico: revisa que existan las pestañas y sus encabezados. */
function verificarCapaLimpia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const enc = ss.getSheetByName(NOMBRE_HOJA);
  const limpia = ss.getSheetByName(HOJA_LIMPIA);
  const meseros = ss.getSheetByName(NOMBRE_HOJA_MESEROS);

  const resumen = {
    encuestas: enc ? Math.max(0, enc.getLastRow() - 1) : 0,
    limpias: limpia ? Math.max(0, limpia.getLastRow() - 1) : 0,
    meseros: meseros ? Math.max(0, meseros.getLastRow() - 1) : 0,
    pestañaLimpia: !!limpia
  };

  Logger.log('=== Verificación de capa limpia ===');
  Logger.log(JSON.stringify(resumen));
  if (limpia && limpia.getLastColumn() > 0) {
    const headers = limpia.getRange(1, 1, 1, limpia.getLastColumn()).getValues()[0].map(String);
    Logger.log('Encuestas_Limpias · columnas: ' + headers.length);
    Logger.log('Contrato: ' + headers.filter(function (h) {
      return ['id', 'timestamp', 'clientName', 'phone', 'birthday', 'dish', 'comment', 'registeredBy', 'quality'].indexOf(h) !== -1;
    }).join(', '));
  } else {
    Logger.log('⚠ Falta la pestaña Encuestas_Limpias. Ejecuta "Datos → Actualizar Encuestas_Limpias".');
  }
  return resumen;
}

/* Ejecuta todo lo necesario después de pegar este archivo. */
function configuracionInicial() {
  actualizarEncuestasLimpias();
  instalarActualizacionCada15Minutos();
  verificarCapaLimpia();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Coronel')
    .addItem('Actualizar Encuestas_Limpias', 'actualizarEncuestasLimpias')
    .addItem('Configurar todo (actualizar + trigger)', 'configuracionInicial')
    .addItem('Instalar actualización cada 15 minutos', 'instalarActualizacionCada15Minutos')
    .addItem('Verificar capa limpia', 'verificarCapaLimpia')
    .addToUi();
}

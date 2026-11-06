# Fuente de datos (Google Sheets): verificación y revisión del Apps Script

> Fecha de verificación: 2026-11-06. Objetivo: confirmar que el dashboard lee bien la fuente y responder si el Apps Script pegado es correcto para la hoja de datos.

## 0. Política: limpieza dentro de la app (sin Apps Script obligatorio)

- El dashboard lee la pestaña **`Encuestas`** y aplica la limpieza en el servidor:
  - descarta filas con comentarios ilegibles de OCR (“Error de lectura”),
  - normaliza la calidad a **Bueno / Regular / Malo**,
  - limpia espacios y caracteres de control en los comentarios.
- **No requiere el Apps Script ni la pestaña `Encuestas_Limpias`** para funcionar. El script queda como capa opcional si algún día quieren una pestaña física separada.
- Si `GOOGLE_SHEET_TAB=Encuestas_Limpias` y la pestaña existe, la app la usa (y también descarta filas con `Estado Registro = Advertencia`).
- Para desactivar la limpieza: `SURVEY_CLEAN_FILTER=false`.
- Si la pestaña configurada no existe, hay respaldo a `Encuestas` con aviso; para prohibirlo: `ALLOW_SHEET_FALLBACK=false`.

Configuración recomendada en Render: `GOOGLE_SHEET_TAB=Encuestas`.

Pasos del Apps Script (opcional): [integrations/apps-script/README.md](../integrations/apps-script/README.md).

## 1. Cómo lee el dashboard la hoja

El dashboard **no usa Apps Script**: lee la hoja pública por HTTP con el endpoint *gviz* de Google Sheets.

```
https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&sheet=<pestaña>&range=<rango>
```

- Variables: `GOOGLE_SHEET_ID` (hoja) y `GOOGLE_SHEET_TAB` (pestaña productiva).
- Si la pestaña configurada no existe o no tiene los encabezados esperados, el backend **sondea solo la fila de encabezados** y cae a la pestaña `Encuestas`.
- Caché en memoria de 60 s por pestaña; el navegador refresca cada 5 min.
- Campos que consume: `ID Único`/`id`/`ID de Envío`, `Timestamp`, `Nombre Cliente`, `Número Contacto`, `Cumpleaños Original`, `Productos Normalizados`, `Opinión Limpia`, `Mesero`/`Registrado Por`, `Calidad Limpia`.
- No requiere token: la hoja debe estar compartida como **“Cualquier persona con el enlace → Lector”**.

Para verificar en cualquier momento:

```bash
node scripts/verify-sheets.mjs https://coronel-dashboard.onrender.com
```

## 2. Resultado de la verificación

| Prueba | Resultado |
|---|---|
| Hoja pública (gviz sin autenticación) | ✅ HTTP 200 en ~0,4 s |
| Pestaña `Encuestas` con encabezados esperados | ✅ `ID Único · Timestamp · ID Cliente · Nombre del Cliente · …` |
| Pestaña configurada `Encuestas_Limpias` | ❌ **no existe** (Google devuelve la primera hoja; se comprobó comparando con un nombre inventado) |
| Dashboard entrega datos | ✅ 112 encuestas, 3 meseros |
| Fuente efectiva usada | ✅ `Google Sheets · Encuestas` (fallback automático) |
| Campos de registros | ✅ id, timestamp, cliente, calidad, cumpleaños, mesero |

**Conclusión:** la conexión a la fuente es correcta y el dashboard muestra datos reales. La limpieza se hace **en la app** sobre `Encuestas`, así que no hace falta crear `Encuestas_Limpias` ni configurar Apps Script.

### Apps Script (opcional)

Solo si quieren una pestaña limpia separada en el Sheet. No es necesario para el dashboard. Si la crean, configuren `GOOGLE_SHEET_TAB=Encuestas_Limpias` en Render.

## 3. ¿Es correcto el Apps Script pegado?

El script es la **app de captura** (formulario + OCR con OCR.space + reconstrucción de la capa limpia). No es necesario para que el dashboard funcione, pero es **compatible** con él si se despliega bien.

### Lo que hace bien

- Web App con `doPost` (guardado) y `doGet` (statu;s/consultas) con JSONP.
- Protección por `TOKEN_APP` en `doGet`; token opcional en `doPost`.
- Flujo OCR en 2 pasos con caché (evita depender de la respuesta del POST, correcto).
- IDs únicos `ENC-000001` con `ScriptProperties` + reparación de filas importadas.
- Catálogos de clientes, meseros, productos y relaciones.
- Capa `Encuestas_Limpias` con contrato estable para el dashboard.
- Trigger cada 15 minutos disponible en el menú **Datos**.

### Problemas a corregir antes de usarlo

1. **Placeholders sin reemplazar**
   - `TOKEN_APP = 'PEGAR_TOKEN_NUEVO_AQUI'` → todas las acciones con token fallarán.
   - `OCR_SPACE_API_KEY = 'PEGAR_API_KEY_OCR_NUEVA_AQUI'` → el OCR no funcionará.
   - La validación de la key OCR está mal: compara `indexOf('PEGUE_AQUI') === 0`, pero el placeholder empieza con `PEGAR_`. Corregir a, por ejemplo:
     ```js
     if (!OCR_SPACE_API_KEY || OCR_SPACE_API_KEY.indexOf('PEGAR') === 0 || OCR_SPACE_API_KEY.length < 20) {
       return responder({ status: 'error', mensaje: 'Falta configurar OCR_SPACE_API_KEY.' });
     }
     ```

2. **POST abierto**: `REQUIRIR_TOKEN_POST = false`. Cualquiera con la URL `/exec` podría insertar filas. Si el formulario ya envía `token`, ponerlo en `true`.

3. **El token del cliente no es un secreto**: va en `index.html` público. Sirve como disuasión, no como seguridad real. Para datos sensibles, validar además longitud/formato y considerar límites de cuota.

4. **Trigger no instalado**: sin ejecutar `instalarActualizacionCada15Minutos`, `Encuestas_Limpias` no se actualiza (o no se crea). Verificar en **Activadores** del proyecto.

5. **Encabezados del contrato**: el dashboard lee las columnas humanas dentro de `A:Z` (`ID Único`, `Timestamp`, `Nombre Cliente`, etc.). Si se renombran esas columnas, el dashboard pedirá fallback o no encontrará los datos. Las columnas contrato en minúsculas (`id`, `timestamp`, …) están en `Z`/`AA` y **no** son las que usa el dashboard.

6. **Costo/tiempo del trigger**: reconstruir `Encuestas_Limpias` con 44 columnas cada 15 min puede acercarse a los límites de Apps Script si la hoja crece mucho. Si la hoja supera ~5–10 mil filas, pasar a un proceso por lotes o dejar el dashboard leyendo `Encuestas`.

7. **Seguridad del PIN**: `PIN_ADMIN = '5956'` está en el script y coincide con el PIN del dashboard. Cámbialo si el repositorio del script se comparte.

### Checklist para activar la capa limpia

- [ ] Reemplazar `TOKEN_APP` y `OCR_SPACE_API_KEY`.
- [ ] (Opcional) `REQUIRIR_TOKEN_POST = true` y enviar token desde el formulario.
- [ ] Implementar → Gestionar implementaciones → **Nueva versión** (la URL `/exec` no cambia).
- [ ] Menú **Datos → Actualizar Encuestas_Limpias** (crea la pestaña).
- [ ] Menú **Datos → Instalar actualización cada 15 minutos**.
- [ ] Verificar que la pestaña exista y tenga `ID Único` y `Timestamp` en la fila 1.
- [ ] Ejecutar `node scripts/verify-sheets.mjs` y confirmar que la pestaña configurada ya existe.

## 4. Recomendaciones de operación

- Mantener la hoja compartida como **Lector público** para gviz; no hace falta publicar en la web.
- No cambiar los nombres de las columnas que consume el dashboard.
- Revisar una vez al mes que la pestaña productiva tenga datos recientes (el dashboard muestra `Actualizado HH:MM`).
- Si se migra a la capa limpia, dejar `GOOGLE_SHEET_TAB=Encuestas_Limpias`; si no, usar `Encuestas`.

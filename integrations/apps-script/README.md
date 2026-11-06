# Apps Script de captura → capa limpia (Encuestas_Limpias)

Este documento explica cómo dejar el Google Apps Script (`Código.gs`) correctamente configurado para que genere la pestaña **Encuestas_Limpias**, que es la **fuente de análisis** del dashboard.

> ⚠️ **Los valores reales (token, API key de OCR y PIN) no se guardan en este repositorio público.** Están en `integrations/apps-script/SECRETOS.local.md`, que está en `.gitignore` y se generó en tu equipo. Si ese archivo no existe, pídelos de nuevo.

## 1. Qué hace el script

- `doPost`: recibe el formulario/OCR y guarda la encuesta en la pestaña **Encuestas**.
- `OCR.space`: proxy para leer fotos del formulario (la API key queda en el servidor).
- `reconstruirEncuestasLimpias_`: reconstruye **Encuestas_Limpias** con columnas normalizadas (contrato del dashboard).
- `doGet`: statu;s de envío, catálogo de meseros, etc.

El dashboard **no llama a este script**: lee la hoja pública con *gviz*. El script solo alimenta y limpia los datos.

## 1.1 Archivos de este directorio

- `Codigo.gs`: versión **sin secretos** (la que se publica en el repo).
- `Codigo.local.gs`: misma versión **con token, PIN y API key reales** (no se sube a Git). **Usa esta para pegar en Apps Script.**


## 2. Cambios obligatorios en `Código.gs`

Busca y reemplaza estas constantes:

```js
/* 1) Token: debe ser EXACTAMENTE el mismo que TOKEN_APP de index.html */
const TOKEN_APP = '<TOKEN_REAL>';

/* 2) PIN para eliminar meseros / operaciones sensibles */
const PIN_ADMIN = '<PIN_REAL>';

/* 3) API key de OCR.space */
const OCR_SPACE_API_KEY = '<OCR_KEY_REAL>';

/* 4) Exigir token también en el POST de guardado: se deja en false para no
      romper el formulario si aún no envía token; cámbialo a true al confirmarlo */
const REQUIRIR_TOKEN_POST = false;
```

> Los valores reales están en `SECRETOS.local.md` (local, no versionado).

### 2.1 Corregir la validación de la API key OCR (bug)

La condición actual no detecta el placeholder:

```js
// ❌ actual
if (!OCR_SPACE_API_KEY || OCR_SPACE_API_KEY.indexOf('PEGUE_AQUI') === 0) {
```

Cámbiala por:

```js
// ✅ corregida
if (!OCR_SPACE_API_KEY || OCR_SPACE_API_KEY.indexOf('PEGAR') === 0 || OCR_SPACE_API_KEY.length < 20) {
```

### 2.2 Verificar que el formulario envíe el token

Si `REQUIRIR_TOKEN_POST = true`, el `index.html` del formulario debe enviar `token` en el cuerpo del POST. Además su `TOKEN_APP` debe coincidir con el del script.

## 3. Pasos para publicar

1. Pega los cambios en el editor de Apps Script y guarda.
2. **Implementar → Gestionar implementaciones → ✏️ → Nueva versión → Implementar** (la URL `/exec` no cambia).
3. En la hoja: menú **Coronel → Configurar todo (actualizar + trigger)**.
   - Si el menú **Coronel** no aparece: guarda el script, recarga la hoja (F5) y vuelve a mirar.
   - Alternativa sin menú: en el editor de Apps Script elige la función `configuracionInicial` y pulsa **Ejecutar**.
4. Menú **Coronel → Instalar actualización cada 15 minutos** (si no usaste “Configurar todo”).
5. Verifica en el Sheet que exista la pestaña **Encuestas_Limpias** con `ID Único` y `Timestamp` en la fila 1.
6. Ejecuta la verificación del dashboard:

```bash
node scripts/verify-sheets.mjs https://coronel-dashboard.onrender.com
```

Debe pasar de “⚠ pestaña no existe / fallback” a “✅ pestaña limpia” y la fuente efectiva debe ser `Encuestas_Limpias`.

## 4. Después de crear la pestaña

- El dashboard la detecta sola (caché de 60 s). El aviso **“⚠ Fuente limpia no disponible”** desaparece.
- Las filas marcadas como inválidas por la capa limpia (`Estado Registro` = Advertencia, o comentario = “Error de lectura”) se **descartan** automáticamente para los análisis.
- Si en algún momento la pestaña desaparece, el dashboard vuelve a mostrar `Encuestas` con el aviso.
- Para **prohibir** el fallback y detener el dashboard en lugar de mostrar datos sin depurar, configura en Render:

```
ALLOW_SHEET_FALLBACK=false
```

## 5. Seguridad

- No agregues token, API key ni PIN al repositorio ni a capturas de pantalla.
- El token del formulario viaja en el HTML público (`index.html`): sirve como disuasión, no como secreto.
- Rota la API key de OCR.space si se comparte el script.
- `PIN_ADMIN` y el `ADMIN_PIN` del dashboard deberían mantenerse alineados o cambiarse juntos.

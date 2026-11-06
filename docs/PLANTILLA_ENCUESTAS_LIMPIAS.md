# Plantilla: pestaña `Encuestas_Limpias` (sin Apps Script)

Objetivo: tener **una pestaña física en el Google Sheet** con los datos limpios y normalizados, y que el dashboard use **esa misma pestaña**. Las fórmulas se recalculan solas cuando se agregan encuestas en `Encuestas`.

## 1. Crear la pestaña

1. Abre el Google Sheet.
2. Abajo, en la lista de pestañas: **+** → crear hoja → renómbrala exactamente:
   ```
   Encuestas_Limpias
   ```
3. Haz clic en la celda **A1** de la nueva pestaña.

## 2. Pegar encabezados y fórmulas

1. Abre el archivo [Encuestas_Limpias.tsv](Encuestas_Limpias.tsv) con el Bloc de notas (doble clic; si no se abre, clic derecho → Abrir con → Bloc de notas).
2. `Ctrl+A` y `Ctrl+C`.
3. En la hoja, con A1 seleccionada, `Ctrl+V`.
4. Deben quedar **10 columnas** (A a J) y **2 filas**: encabezados en la fila 1 y fórmulas en la fila 2.
   - No escribas nada debajo de la fila 2.
   - Si Google muestra “Se necesita ampliar el resultado de la matriz”, borra cualquier contenido de las filas 3 en adelante.

> Si tu Google Sheets usa **punto y coma** como separador de fórmulas (configuración regional), reemplaza las comas `,` por `;` en las fórmulas.

## 3. Verificar que la pestaña funciona

- Debe mostrar una fila por cada encuesta cuyo ID no esté vacío.
- La columna **Calidad Limpia** debe decir `Bueno`, `Regular`, `Malo` o vacío.
- La columna **Estado Registro** debe decir `Válido` o `Advertencia: …`.
- Las encuestas con comentario ilegible de OCR aparecen como `Error de lectura` y `Advertencia: error de lectura` (el dashboard las descarta).

## 4. Activar en la app

La app ya está configurada con `GOOGLE_SHEET_TAB=Encuestas_Limpias` en Render. En cuanto la pestaña exista, el dashboard la detecta sola (≤60 s) y empieza a mostrar **exactamente los mismos datos** que ves en la pestaña.

Verificación:

```bash
node scripts/verify-sheets.mjs https://coronel-dashboard.onrender.com
```

Debe reportar:
- `pestaña configurada existe` ✅
- `fuente efectiva: Google Sheets · Encuestas_Limpias` ✅
- `fallbackUsed=false` ✅

## 5. Notas

- Si borras la pestaña, la app vuelve temporalmente a `Encuestas` (limpiando en la app) sin romperse.
- Si más adelante quieres que la pestaña tenga más columnas (edad, productos normalizados, etc.), el Apps Script opcional genera una versión extendida; esta plantilla cubre lo que consume el dashboard.
- No edites las fórmulas a mano salvo que sepas lo que haces; para cambiar reglas de limpieza, edita la fórmula de la columna correspondiente.

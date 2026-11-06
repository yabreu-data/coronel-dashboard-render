# Análisis de calidad y normalización de datos — Restaurante Coronel

> Fuente: Google Sheet `1q9WMz…` · pestañas `Encuestas` (captura) y `Encuestas_Limpias` (capa limpia).
> Fecha del análisis: 2026-11-06. Muestras: 66 filas en `Encuestas` y 112 en `Encuestas_Limpias`.

## 1. Resumen ejecutivo

El dataset es pequeño pero **ya permite análisis serios**; el problema no es el volumen sino la **consistencia entre capas**. Hallazgos principales:

1. **La capa limpia está desactualizada**: `Encuestas_Limpias` tiene 112 filas, `Encuestas` solo 66. Hay **46 filas que ya no existen en la fuente** (IDs ENC-000001 a ENC-000046, del 18 al 21/09). La app las descarta por estado “Advertencia”, pero la hoja limpia las conserva. Hay que decidir: **restaurarlas** o **reconstruir la capa limpia**.
2. **Bug de mapeo en la capa limpia** (desplazamiento de 3 columnas): las columnas humanas de edad y parte del contrato estaban corridas (`Estado Edad` contenía fechas). **Corregido en el script actualizado.**
3. **Pérdida de la hora** en el `Timestamp` de las 66 filas actuales (la captura sí tiene hora). **Corregido** (formato `dd/MM/yyyy HH:mm:ss`).
4. **Fechas inválidas por parseo**: 46 filas con fecha de texto `dd/mm/yyyy` quedaban como “Advertencia: fecha inválida”. **Corregido** con un parser robusto.
5. **Nombres sin normalizar**: 39 nombres fuera de formato título (`HUMBERTO julon LARA`, `LISSETH M. SONSOR`, etc.). **Corregido** (formato título con partículas).
6. **Edades imposibles**: 7 registros con edad 0, −1 u 8 por años de nacimiento 2026/futuros. Falta validación en captura.
7. **Mesero mal clasificado**: 25 encuestas tienen `Mesero = "Cliente (Formulario Web)"`; eso no es un mesero, es la **fuente**. Contamina el ranking de meseros.
8. **Comentarios pobres**: 20,5 % vacíos, 2 con el placeholder de la interfaz (`● ¿Qué te pareció nuestro`), 2 con “Error de lectura” y respuestas repetidas (`Todo bien` ×5, `Todo Bien` ×2).
9. **Producto demasiado agregado**: solo 4 categorías (Pollo, Parrillas, Criollos, Otros); “Otros” representa ~25 %. No se puede responder bien “qué plato pide más”.
10. **Privacidad**: la hoja es pública vía gviz y expone teléfonos. Para analítica externa conviene enmascarar o servir por API.

## 2. Perfil del dataset

| Indicador | Valor |
|---|---|
| Encuestas en captura (`Encuestas`) | 66 |
| Filas en `Encuestas_Limpias` | 112 (66 vigentes + 46 obsoletas) |
| Rango de fechas (captura) | 2026-09-25 → 2026-11-04 |
| Fuente | Registro por mesero 87 · Formulario Web 25 |
| Meseros | Shirley 37 · Betty 25 · Sr. Carlos 25 · “Cliente (Formulario Web)” 25 |
| Calidad | Bueno 96 · Regular 9 · Malo 1 · vacío 6 |
| Cumpleaños | 107 con año · 5 sin año; parseables 112/112 |
| Edad calculable | 105/112 (media 37,9; mediana 37; rango 0–80) |
| Productos | 11 combinaciones · 4 categorías base |
| Comentarios | 81 únicos · 23 vacíos (20,5 %) |
| Teléfonos | 108 únicos · 2 vacíos · 3 repetidos |
| Duplicados exactos (timestamp+nombre+teléfono) | 0 |
| Encuestas con hora | 66/66 en captura; 0/66 en la capa limpia (pérdida de hora) |

## 3. Hallazgos detallados

### 3.1 Consistencia entre capas (crítico)

- `Encuestas_Limpias` **no se reconstruyó** después de que se borraran 46 filas de `Encuestas`.
- Las 46 obsoletas son ENC-000001…046 (18–21/09), con estado “Advertencia: fecha inválida”.
- La app lee la capa limpia y filtra las advertencias → muestra 66, no 112. **El 66 es el dato vigente**, pero la hoja limpia miente al conservar 112.
- IDs faltantes: `47, 48, 49` (nunca existieron) y `96` (hueco de secuencia). Conviene documentar/reparar.

**Regla:** la capa limpia debe ser **siempre reconstruible** y validarse contra la fuente (conteo e IDs). Nunca editar la capa limpia a mano.

### 3.2 Fechas y timestamps

- La captura guarda `dd/MM/yyyy HH:mm:ss`; la capa limpia perdía la hora por formato de columna.
- 46 filas con fecha en texto no se parseaban (`new Date('29/9/2026')` → inválido). Corregido.
- Horas de registro (captura): 23 h (15), 21 h (12), 18 h (10), 19 h (7), 22 h (6). **Concentración nocturna**; útil para turnos y dotación.
- No hay zona horaria explícita. Recomendación: almacenar ISO 8601 con offset (`2026-09-25T18:42:23-05:00`) o UTC + hora local.

### 3.3 Nombres

- 39/112 fuera de formato título; 16 todo mayúsculas; 1 empieza en minúscula; 1 con dígitos; 1 con carácter griego (`Μ` en “Lily Guevara Μoreno”); 1 con espacios dobles.
- Riesgo: clientes duplicados al comparar nombres (`Luis` vs `LUIS`).
- Regla propuesta: trim + colapsar espacios + quitar caracteres de control + **formato título** respetando `de/del/la/los/y`; normalizar caracteres griegos/latinos confundibles; conservar tildes.
- No usar el nombre como clave; usar teléfono normalizado o `ID Cliente`.

### 3.4 Cumpleaños y edad

- Formatos: 92 `dd/mm/yyyy`, 15 `dd/mm/yy`, 5 `dd/mm` (sin año).
- 5 sin año → edad desconocida legítima.
- **7 edades improbables**: 4 con año 2026 (edad 0), 2 con cumpleaños futuro (edad −1), 1 con 8 años. Ejemplos:
  - `David Rojas Lopez` · 23/09/2026 (encuesta 29/09/2026)
  - `Jessica Modesta Nuñez` · 03/11/2026 (encuesta 03/10/2026) → futuro
  - `JUSTO LLANCO` · 09/08/2026 (encuesta 03/10/2026)
- Regla propuesta:
  - año entre 1900 y el año actual; si es el año actual, la fecha no puede ser futura;
  - marcar `Revisar edad` si edad < 12 o > 90 (no eliminar automáticamente: puede haber niños/adultos mayores reales);
  - capturar con **selector de fecha** y validación de año, no texto libre.
- La columna `Edad al Responder` estaba desalineada por el bug de mapeo; tras la corrección queda correcta.

### 3.5 Teléfonos y clientes

- 108 teléfonos únicos, 2 vacíos, 3 repetidos en varias encuestas (6 registros), 1 teléfono con dos nombres distintos.
- No hay longitudes inválidas (todos 9 dígitos cuando existen).
- Recomendación:
  - teléfono **obligatorio**, solo dígitos, exactamente 9;
  - clave de cliente = teléfono normalizado; si no hay teléfono, usar `nombre+fecha` y marcar “cliente sin teléfono”;
  - detectar mismo teléfono con nombres distintos y pedir confirmación;
  - no duplicar clientes por diferencias de nombre.

### 3.6 Calidad

- Distribución limpia: Bueno 96 (85,7 %), Regular 9 (8 %), Malo 1 (0,9 %), vacío 6 (5,4 %).
- En la captura existe `Sin calificar` (1), pero la capa limpia lo convierte en vacío: **se pierde la distinción** entre “no respondió” y “dato faltante”.
- Recomendación: enum cerrado `Bueno | Regular | Malo | Sin calificar`, con `Sin calificar` explícito; no usar vacío.
- Calidad por fuente (limpias): Formulario Web 20 Bueno / 4 Regular / 1 Malo; Registro por mesero 76 Bueno / 5 Regular / 6 vacío.

### 3.7 Comentarios

- 23 vacíos (20,5 %), 81 únicos.
- Repetidos: `Todo bien` (5), `Todo Bien` (2), `Estuvo todo bueno y agradable` (2), `Ventilador` (2), `● ¿Qué te pareció nuestro` (2), `Error de lectura` (2).
- Placeholder de UI y textos de una sola palabra (“Ventilador”) no aportan a análisis.
- Recomendación:
  - eliminar placeholders y caracteres de control;
  - catálogo de respuestas equivalentes: `todo bien|todo ok|todo excelente` → categoría “Todo bien”;
  - longitud mínima 3 y descartar comentarios que no sean texto;
  - marcar idioma, groserías y spam;
  - análisis de sentimiento/aspectos (comida, servicio, ambiente, precio, tiempo) y extracción de temas.

### 3.8 Productos

- 11 combinaciones; categorías: Pollo 75, Otros 28, Parrillas 20, Criollos 9.
- “Otros” (~25 %) demasiado alto; no hay plato específico (ej. “Pollo a la brasa”, “Lomo saltado”).
- Regla propuesta:
  - catálogo `Producto` + `Categoría` (Pollo, Parrillas, Criollos, Otros);
  - separar por `;`/`+`, quitar duplicados y normalizar sinónimos;
  - si se elige “Otros”, pedir detalle obligatorio;
  - enlazar con `Productos`/`Encuesta_Productos` para análisis plato × calidad.

### 3.9 Meseros y fuente

- `Cliente (Formulario Web)` aparece como mesero en 25 encuestas. **No es mesero**; es el origen del registro.
- Los nombres están en mayúsculas (`SHIRLEY`, `BETTY`, `Sr. CARLOS`).
- Recomendación:
  - `Mesero` solo para meseros reales (catálogo `MES-*`);
  - `Fuente` = `Formulario Web` / `Registro por mesero`;
  - si es formulario web, `Mesero` vacío y `Registrado Por = Cliente (Formulario Web)`;
  - ranking de meseros solo con registros por mesero; excluir web y “Otros”.

### 3.10 Contrato y encabezados

- La tabla limpia tiene **dos columnas con el mismo nombre lógico** (`Timestamp` y `timestamp`), lo que rompe pandas/SQL/BI (colisión case-insensitive).
- Había **desplazamiento de 3 columnas** en el contrato y en las edades humanas. Corregido en el script actualizado.
- Recomendación: nombres únicos y estables; documentar el contrato (versión) y validar encabezados al reconstruir.

### 3.11 Duplicados

- 0 duplicados exactos por `(timestamp, nombre, teléfono)`.
- 3 teléfonos con más de una encuesta (6 registros): puede ser cliente recurrente legítimo o doble envío.
- Regla: detectar mismo teléfono en ventana corta (p. ej. 10 minutos) y avisar; conservar `ID de Envío` como idempotencia.

### 3.12 Privacidad

- La hoja es pública (gviz) y contiene nombres y teléfonos. Para uso interno es aceptable; para compartir análisis, exportar con teléfono enmascarado (`9xx xxx xxx`) o servir por API con autenticación.
- Los logs de Apps Script también pueden contener datos; cuidar su retención.

## 4. Reglas de normalización propuestas (data dictionary)

| Campo | Regla | Ejemplo / válvula |
|---|---|---|
| Nombre | title case, partículas en minúscula, trim, sin dígitos | `HUMBERTO julon LARA` → `Humberto Julon Lara` |
| Teléfono | solo dígitos, 9 caracteres, obligatorio | `+51 987 654 321` → `987654321` |
| Cumpleaños | `dd/mm/yyyy`; año 1900–actual; no futuro; edad 12–90 o marcar revisión | `03/11/2026` → `Revisar edad` |
| Calidad | enum `Bueno/Regular/Malo/Sin calificar` | vacío → `Sin calificar` |
| Comentario | trim, sin control/placeholder, min 3; mapa de respuestas comunes | `● ¿Qué te pareció nuestro` → vacío |
| Producto | categoría + detalle; split `;`/`+`; sinónimos; título | `pollo + otros` → `Pollo; Otros` |
| Mesero | solo catálogo `MES-*`; web → vacío | `Cliente (Formulario Web)` → `Fuente=Formulario Web` |
| Fuente | `Formulario Web` / `Registro por mesero` | — |
| Timestamp | ISO 8601 con zona; mostrar `dd/MM/yyyy HH:mm:ss` | `2026-09-25T18:42:23-05:00` |
| Estado | códigos, no texto libre | `OK`, `SIN_ID`, `FECHA_INVALIDA`, `EDAD_REVISAR` |
| Edad | derivada de cumpleaños y fecha; no capturada a mano | — |
| IDs | ENC/CLI/MES/PROD/REL, sin reutilizar; documentar huecos | ENC-000096 faltante |

## 5. Validaciones recomendadas en la captura

- Campos obligatorios: nombre, teléfono, cumpleaños, plato, calidad.
- Teléfono con máscara y validación de 9 dígitos.
- Cumpleaños con selector de fecha o 3 campos día/mes/año; rechazar futuro.
- Calidad con botones/dropdown (no texto libre).
- Plato con categoría + detalle; “Otros” exige especificar.
- Comentario con longitud mínima y limpieza de placeholders.
- Aviso de duplicado por teléfono (ventana de tiempo).
- Idempotencia por `ID de Envío` (ya existe).
- Registrar `fuente` y `mesero` por separado.

## 6. Monitoreo y gobierno de datos

- Dashboard de calidad diario: filas fuente vs limpias, filas obsoletas, fechas inválidas, duplicados, % nulos, edades fuera de rango, cambios de distribución.
- Alertas si: limpias ≠ fuente ±2; fecha inválida > 0; nombres sin título > 5 %; comentarios vacíos > 30 %; “Otros” > 30 %.
- **Nunca borrar filas de `Encuestas`**: archivar (`Archivadas`) o marcar inactivo. La capa limpia puede reconstruirse; una fila borrada se pierde.
- Versionar el contrato (v1, v2) y probar el rebuild en una copia antes de producción.
- Backup semanal de la hoja (copia o export CSV) y de Supabase.
- Control de acceso y enmascarado de PII para análisis.

## 7. Analítica que se habilita con estos arreglos

- **Clientes**: recencia, frecuencia, ticket (si se agrega monto), RFM, cohortes por mes, recompra, clientes en riesgo.
- **Cumpleaños**: conversión por etapa (mes/semana/día), canal, responsable, tiempo de respuesta, redención.
- **Meseros**: ranking con intervalos de confianza (Wilson), calidad promedio, volumen, evolución mensual; separar web.
- **Productos**: plato × calidad, top/bottom, combinaciones, categoría; “Otros” como señal de captura incompleta.
- **Texto**: sentimiento global y por aspecto (comida, servicio, ambiente, precio, tiempo); temas frecuentes; quejas.
- **Operación**: horas de mayor registro, días, estacionalidad, turnos.

## 8. Priorización

| Prioridad | Acción | Impacto | Esfuerzo |
|---|---|---|---|
| P0 | Decidir restaurar las 46 filas o reconstruir la capa limpia | Alto | Bajo |
| P0 | Reejecutar script con correcciones (mapeo, hora, fechas, título) | Alto | Bajo |
| P0 | Validar cumpleaños/teléfono en captura | Alto | Medio |
| P1 | Separar `Fuente` de `Mesero` (web no es mesero) | Alto | Bajo |
| P1 | Enum de calidad con `Sin calificar` | Medio | Bajo |
| P1 | Normalizar comentarios (placeholders, respuestas comunes) | Medio | Medio |
| P1 | Detalle de producto / categoría; “Otros” obligatorio | Alto | Medio |
| P2 | Data dictionary + validación de contrato | Medio | Bajo |
| P2 | Monitoreo de calidad y alertas | Alto | Medio |
| P2 | Enmascarar PII en exportaciones | Medio | Bajo |
| P3 | Sentimiento/aspectos y temas | Alto | Alto |

## 9. Acciones inmediatas sugeridas

1. **Restaurar o aceptar** las 46 filas eliminadas: si fueron un error, recuperarlas de `Encuestas_Limpias` (ya están allí) antes de reconstruir; si fueron intencionales, reconstruir y asumir 66.
2. Reemplazar `Código.gs` con la versión actualizada (incluye mapeo, hora, fechas y nombres) y ejecutar `actualizarEncuestasLimpias`.
3. Verificar que la capa limpia quede con **66 o 112 filas según la decisión**, con 0 advertencias de fecha, Timestamp con hora y edades correctas.
4. Implementar validaciones de captura (teléfono, cumpleaños, calidad, producto).
5. Definir el catálogo de productos y separar fuente/mesero.

## 10. Estado del script (correcciones ya aplicadas)

- ✅ Parseo robusto de fechas `dd/mm/yyyy` (texto o fecha).
- ✅ Formato título en nombres, meseros, fuentes y productos.
- ✅ Corrección del desplazamiento de 3 columnas (edad humana + contrato).
- ✅ `Timestamp` y `Fecha Procesamiento` con hora.
- ✅ Limpieza de placeholder `●` en comentarios.
- ⏳ Pendiente: separar `Fuente` de `Mesero`, validación de cumpleaños/teléfono en captura, enum de calidad con `Sin calificar`, detalle de producto y monitoreo.

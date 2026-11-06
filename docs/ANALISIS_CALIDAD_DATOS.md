# AnÃ¡lisis de calidad y normalizaciÃ³n de datos â€” Restaurante Coronel

> Fuente: Google Sheet `1q9WMzâ€¦` Â· pestaÃ±as `Encuestas` (captura) y `Encuestas_Limpias` (capa limpia).
> Fecha del anÃ¡lisis: 2026-11-06. Muestras: 112 filas en `Encuestas` y 112 en `Encuestas_Limpias`.

> Nota tÃ©cnica: gviz devuelve la data **transpuesta** cuando se le pide un rango
> grande (mÃ¡s de ~42 filas). El dashboard lee por bloques de 40 filas; una
> lectura directa de `A1:M2000` ve solo 66 filas y parece que faltan datos.
> Para analizar hay que leer por bloques o por columna.

## 1. Resumen ejecutivo

El dataset es pequeÃ±o pero **ya permite anÃ¡lisis serios**; el problema no es el volumen sino la **consistencia entre capas**. Hallazgos principales:

1. **46 filas con fecha invÃ¡lida**: 112 filas en total, pero 46 quedaron como â€œAdvertencia: fecha invÃ¡lidaâ€ porque el parser antiguo no entendÃ­a `dd/mm/yyyy` en texto. No son filas borradas: estÃ¡n en la fuente. **Corregido**; al reejecutar deben quedar 112 vÃ¡lidas.
2. **Bug de mapeo en la capa limpia** (desplazamiento de 3 columnas): las columnas humanas de edad y parte del contrato estaban corridas (`Estado Edad` contenÃ­a fechas). **Corregido en el script actualizado.**
3. **PÃ©rdida de la hora** en el `Timestamp` de las filas recientes (la captura sÃ­ tiene hora). **Corregido** (formato `dd/MM/yyyy HH:mm:ss`).
4. **Fechas invÃ¡lidas por parseo**: 46 filas con fecha de texto `dd/mm/yyyy` quedaban como â€œAdvertencia: fecha invÃ¡lidaâ€. **Corregido** con un parser robusto.
5. **Nombres sin normalizar**: 39 nombres fuera de formato tÃ­tulo (`HUMBERTO julon LARA`, `LISSETH M. SONSOR`, etc.). **Corregido** (formato tÃ­tulo con partÃ­culas).
6. **Edades imposibles**: 7 registros con edad 0, âˆ’1 u 8 por aÃ±os de nacimiento 2026/futuros. Falta validaciÃ³n en captura.
7. **Mesero mal clasificado**: 25 encuestas tienen `Mesero = "Cliente (Formulario Web)"`; eso no es un mesero, es la **fuente**. Contamina el ranking de meseros.
8. **Comentarios pobres**: 20,5 % vacÃ­os, 2 con el placeholder de la interfaz (`â— Â¿QuÃ© te pareciÃ³ nuestro`), 2 con â€œError de lecturaâ€ y respuestas repetidas (`Todo bien` Ã—5, `Todo Bien` Ã—2).
9. **Producto demasiado agregado**: solo 4 categorÃ­as (Pollo, Parrillas, Criollos, Otros); â€œOtrosâ€ representa ~25 %. No se puede responder bien â€œquÃ© plato pide mÃ¡sâ€.
10. **Privacidad**: la hoja es pÃºblica vÃ­a gviz y expone telÃ©fonos. Para analÃ­tica externa conviene enmascarar o servir por API.

## 2. Perfil del dataset

| Indicador | Valor |
|---|---|
| Encuestas en captura (`Encuestas`) | 112 |
| Filas en `Encuestas_Limpias` | 112 |
| Rango de fechas (captura) | 2026-09-25 â†’ 2026-11-04 |
| Fuente | Registro por mesero 87 Â· Formulario Web 25 |
| Meseros | Shirley 37 Â· Betty 25 Â· Sr. Carlos 25 Â· â€œCliente (Formulario Web)â€ 25 |
| Calidad | Bueno 96 Â· Regular 9 Â· Malo 1 Â· vacÃ­o 6 |
| CumpleaÃ±os | 107 con aÃ±o Â· 5 sin aÃ±o; parseables 112/112 |
| Edad calculable | 105/112 (media 37,9; mediana 37; rango 0â€“80) |
| Productos | 11 combinaciones Â· 4 categorÃ­as base |
| Comentarios | 81 Ãºnicos Â· 23 vacÃ­os (20,5 %) |
| TelÃ©fonos | 108 Ãºnicos Â· 2 vacÃ­os Â· 3 repetidos |
| Duplicados exactos (timestamp+nombre+telÃ©fono) | 0 |
| Encuestas con hora | 112/112 en captura; 46/112 en la capa limpia (pÃ©rdida de hora en el resto) |

## 3. Hallazgos detallados

### 3.1 Consistencia y lectura de la fuente

- `Encuestas` y `Encuestas_Limpias` tienen **112 filas cada una**: no hay filas perdidas.
- El â€œ66â€ que se ve en algunas lecturas es un **artefacto de gviz**: al pedir un
  rango grande devuelve las columnas transpuestas. El dashboard lee por bloques
  de 40 filas y sÃ­ ve las 112.
- **46 filas** quedaron en estado â€œAdvertencia: fecha invÃ¡lidaâ€ por el parser
  antiguo de fechas en texto. Al reejecutar el script corregido deben quedar
  112 vÃ¡lidas.
- IDs faltantes: `47, 48, 49` (nunca existieron) y `96` (hueco de secuencia).
  Conviene documentar/reparar y no reutilizar nÃºmeros.

**Regla:** la capa limpia debe ser **siempre reconstruible** y validarse contra
la fuente (conteo e IDs). Nunca editar la capa limpia a mano.

### 3.2 Fechas y timestamps

- La captura guarda `dd/MM/yyyy HH:mm:ss`; la capa limpia perdÃ­a la hora en 66
  filas por formato de columna.
- 46 filas con fecha en texto no se parseaban (`new Date('29/9/2026')` â†’ invÃ¡lido). Corregido.
- Horas de registro (captura): 23 h (15), 21 h (12), 18 h (10), 19 h (7), 22 h (6). **ConcentraciÃ³n nocturna**; Ãºtil para turnos y dotaciÃ³n.
- No hay zona horaria explÃ­cita. RecomendaciÃ³n: almacenar ISO 8601 con offset (`2026-09-25T18:42:23-05:00`) o UTC + hora local.

### 3.3 Nombres

- 39/112 fuera de formato tÃ­tulo; 16 todo mayÃºsculas; 1 empieza en minÃºscula; 1 con dÃ­gitos; 1 con carÃ¡cter griego (`Îœ` en â€œLily Guevara Îœorenoâ€); 1 con espacios dobles.
- Riesgo: clientes duplicados al comparar nombres (`Luis` vs `LUIS`).
- Regla propuesta: trim + colapsar espacios + quitar caracteres de control + **formato tÃ­tulo** respetando `de/del/la/los/y`; normalizar caracteres griegos/latinos confundibles; conservar tildes.
- No usar el nombre como clave; usar telÃ©fono normalizado o `ID Cliente`.

### 3.4 CumpleaÃ±os y edad

- Formatos: 92 `dd/mm/yyyy`, 15 `dd/mm/yy`, 5 `dd/mm` (sin aÃ±o).
- 5 sin aÃ±o â†’ edad desconocida legÃ­tima.
- **7 edades improbables**: 4 con aÃ±o 2026 (edad 0), 2 con cumpleaÃ±os futuro (edad âˆ’1), 1 con 8 aÃ±os. Ejemplos:
  - `David Rojas Lopez` Â· 23/09/2026 (encuesta 29/09/2026)
  - `Jessica Modesta NuÃ±ez` Â· 03/11/2026 (encuesta 03/10/2026) â†’ futuro
  - `JUSTO LLANCO` Â· 09/08/2026 (encuesta 03/10/2026)
- **Sobre el aÃ±o 2026**: el script **no debe inventar el aÃ±o**. Si el formulario
  envÃ­a solo `dd/mm`, se guarda sin aÃ±o y la edad queda â€œDesconocidaâ€. Los 4
  casos con aÃ±o 2026 son valores explÃ­citos del formulario (probablemente el
  formulario pone el aÃ±o actual por defecto). Regla: no asignar aÃ±o; si el aÃ±o
  es mayor que el de la encuesta â†’ â€œRevisarâ€; edad < 12 o > 90 â†’ â€œRevisarâ€.
- Regla propuesta:
  - aÃ±o entre 1900 y el aÃ±o actual; si es el aÃ±o actual, la fecha no puede ser futura;
  - marcar `Revisar edad` si edad < 12 o > 90 (no eliminar automÃ¡ticamente: puede haber niÃ±os/adultos mayores reales);
  - capturar con **selector de fecha** y validaciÃ³n de aÃ±o, no texto libre.
- La columna `Edad al Responder` estaba desalineada por el bug de mapeo; tras la correcciÃ³n queda correcta.

### 3.5 TelÃ©fonos y clientes

- 108 telÃ©fonos Ãºnicos, 2 vacÃ­os, 3 repetidos en varias encuestas (6 registros), 1 telÃ©fono con dos nombres distintos.
- No hay longitudes invÃ¡lidas (todos 9 dÃ­gitos cuando existen).
- RecomendaciÃ³n:
  - telÃ©fono **obligatorio**, solo dÃ­gitos, exactamente 9;
  - clave de cliente = telÃ©fono normalizado; si no hay telÃ©fono, usar `nombre+fecha` y marcar â€œcliente sin telÃ©fonoâ€;
  - detectar mismo telÃ©fono con nombres distintos y pedir confirmaciÃ³n;
  - no duplicar clientes por diferencias de nombre.

### 3.6 Calidad

- DistribuciÃ³n limpia: Bueno 96 (85,7 %), Regular 9 (8 %), Malo 1 (0,9 %), vacÃ­o 6 (5,4 %).
- En la captura existe `Sin calificar` (1), pero la capa limpia lo convierte en vacÃ­o: **se pierde la distinciÃ³n** entre â€œno respondiÃ³â€ y â€œdato faltanteâ€.
- RecomendaciÃ³n: enum cerrado `Bueno | Regular | Malo | Sin calificar`, con `Sin calificar` explÃ­cito; no usar vacÃ­o.
- Calidad por fuente (limpias): Formulario Web 20 Bueno / 4 Regular / 1 Malo; Registro por mesero 76 Bueno / 5 Regular / 6 vacÃ­o.

### 3.7 Comentarios

- **87 comentarios vÃ¡lidos** (de 112): 23 vacÃ­os (20,5 %), 2 â€œError de lecturaâ€ y 2 con el placeholder de UI.
- **Sentimiento lÃ©xico**: 48 con seÃ±al positiva, 4 con seÃ±al negativa, 29 con pedido/sugerencia.
- **Lo que mÃ¡s se repite**:

| Comentario | Veces |
|---|---|
| Todo bien / Todo Bien | 7 |
| Estuvo todo bueno y agradable | 2 |
| Ventilador | 2 |
| â— Â¿QuÃ© te pareciÃ³ nuestro (placeholder) | 2 |

- **Palabras mÃ¡s frecuentes**: bien (19), bueno (11), atenciÃ³n (10), gracias (7), rico (6), excelente (5), agradable (5), tiempo (3), pollo (3), falta (3), platos (3), bebida (2), papas (2), sabor (2).
- **Temas positivos**: atenciÃ³n (10 menciones), comida/sazÃ³n (â€œricoâ€, â€œexcelenteâ€, â€œagradableâ€), delivery puntual.
- **Pedidos y sugerencias detectadas** (29 comentarios):
  - Papas mÃ¡s crocantes / menos aceite / mejor fritas (3)
  - MÃ¡s variedad de platos criollos y chifa (aeropuerto) (2)
  - Salsa huancaÃ­na con mÃ¡s sabor; tallarÃ­n saltado con mÃ¡s aderezo (2)
  - Promociones con bebida / mÃ¡s ofertas / degustaciÃ³n para clientes fieles (3)
  - MÃºsica de fondo y ventilador (ambiente) (3)
  - Mejorar tiempo de entrega / rapidez en bebidas (3)
  - ConsideraciÃ³n con clientes habituales (1)
  - Chimichurri (1)
- **Oportunidad**: los comentarios ya responden â€œÂ¿estÃ¡n contentos?â€ (predominio positivo) y â€œÂ¿quÃ© piden?â€ (papas, variedad, salsas, promos con bebida, ambiente y tiempo). Falta convertirlo en un panel fijo del dashboard (ya implementado: â€œLo que mÃ¡s se repiteâ€ y â€œLo que pidenâ€).
- RecomendaciÃ³n:
  - eliminar placeholders y caracteres de control (hecho);
  - agrupar respuestas equivalentes (`todo bien`, `todo ok`, `todo excelente` â†’ â€œTodo bienâ€);
  - longitud mÃ­nima 3 y descartar textos que no sean opiniÃ³n;
  - marcar idioma, groserÃ­as y spam;
  - anÃ¡lisis de sentimiento/aspectos (comida, servicio, ambiente, precio, tiempo) y extracciÃ³n de temas.

### 3.8 Productos

- 11 combinaciones; categorÃ­as: Pollo 75, Otros 28, Parrillas 20, Criollos 9.
- â€œOtrosâ€ (~25 %) demasiado alto; no hay plato especÃ­fico (ej. â€œPollo a la brasaâ€, â€œLomo saltadoâ€).
- Regla propuesta:
  - catÃ¡logo `Producto` + `CategorÃ­a` (Pollo, Parrillas, Criollos, Otros);
  - separar por `;`/`+`, quitar duplicados y normalizar sinÃ³nimos;
  - si se elige â€œOtrosâ€, pedir detalle obligatorio;
  - enlazar con `Productos`/`Encuesta_Productos` para anÃ¡lisis plato Ã— calidad.

### 3.9 Meseros y fuente

- `Cliente (Formulario Web)` aparece como mesero en 25 encuestas. **No es mesero**; es el origen del registro.
- Los nombres estÃ¡n en mayÃºsculas (`SHIRLEY`, `BETTY`, `Sr. CARLOS`).
- RecomendaciÃ³n:
  - `Mesero` solo para meseros reales (catÃ¡logo `MES-*`);
  - `Fuente` = `Formulario Web` / `Registro por mesero`;
  - si es formulario web, `Mesero` vacÃ­o y `Registrado Por = Cliente (Formulario Web)`;
  - ranking de meseros solo con registros por mesero; excluir web y â€œOtrosâ€.

### 3.10 Contrato y encabezados

- La tabla limpia tiene **dos columnas con el mismo nombre lÃ³gico** (`Timestamp` y `timestamp`), lo que rompe pandas/SQL/BI (colisiÃ³n case-insensitive).
- HabÃ­a **desplazamiento de 3 columnas** en el contrato y en las edades humanas. Corregido en el script actualizado.
- RecomendaciÃ³n: nombres Ãºnicos y estables; documentar el contrato (versiÃ³n) y validar encabezados al reconstruir.

### 3.11 Duplicados

- 0 duplicados exactos por `(timestamp, nombre, telÃ©fono)`.
- 3 telÃ©fonos con mÃ¡s de una encuesta (6 registros): puede ser cliente recurrente legÃ­timo o doble envÃ­o.
- Regla: detectar mismo telÃ©fono en ventana corta (p. ej. 10 minutos) y avisar; conservar `ID de EnvÃ­o` como idempotencia.

### 3.12 Privacidad

- La hoja es pÃºblica (gviz) y contiene nombres y telÃ©fonos. Para uso interno es aceptable; para compartir anÃ¡lisis, exportar con telÃ©fono enmascarado (`9xx xxx xxx`) o servir por API con autenticaciÃ³n.
- Los logs de Apps Script tambiÃ©n pueden contener datos; cuidar su retenciÃ³n.

## 4. Reglas de normalizaciÃ³n propuestas (data dictionary)

| Campo | Regla | Ejemplo / vÃ¡lvula |
|---|---|---|
| Nombre | title case, partÃ­culas en minÃºscula, trim, sin dÃ­gitos | `HUMBERTO julon LARA` â†’ `Humberto Julon Lara` |
| TelÃ©fono | solo dÃ­gitos, 9 caracteres, obligatorio | `+51 987 654 321` â†’ `987654321` |
| CumpleaÃ±os | `dd/mm/yyyy`; aÃ±o 1900â€“actual; no futuro; edad 12â€“90 o marcar revisiÃ³n | `03/11/2026` â†’ `Revisar edad` |
| Calidad | enum `Bueno/Regular/Malo/Sin calificar` | vacÃ­o â†’ `Sin calificar` |
| Comentario | trim, sin control/placeholder, min 3; mapa de respuestas comunes | `â— Â¿QuÃ© te pareciÃ³ nuestro` â†’ vacÃ­o |
| Producto | categorÃ­a + detalle; split `;`/`+`; sinÃ³nimos; tÃ­tulo | `pollo + otros` â†’ `Pollo; Otros` |
| Mesero | solo catÃ¡logo `MES-*`; web â†’ vacÃ­o | `Cliente (Formulario Web)` â†’ `Fuente=Formulario Web` |
| Fuente | `Formulario Web` / `Registro por mesero` | â€” |
| Timestamp | ISO 8601 con zona; mostrar `dd/MM/yyyy HH:mm:ss` | `2026-09-25T18:42:23-05:00` |
| Estado | cÃ³digos, no texto libre | `OK`, `SIN_ID`, `FECHA_INVALIDA`, `EDAD_REVISAR` |
| Edad | derivada de cumpleaÃ±os y fecha; no capturada a mano | â€” |
| IDs | ENC/CLI/MES/PROD/REL, sin reutilizar; documentar huecos | ENC-000096 faltante |

## 5. Validaciones recomendadas en la captura

- Campos obligatorios: nombre, telÃ©fono, cumpleaÃ±os, plato, calidad.
- TelÃ©fono con mÃ¡scara y validaciÃ³n de 9 dÃ­gitos.
- CumpleaÃ±os con selector de fecha o 3 campos dÃ­a/mes/aÃ±o; rechazar futuro.
- Calidad con botones/dropdown (no texto libre).
- Plato con categorÃ­a + detalle; â€œOtrosâ€ exige especificar.
- Comentario con longitud mÃ­nima y limpieza de placeholders.
- Aviso de duplicado por telÃ©fono (ventana de tiempo).
- Idempotencia por `ID de EnvÃ­o` (ya existe).
- Registrar `fuente` y `mesero` por separado.

## 6. Monitoreo y gobierno de datos

- Dashboard de calidad diario: filas fuente vs limpias, filas con advertencia, fechas invÃ¡lidas, duplicados, % nulos, edades fuera de rango, cambios de distribuciÃ³n.
- Alertas si: limpias â‰  fuente Â±2; fecha invÃ¡lida > 0; nombres sin tÃ­tulo > 5 %; comentarios vacÃ­os > 30 %; â€œOtrosâ€ > 30 %.
- **Nunca borrar filas de `Encuestas`**: archivar (`Archivadas`) o marcar inactivo. La capa limpia puede reconstruirse; una fila borrada se pierde.
- Versionar el contrato (v1, v2) y probar el rebuild en una copia antes de producciÃ³n.
- Backup semanal de la hoja (copia o export CSV) y de Supabase.
- Control de acceso y enmascarado de PII para anÃ¡lisis.

## 7. AnalÃ­tica que se habilita con estos arreglos

- **Clientes**: recencia, frecuencia, ticket (si se agrega monto), RFM, cohortes por mes, recompra, clientes en riesgo.
- **CumpleaÃ±os**: conversiÃ³n por etapa (mes/semana/dÃ­a), canal, responsable, tiempo de respuesta, redenciÃ³n.
- **Meseros**: ranking con intervalos de confianza (Wilson), calidad promedio, volumen, evoluciÃ³n mensual; separar web.
- **Productos**: plato Ã— calidad, top/bottom, combinaciones, categorÃ­a; â€œOtrosâ€ como seÃ±al de captura incompleta.
- **Texto**: sentimiento global y por aspecto (comida, servicio, ambiente, precio, tiempo); temas frecuentes; quejas.
- **OperaciÃ³n**: horas de mayor registro, dÃ­as, estacionalidad, turnos.

## 8. PriorizaciÃ³n

| Prioridad | AcciÃ³n | Impacto | Esfuerzo |
|---|---|---|---|
| P0 | Reejecutar script y validar 112 filas con 0 advertencias | Alto | Bajo |
| P0 | Corregir lectura de rangos grandes en gviz (bloques â‰¤40 filas) | Alto | Bajo |
| P0 | Reejecutar script con correcciones (mapeo, hora, fechas, tÃ­tulo) | Alto | Bajo |
| P0 | Validar cumpleaÃ±os/telÃ©fono en captura | Alto | Medio |
| P1 | Separar `Fuente` de `Mesero` (web no es mesero) | Alto | Bajo |
| P1 | Enum de calidad con `Sin calificar` | Medio | Bajo |
| P1 | Normalizar comentarios (placeholders, respuestas comunes) | Medio | Medio |
| P1 | Detalle de producto / categorÃ­a; â€œOtrosâ€ obligatorio | Alto | Medio |
| P2 | Data dictionary + validaciÃ³n de contrato | Medio | Bajo |
| P2 | Monitoreo de calidad y alertas | Alto | Medio |
| P2 | Enmascarar PII en exportaciones | Medio | Bajo |
| P3 | Sentimiento/aspectos y temas | Alto | Alto |

## 9. Acciones inmediatas sugeridas

1. Reemplazar `CÃ³digo.gs` con la versiÃ³n actualizada (mapeo, hora, fechas, nombres, mesero web y revisiÃ³n de edad) y ejecutar `actualizarEncuestasLimpias`.
2. Verificar que la capa limpia quede con **112 filas**, 0 advertencias de fecha, Timestamp con hora y edades correctas.
3. Implementar validaciones de captura (telÃ©fono, cumpleaÃ±os, calidad, producto).
4. Definir el catÃ¡logo de productos y el detalle cuando se elija â€œOtrosâ€.
5. Revisar el panel â€œVoz del clienteâ€ con las nuevas secciones de comentarios repetidos y pedidos.

## 10. Estado del script (correcciones ya aplicadas)

- âœ… Parseo robusto de fechas `dd/mm/yyyy` (texto o fecha).
- âœ… Formato tÃ­tulo en nombres, meseros, fuentes y productos.
- âœ… CorrecciÃ³n del desplazamiento de 3 columnas (edad humana + contrato).
- âœ… `Timestamp` y `Fecha Procesamiento` con hora.
- âœ… Limpieza de placeholder `â—` en comentarios.
- âœ… `Mesero` vacÃ­o para registros de formulario web (la fuente queda en `Fuente`).
- âœ… Marcado `Revisar` para edades improbables (aÃ±os 2026/futuros, <12 o >90).
- âœ… Panel â€œLo que mÃ¡s se repiteâ€ y â€œLo que pidenâ€ en Voz del cliente.
- â³ Pendiente: validaciÃ³n de cumpleaÃ±os/telÃ©fono en captura, enum de calidad con `Sin calificar`, detalle de producto y monitoreo.


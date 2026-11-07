# Auditoría UX/UI — Sistema de Gestión Coronel

> Fecha: 2026-11-06 · Alcance: 15 pantallas en escritorio (1440×1000) y móvil
> (390×844) · App en producción · Usuario temporal eliminado después de la auditoría.
> Capturas: [docs/screenshots/ux](screenshots/ux).

## 1. Resumen ejecutivo

El sistema **funciona y tiene una identidad sólida** (marca Coronel, tema oscuro,
tarjetas, tipografía editorial), pero hoy se siente como **un tablero de análisis
con 12 pantallas** más que como una herramienta de operación diaria.

Los cinco problemas de mayor impacto son:

1. **Navegación sobrecargada y mezclada**: 12 ítems en 4 grupos; operación
   (cumpleaños, llamadas, prioridades) y análisis (voz, equipo, metas) compiten.
2. **La acción del día queda debajo del pliegue**: en móvil hay ~900 px de
   cabecera/filtros antes de la primera alerta; en escritorio el resumen ocupa
   media pantalla.
3. **Métricas duplicadas y jerarquía débil**: cumpleaños tiene 9 indicadores
   (5 tarjetas + 4 embudo), prioridades 6, voz 7; el usuario no sabe qué mirar
   primero.
4. **Móvil no es una experiencia de primera clase**: navegación en desplegable,
   cabecera muy alta, filtros globales, tablas que se cortan y KPIs que antes se
   ocultaban (ya corregido).
5. **Microtipografía y microcopy**: etiquetas de 9–11 px, frases como
   “asunto(s)”, “0 registro(s)”, “T-3”, “Encuestas_Limpias”, “IC95”, que
   agregan carga cognitiva.

También corregí en esta pasada 6 defectos concretos detectados durante la
auditoría (ver §9).

## 2. Método

- Revisión heurística (Nielsen) + auditoría visual de las 15 pantallas.
- Recorrido de flujos: login, acceso, operación diaria, cumpleaños, llamadas,
  equipo, configuración.
- Revisión de código de layout/CSS y de los componentes reutilizables.
- Comprobación de contraste de colores y tamaños de texto.
- No se modificaron datos de negocio; el usuario de auditoría se eliminó.

## 3. Macro: arquitectura y prioridades

### 3.1 Navegación: 12 ítems para 3 trabajos distintos

**Qué pasa.** El menú mezcla tres jobs-to-be-done:

- **Operar hoy**: Centro de acción, Cumpleaños, Prioridades, Llamadas.
- **Entender**: Voz del cliente, Equipo, Historial de metas.
- **Configurar**: Promociones, Responsables, Administración, Mi perfil.

**Por qué importa.** La cajera/admin debe escanear 12 opciones para encontrar la
tarea del día; los ítems de análisis y configuración compiten visualmente con
los operativos. Además, los badges (5, 3, 2) no explican qué representan.

**Cómo.**

1. Reducir el menú principal a **5 destinos + cuenta**:
   - **Hoy** (Centro de acción + alertas)
   - **Cumpleaños**
   - **Clientes** (incluye Prioridades como pestaña)
   - **Llamadas**
   - **Análisis** (Voz del cliente + Equipo + Historial de metas)
   - **Configuración** (Promociones, Responsables, Administración) — solo admin
2. Navegación por rol: la cajera solo ve Hoy, Cumpleaños, Clientes, Llamadas;
   el admin ve todo.
3. Móvil: **barra inferior** de 4 destinos (Hoy, Cumpleaños, Clientes, Llamadas)
   + “Más” para Análisis/Configuración.
4. Badges con tooltip/aria: “9 acciones vencidas”, “3 cumpleaños próximos”,
   “2 tareas pendientes”.

### 3.2 Jerarquía de página: el dato antes que la acción

**Qué pasa.** Plantilla actual: topbar grande → filtros globales → hero/intro →
alertas → resumen → KPIs → contenido. En Cumpleaños, la lista de clientes
empieza a ~600 px; en móvil, a ~1.600 px.

**Por qué importa.** El usuario entra a “hacer”, no a leer un informe. Cada
bloque antes del contenido retrasa la acción.

**Cómo.**

1. Plantilla de página común:
   - **Header compacto**: título + una línea de contexto + acción primaria.
   - **Filtros** en una barra colapsable (solo visibles al pulsar “Filtros”).
   - **Contenido accionable primero** (lista/tarjetas).
   - **Métricas secundarias** después o en un panel colapsable.
2. Eliminar el hero de 2–3 líneas en páginas operativas; usar eyebrow + título.
3. En escritorio, limitar el alto del bloque de alertas + resumen a ~220 px.
4. En móvil, no mostrar el selector de fuente ni el estado de sincronización en
   la cabecera; moverlos a “Configuración > Fuente de datos”.

### 3.3 Métricas duplicadas

**Qué pasa.**

- Cumpleaños: 5 tarjetas (mes, semana, hoy, contactados, redimidos) + 4 del
  embudo + chips de etapa.
- Prioridades: 6 tarjetas + filtros de estado.
- Voz: 6 tarjetas + 2 paneles.
- Equipo: 4 tarjetas + meta + scorecard + barras.

**Por qué importa.** Más números no significan más claridad: el usuario no sabe
cuál es el KPI principal ni qué hacer si está mal.

**Cómo.**

1. Un **KPI principal** por página, 2–4 secundarios; el resto en “Ver detalle”.
2. Cumpleaños: dejar **4 KPIs** (mes, semana, hoy, pendientes de contactar) y
   colapsar el embudo en una barra de progreso.
3. Prioridades: 3 KPIs (pendientes, vencidas, atendidas) y filtros como chips.
4. Voz: 3 KPIs (calidad positiva, comentarios, pedidos) + paneles.
5. Equipo: scorecard primero; filtros de período y comparación en un
   acordeón.

### 3.4 Móvil: segunda prioridad, no primera

**Qué pasa** (captura `overview-mobile.png`):

- Cabecera: título, fuente, sincronización, sesión, navegación desplegable,
  búsqueda, calidad, CSV/PDF → ~900 px antes de las alertas.
- Navegación es un `<select>`/desplegable de 12 ítems; no hay acceso rápido.
- Antes se ocultaban los KPIs 4 y 5 (ya corregido).
- El texto del buscador se corta (“…mesero o t”).
- Tablas y filtros no se adaptan; el botón “Ver análisis detallado” queda lejos.

**Por qué importa.** Gran parte del uso real será desde el celular (cajera,
mesero, dueño). Un flujo móvil lento reduce adopción y aumenta errores.

**Cómo.**

1. **Header móvil compacto**: logo + título + avatar/menú; sin fuente/sync.
2. **Bottom navigation** fija con 4 destinos + “Más”.
3. Filtros en un **bottom sheet** (“Filtros”); búsqueda siempre visible.
4. KPIs en 2 columnas, con altura uniforme (ya corregido).
5. Botón primario fijo (“Registrar llamada”, “Enviar WhatsApp”) en la parte
   inferior de la lista.
6. Tablas → **cards** en móvil; cada card con 2–3 datos y una acción.

### 3.5 Topbar y “Fuente”

**Qué pasa.** La barra superior tiene 4 zonas compitiendo: título, fuente
(`Encuestas_Limpias`), estado de sincronización, actualizar y sesión. En móvil
ocupa 3 filas. El selector de fuente es técnico y está en todas las pantallas.

**Por qué importa.** La fuente de datos es una decisión de configuración, no una
acción diaria; y “Encuestas_Limpias” no significa nada para el usuario.

**Cómo.**

1. Topbar: título + píldora “Actualizado 07:11” + icono refrescar + avatar.
2. Fuente: mover a **Configuración > Fuente de datos**, mostrar solo “Datos
   limpios” como badge informativo.
3. En móvil, avatar abre menú con “Mi perfil”, “Configuración”, “Cerrar sesión”.
4. Eliminar el texto duplicado “Actualización automática cada 5 minutos ·
   Google Sheets · Encuestas_Limpias” de cada página; dejarlo en el tooltip del
   estado.

### 3.6 Lenguaje y microcopy

**Qué pasa.** “Encuestas_Limpias”, “IC95”, “T-3”, “T+1”, “Meta 50”, “Fuente”,
“asunto(s)”, “pendiente(s)”, “0 registro(s)”, “DELIVERY / WEB”, “Sentimiento de
calidad” (en realidad calidad positiva).

**Por qué importa.** El personal no técnico duda y comete errores; los textos
entre paréntesis se leen mal y parecen plantillas.

**Cómo.**

1. Glosario visible en tooltips: “Calidad positiva”, “Muestra”, “IC95”.
2. Pluralización automática: `plural(9, "prioridad vencida", "prioridades vencidas")`.
3. Renombrar:
   - “Fuente” → “Datos” / “Origen”.
   - “Encuestas_Limpias” → “Datos limpios”.
   - “Sentimiento de calidad” → “Calidad positiva”.
   - “Meta calidad” → “Objetivo de calidad”.
4. Evitar jerga en el flujo de caja: “0–3 días” en vez de “T-3”.

### 3.7 Confianza y transparencia

**Qué pasa.** El sistema ya muestra IC95, pero sin explicación; “91% positivo”
puede leerse como verdad absoluta. La fuente y la fecha están presentes, pero
como texto técnico.

**Por qué importa.** Decisiones de personal y promociones se toman con datos;
la incertidumbre debe ser visible y comprensible.

**Cómo.**

1. Tooltip en cada KPI con “n=106, IC95 83–95%” y una frase: “Con más respuestas,
   este rango se reduce”.
2. Badge “Muestra baja” en meseros con n<20 (ya implementado).
3. Enlace “¿Cómo se calcula?” en Voz/Equipo con una explicación de 3 líneas.
4. Mostrar la hora de última actualización como “Hace 3 min” con tooltip de fecha
   exacta.

## 4. Auditoría página por página

| Página | Para qué sirve | Problemas principales | Cómo mejorarla |
|---|---|---|---|
| **Login** | Entrar / solicitar acceso / recuperar | Copy largo, sin ver contraseña, sin indicador de mayúsculas, modo oscuro distinto al resto | Simplificar copy; botón “Ver”; `aria-describedby`; mismo tema visual; enlace “¿Problemas para entrar?” |
| **Centro de acción** | Ver alertas y KPIs del día | 5 KPIs + alertas + resumen; mucho espacio vacío; KPI con detalle largo; alerta “9 vencidas” ya corregida | Priorizar 3 acciones (vencidas, cumpleaños, clientes en riesgo); KPIs 3–4; “Ver análisis” colapsable |
| **Voz del cliente** | Entender comentarios y pedidos | 6 KPIs + face; “91% · 106” vs 85 comentarios (corregido); paneles largos; “frases detectadas” | 3 KPIs; pestañas “Resumen / Comentarios / Pedidos”; filtros por etiqueta; exportar |
| **Equipo** | Comparar meseros y delivery | Filtros y comparación ocupan 400 px antes del scorecard; ranking con n pequeño; período poco claro | Scorecard primero; filtros en barra; mostrar n/IC95 (hecho); “Delivery/Web” separado; explicar metas |
| **Cumpleaños** | Ejecutar campañas por día/semana/mes | 9 KPIs; tarjetas enormes con 8 acciones; filtros duplicados; estado “sin contactar” | KPIs 4; tarjeta compacta con 2 acciones + menú; embudo colapsado; CTA “Contactar hoy” |
| **Clientes** | Segmentar y llamar | 5 KPIs; “Próximos cumpleaños” mostraba agosto (corregido); filtros chips; tabla/cards | 3 KPIs; lista con orden por prioridad; acciones inline; paginación |
| **Prioridades** | Resolver asuntos pendientes | 6 KPIs + muchos filtros; estados “Pendiente/En seguimiento/Atendida”; “Vencidas” ahora 9 | 3 KPIs; lista como tablero kanban/lista; filtros colapsados; acciones claras |
| **Promociones** | Catálogo de promociones | “Ninguna” aparece activa; filas repetitivas; sin búsqueda ni formulario visible | Separar “Ninguna” como opción de “sin promo”; formulario “Nueva promoción” en modal; búsqueda/estado |
| **Llamadas** | Historial de contacto | Estado vacío sin CTA; tabla no probada con datos; filtros ocupan espacio | CTA “Registrar primera llamada”; filtros colapsados; cards en móvil; detalle en drawer |
| **Responsables** | Catálogo de responsables | Botón “Agregar usuario” parece texto; formulario inline; auditoría vacía | Botón primario; modal; validación; mostrar permisos |
| **Historial de metas** | Evolución de objetivos | Barras sin n/IC; comparación visual; mucho encabezado | Barras con n y CI; selector de período compacto; exportar |
| **Mi perfil** | Identidad y sesión | “Sin contraseña local” confuso; mucho espacio; avatar no editable visualmente | Card de cuenta clara; cambio de avatar modal; enlaces de seguridad |
| **Administración** | Roles y accesos | Filas densas; chips pequeños; “0 PENDIENTE(S)” | Tabla/cards; acciones en menú; confirmaciones; roles explicados |

## 5. Micro: componentes y detalles

### 5.1 Tipografía y contraste

- Hay etiquetas de **9–11 px** en mayúsculas (`.eyebrow`, `.side-label`, badges).
  En escritorio se leen, en móvil no.
- Contraste medido:
  - `#6e87a3` sobre `#0c1728`: **4,84:1** (pasa AA normal, pero a 9 px es frágil).
  - `#55708e` sobre `#081221`: **3,66:1** (no pasa AA para texto normal).
  - Texto blanco sobre CTA rojo: **4,57:1** (pasa por poco).
- **Cómo**: escala mínima 12 px para metadatos, 13–14 px cuerpo, 11 px solo
  etiquetas; subir `--muted` a un tono más claro; no usar color como única señal.

### 5.2 Acciones y botones

- Tarjeta de cumpleaños: **8 botones** (WhatsApp, Llamar, Ver ficha, Copiar,
  Ajustar, Ver historial, Programar, No contestó). Demasiada elección.
- “Agregar usuario” se ve como texto plano.
- **Cómo**: prioridad visual:
  1. WhatsApp / Llamar (primario).
  2. “No contestó” (secundario de la tarea).
  3. Menú “⋯” con ficha, copiar, ajustar, historial.
  4. Estados como control segmentado de una sola fila.
- Botones con altura mínima 40–44 px en móvil.

### 5.3 Filtros y búsqueda

- Barra global con buscador, calidad, limpiar, CSV/PDF en casi todas las páginas.
- “Limpiar” no dice qué limpia; los filtros no muestran chips activos.
- **Cómo**: barra contextual por página; chips de filtros activos con “×”;
  búsqueda con `Ctrl/Cmd+K`; estado vacío con “Limpiar filtros”; guardar vistas.

### 5.4 Estados vacíos y feedback

- Llamadas: “No hay llamadas…” sin CTA.
- Administración: “No hay solicitudes” sin explicación de qué hacer.
- Toasts duran 3,2 s, sin `aria-live`; no hay skeletons al cargar.
- **Cómo**: componente `EmptyState` con título + explicación + acción; skeleton
  en listas/KPIs; toast con `role="status"` y cierre manual; confirmaciones para
  acciones destructivas en modal (no `window.prompt`).

### 5.5 Tablas y responsive

- Llamadas/Administración/Historial usan tablas densas; en móvil se cortan.
- **Cómo**: en `<760px` convertir filas en cards (2–3 datos + acción); en desktop
  cabecera sticky, orden por columnas y paginación; acciones en menú.

### 5.6 Modales y accesibilidad

- Revisar foco atrapado, `Esc`, retorno de foco, `role="dialog"`, `aria-modal`.
- Formularios: asociar `label`+`input`, `aria-describedby` para errores.
- `prefers-reduced-motion`: confeti, latido y transiciones deben desactivarse.
- Skip link (“Saltar al contenido”) y landmarks (`nav`, `main`).
- Iconos: `aria-label` cuando no hay texto; no depender del emoji.

### 5.7 Datos y visualizaciones

- Barras de metas sin n ni IC; colores sin leyenda.
- “Sentimiento de calidad” usaba 85 comentarios para un % de 106 respuestas
  (corregido a 106).
- **Cómo**: cada gráfico con título, unidad, n, período y tooltip; mostrar IC en
  rankings; evitar gráficos de tarta para muchas categorías.

## 6. Sistema de diseño recomendado

### Tokens

| Token | Valor sugerido |
|---|---|
| Espaciado | 4, 8, 12, 16, 24, 32, 48 |
| Tipografía | 11 (label), 12 (meta), 14 (cuerpo), 16 (énfasis), 20 (h3), 28 (h2), 36 (h1) |
| Radios | 8 (chips), 12 (cards), 16 (modales) |
| Superficies | base `#07111f`, panel `#0c1728`, elevada `#122238` |
| Texto | primario `#eaf3fb`, secundario `#a9bdd2`, terciario `#7f97b0` |
| Estados | verde `#39e3ad`, ámbar `#ffca58`, rojo `#ff718c`, azul `#4cc8ed` |

### Componentes a estandarizar

- `PageHeader` (título, descripción, acción primaria).
- `StatGrid` (1–4 KPIs, responsive, sin recorte).
- `SectionCard` (título, acción, contenido, estados vacío/carga/error).
- `FilterBar` (búsqueda, chips activos, exportar, limpiar).
- `DataTable` (desktop) + `DataCard` (móvil).
- `EmptyState`, `Skeleton`, `Toast`, `ConfirmDialog`, `Modal` accesible.
- `ActionMenu` para acciones secundarias.
- `Badge`, `Pill`, `SegmentedControl`.

## 7. Roadmap priorizado

### P0 — Esta semana (alto impacto, bajo esfuerzo)

1. Header móvil compacto: ocultar fuente/sync, avatar con menú.
2. Navegación móvil: bottom bar de 4 destinos + “Más”.
3. Eliminar KPIs ocultos en tablet/móvil (hecho).
4. Corregir conteo de vencidas (hecho), fechas de cumpleaños (hecho), conteo
   de Voz (hecho), filtros de etapa (hecho).
5. CTA en estado vacío de Llamadas.
6. Pluralización de textos (“9 prioridades vencidas”, “0 registros”).
7. Reducir acciones de tarjeta de cumpleaños a 2 + menú.

### P1 — 1–2 semanas

1. Reorganizar navegación (5 destinos + configuración) y navegación por rol.
2. Plantilla de página compacta; acción antes que métricas.
3. Unificar KPIs: máximo 4 por página; mover el resto a detalle.
4. Tipografía/contraste: mínimo 12 px, tokens de color AA.
5. Tablas → cards en móvil; filtros en sheet.
6. Modales accesibles y confirmaciones (sin `window.prompt`).

### P2 — 2–4 semanas

1. Onboarding de 3 pasos (“Configura fuente”, “Revisa cumpleaños”, “Registra
   primera llamada”).
2. Sistema de diseño formal (tokens + componentes).
3. Gráficos con n, IC y tooltips; reportes exportables.
4. Accesibilidad completa (teclado, lectores, reduced motion).
5. Búsqueda global `Ctrl+K` y vistas guardadas.

### P3 — Después

- Modo claro/oscuro, PWA/offline, personalización por rol, notificaciones.

## 8. Métricas para medir la mejora

- Tiempo hasta la primera acción del día (objetivo < 30 s).
- Clics hasta registrar una llamada (objetivo ≤ 3).
- Uso móvil vs escritorio y finalización de tareas en móvil.
- Tasa de error en registro de llamadas/estados.
- SUS (System Usability Scale) antes/después; objetivo > 80.
- Rebote en páginas de análisis; uso de “Ver detalle”.

## 9. Correcciones aplicadas durante la auditoría

- KPIs 4.º y 5.º ya no se ocultan en tablet/móvil.
- Resumen muestra las **9 vencidas reales** (antes 5 por tope de top-5).
- Filtros de cumpleaños: **0–3 d, 4–7 d, 8–30 d, Pasadas**.
- “Próximos cumpleaños” usa ventana 0–7 y formatea `08/11/83` correctamente
  (antes aparecía 11-ago).
- Voz del cliente: 91 % con **106 respuestas** (antes 85 comentarios).
- Detalle de KPI ya no se recorta; permite varias líneas.
- Subtítulo técnico oculto en móvil para reducir cabecera.

## 10. Implementación aplicada (2026-11-06)

### Tema claro de marca

- Fondo general blanco verdoso (`#f6faf7`), superficies blancas y sidebar salvia
  (`#acd3b6`).
- Verde principal `#1d4a31`; rojo de acento `#d93a2b`.
- Login, splash, tablas, tarjetas, filtros, modales y navegación móvil migrados
  al tema claro.
- Logo con fondo transparente (`logo-coronel.png`) para sidebar y login.

### Navegación y estructura

- Menú consolidado en 3 grupos: **Operación** (Centro de acción, Cumpleaños,
  Clientes, Prioridades, Llamadas), **Análisis** (Voz, Equipo, Historial) y
  **Configuración** (Promociones, Responsables, Perfil, Administración).
- Nuevo **bottom navigation** móvil: Hoy, Cumpleaños, Clientes, Llamadas y “Más”.
- Hoja “Más opciones” para el resto de pantallas.
- Cabecera móvil compacta: sin fuente/sincronización/sesión duplicadas; título +
  actualizar.
- Filtros móviles reordenados para evitar superposiciones; exportaciones
  ocultas en móvil para dar prioridad a búsqueda/calidad.

### Contenido y acciones

- Centro de acción con **4 KPIs** (se retiró la tarjeta duplicada de alertas).
- Tarjeta de cumpleaños con acciones primarias **WhatsApp / Llamar** y menú
  **“⋯ Más”** para ficha, copiar y ajustar.
- Estado vacío de Llamadas con CTA a Clientes.
- Pluralización real: “9 prioridades vencidas”, “3 cumpleaños próximos”,
  “0 pendientes”.
- Atajo **Ctrl/Cmd+K** para enfocar la búsqueda.
- Foco visible y `prefers-reduced-motion` respetados.

### Cierre de los puntos anteriores

- **Onboarding**: panel “Tu rutina de hoy, en tres pasos” en Centro de acción,
  con descarte persistente.
- **Tablas móviles**: la tabla de Llamadas se convierte en cards con etiquetas;
  las demás tablas conservan scroll hasta su migración.
- **Modales**: `useDialogFocus` atrapa el foco, cierra con `Esc` y devuelve el
  foco; aplicado a registrar llamada y vista previa de PDF. Los modales de
  cumpleaños ya cierran con `Esc`.
- **Gráficos**: tooltip con n e IC95 en la comparativa de meseros.
- **Sistema de diseño**: documentado en [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

### Extracción pendiente

- Convertir la documentación del sistema de diseño en componentes reutilizables
  (`PageHeader`, `FilterBar`, `DataTable`, `EmptyState`).
- Migrar las tablas restantes (clientes, historial, auditoría) al patrón de
  cards en móvil.

## 11. Auditoría automática de contraste y superficies (2026-11-06)

Se recorrieron las 12 pantallas en producción calculando el ratio de contraste
de cada texto visible y detectando superficies oscuras que hubieran quedado del
tema anterior.

Corregido:

- Etiquetas de filtros, fechas y formularios que seguían en gris claro.
- Textos blancos sobre tarjetas blancas en Prioridades, Equipo, Voz, Clientes,
  Historial, Perfil y Administración.
- Filas de Promociones, Responsables y Auditoría que conservaban fondo azul
  oscuro.
- Botones de acciones secundarias y paginación con fondo oscuro.
- Etiquetas VENCIDA/atrasada y metadatos de prioridades.
- Barras de Historial que conservaban gradiente cian/azul del tema anterior.
- Tags de Voz del cliente y nube de palabras con colores claros sobre blanco.
- Aviso de muestra insuficiente en Equipo con fondo oscuro.
- Hovers inconsistentes: tarjetas, chips, botones de acción, tablas y
  paginación ahora cambian a salvia/blanco con texto oscuro.
- El texto secundario se oscureció de `#5c7a6b` a `#4f6f5e` para superar 4.5:1
  sobre fondos salvia.

Resultado: la auditoría automática queda **sin incidencias reales de contraste**
en las 12 pantallas; las únicas superficies oscuras que permanecen son
intencionales (navegación verde, chips seleccionados, fecha de cumpleaños y CTA
de WhatsApp).

## 12. Siguiente paso recomendado

Empezar por **P0 móvil + navegación + tarjeta de cumpleaños**, porque concentra
la mayor fricción diaria. Después, la consolidación de IA (P1) evita tener que
rediseñar dos veces.

> Criterio de aceptación P0: en un celular de 390 px, la primera alerta visible
> aparece en menos de 500 px de scroll, la navegación principal está siempre
> accesible y registrar una llamada toma ≤ 3 toques.

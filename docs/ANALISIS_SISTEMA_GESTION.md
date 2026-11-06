# Análisis del sistema de gestión · Restaurante Coronel

> Documento de trabajo para decidir qué optimizar. Enfoque: **atención al cliente**, no operación de restaurante. Prioridad declarada: **cumpleaños** y **calidad de atención (meseros y productos)**.

---

## 1. Resumen ejecutivo

El sistema ya es un buen **tablero analítico**: consolida encuestas de Google Sheets, calcula calidad positiva, ranking de meseros, temas recurrentes de comentarios, pipeline de cumpleaños y campañas de recuperación. Pero está diseñado como *observatorio* (mirar datos) más que como **herramienta de trabajo diario** (saber qué hacer hoy, con quién y cómo dar seguimiento).

Las tres brechas más importantes:

1. **Cumpleaños sin protocolo**: hay calendario, mensajes y estados, pero no un plan por etapas (qué hacer en T-30, T-14, T-7, T-3, T-1, día, T+3, T+7), ni tareas vencidas, ni embudo de conversión. Es el mayor valor percibido por el dueño y hoy está a medio camino.
2. **Seguimiento disperso**: el seguimiento vive en “Llamadas”; no existe una ficha única del cliente que reúna visitas, platos, cumpleaños, promociones, llamadas y próxima acción.
3. **Analítica de atención sin narrativa**: hay ranking de meseros y palabras clave, pero falta tendencia por mesero, meta individual, cruce mesero × producto y un “qué pide más / qué gusta menos” listo para decidir.

---

## 2. Inventario actual

| Módulo | Qué resuelve hoy | Límite principal |
|---|---|---|
| Centro de acción | KPIs generales, alertas de prioridades y cumpleaños, metas | Mezcla análisis y operación; no es una lista de “tareas de hoy” |
| Cumpleaños | Calendario mensual, pipeline de 7 días, mensaje sugerido, estados contactado/aceptado/redimido | Sin protocolo completo ni vencimientos; etapas gruesas |
| Prioridades | Alertas con responsable, fecha y estado (pendiente/en curso/hecho) + historial | Carga manual; no se conecta a clientes concretos |
| Clientes | Ficha por cliente (frecuencia, plato, calidad, segmento Fiel/Nuevo) | Sin historial de contacto ni “próxima acción” |
| Voz del cliente | Nube de frases, señales positivas/negativas, comentarios | Sin tendencia temporal ni vínculo a producto/mesero |
| Equipo | Ranking de meseros por encuestas y % calidad; metas globales | Sin meta individual, tendencia mensual ni comentarios por mesero |
| Promociones | Catálogo por categoría (recuperación, cumpleaños, fidelidad, general) | Sin medición de uso real por promoción |
| Llamadas | Registro de contacto, resultado, promoción, próxima llamada | No genera recordatorios ni embudo |
| Responsables | Asignación de responsables internos | No hay carga de trabajo ni SLA |
| Historial de metas | Evolución de objetivos | No compara resultado vs meta |
| Administración | Usuarios, permisos, auditoría, solicitudes de acceso | — |

---

## 3. Diagnóstico (hallazgos)

**H1. El protocolo de cumpleaños no existe como proceso.**
La lógica actual asigna una etapa según días restantes (`≤7`, `≤3`, `1`, `0`, `<0`) y un texto de plantilla. No hay etapas de preparación (T-30/T-14), ni responsables, ni checklist, ni fecha de “próxima acción”, ni validación de que la fecha/teléfono estén correctos.

**H2. No se puede saber “qué toca hacer hoy”.**
Los estados (contactado / aceptó / redimió) se registran como llamadas, pero el sistema no calcula vencimientos (“debí contactar ayer”), ni permite programar la siguiente acción por cliente.

**H3. Segmentación insuficiente para priorizar.**
Solo “Fiel/Nuevo”. No hay VIP (frecuencia + recencia + ticket), ni “en riesgo” (sin visita hace X días), ni criterio por plato favorito o por mesero que lo atendió.

**H4. Cumpleaños de terceros (familia) no se capturan.**
Si el valor es “los cumpleaños de los suyos”, conviene registrar acompañantes/familia por cliente (nombre, parentesco, fecha) y no solo la fecha del titular.

**H5. Meseros: ranking sin gestión.**
Hay conteo y % de calidad, pero no meta individual, no tendencia (¿mejora o empeora?), no comentarios agrupados por mesero y no alerta cuando un mesero cae dos semanas seguidas.

**H6. Productos: no hay ranking accionable.**
La calidad se analiza a nivel global. Falta “top/flop de platos por calidad”, “qué se pide más”, “qué se pide y gusta menos”, y el cruce **plato × mesero** (¿es el plato o la atención?).

**H7. Navegación con solapes.**
12 pestañas con fronteras difusas: “Clientes”, “Voz del cliente” y “Equipo” responden preguntas parecidas. Falta un “Hoy” operativo y una ficha única de cliente.

**H8. Datos frágiles.**
Todo depende de Google Sheets: si se renombra una columna o se cae la hoja, el tablero falla; no hay validaciones (cumpleaños imposibles, teléfonos incompletos) ni edición dentro de la app.

---

## 4. Oportunidad central: **Protocolo Cumpleaños 360**

Diseño propuesto, configurable por el restaurante. Cada cliente-cumpleaños recorre etapas con **fecha objetivo, canal, tarea, mensaje de ejemplo y KPI**.

### 4.1 Etapas propuestas

| Etapa | Cuándo | Objetivo | Canal sugerido | Tarea / ejemplo de mensaje |
|---|---|---|---|---|
| **Preparación** | T-30 a T-21 | Validar datos y planificar el mes | Interno | Confirmar fecha y teléfono; asignar responsable; revisar promoción vigente |
| **Pre-aviso** | T-14 | Sembrar la expectativa sin pedir nada | WhatsApp | “Hola {nombre} 👋 En Coronel estamos preparando algo especial para tu cumpleaños el {fecha}. ¿Te gustaría que te reservemos un detalle?” |
| **Plan** | T-7 | Definir salón / delivery / hora | WhatsApp o llamada | “¿Celebras con nosotros o prefieres delivery? Te reservamos {beneficio}.” |
| **Recordatorio** | T-3 | Confirmar y dar vigencia | WhatsApp | “Tu beneficio vence el {fecha}. ¿Te confirmo mesa para 2 o 4 personas?” |
| **Confirmación** | T-1 | Cerrar logística | Llamada corta | “Mañana te esperamos. ¿Alguna preferencia de plato o torta?” |
| **Día D** | Día | Felicitar y activar promoción | Presencial + WhatsApp | “¡Feliz cumpleaños, {nombre}! 🎉 Hoy tu {beneficio} te espera.” |
| **Agradecimiento** | T+1 | Cerrar experiencia y pedir encuesta | WhatsApp | “Gracias por celebrar con nosotros. ¿Nos cuentas cómo te fue? (1 min)” |
| **Recuperación** | T+3 (si no vino) | Segunda oportunidad | Llamada | “No pudimos verte en tu cumpleaños, pero tu detalle sigue válido hasta {fecha}.” |
| **Cierre** | T+7 | Registrar resultado y siguiente ciclo | Interno | Marcar redimido / no redimido + motivo; programar próxima visita |

> Regla de oro: **máximo 3 mensajes** por cumpleaños (T-14, T-3, día D) + 1 llamada opcional. Saturación = pérdida de base.

### 4.2 Seguimiento fácil (lo que debe existir en pantalla)

- **Tablero “Hoy”**: cumpleaños de hoy, acciones vencidas, acciones de mañana, sin respuesta.
- **Kanban por etapa** (Preparación → Pre-aviso → Plan → Recordatorio → Confirmación → Día D → Seguimiento): cada tarjeta muestra cliente, fecha, canal, responsable y **siguiente acción con fecha**.
- **Checklist por etapa** con un clic: “mensaje enviado”, “respondió”, “confirmó”, “vino”, “redimió”.
- **Ficha de cliente** (una sola pantalla): cumpleaños, edad que cumple, plato favorito, última visita, encuestas, llamadas, promociones usadas, familiares registrados, notas.
- **Plantillas por etapa/canal** con variables (nombre, plato favorito, promoción, fecha) y **banco de respuestas** para objeciones (“no puedo”, “mándame info”, “¿es gratis?”).
- **Recordatorios** internos (correo/WhatsApp al responsable) para acciones vencidas.

### 4.3 Embudo y métricas de cumpleaños

| Métrica | Para qué |
|---|---|
| Contactados / base del mes | Mide cobertura real del equipo |
| Tasa de respuesta | Calidad de canal y mensaje |
| Aceptación de promoción | Atractivo del beneficio |
| Redención (vino / pidió) | Retorno real |
| Ticket promedio con cumpleaños vs sin | Impacto económico |
| Recompra a 30/60/90 días | Valor de la acción |
| Tiempo de primera respuesta | Atención al cliente |

### 4.4 Segmentación propuesta

| Segmento | Regla (configurable) | Acción |
|---|---|---|
| VIP | ≥4 visitas en 6 meses o alto ticket | Trato personal + detalle premium |
| Fiel | ≥2 visitas | Beneficio fidelidad + cumpleaños |
| Nuevo | 1 visita | Bienvenida + cumpleaños |
| En riesgo | sin visita hace >90 días | Reactivación + encuesta |
| Crítico | mala calidad reciente | Llamada del encargado |

---

## 5. Pulso de atención: meseros y productos

### 5.1 Meseros (lo que falta)

- **Ficha por mesero**: encuestas del periodo, % calidad positiva, **tendencia mensual** (mejora/empeora), comentarios positivos/negativos agrupados, platos asociados, meta individual (ej. 12 encuestas y 85% calidad).
- **Ranking con contexto**: no solo “quién tiene más”, sino volumen + calidad + tendencia.
- **Alertas**: mesero bajo meta o con 2 semanas de caída → tarea al responsable.
- **Cruce con cumpleaños**: ¿los meseros atienden bien a los cumpleañeros? (encuesta post-visita).

### 5.2 Productos (lo que falta)

- **Ranking de platos**: más pedidos, más elogiados, más criticados (calidad negativa asociada).
- **Plato × mesero**: detectar si un plato baja solo en un turno o mesero (problema de cocina vs atención).
- **Evolución mensual**: qué producto sube/baja.
- **“Qué gusta más / menos”** listo para compartir con cocina, con comentarios reales.

### 5.3 Indicadores transversales sugeridos

- **Índice de atención** (0–100): 40% calidad positiva + 30% recuperación efectiva + 30% cobertura de cumpleaños.
- **Tiempo de respuesta** a una encuesta negativa (<24 h).
- **Clientes recuperados** por mes y ticket recuperado.

---

## 6. Ficha única del cliente (unificación)

Hoy: Clientes, Voz del cliente y Llamadas son pantallas separadas. Propuesta: **una ficha** con pestañas:

1. Resumen (nombre, teléfono, cumpleaños, edad, segmento, última visita, plato favorito).
2. Historial de visitas/encuestas (calidad, comentarios, mesero).
3. Cumpleaños (etapa actual, historial de campañas, resultado del último año).
4. Contacto (llamadas, WhatsApp, promociones aceptadas).
5. Familia (cumpleaños de acompañantes).
6. Notas y próxima acción.

---

## 7. Optimizaciones transversales (quick wins)

| Mejora | Esfuerzo | Impacto |
|---|---|---|
| Renombrar pestañas a lenguaje de negocio (“Hoy”, “Cumpleaños”, “Atención”, “Clientes”, “Campañas”) | Bajo | Alto (claridad) |
| Tablero “Hoy” con tareas vencidas y de mañana | Bajo | Alto |
| Búsqueda global (cliente, teléfono, plato, comentario) | Bajo | Medio |
| Deep links desde cualquier métrica a la lista filtrada | Bajo | Medio |
| Exportar CSV/PDF por módulo (ya existe) + envío semanal automático | Medio | Medio |
| Validaciones de datos (cumpleaños/fecha inválida, teléfono) | Medio | Alto |
| Estado de datos visible (“última actualización”, reintento, alerta si falla la hoja) | Bajo | Medio |
| Plantillas de mensajes editables desde el panel | Medio | Alto |
| Registro de “motivo” cuando no se redime (precio, distancia, etc.) | Bajo | Alto |
| Accesibilidad: contraste, foco, textos alternativos | Bajo | Medio |

---

## 8. Roadmap priorizado

### Fase 1 — “Que se pueda trabajar” (1–2 semanas)
1. Protocolo de cumpleaños v1: etapas, fecha de próxima acción, checklist, plantillas por etapa, tablero de vencimientos.
2. Embudo de cumpleaños (contactados → aceptados → redimidos).
3. Ficha única del cliente (v1: resumen + historial + cumpleaños + contacto).
4. Renombres/navegación y tablero “Hoy”.

### Fase 2 — “Que se pueda gestionar” (2–3 semanas)
5. Pulso de meseros: meta individual, tendencia, comentarios agrupados, alertas.
6. Ranking de productos top/flop + plato × mesero.
7. Segmentación VIP / en riesgo + acción sugerida.
8. Recordatorios internos (correo/WhatsApp) para tareas vencidas.

### Fase 3 — “Que se pueda automatizar” (3–4 semanas)
9. Automatizaciones de mensajes (WhatsApp Business / correo) con aprobación del responsable.
10. Reporte ejecutivo mensual automático (calidad, cumpleaños, recuperación).
11. Comparativa de metas vs resultado y proyección.
12. Benchmark histórico anual por cliente/mesero/producto.

---

## 9. Respuestas del cliente y decisiones tomadas

| Tema | Respuesta del restaurante | Decisión de diseño |
|---|---|---|
| Vigencia del beneficio | **Día, semana o mes; puede variar por campaña** | La etapa de preparación exige definir la vigencia de cada campaña |
| Canales | **WhatsApp Business, WhatsApp personal, llamada y correo**; **sin API de WhatsApp** | Enlaces `wa.me` con mensaje precargado + botón “Copiar mensaje” + enlace de llamada |
| Responsable | **La cajera, en horario de baja demanda** | Aparece como responsable sugerido en el protocolo y en la pestaña |
| Meta | **Aún sin meta fija** | Se miden cobertura y redención para fijar la meta con datos reales |
| Familiares | **Nombre y fecha, si están en la nota** | Se registran desde el comentario; campo estructurado en la ficha (v2) |
| Buen trato | **“Excelente atención”, “muy amables”, etc.** | Se usan como señales del índice de atención, además de la calidad “Bueno” |
| Edición de datos | Pendiente | Por ahora la fuente sigue siendo Google Sheets |

## 9.1 Estado de implementación (v1)

Ya implementado en el dashboard:

- **Pestaña Cumpleaños rediseñada** para trabajar en segundos: métricas (mes, **semana**, hoy, contactados, redimidos), **embudo** base → contactados → aceptaron → redimieron, filtros por etapa, búsqueda y toggle “solo sin contactar”.
- **Calendario arriba del listado**, con estados visibles: **hoy** resaltado, días con cumpleaños en ámbar, día seleccionado y leyenda; al elegir un día se filtra el listado.
- **Tarjetas accionables**: promoción ofrecida editable por cliente, responsable, **próxima acción con fecha** (con botones +1/+3/+7/+14 días), canal, **familiar (nombre y fecha)** y registro de **motivo de no redención**.
- **Llamada funcional**: al pulsar “Llamar” se abre un panel con el número, enlace `tel:`, copiar número y botones para registrar el resultado (contactado / aceptó / redimió / no redimió).
- **Mensajes de WhatsApp editables** por etapa (mes, semana, día, seguimiento) con variables `{nombre}`, `{fecha}`, `{beneficio}`, `{plato}`; se aplican al abrir WhatsApp o copiar.
- **Ficha única del cliente** (modal): teléfono, cumpleaños, segmento, plato favorito, promoción, responsable, próxima acción, familiares, visitas/encuestas y contactos.
- **Protocolo de cumpleaños** colapsable con Mes / Semana / Día / Seguimiento, pasos, canal, ejemplo y “no hacer”.
- **Responsable sugerido**: cajera en horario de baja demanda, visible en el protocolo y en la pestaña.
- **Pool de base de datos ajustado** (5 conexiones, liberación rápida) para respetar el límite del pooler de Supabase.

Pendiente para las siguientes iteraciones:

1. **Automatizaciones**: recordatorios automáticos (correo/WhatsApp) de acciones vencidas.
2. **Vigencia por campaña** como campo en la app (hoy se define al preparar la campaña).
3. **Edición de datos** dentro de la app (hoy la fuente sigue siendo Google Sheets).
4. **Índice de atención** que combine calidad, recuperación y cobertura de cumpleaños.
5. Reporte ejecutivo mensual de cumpleaños (cobertura, redención, recompra).

## 9.2 Decisiones que faltan definir

1. ¿La vigencia por campaña se registra en la app (campo) o se sigue definiendo en la hoja de Google?
2. ¿Los familiares se guardan como campo estructurado (nombre + fecha) en la ficha del cliente?
3. ¿Cuál es el horario exacto de baja demanda de la cajera y qué política de mensajes se aplica?

---

## 10. Conclusión

El sistema tiene una base sólida y datos suficientes para responder las preguntas del dueño (cumpleaños, meseros, productos). Lo que falta no son más gráficos: es **convertir los datos en proceso**: un protocolo de cumpleaños con etapas y seguimiento, una ficha única por cliente y una capa de alertas/recordatorios. Con la Fase 1 el equipo pasaría de “consultar el tablero” a **trabajar desde el tablero**.

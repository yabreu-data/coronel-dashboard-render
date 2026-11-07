# Centro de acción — rediseño de puesto de mando

## Objetivo

Convertir el inicio del dashboard en una herramienta de **operación diaria**,
no en un reporte que hay que interpretar. La pregunta que responde ahora es:

> ¿Qué tengo que hacer hoy y cómo está el negocio mientras lo hago?

## Problema del diseño anterior

- La misma información aparecía tres veces: alertas, resumen ejecutivo y KPIs.
- La calidad se mostraba en un bloque grande y luego otra vez en una tarjeta.
- El usuario tenía que bajar para encontrar el detalle, pero el detalle repetía
  las alertas y los KPIs.
- El bloque de alertas no distinguía urgencia real de información.
- En móvil la cabecera y los filtros empujaban la acción principal muy abajo.
- No había contexto temporal: “9 vencidas” no decía qué hacer primero.

## Nueva arquitectura

### 1. Command header
- Saludo y fecha: “CENTRO DE ACCIÓN · SÁBADO, 7 DE NOVIEMBRE”.
- Frase de situación: cuántas prioridades vencidas y cumpleaños hay.
- Dos acciones: **Atender vencidas** (primaria, roja) y **Ver cumpleaños**.
- Datos de confianza: actualizado, encuestas y clientes.
- **Pulso** al lado: calidad positiva, IC95, composición Bueno/Regular/Malo,
  encuestas sin calificar y tendencia de 7 días.

### 2. Plan de hoy
Una cola priorizada, no una lista de métricas:

1. Prioridades vencidas.
2. Clientes con calidad Mala.
3. Cumpleaños próximos.
4. Encuestas sin calificar.

Cada fila tiene cantidad, explicación y acción. La primera disponible se
destaca con borde rojo; si no hay pendientes, pasa a estado verde.

### 3. Pulso del negocio
Tres señales de contexto: clientes en riesgo, respuestas sin calificar y
cumpleaños de hoy. Incluye una frase de lectura y acceso a clientes.

### 4. Contexto accionable
- **Clientes a llamar**: riesgo con nombre, teléfono y comentario.
- **Agenda**: próximos cumpleaños con fecha, días restantes y promoción.
- **Primeros pasos** para usuarios nuevos, descartable.
- **Ver análisis completo**: el detalle queda debajo, sin competir con la
  operación.

## Decisiones de UI/UX

- **Jerarquía por consecuencia, no por tipo de dato**: primero lo que tiene
  fecha o cliente afectado; después el pulso; después el análisis.
- **Un solo lugar para la calidad**: el pulso reemplaza el hero y la tarjeta
  duplicada.
- **Números con contexto**: n, IC95 y “sin calificar” junto al porcentaje.
- **Acciones junto al dato**: cada señal tiene una salida concreta.
- **Fondo oscuro solo donde ancla**: el pulso verde oscuro separa la lectura
  ejecutiva del área de trabajo blanca.
- **Móvil**: una columna, acciones a ancho completo y cola de tareas sin
  desplazamiento horizontal.
- **Consistencia**: mismos tokens, tipografía y estados hover que el resto del
  sistema (ver [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)).

## Datos que usa

- Encuestas, calidad y comentarios de `Encuestas_Limpias`.
- Prioridades y vencimientos.
- Perfiles de clientes y segmento “En riesgo”.
- Cumpleaños y promociones.
- Llamadas registradas.
- Cálculo de IC95 con Wilson para la calidad positiva.

## Cómo medir si funciona

- Tiempo hasta la primera acción del día (< 30 s).
- Clics hasta abrir una prioridad vencida (≤ 2).
- Porcentaje de días con al menos una llamada registrada.
- Uso del bloque “Plan de hoy” vs. navegación manual.
- Tiempo en móvil para resolver una tarea.

## Capturas

- [Escritorio](screenshots/ux/overview-redesign-clean.png)
- [Móvil](screenshots/ux/overview-redesign-mobile.png)
- [Con primeros pasos](screenshots/ux/overview-redesign.png)

## Próximos pasos

- Añadir seguimiento de llamadas vencidas al plan cuando existan registros.
- Personalizar el saludo por rol (cajera vs. administrador).
- Convertir el resto de tablas a cards móviles.

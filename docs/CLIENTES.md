# Clientes — cartera accionable

## Objetivo

Convertir Clientes en una **cartera de trabajo**, no en un catálogo:

1. ¿A quién debo llamar primero?
2. ¿En qué segmento está cada cliente?
3. ¿Cuándo fue el último contacto y qué dijo?

## Problemas del diseño anterior

- Cinco tarjetas de KPI repetían los conteos de los tabs de segmento.
- La página mezclaba cumpleaños, últimas llamadas, cumpleaños pasados,
  clientes estrella y base de clientes: cinco bloques sin jerarquía.
- La tabla se cortaba en móvil y solo mostraba 30 de 109 clientes sin avisar.
- La búsqueda global no filtraba la cartera visible.
- No había una prioridad de llamada clara.

## Nueva arquitectura

### 1. Cabecera de cartera
- Contactos totales.
- Fieles, recurrentes y en riesgo.
- Acción primaria: **Atender los clientes en riesgo**.
- Acción secundaria: **Ver cumpleaños**.

### 2. Prioridad de hoy
Panel lateral con los tres clientes en riesgo más relevantes:
- nombre,
- comentario,
- llamada directa.

Enlace para ver todos los clientes en riesgo.

### 3. Segmentos
Tabs con conteo:
`Todos · En riesgo · Fieles · Recurrentes · Nuevos`

### 4. Cartera
Filas accionables con:
- iniciales del cliente,
- nombre y segmento,
- teléfono y comentario,
- número de encuestas,
- última calidad,
- última llamada,
- botón de llamada.

Se muestran 15 clientes inicialmente y luego se cargan los restantes.

### 5. Contexto lateral
- **Agenda de cumpleaños** con vista semana/mes y llamada directa.
- **Últimas llamadas** con fecha, resultado y próxima acción.

En móvil, la agenda y las llamadas aparecen antes de la cartera para no quedar
al final de una lista larga.

## Decisiones de UI/UX

- **Una acción principal por cliente**: llamar. El detalle se abre al pulsar
  la fila.
- **Segmento como filtro principal**, no como cinco tarjetas repetidas.
- **Riesgo primero**: orden por segmento y luego por recurrencia.
- **Búsqueda aplicada a la cartera**: nombre, teléfono y comentario.
- **Carga progresiva**: 15 iniciales, sin listas infinitas silenciosas.
- **Móvil**: tabs en varias filas, llamada como icono, agenda primero.

## Métricas para medir la cartera

- Clientes en riesgo contactados por semana.
- Tiempo medio hasta la primera llamada.
- Tasa de recuperación de clientes en riesgo.
- Clientes fieles/recurrentes con seguimiento.
- Uso del botón de llamada vs. navegación manual.

## Capturas

- [Escritorio](screenshots/ux/clients-redesign.png)
- [Móvil](screenshots/ux/clients-redesign-mobile.png)

## Próximos pasos

- Ficha de cliente con historial completo y próxima acción.
- Filtro por responsable y por última llamada.
- Exportación de la cartera filtrada.
- Acciones masivas de asignación.

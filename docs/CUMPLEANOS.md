# Cumpleaños — rediseño de campaña

## Objetivo

Convertir la pestaña de cumpleaños en un **flujo de campaña operable**:

1. ¿A quién contacto hoy?
2. ¿Qué avance lleva la campaña?
3. ¿Qué sigue después de contactar?

## Problemas del diseño anterior

- Nueve indicadores arriba (5 tarjetas + 4 pasos de embudo) que repetían la
  misma información.
- Tarjetas muy altas con cinco botones de estado, más acciones y metadatos.
- El embudo y los KPIs competían por atención.
- El calendario seguía en azul oscuro dentro del tema claro.
- En móvil la cabecera ocupaba demasiado y las tarjetas se alargaban.

## Nueva arquitectura

### 1. Cabecera de campaña
- “CAMPAÑA · NOVIEMBRE DE 2026”.
- Cuántos clientes están sin contactar.
- Contexto: cumpleaños de hoy y de la semana.
- Acción primaria: **Contactar los de hoy** o **Preparar la semana**.
- Acciones secundarias: mensajes de WhatsApp y alerta de acciones vencidas.
- Tres KPIs: **Hoy**, **Esta semana**, **Sin contactar**.

### 2. Avance de campaña
Un solo embudo horizontal:

`Base → Contactados → Aceptaron → Redimieron`

Cada etapa muestra cantidad, porcentaje de la base y barra de progreso.

### 3. Lista priorizada
- Filtros por etapa (0–3, 4–7, 8–30, pasadas) y estado.
- Búsqueda y “solo sin contactar”.
- Agrupación por horizonte temporal.
- Fila compacta con:
  - fecha,
  - nombre, segmento y días restantes,
  - teléfono y promoción,
  - estado como selector,
  - próxima acción e historial,
  - WhatsApp, llamada y menú de acciones.

### 4. Calendario
- Se mantiene oculto hasta “Ver calendario”.
- Días claros, cumpleaños en ámbar, hoy en verde y selección en verde oscuro.
- El día seleccionado filtra la lista inferior.

### 5. Protocolo
El playbook queda al final como guía de equipo, sin competir con la operación.

## Decisiones de UI/UX

- **Una sola fuente de avance**: el embudo reemplaza tarjetas y funnel
  duplicados.
- **Estado como selector**: menos ruido que cinco botones y evita pulsaciones
  accidentales.
- **Acción primaria contextual**: si hoy hay cumpleaños, “Contactar hoy”; si no,
  “Preparar la semana”.
- **WhatsApp y llamada siempre visibles**: son las dos acciones reales.
- **Acciones secundarias en menú**: ficha, copiar mensaje y ajustar.
- **Móvil**: cabecera compacta, KPIs en fila, tarjetas en una columna y acciones
  a ancho completo.

## Datos que usa

- Cumpleaños y edades confiables.
- Perfiles y segmento del cliente.
- Campañas: estado, promoción, responsable, próxima acción.
- Llamadas y resultados.
- Plantillas de WhatsApp.
- Promociones activas.

## Cómo medir la campaña

- Tasa de contacto = contactados / base.
- Tasa de aceptación = aceptaron / contactados.
- Tasa de redención = redimieron / aceptaron.
- Tiempo medio hasta el primer contacto.
- Acciones vencidas por responsable.
- Cumpleaños contactados antes de la fecha.

## Capturas

- [Escritorio](screenshots/ux/birthday-redesign.png)
- [Calendario](screenshots/ux/birthday-redesign-calendar.png)
- [Móvil](screenshots/ux/birthday-redesign-mobile.png)

## Próximos pasos

- Acciones masivas para “marcar contactados” y “copiar mensajes del día”.
- Filtro por responsable.
- Comparativa entre meses.
- Envío directo de WhatsApp Business API.

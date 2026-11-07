# Tarjetas de insight

## Principio

Un dato no es un insight. Un insight es una **conclusión con evidencia y una
acción posible**.

Cada pantalla de análisis muestra como máximo **3 tarjetas**:

1. qué funciona,
2. qué mejorar,
3. qué hacer / qué falta.

## Anatomía

| Elemento | Función |
|---|---|
| Etiqueta | “Lo que funciona”, “Prioridad n.º 1”, “Muestra pequeña”. |
| Titular | La conclusión, en una frase. |
| Evidencia | Número, muestra y período. |
| Confianza | n, IC95 o “muestra insuficiente”. |
| Acción | Lleva al detalle o al flujo operativo. |
| Tono | Verde, ámbar, rojo o neutro según el mensaje. |

No se permite:

- un insight sin evidencia;
- repetir el mismo dato en KPI y tarjeta;
- ranked de meseros con n<20 como si fuera definitivo;
- más de 3 tarjetas por pantalla.

## Dónde están

### Centro de acción
- Prioridad n.º 1: atrasadas.
- Cliente en riesgo más urgente.
- Cumpleaños próximo.

### Voz del cliente
- Lo que funciona: señal positiva más repetida.
- Lo que mejorar: señal negativa más repetida.
- Lo que piden: categoría de pedido más frecuente.

### Equipo
- Mejor porcentaje con n e IC95.
- Confianza del ranking: muestra baja.
- Delivery web vs. meta.

### Historial de metas
- Calidad del último mes vs. meta.
- Tendencia contra el mes anterior.
- Mesero con más volumen.

## Reglas de lenguaje

- “Clientes satisfechos”, no “calidad positiva”.
- “Atrasadas”, no “vencidas”.
- “Muestra baja”, no “n insuficiente” sin explicación.
- “Meta: 90%”, no “objetivo positivo 90”.

## Capturas

- [Centro de acción](screenshots/ux/insights-overview.png)
- [Voz del cliente](screenshots/ux/insights-voice.png)
- [Equipo](screenshots/ux/insights-team.png)
- [Historial](screenshots/ux/insights-targetHistory.png)

## Siguiente

- Convertir cada insight negativo en una prioridad con un clic.
- Permitir descartar un insight (“ya lo revisamos”).
- Comparar los insights de dos períodos.

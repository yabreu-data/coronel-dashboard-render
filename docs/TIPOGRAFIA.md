# Tipografía A — Manrope + Lora

## Dirección elegida

Una tipografía **cálida y de restaurante**, pero con lectura rápida para el día a
día:

- **Manrope** para operar: texto, botones, tablas, listas y formularios.
- **Lora** para la marca: títulos, cifras y momentos editoriales.
- Respaldo: Segoe UI / Georgia si Google Fonts no carga.

La decisión busca el equilibrio entre lo agradable y lo usable: una cajera o el
dueño deben leer rápido, pero la app no debe sentirse como un software genérico.

## Familias

| Uso | Fuente |
|---|---|
| Títulos H1–H3, cifras KPI, fechas destacadas | **Lora** |
| Cuerpo, navegación, botones, tablas, etiquetas | **Manrope** |
| Respaldo | Segoe UI / Georgia |

Cargadas desde Google Fonts en `client/index.html` con `display=swap`.

## Escala normalizada

| Nivel | Escritorio | Móvil |
|---|---:|---:|
| H1 | 34 px | 29 px |
| H2 | 28 px | 24 px |
| H3 | 19 px | 18 px |
| Hero / command | 33 px | 28 px |
| Cuerpo | 15 px | 15 px |
| Secundario | 13 px | 12.5 px |
| Etiquetas | 10.5 px | 10 px |
| Cifras KPI | 30 px | 27 px |

- Interlineado 1.55 en cuerpo y 1.05–1.12 en títulos.
- Manrope con pesos 400–700; Lora 500–700.
- Números KPI con cifras tabulares y Lora para darles presencia.
- Se eliminaron tamaños operativos de 8–9 px.

## Toque Ghibli

- Fondo **papel cálido** (`#f7f2e7`).
- Tarjetas **marfil** (`#fffdf8`).
- Verde bosque y salvia como base de marca.
- Lora aporta el aire de libro ilustrado; Manrope mantiene la interfaz ágil.
- Bordes y sombras suaves, sin efectos excesivos.
- La identidad Coronel (verde, rojo, salvia) no cambia.

## Antes / después

| Antes | Ahora |
|---|---|
| Fraunces + Source Serif 4 en todo | Lora para títulos; Manrope para lectura |
| Texto serif en listas largas | Texto sans legible en la operación |
| Interfaz sentida como “libro” | Interfaz de restaurante moderna |
| Etiquetas pequeñas | Escala mínima normalizada |
| Fondo blanco frío | Papel cálido con tarjetas marfil |

## Cuidados

- Lora solo en títulos, cifras y fechas destacadas; no en párrafos.
- Manrope no debe bajar de 10 px en etiquetas.
- Mantener contraste AA.
- Evitar mayúsculas sostenidas largas: solo eyebrows y pills.

## Capturas

- [Centro de acción](screenshots/ux/typography-a-overview.png)
- [Cumpleaños](screenshots/ux/typography-a-birthdays.png)
- [Clientes](screenshots/ux/typography-a-clients.png)
- [Prioridades](screenshots/ux/typography-a-priorities.png)
- [Móvil](screenshots/ux/typography-a-mobile.png)
- [Comparación A/B/C que se usó para decidir](screenshots/ux/typography-comparison.png)

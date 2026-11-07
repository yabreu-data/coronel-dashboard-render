# Tipografía editorial — Fraunces + Source Serif 4

## Dirección

Una tipografía **serif cálida y editorial**, con aire de libro ilustrado y
restaurante de barrio: moderna, legible y con un guiño Ghibli sin convertirse en
un tema infantil.

## Familias

| Uso | Fuente | Por qué |
|---|---|---|
| Títulos y cifras | **Fraunces** | Serif contemporánea, curvas suaves y personalidad; funciona como letrero de restaurante. |
| Texto, botones y UI | **Source Serif 4** | Serif de lectura, clara en tamaños pequeños; evita el contraste duro de una sans. |
| Respaldo | Georgia, Palatino, serif | Si Google Fonts no carga, la app conserva el carácter serif. |

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
- `letter-spacing` negativo solo en títulos; etiquetas con tracking amplio.
- Números con `lining-nums tabular-nums`.
- Se eliminaron tamaños de 8–9 px en textos operativos.

## Toque Ghibli

- Fondo **papel cálido** (`#f7f2e7`) en lugar de blanco frío.
- Tarjetas **marfil** (`#fffdf8`).
- Verde bosque y salvia se mantienen como base de marca.
- Serif con curvas suaves en títulos; texto de lectura en lugar de sans.
- Bordes y sombras suaves, sin exceso de gradientes ni efectos.
- La identidad Coronel (verde, rojo, salvia) no cambia.

## Antes / después

| Antes | Ahora |
|---|---|
| Inter sans en todo | Fraunces para títulos y cifras; Source Serif 4 para lectura |
| Títulos genéricos | Títulos con carácter editorial |
| Etiquetas de 8–10 px | Etiquetas de 10–11 px |
| Números con sans | Cifras serif alineadas |
| Fondo blanco frío | Papel cálido con tarjetas marfil |
| Tipografía sin jerarquía | Escala fija de 6 niveles |

## Cuidados

- No usar Fraunces en párrafos largos: se reserva para títulos y cifras.
- No bajar de 10 px en etiquetas.
- Mantener contraste AA; el serif fino necesita fondos claros.
- Evitar mayúsculas sostenidas largas: se usan solo en eyebrows y pills.

## Capturas

- [Centro de acción](screenshots/ux/fonts-overview.png)
- [Cumpleaños](screenshots/ux/fonts-birthdays.png)
- [Clientes](screenshots/ux/fonts-clients.png)
- [Prioridades](screenshots/ux/fonts-priorities.png)
- [Móvil](screenshots/ux/fonts-mobile.png)

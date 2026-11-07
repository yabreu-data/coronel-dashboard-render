# Dirección visual: minimalista, premium y cálida

## Intención

Que el sistema se sienta como un restaurante cuidado: **sobrio, cálido y
premium**, no como un panel corporativo frío. Menos adornos, mejor jerarquía,
materiales suaves y movimiento discreto.

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--canvas` | `#f5f1e8` | Fondo marfil cálido |
| `--surface` | `#fffdf8` | Tarjetas, tablas, formularios |
| `--line` | `#e5ddcf` | Bordes finos |
| `--ink` | `#1e2e24` | Texto principal |
| `--muted` | `#67736a` | Texto secundario |
| `--green` | `#1b3b2a` | Verde bosque premium |
| `--red` | `#c4513b` | Terracota de acción |
| `--yellow` | `#b98a45` | Ocre para avisos |

El rojo de marca se mantiene, pero se vuelve **terracota** para no gritar. El
verde profundo manda en sidebar, títulos y acciones principales.

## Sidebar y navegación

- Sidebar verde bosque con degradado muy sutil.
- Estado activo con **tinte salvia + línea vertical**, no con bloque saturado.
- Badges pequeños, terracota, discretos.
- Etiquetas de sección más pequeñas y espaciadas.
- Navegación móvil inferior en marfil translúcido con blur.

## Topbar

- Sticky, translúcida y con borde inferior cálido.
- Título en Lora, breadcrumb en mayúsculas pequeñas.
- Selector de datos y sesión como controles secundarios.
- **Registrar llamada** se mantiene como única acción roja.

## Tarjetas

- Fondo `#fffdf8`, borde de 1 px y radio 15–17 px.
- Sombra amplia y very low opacity (`0 10px 28px rgba(48,42,29,.045)`).
- Tarjetas de insight con borde superior de 2 px según tono.
- Cero gradientes decorativos fuertes; solo el bloque de calidad conserva peso
  visual.

## Botones y badges

- Acción principal: terracota `#c4513b`, radio 9 px, sombra suave.
- Acción secundaria: marfil, borde cálido, texto verde.
- Badges de 5 px de radio, fondo tonal, tipografía de 9 px.
- Feedback al presionar: `scale(0.985)`.

## Formularios

- Fondo marfil claro, borde `#ded4c4`, radio 8 px.
- Foco con halo salvia `rgba(172,211,182,.26)`.
- Etiquetas en verde grisáceo, no negro puro.

## Movimiento

- Entrada de secciones: `soft-rise` de **300 ms** con
  `cubic-bezier(.16,1,.3,1)`.
- Hover de tarjetas: 1 px de elevación, 200 ms.
- Toast: 220 ms.
- Botones y campos: 180 ms.
- `prefers-reduced-motion`: se desactivan animaciones y transiciones.
- Sin librerías de animación: todo es CSS.

## Capturas

- [Centro de acción](screenshots/ux/premium-overview.png)
- [Clientes](screenshots/ux/premium-clients.png)
- [Prioridades](screenshots/ux/premium-priorities.png)
- [Llamadas](screenshots/ux/premium-calls.png)
- [Móvil](screenshots/ux/premium-mobile.png)
- [Login](screenshots/ux/premium-login.png)

## Dependencias

Ninguna nueva. Se usan los componentes, Tailwind, Lucide y fuentes ya
instalados. Todo el refresh vive en `client/src/index.css`.

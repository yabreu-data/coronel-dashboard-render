# Sistema de diseño — Coronel

Base visual del dashboard después de la migración a tema claro.

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--canvas` | `#f3f6f2` | Fondo general moderno |
| `--surface` | `#ffffff` | Tarjetas, tablas, formularios |
| `--sage` | `#acd3b6` | Acento, sidebar activo, bordes suaves |
| `--green-900` | `#1d4a31` | Navegación, títulos, botones secundarios |
| `--green-700` | `#2f6b4f` | Enlaces y foco |
| `--red-600` | `#d93a2b` | Acción primaria y alertas críticas |
| `--red-50` | `#fff1ef` | Fondo de alertas |
| `--ink` | `#173b2b` | Texto principal |
| `--muted` | `#4f6f5e` | Texto secundario |
| `--line` | `#e2e9e1` | Bordes |

Reglas:

- El blanco no se usa para todo: la navegación principal es verde oscuro, el
  fondo es verde muy claro y las tarjetas de trabajo son blancas.
- El rojo se reserva para acciones primarias y criticidad; no para decoración.
- La salvia indica selección, progreso y superficies secundarias.

## Tipografía

| Nivel | Tamaño | Uso |
|---|---|---|
| H1 | 27–34 px | Título de página |
| H2 | 22–26 px | Título de sección |
| H3 | 16–18 px | Título de tarjeta |
| Cuerpo | 13–14 px | Texto de interfaz |
| Meta | 11–12 px | Descripciones, fechas |
| Label | 10–11 px | Eyebrow en mayúsculas, con tracking |

Mínimo 11 px para etiquetas; nunca 9 px en contenido operativo.

## Espaciado y radios

- Escala: 4, 8, 12, 16, 24, 32, 48.
- Radios: 8 px chips, 12–14 px tarjetas, 16–18 px modales.
- Sombra base: `0 10px 26px rgba(29,74,49,.07)`.
- Sombra elevada: `0 24px 60px rgba(29,74,49,.14)`.

## Componentes

### PageHeader
Título + una línea de contexto + acción primaria. Sin hero de 3 líneas.

### StatCard
KPIs de 4 columnas máximo. Valor grande, etiqueta, detalle opcional y flecha
solo si es clicable. En móvil: 2 columnas.

### SectionCard / Panel
Superficie blanca, borde `--line`, cabecera con título y acción. Estados:
normal, vacío, carga y error.

### FilterBar
Búsqueda + filtros activos como chips + limpiar. En móvil se colapsa en una
hoja o se oculta lo secundario.

### DataTable
Desktop: cabecera salvia, filas blancas, hover salvia suave.
Móvil: cards con `data-label` visible; una acción principal por card.

### Modal
`role="dialog"`, `aria-modal`, foco atrapado, `Esc` para cerrar y retorno de
foco al elemento que lo abrió. Usar `useDialogFocus`.

### Alert / EmptyState
Las alertas usan fondo rojo claro y texto oscuro; nunca texto blanco sobre
pastel. Los estados vacíos incluyen una acción concreta.

## Accesibilidad

- Contraste mínimo 4.5:1 en texto normal.
- Foco visible con anillo verde de 3 px.
- Objetivos táctiles de 44×44 px en móvil.
- `prefers-reduced-motion` desactiva confeti y animaciones.
- No usar color como única señal: acompañar con texto o icono.

## Estructura visual

1. Sidebar verde oscuro: marca y navegación.
2. Topbar blanco: título, estado de datos y acciones.
3. Contenido: fondo verde claro, tarjetas blancas, paneles secundarios salvia.
4. Alertas: rojo pálido solo para lo que requiere acción.

## Refresh moderno

- Topbar sticky con vidrio suave y borde inferior.
- Sidebar verde bosque fijo, navegación activa en salvia.
- Tarjetas blancas de 16–20 px, sombra suave y menos bordes duros.
- Fondo verde grisáceo claro (`#f3f6f2`), no blanco frío.
- Botones, tabs e inputs con radios de 8–10 px.
- Más espacio interior y jerarquía tipográfica Lora + Manrope.

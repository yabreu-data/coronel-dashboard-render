# Estilo Bistró Botánico

## Dirección

Interfaz editorial de restaurante: papel blanco con patrón textil, títulos serif
en verde de marca, texto negro legible y rojo solo para llamadas a la acción.

## Tokens aplicados

```css
--brand-green-light: #87c097;
--brand-green-dark: #208d56;
--brand-white: #ffffff;
--brand-red-accent: #f93015;
--brand-black: #000000;
--radius-editorial: 16px;
```

- Títulos: **Playfair Display**, verde `#208d56`.
- Interfaz y cuerpo: **Inter**, negro.
- Fondo: blanco puro + patrón de Coronel al **4 %**.
- Header/topbar: verde `#208d56` con logo blanco.
- Sidebar: verde menta `#f2f8f5`.
- Tarjetas métricas: blancas, borde `#87c097`, radio 16 px y sombra verde suave.
- Paneles destacados: `rgba(135,192,151,.15)`.
- Rojo `#f93015`: solo botones principales/CTA y precios.

## Correcciones de contraste

- **Contexto de la señal**: fondo blanco, título verde, contador negro,
  comentarios en negro y metadatos en gris oscuro.
- **Fichas/modales heredados**: `bw-modal`, `comment-modal`, `client-sheet`,
  `call-modal` y PDF pasan a superficies blancas con texto oscuro.
- **Sidebar**: fondo blanco, navegación verde oscuro y badges verdes con número
  blanco.
- **Riesgo/clientes/productos**: nombres y números con negro/gris alto contraste,
  sin depender del hover.
- **Insights**: las palabras clave entre comillas y “Calificó Regular/Malo”
  aparecen en negrita.

## Espacio

- Padding de panel a 22 px.
- Separación entre zonas a 20 px.
- Tarjetas de insight de 170 px mínimo.
- Contenido con más aire y menos fondos verdes saturados.

## Patrón

`/manus-storage/patron-coronel.png` se usa:

- en el `body::before`, fijo, `160px`, opacidad 4 %;
- en la hoja del PDF, opacidad 4,5 %.

## Dónde se cambian las metas

**Equipo → Metas del equipo → Editar metas**.

También hay botón directo en el encabezado de Equipo y en la tarjeta
**META CALIDAD**.

## Capturas

- [Header y sidebar](screenshots/audit/header-overview.png)
- [Header móvil](screenshots/audit/header-mobile.png)
- [Inicio Bistró](screenshots/audit/bistro-overview.png)
- [Contexto de señal](screenshots/audit/bistro-context.png)
- [Clientes](screenshots/audit/bistro-clients.png)
- [PDF Bistró](screenshots/audit/bistro-pdf.png)

# Identidad Coronel aplicada

## Patrón de marca

Archivo: `client/public/manus-storage/patron-coronel.png`.

Uso:

- Fondo sutil de la aplicación, al 3,5 % de opacidad.
- Fondo del reporte PDF, al 4,5 %.
- Se mezcla con `multiply` para integrarse al verde claro sin ensuciar la
  lectura.

## Paleta

| Color | Uso |
|---|---|
| `#208d56` | Verde principal, acciones y acentos |
| `#87c097` | Salvia, estados activos y detalles |
| `#ffffff` | Superficies |
| `#f93015` | Acción principal y alertas |
| `#000000` | Texto base |
| `#eef8f3` | Fondo turquesa muy claro |

Se eliminó el fondo rosado/crema anterior. Las zonas ahora usan verdes y
turquesas muy suaves.

## Nombre editable

**Mi cuenta → Tus datos → Editar nombre → Guardar.**

- Endpoint nuevo `profile.updateName`.
- Actualiza la tabla de usuarios y refresca `auth.me`.
- El nombre cambia en la barra superior, el saludo y la ficha de cuenta.

## Contador de encuestas

En la barra superior:

> **111 encuestas cargadas desde Encuestas_Limpias**

También aparece en el pie de página. Sirve para comparar el total que muestra
el sistema contra la hoja de Google.

## Word cloud interactivo

En **Voz del cliente → Frases que se repiten**:

- Tamaño según frecuencia.
- Colores de la paleta.
- Hover y selección.
- Al hacer clic, despliega los comentarios que mencionan esa frase.
- La coincidencia se hace por palabras, no por texto exacto, para que no quede
  vacía por puntuación o acentos.

## Tipografía

- **Manrope** para títulos, navegación y UI.
- **Lora** solo como acento editorial en el logo/marca.
- Tamaños mínimos subidos para etiquetas, tablas y textos secundarios.

## Metas del equipo

Están en:

**Equipo → Metas del equipo → Editar metas → `Editar metas`**.

También se llega con el botón **Editar metas** del encabezado de Equipo o con la
tarjeta **META CALIDAD**.

Requiere la clave de administrador.

## PDF

- El panel de control pasó del azul oscuro a blanco/verde.
- La hoja mantiene el patrón de marca.
- Se corrigió un error de hooks de React que rompía la vista previa.

## Capturas

- [Inicio verde](screenshots/audit/brand-overview.png)
- [Word cloud](screenshots/audit/brand-wordcloud.png)
- [Nombre editable](screenshots/audit/brand-name-edit.png)
- [Metas del equipo](screenshots/audit/brand-team-targets.png)
- [PDF](screenshots/audit/brand-pdf.png)

## Saludo y contraste

- El Centro de acción saluda primero: “Hola, {nombre} 👋”.
- La urgencia pasa a una línea secundaria.
- Riesgo con contexto muestra solo clientes que dejaron comentario.
- Los clientes con calificación pero sin comentario siguen su propio criterio de calificación, no se presentan como “contexto”.
- Nombres y textos secundarios de riesgo, clientes y productos tienen más contraste y tamaño.
- El verde fuerte queda en acentos, sidebar y acciones; los fondos son turquesa muy claro.

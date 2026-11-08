# Ficha de cliente flotante

## Problema reportado

Al abrir una ficha, aparecía lejos del punto de lectura: “abajo, como en el
centro de toda la página”.

## Causa técnica real

El layout no hace scroll con `window`. El contenedor que scrollea es
`.main-area`:

```css
.main-area {
  height: 100vh;
  overflow-y: auto;
}
```

El código hacía:

```ts
window.scrollTo({ top: 0, behavior: "smooth" });
```

Eso no movía `.main-area`. Al cambiar de pantalla, el scroll viejo se conservaba
y la ficha quedaba a mitad de página o fuera de la vista.

## Solución aplicada

### 1. Scroll correcto
Se añadió:

```ts
const scrollAppToTop = (behavior = "smooth") => {
  const scroller = document.querySelector<HTMLElement>(".main-area");
  if (scroller) scroller.scrollTo({ top: 0, behavior });
  else window.scrollTo({ top: 0, behavior });
};
```

Ahora sí se usa en navegación y al volver a Prioridades.

### 2. Ficha como panel flotante
En vez de cambiar de página, “Abrir ficha” abre un panel sobre la pantalla
actual:

- Escritorio: panel lateral derecho de 440 px.
- Móvil: hoja inferior con máximo 88vh.
- Fondo difuminado.
- Bloquea el scroll del fondo.
- Se cierra con la X, el fondo o `Escape`.
- **No pierde la posición de lectura.**

### 3. Contenido de la ficha
- Nombre, teléfono, segmento y visitas.
- Llamar por `tel:`.
- Registrar llamada sin salir.
- Último comentario y último contacto.
- Últimas visitas con calidad, plato, fecha, mesero y comentario.
- Cierre explícito.

## Capturas

- [Ficha escritorio](screenshots/audit/client-sheet.png)
- [Ficha móvil](screenshots/audit/client-sheet-mobile.png)

## Verificación

- Scroll de `.main-area` antes/después de abrir: **844 → 844** (se conserva).
- Panel en escritorio: `x=986`, ancho 440, alto ajustado al contenido.
- Panel móvil: hoja inferior.
- `pnpm check`, `pnpm build`, tests y smoke test en verde.

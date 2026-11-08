# Jerarquía visual

## Problema

La interfaz era demasiado blanca y plana: el encabezado, los insights, los KPI,
las tablas y los formularios tenían el mismo peso. El ojo no sabía dónde
empezar ni dónde terminaba una zona.

## Solución: cuatro niveles de superficie

1. **Lienzo cálido** `#f5f1e8`.
2. **Zona de página** con acento lateral por pantalla.
3. **Franja de insights** con tinte propio.
4. **Tarjetas y tablas** blancas/marfil para el detalle.

La regla es: **cuanto más importante es una zona, más color y contraste tiene**;
el detalle queda en superficies limpias.

## Acento por pantalla

| Pantalla | Acento |
|---|---|
| Centro de acción | Verde bosque |
| Cumpleaños | Ocre |
| Clientes | Terracota |
| Prioridades | Ámbar |
| Llamadas | Verde |
| Voz del cliente | Terracota suave |
| Equipo | Salvia |
| Historial | Ocre oscuro |
| Promociones | Malva |
| Encargados | Verde azulado |
| Mi cuenta | Verde bosque |
| Cuentas y accesos | Malva profundo |

El acento aparece en:

- borde izquierdo del encabezado;
- línea antes de cada “eyebrow” de sección;
- cabecera de tablas;
- borde superior de los KPI;
- fondos de zona.

## Qué cambió

### Encabezado de página
- Fondo degradado de marfil a tinte de la página.
- Borde izquierdo de 4 px con el acento.
- Título con más peso.

### Franja de insights
- Ya no es una fila de tarjetas sobre blanco.
- Es una **zona con fondo tintado**, borde y radio propios.
- Las tarjetas blancas resaltan dentro.

### Insights por tono
- Positivo: verde muy suave.
- Precaución: crema.
- Crítico: rosado cálido.
- Neutro: marfil.

### KPI
- Cada tarjeta tiene borde superior de color y fondo tintado.
- El número es más grande.
- Los seis KPI ya no se leen como un bloque uniforme.

### Secciones
- “Eyebrow” con línea de acento.
- Títulos más grandes.
- Línea inferior que separa el encabezado del contenido.

### Zonas especiales
- Agenda de llamadas: verde suave.
- Solicitudes de acceso: crema.
- Resumen de cuentas: verde suave.
- Promociones/nuevas altas: crema.
- Auditoría: gris cálido.
- Mi imagen: verde suave.
- Seguridad: crema.

### Tablas
- Cabecera con tinte de página.
- Filas alternas marfil.
- Hover verde suave.

### Estados vacíos
- Caja punteada cálida, no otro panel blanco.

## Capturas

- [Centro de acción](screenshots/audit/hierarchy-overview.png)
- [Clientes](screenshots/audit/hierarchy-clients.png)
- [Voz del cliente](screenshots/audit/hierarchy-voice.png)
- [Llamadas](screenshots/audit/hierarchy-calls.png)
- [Promociones](screenshots/audit/hierarchy-promotions.png)
- [Cuentas y accesos](screenshots/audit/hierarchy-administracion.png)
- [Móvil](screenshots/audit/hierarchy-mobile.png)

## Implementación

- Atributo `data-page` en el contenedor principal.
- Variables CSS `--page-accent` y `--page-soft` por pantalla.
- Clases `accent-*` en los KPI.
- Sin dependencias nuevas.
- Respeta `prefers-reduced-motion`.

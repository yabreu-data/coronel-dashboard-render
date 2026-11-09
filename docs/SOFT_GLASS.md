# Soft Glass Dashboard

## Estructura

### Logo
- Vive en la **barra lateral**, dentro de un bloque sólido `#145c36`.
- El header ya no contiene el logo.
- El logo blanco se lee perfectamente sobre el bloque verde.

### Paleta calibrada

| Token | Valor | Uso |
|---|---|---|
| `--brand-green-dark` | `#145c36` | Títulos, iconos, logo |
| `--brand-green-light` | `#9ed4ae` | Bordes, badges, tarjetas secundarias |
| `--brand-accent-red` | `#e02f1b` | Alertas críticas y CTA |
| `--bg-app` | `#f3f6f4` | Fondo general |
| `--bg-card` | `#ffffff` | Tarjetas |
| `--text-main` | `#111613` | Texto principal |
| `--text-muted` | `#526357` | Texto secundario |
| `--radius-dashboard` | `18px` | Tarjetas flotantes |
| `--shadow-card` | sombra verde muy suave | Volumen |

### Fondo
- Patrón Coronel repetido a **820 px**, con capa de 95 % y visible al 5 %.
- Capa blanca de 95 % para que el patrón se vea sin competir con la lectura.
- También se aplica en login y carga.

### Tarjetas
- `.dashboard-card` y `.panel`.
- Fondo blanco translúcido.
- Borde verde fino.
- Sombra suave.
- Hover de 2 px.

### Header
- Blanco con vidrio suave (`backdrop-filter`).
- Título en verde oscuro.
- Sin logo.

### Sidebar
- Blanca.
- Logo en caja verde oscura de 12 px de radio.
- Navegación verde.
- Badges rojos calibrados.

## Equipo: reestructuración

Orden nuevo:

1. Encabezado con **Editar metas** visible.
2. **Período** primero.
3. **Insights** del período.
4. **KPI** del período.
5. Comparación solo si hay fechas completas.
6. **Personas**: volumen y calidad.
7. **Metas** al final, colapsadas.

Se eliminó la comparación vacía que aparecía sin fechas y se movieron las metas fuera del flujo principal.

## Contraste
- Contexto de la señal: modal blanco, texto negro, contador negro.
- Fichas y modales: superficies blancas.
- Nombres de clientes y productos sin depender del hover.
- Textos secundarios más grandes.

## Capturas
- [Soft Glass · Inicio](screenshots/audit/softglass-overview.png)
- [Soft Glass · Equipo](screenshots/audit/softglass-team.png)
- [Soft Glass · Móvil](screenshots/audit/softglass-mobile.png)

## Centro de mando

- Saludo antes de la urgencia.
- Se eliminó el panel “Pulso del negocio” duplicado.
- Plan de hoy a ancho completo, con tareas en dos columnas.
- Luego clientes a llamar y cumpleaños.
- El análisis queda debajo, colapsado.

## Voz del cliente y Equipo

- Voz: insights primero, word cloud interactivo y contexto de la señal legible. Aún conserva paneles secundarios que se pueden reducir.
- Equipo: período primero, insights, KPI, personas y metas al final; la comparación solo aparece con fechas completas.

## Pestañas de Equipo

- **Resumen:** período, insights, KPI y comparación.
- **Personas:** delivery, volumen y desempeño.
- **Metas:** formulario de metas, que se abre automáticamente al entrar.

## Código de estilo

La configuración activa consolidada está en:
[ESTILO_ACTUAL.css](ESTILO_ACTUAL.css).

## Estilo Moderno Vivo (Rappi)

- Fondo blanco puro con patrón a **820 px** y capa del 95 %.
- Tarjetas `#f8faf9`, radio 24 px, sombra suave.
- Header blanco limpio y sidebar blanca.
- Logo blanco dentro de bloque verde en el sidebar.
- Botones CTA rojos con radio 14 px.
- Pestañas de Equipo: Resumen, Personas y Metas.
- CSS activo: [ESTILO_ACTUAL.css](ESTILO_ACTUAL.css).

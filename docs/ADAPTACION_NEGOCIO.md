# Adaptación al negocio y al usuario real

## Para quién está diseñado

Para el dueño y la cajera de Coronel, personas que:

- conocen su restaurante y a sus clientes,
- usan poco la computadora o el celular para gestionar,
- no dominan términos como “IC95”, “campaña”, “base” o “seguimiento”,
- necesitan saber **qué hacer hoy**, no interpretar un tablero.

## Principio

> No agregar más funciones: traducir las que ya existen y decir qué hacer
> primero.

## Cambios aplicados

### Lenguaje visible

| Antes | Ahora |
|---|---|
| Fuente / Encuestas_Limpias | Datos / Datos reales |
| Reporte analítico | Restaurante Coronel |
| Campaña | Cumpleaños del mes |
| Base | Total del mes |
| Contactados | Ya saludados |
| Aceptaron | Aceptaron promo |
| Redimieron | Usaron promo |
| Pendiente (cumpleaños) | Sin contactar |
| Próxima acción | Próximo paso |
| Llamar (abre formulario) | Anotar llamada / Registrar llamada |
| Cartera de clientes | Tus clientes |
| En riesgo | Por recuperar |
| Fiel / Recurrente / Nuevo | Frecuente / Repite / Primera vez |
| Centro de prioridades | Pendientes del negocio |
| Vencidas / Pendientes | Atrasadas / Sin vencer |
| En seguimiento / Atendidas | En proceso / Resueltas |
| Cola de trabajo | Pendientes |
| PIN de administrador | Clave del administrador |

### Cumpleaños

- Título: **“Felicita a tus clientes”**.
- Explica en una línea: mirar quién cumple, saludar por WhatsApp y registrar si
  vino a usar la promo.
- CTA contextual: **“Saludar a X de hoy”** o **“Ver los X de esta semana”**.
- Estado del contacto en palabras del negocio.
- Acción **“Anotar llamada”** en vez de “Llamar”.
- Embudo: Total del mes → Ya saludados → Aceptaron promo → Usaron promo.
- Guía desplegable “¿Cómo uso esta página?” con 3 pasos.

### Clientes

- Título: **“¿A quién puedes llamar hoy?”**.
- Explica qué significa frecuente, repite, primera vez y por recuperar.
- CTA **“Ver X por recuperar”**.
- Segmentos en lenguaje cotidiano.
- Filas con **visitas**, **última opinión** y **Registrar** llamada.
- Guía de 3 pasos.

### Prioridades

- Título: **“¿Qué hago primero hoy?”**.
- Regla de atención escrita como instrucciones:
  1. Cliente molesto: discúlpate y ofrece solución.
  2. Cumpleaños: saluda y ofrece promo.
  3. Llamada pendiente: cumple el seguimiento.
  4. Cliente regular: busca mejorar.
- Tabs: **Atrasadas, Sin vencer, En proceso, Resueltas, Todas**.
- Cada fila muestra estado (**Sin empezar, En proceso, Resuelta**) y una acción
  (**Empezar, Resolver, Reabrir**).
- PIN explicado: “Es la clave de 4 dígitos que usa el encargado”.
- Guía de 3 pasos.

### Navegación y cabecera

- Móvil: **Inicio** y **Cumpleaños** completos.
- Cabecera: “Datos reales · actualización automática cada 5 minutos”.
- Se quitó “Reporte analítico” del encabezado.
- Pie: “Encuestas registradas · N registros”.

## Ayuda contextual

Cada una de las tres páginas tiene un bloque **“¿Cómo uso esta página?”** con
tres pasos. Está cerrado por defecto para no ocupar espacio, pero disponible
para quien lo necesita.

## Qué falta para cerrar la experiencia de novato

1. Glosario global con icono “?”.
2. Onboarding de primer ingreso (3 tarjetas) al inicio de Centro de acción.
3. Periodo visible en los indicadores (“desde septiembre”).
4. Revisión de tamaños: algunas etiquetas siguen en 9–10 px.
5. Prueba con 5 usuarios reales (dueño, cajera, mesero).
6. Reemplazar el “IC95” de la tarjeta principal por “margen de error” con ayuda.

## Evidencia

- [Cumpleaños](screenshots/ux/business-birthdays.png)
- [Clientes](screenshots/ux/business-clients.png)
- [Prioridades](screenshots/ux/business-priorities.png)
- [Prioridades móvil](screenshots/ux/business-priorities-mobile.png)

## Criterio de aceptación

Una persona que nunca usó el sistema debe poder:

1. Encontrar a quién felicitar hoy.
2. Registrar una llamada sin preguntar qué botón pulsar.
3. Entender por qué una prioridad está primero.
4. Saber qué significa “por recuperar”.
5. Pedir ayuda sin salir de la página.

# Auditoría de claridad para usuarios no técnicos

## Alcance

- Centro de acción (pantalla base del rediseño).
- Cumpleaños.
- Clientes.
- Prioridades.

Revisión en escritorio y móvil, con foco en una persona que **usa poco la
computadora y no domina términos de gestión**.

Preguntas guía:

1. ¿Entiendo qué hace esta pantalla en 5 segundos?
2. ¿Sé cuál es la primera acción?
3. ¿Entiendo las palabras?
4. ¿Puedo equivocarme o perderme?
5. ¿Qué pasa si no hay datos?

## Veredicto

**Visualmente están bien; conceptualmente todavía hablan como un dashboard.**

| Dimensión | Nota | Comentario |
|---|---:|---|
| Jerarquía visual | 8/10 | La acción principal se ve; el ojo sabe dónde empezar. |
| Lenguaje | 4/10 | “IC95”, “cola”, “base”, “redimieron”, “seguimiento” son de experto. |
| Aprendizaje sin ayuda | 5/10 | No hay explicación al entrar ni glosario contextual. |
| Acciones | 7/10 | Hay CTA claras, pero algunas etiquetas no dicen lo que realmente hacen. |
| Móvil | 7/10 | Buen apilado, pero páginas largas y textos pequeños. |
| Confianza | 6/10 | Los números son correctos, pero no siempre se dice el período o el significado. |

**Nota global para un usuario novato: 6.2/10.** Para un gerente con experiencia
en reportes: 8.5/10.

## Lo que sí funciona y no hay que tocar

- Una **acción principal** por pantalla: atender vencidas, preparar la semana,
  atender clientes en riesgo.
- Colores con intención: rojo para crítico, verde para avance.
- Listas compactas, sin tablas horizontales.
- El Centro de acción responde “qué hacer hoy” antes que “cómo va el negocio”.
- Cumpleaños tiene un flujo claro: campaña → avance → lista.
- Clientes prioriza el riesgo y da llamada directa.
- Prioridades separa vencidas, pendientes y resueltas.

---

## Hallazgo transversal nº 1: el vocabulario

### Inventario de términos que un novato no diría

| En la app | Lo que probablemente entiende el dueño | Mejor etiqueta |
|---|---|---|
| Calidad positiva | “¿Calidad de qué? ¿de la comida?” | **Clientes satisfechos** |
| IC95 83–95% | “Un código” | **Margen de error** (tooltip aparte) |
| Sin calificar | “No sé qué es” | **Sin respuesta de calidad** o **Pendiente de calificar** |
| Cola de trabajo | “¿Una fila?” | **Pendientes de hoy** |
| Vencidas | “Vencido, ¿quién?” | **Atrasadas** |
| Pendientes | “¿No son lo mismo que vencidas?” | **Para hoy / sin vencer** |
| En seguimiento | “¿Siguiendo a quién?” | **En proceso** |
| Atendidas | “¿Atendidas por quién?” | **Resueltas** |
| En riesgo | “¿Riesgo de qué?” | **Clientes a recuperar** |
| Fiel / Recurrente / Nuevo | “¿Fiel a qué?” | Mantener, pero explicar en una línea |
| Base 13 | “¿Base de qué?” | **Total del mes** |
| Aceptaron | “¿Aceptaron qué?” | **Aceptaron la promoción** |
| Redimieron | “¿Redimieron?” | **Usaron su promoción** |
| Campaña | “¿Publicidad?” | **Cumpleaños del mes** |
| Próxima acción | “¿Qué acción?” | **Próximo paso** |
| PIN de administrador | “¿Cuál PIN?” | **Clave de administrador** |

### Cómo corregirlo

1. Reemplazar etiquetas visibles por lenguaje cotidiano.
2. Mantener el término técnico en un tooltip o ayuda “¿Qué significa?”.
3. Añadir un **glosario de 6 palabras** accesible con un icono “?”.
4. No mostrar “IC95” en la tarjeta principal: mostrar
   “91% de clientes satisfechos” y, debajo, “margen estimado 83–95% (muestra
   pequeña)”. El detalle técnico puede ir en un “Ver cómo se calcula”.

---

## Hallazgo transversal nº 2: no hay un primer paso

El onboarding existe, pero está **al final del Centro de acción**. Un usuario
nuevo no baja hasta ahí: se queda en la cabecera y los filtros.

### Cómo corregirlo

- En el primer ingreso, mostrar **3 tarjetas grandes**:
  1. “Revisa lo atrasado”.
  2. “Felicita a los cumpleaños de hoy”.
  3. “Registra la llamada”.
- Un botón “Entendido” y otro “Ver guía”.
- En cada pestaña, una línea de ayuda contextual:
  - Cumpleaños: “Elige un cliente y pulsa WhatsApp o Llamar”.
  - Clientes: “Pulsa una fila para registrar la llamada”.
  - Prioridades: “Pulsa Pendiente para avanzar el estado”.
- Un icono **?** fijo con glosario y preguntas frecuentes.

---

## Hallazgo transversal nº 3: la navegación

El menú de escritorio sigue teniendo **13 destinos**, agrupados en Operación,
Análisis y Configuración. Para un dueño que solo quiere llamar a clientes,
“Historial de metas”, “Responsables” y “Administración” compiten visualmente.

En móvil, la barra inferior dice **“Cumples”**, abreviatura que no es obvia.

### Cómo corregirlo

- Móvil: “Cumpleaños” completo, o “Cumples” solo si entra sin apretar.
- Escritorio: **colapsar Configuración** en un desplegable.
- Ocultar por rol las secciones que no usa la cajera.
- Renombrar “Centro de acción” como **“Hoy”** (más humano).
- Añadir una migaja simple: “Hoy / Cumpleaños”.

---

## Centro de acción

### Lo bueno

- La primera frase dice qué pasa y la CTA dice qué hacer.
- El plan de hoy tiene cuatro tareas concretas.
- La agenda y los clientes a llamar están a la vista.

### Lo que confunde

| Problema | Por qué | Cómo |
|---|---|---|
| “91% calidad positiva · IC95 83–95%” | Dos conceptos técnicos juntos | “91% de clientes satisfechos” + “margen 83–95%” en ayuda |
| “112 encuestas” sin período | No se sabe si es del mes o histórico | “112 encuestas · desde septiembre” |
| “Pulso del negocio” | Metáfora | “Resumen del negocio” |
| “Sentimiento de calidad” | No es sentimiento, es calidad | “Clientes satisfechos” |
| “Sin calificar” | No se entiende la consecuencia | “6 encuestas sin respuesta de calidad” |
| “Ver análisis completo” | ¿Qué hay ahí? | “Ver más detalles” |

---

## Cumpleaños

### Lo bueno

- “13 clientes sin contactar” es claro.
- La CTA cambia si hay cumpleaños hoy o no.
- WhatsApp y Llamar están siempre visibles.
- El calendario es opcional.

### Lo que confunde

| Problema | Por qué | Cómo |
|---|---|---|
| “Campaña” | Suena a marketing | **Cumpleaños del mes** |
| “Base 13” | No se entiende | **Total del mes** |
| “Aceptaron” / “Redimieron” | No se sabe qué aceptaron | **Aceptaron promo** / **Usaron promo** |
| “Preparar la semana” | ¿Qué voy a preparar? | **Ver los 5 de esta semana** |
| “Pendiente” en el selector | ¿Pendiente de qué? | **Sin contactar** |
| “Próxima acción” | Vago | **Próximo paso** |
| “Editar mensajes de WhatsApp” | Puede dar miedo | **Mensajes para cumpleaños** |
| “0 hoy · 5 esta semana” | No explica que hoy no toca | “Hoy no hay cumpleaños; el próximo es el 8” |

---

## Clientes

### Lo bueno

- “A quién llamar” está arriba y es directo.
- Los segmentos tienen conteo.
- La ficha se abre con un clic.
- La búsqueda filtra la cartera.

### Lo que confunde

| Problema | Por qué | Cómo |
|---|---|---|
| “Cartera de clientes” | Lenguaje bancario | **Clientes** |
| “Fiel / Recurrente / Nuevo” | No son obvios | Explicar en una línea visible, no solo en párrafo |
| “En riesgo” | No se sabe el criterio | “En riesgo = calidad Mala o Regular” |
| “Llamar” abre un formulario | No llama, registra | **Registrar llamada**; si hay teléfono, ofrecer `tel:` |
| “Última calidad” | ¿De qué? | **Última opinión** |
| “Sin llamadas” | ¿Nunca se llamó? | “Aún no hay llamadas registradas” |
| “0 fieles” | Parece un error | “Aún no hay clientes con 3+ encuestas” |
| Filas con muchos metadatos | Cuesta leer | Dos líneas: nombre/segmento; teléfono/última llamada |

---

## Prioridades

### Lo bueno

- “Atender 9 vencidas” es la acción más clara de toda la app.
- Las tabs separan estados.
- La edición está oculta hasta que se necesita.
- El PIN ahora es un modal, no un prompt nativo.

### Lo que confunde

| Problema | Por qué | Cómo |
|---|---|---|
| Vencidas vs Pendientes | Parecen lo mismo | **Atrasadas** vs **Sin vencer** |
| “En seguimiento” | Jerga | **En proceso** |
| “Atendidas” | ¿Atendidas por quién? | **Resueltas** |
| Fila vencida con botón “Pendiente” | Contradicción | Mostrar **Atrasada** y el botón **Resolver** |
| “PIN de administrador” sin ayuda | No sabe cuál es | “Es la clave de 4 dígitos del administrador. Si no la tienes, pídesela a…” |
| PIN en cada cambio | Frustrante para cajera | Permitir que la cajera marque seguimiento sin PIN; el admin valida cierres |
| “Regla de prioridad” oculta en móvil | El usuario que más la necesita no la ve | Mostrar un enlace “¿Cómo priorizar?” |
| “Calidad Mala” | Juicio | **Cliente molesto** o **Mala experiencia** |
| “Cola de trabajo” | Jerga | **Pendientes de hoy** |

---

## Detalles de forma que afectan la lectura

- **Etiquetas de 8–9 px** en tipos, estados y badges. Para un adulto mayor o
  poca vista, son demasiado pequeñas. Subir mínimo a **11 px**.
- **Botones de 29–34 px** en acciones de fila. El mínimo táctil recomendado es
  44 px.
- Hay **muchos badges por fila**: tipo, urgencia, estado, próxima acción.
  Reducir a dos: urgencia + estado.
- El rojo se usa para acción primaria y alerta; es correcto, pero si todo es
  rojo deja de destacar.
- Los emojis son amables, pero no reemplazan una etiqueta clara.

---

## Prioridad de correcciones

### P0 — Claridad inmediata (1–2 días)

1. Glosario contextual + icono “?”.
2. Renombrar términos principales (tabla de arriba).
3. Añadir período a los números (“desde septiembre” / “últimos 30 días”).
4. “Llamar” → **Registrar llamada** cuando abre formulario.
5. Cambiar “Vencidas/Pendientes” a **Atrasadas/Sin vencer**.
6. Mostrar ayuda del PIN y explicar quién lo administra.
7. Onboarding al inicio, no al final.

### P1 — Aprendizaje y consistencia (3–5 días)

1. Barra inferior “Cumpleaños” completa.
2. Colapsar Configuración en escritorio.
3. Reducir badges por fila.
4. Subir tipografía mínima a 11 px y acciones a 40–44 px.
5. Mensajes de cero datos explicativos (“Aún no hay…”).
6. Tooltip “¿Cómo se calcula?” para calidad e IC.

### P2 — Confianza y autonomía (1–2 semanas)

1. Tour de 3 pasos por rol.
2. Ayuda contextual en cada pestaña.
3. Página “Mi negocio en simple” con 3 indicadores explicados.
4. Reporte imprimible en lenguaje llano.
5. Validación con 5 usuarios reales (cajera, dueño, mesero).

---

## Cómo validar la mejora

- Prueba de 5 segundos: “¿Qué harías primero aquí?”.
- Prueba de tarea: “Felicita a un cumpleaños” sin ayuda.
- Prueba de tarea: “Marca una prioridad como resuelta”.
- Medir clics hasta la acción y errores.
- Preguntar: “¿Qué palabra no entendiste?”.
- SUS (System Usability Scale) antes/después; objetivo > 80.

## Evidencia

- [Centro de acción](screenshots/ux/overview-redesign-clean.png)
- [Cumpleaños](screenshots/ux/birthday-redesign.png)
- [Clientes](screenshots/ux/clients-redesign.png)
- [Prioridades](screenshots/ux/priorities-redesign.png)
- [PIN de prioridades](screenshots/ux/priorities-redesign-pin.png)

## Recomendación

No rediseñar de nuevo. **Traducir y guiar**: mismas pantallas, menos jerga, un
glosario, períodos visibles y un primer paso claro. Eso es lo que separa “bonito”
de “yo puedo usarlo solo”.

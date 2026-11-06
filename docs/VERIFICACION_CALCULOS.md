# Verificación de cálculos de la app — Restaurante Coronel

> Fecha: 2026-11-06 · Fuente: `Encuestas_Limpias` (112 filas válidas) · App: producción
> (`https://coronel-dashboard.onrender.com`, commit `9398a45`).
> Método: recálculo independiente en Python + navegación real de la app con un
> usuario temporal (eliminado al terminar). No se modificaron datos de negocio.

## 1. Resultado general

**La app calcula correctamente después de corregir 7 defectos.** Todos los
indicadores auditados coinciden con el cálculo independiente:

| Indicador | Cálculo independiente | App | Estado |
|---|---|---|---|
| Encuestas | 112 | 112 | ✅ |
| Clientes únicos (teléfono/nombre) | 109 | 109 | ✅ |
| Calidad respondida (Bueno+Regular+Malo) | 106 | 106 | ✅ |
| Calidad positiva | 96/106 = **90,57 %** | **91 %** (96 de 106) | ✅ (redondeo) |
| Comentarios con texto | 85 | 85 | ✅ |
| Comentarios repetidos (grupos) | 5 | 5 | ✅ |
| Pedidos/sugerencias detectadas | 21 | 21 | ✅ |
| Frases repetidas (2+ apariciones) | 5 | 5 | ✅ |
| Casos “Revisar” (Regular + Malo) | 10 | 10 | ✅ |
| Cumpleaños en noviembre 2026 | 13 | 13 | ✅ |
| Cumpleaños esta semana (lun–dom) | 5 | 5 | ✅ |
| Cumpleaños hoy | 0 | 0 | ✅ |
| Próximos 7 días | 3 | 3 | ✅ |
| Encuestas de salón | 87 | 87 | ✅ |
| Delivery / web | 25 | 25 | ✅ |
| Meseros con respuestas | 3 | 3 | ✅ |
| Shirley | 35/37 = 94,6 % → 95 % | 95 % | ✅ |
| Betty | 17/19 = 89,5 % → 89 % | 89 % | ✅ |
| Sr. Carlos | 24/25 = 96,0 % | 96 % | ✅ |
| Último comentario | 15/10/2026 | 15-oct | ✅ |
| Embudo cumpleaños (Día/Semana/Mes/Seguimiento) | 3 + 0 + 6 + 4 = 13 | 3 + 0 + 6 + 4 | ✅ |

## 2. Defectos encontrados y corregidos

1. **Denominador de calidad inflado con “Sin calificar”.**
   Se calculaba `Bueno / todos los que tienen texto en calidad`, incluyendo
   `Sin calificar`; daba **86 %** (96/112) en vez de **90,6 %** (96/106).
   Corregido con `hasScoredQuality()` en inicio, equipo, comparación mensual,
   comparación por período y scorecard de productos.

2. **Cumpleaños con año de 2 dígitos mal interpretados.**
   `08/11/83` se leía como agosto (parser nativo) o se descartaba; noviembre
   mostraba 11 en vez de 13 y la semana 4 en vez de 5. Corregido en
   `parseBirthdayDate` (app) y `parseBirthday` (shared) para aceptar
   `dd/mm`, `dd/mm/yy` y `dd/mm/yyyy`.

3. **Se descartaban 2 encuestas por comentario ilegible.**
   La app pasaba de 112 a 110. Una encuesta con comentario OCR ilegible sigue
   siendo válida para calidad/volumen; ahora se conserva la encuesta y se deja
   el comentario vacío (`Comentario Válido = 0`).

4. **“Sin calificar” se convertía en vacío.**
   Ahora es un valor explícito y aparece en el filtro de calidad; se excluye del
   denominador de positividad, pero se cuenta en volumen.

5. **“REVISAR” en Voz del cliente solo contaba comentarios.**
   Mostraba 5 en vez de 10 (Regular + Malo). Ahora usa todos los registros
   filtrados, no solo los que tienen comentario.

6. **“PEDIDOS” quedaba truncado a 10.**
   El total real es 21; el listado se limita a 10 para la vista, pero el
   indicador muestra el total.

7. **“FRASES DETECTADAS” mostraba 0 con umbral 4+.**
   Con 85 comentarios, el umbral dejaba la métrica vacía. Ahora usa 2+
   apariciones y muestra 5 frases.

## 3. Definiciones usadas (importante para leer los números)

- **Calidad positiva** = `Bueno / (Bueno + Regular + Malo)`. `Sin calificar` se
  excluye del denominador (es dato faltante, no una opinión negativa).
- **Comentarios** = encuestas con texto no vacío; los comentarios “Error de
  lectura” se excluyen del texto, pero la encuesta se conserva.
- **Pedidos/sugerencias** = comentarios que contienen palabras de petición o
  mejora (21). Es una heurística de lenguaje; requiere revisión manual.
- **Cumpleaños** = se usa **día/mes**; el año solo para edad. Los años
  2026/futuros quedan en `Revisar` y no entran en métricas de edad.
- **“Esta semana”** = semana calendario lunes–domingo (5). El filtro/etapa
  **“Semana”** del embudo significa **4–7 días** (0), por eso no coinciden; no
  es un error, pero conviene renombrar la etapa para evitar confusión.
- **“ALERTAS 5”** es el top-5 de prioridades (ranking), no un conteo de
  encuestas.

## 4. Advertencias estadísticas (tamaño de muestra)

- La calidad global tiene **n = 106** respuestas calificadas; el 91 % tiene un
  margen aproximado de ±5 puntos porcentuales (95 %).
- Por mesero los tamaños son pequeños (19–37 respuestas). Intervalos de Wilson
  al 95 %:
  - Shirley: 35/37 = 94,6 % · IC [82 %, 99 %]
  - Betty: 17/19 = 89,5 % · IC [69 %, 97 %]
  - Sr. Carlos: 24/25 = 96,0 % · IC [80 %, 99 %]
- Por eso **no conviene rankear meseros solo por porcentaje** con estos
  volúmenes: las diferencias no son estadísticamente concluyentes. Recomendación:
  mostrar intervalos o usar un ranking con suavizado (bayesiano) y exigir un
  mínimo de respuestas.
- 6 encuestas (5,4 %) están `Sin calificar`: mejorar la captura de calidad
  reduciría el sesgo de no respuesta.

## 5. Recomendaciones siguientes

1. **Renombrar etapas del embudo** a “0–3 días”, “4–7 días”, “>7 días” y
   “Pasadas” para que no se confundan con “Esta semana”.
2. **Mostrar n y margen de error** en los porcentajes por mesero; no rankear con
   n < 20.
3. **Validar manualmente los 21 pedidos/sugerencias** y convertir las etiquetas
   en un catálogo (Tiempo, Papas, Sabor, Variedad, Promos, Ambiente).
4. **Separar comentario inválido de encuesta inválida** (ya implementado) y
   mantener `Comentario Válido` en la hoja.
5. Medir **tasa de respuesta de calidad** (106/112 = 94,6 %) como indicador de
   calidad del dato, no solo del servicio.

## 6. Reproducibilidad

- Recálculo independiente: `python scripts/analyze_data.py` (perfil) y consultas
  directas a la hoja por gviz.
- Verificación de UI: navegación con Playwright y usuario temporal; se leyeron
  los `stat-card`, `score-row` y métricas de cumpleaños.
- El usuario temporal se eliminó y no quedaron registros de prueba.

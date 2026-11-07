# P0 — Cierre del ciclo de llamadas

## Estado

**P0 de código cerrado.** Queda una decisión de datos: las filas de prueba que
viven en el Google Sheet no se eliminan automáticamente desde la app.

## Lo que se implementó

### 1. La llamada cierra la prioridad
- Si el cliente está **por recuperar** y la llamada no es “No contestó” ni
  “Número inválido”, el registro marca la prioridad `risk-{cliente}` como
  **resuelta**.
- El formulario avisa antes de guardar:
  “Al guardar, la prioridad de este cliente se marcará como resuelta”.
- Se invalidan llamadas, prioridades y campañas de cumpleaños.

### 2. Cumpleaños actualizado al llamar
- `calls.create` ahora sincroniza el estado de la campaña de cumpleaños con el
  resultado de la llamada:
  - No contestó → `noanswer` y reintento.
  - Promoción aceptada/redimida → `accepted`/`redeemed`.
  - Contactado → `contacted`.
- Verificado: una llamada con “Promoción aceptada” y promoción redimida dejó la
  campaña en `redeemed`.

### 3. PIN con modal en Llamadas
- Editar y eliminar un registro ya no usa `window.prompt`.
- Modal con:
  - qué se va a editar/eliminar,
  - clave de 4 dígitos,
  - error inline,
  - cancelar / confirmar.
- Foco en el campo y cierre con `Esc`.

### 4. Llamadas atrasadas en Inicio
- Si existe una llamada con `nextCallDate` anterior a hoy, aparece en el
  **Plan de hoy** como “Llamadas atrasadas”.
- Lleva a la agenda de Llamadas.

### 5. Registro rápido
- Botón global **Registrar llamada**.
- Selector de cliente con los “por recuperar” primero.
- Agenda de próximas llamadas en Llamadas.
- Teléfono clicable en el formulario.
- Confirmación al guardar.

## Verificación realizada

| Prueba | Resultado |
|---|---|
| Llamada con `resolvePriorityKey` | Prioridad `done` ✅ |
| Llamada de cumpleaños | Campaña `redeemed` ✅ |
| Formulario muestra aviso de prioridad | ✅ |
| PIN modal al editar llamada | ✅ |
| Llamada atrasada visible en Inicio | ✅ |
| Datos temporales de validación | Eliminados ✅ |

## Limpieza de datos de prueba

- Cuentas temporales: eliminadas.
- Llamadas de validación: eliminadas.
- Campañas y prioridades de validación: eliminadas.
- **Registros “Prueba”, “Cliente 01”, etc. del Google Sheet:** no se eliminan
  desde la app. Requieren revisión y borrado en la hoja o una regla explícita
  del negocio. No conviene ocultarlos automáticamente porque podrían ser
  clientes reales.

## Cómo usar el flujo

1. Pulsar **Registrar llamada**.
2. Buscar al cliente.
3. Llamar desde el teléfono o usar el enlace.
4. Registrar resultado.
5. Si el cliente estaba por recuperar, la prioridad se cierra.
6. Si se programó próxima llamada, aparecerá en Llamadas y Prioridades.

## Siguiente

P1: rehacer el reporte para que explique **qué funciona, qué mejorar y qué
probar**, no solo mostrar métricas.

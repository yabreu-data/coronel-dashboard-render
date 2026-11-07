# Prioridades — cola de trabajo

## Objetivo

Convertir Prioridades en una **cola operativa** que responda:

1. ¿Qué está vencido?
2. ¿Qué sigue después?
3. ¿Quién es responsable y hasta cuándo?

## Problemas del diseño anterior

- Seis tarjetas de KPI repetían los filtros de tipo y estado.
- El hero y la nota explicativa ocupaban media pantalla antes de la cola.
- La edición de responsable/fecha y el historial estaban siempre abiertos: cada
  fila era enorme.
- El cambio de estado usaba `window.prompt` para pedir el PIN.
- Solo se veían 5 filas por página.
- Los seguimientos programados no entraban en la cola por un retorno
  anticipado en el cálculo.

## Nueva arquitectura

### 1. Cabecera de prioridades
- Cuántas vencidas y cuántos seguimientos activos.
- CTA primaria **Atender vencidas**.
- Cuatro señales: vencidas, pendientes, en seguimiento y atendidas.

### 2. Regla de prioridad
Un panel explica el orden:
1. Calidad Mala.
2. Cumpleaños próximos.
3. Seguimientos programados.
4. Calidad Regular.

### 3. Tabs de estado
`Vencidas · Pendientes · En seguimiento · Atendidas · Todas`

### 4. Cola de trabajo
- Filtros por tipo: Todos, Calidad, Mala, Cumpleaños, Seguimiento.
- Búsqueda por cliente, responsable o detalle.
- Filas compactas con:
  - número,
  - icono,
  - etiqueta y cliente,
  - detalle,
  - fecha límite y responsable,
  - estado,
  - editar,
  - abrir ficha.
- Edición de responsable/fecha e historial bajo demanda.
- 8 prioridades por página.

### 5. PIN accesible
El cambio de estado o de responsable abre un **modal de confirmación**:
- PIN,
- resumen del cambio,
- error inline,
- confirmar/cancelar.

Se eliminó el `window.prompt` nativo.

## Decisiones de UX/gestión

- **La cola manda:** los KPIs ya no ocupan seis tarjetas.
- **Vencidas primero:** el CTA y la tab principal apuntan a lo atrasado.
- **Edición progresiva:** la fila se lee rápido; los controles aparecen al editar.
- **Estado explícito:** la píldora muestra Pendiente, En seguimiento o Atendida.
- **PIN con contexto:** el usuario sabe qué cambio está confirmando.
- **Móvil:** tabs en varias filas, regla oculta, acciones debajo de la fila.
- **Seguimientos incluidos:** se corrigió el cálculo para que las llamadas
  programadas formen parte de la cola.

## Métricas para medir la operación

- Prioridades vencidas por día.
- Tiempo medio de resolución.
- Prioridades atendidas por responsable.
- Reaperturas.
- Seguimientos programados vs. realizados.

## Capturas

- [Escritorio](screenshots/ux/priorities-redesign.png)
- [Edición](screenshots/ux/priorities-redesign-edit.png)
- [Móvil](screenshots/ux/priorities-redesign-mobile.png)

## Próximos pasos

- Reasignación masiva.
- Vistas guardadas por responsable.
- Recordatorios automáticos de vencimiento.
- Exportación de la cola.

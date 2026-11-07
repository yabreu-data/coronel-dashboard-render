# Flujos de trabajo — llamadas y seguimiento

## Objetivo

Reducir los pasos entre **detectar una urgencia** y **dejar registro del contacto**,
sin obligar al usuario a navegar entre cinco pantallas.

## Flujo anterior

```
Centro de acción → abrir Clientes → buscar cliente → abrir modal → guardar
```

O peor:

```
Cumpleaños → abrir tarjeta → llamar → volver → cambiar estado a mano
```

Problemas:

- El botón de llamada no estaba disponible desde todas las páginas.
- Llamadas vacío solo mostraba un historial.
- No era evidente que una próxima llamada crea un pendiente.
- El formulario pedía muchos datos sin contexto de teléfono.

## Flujo nuevo

### 1. Acción global: Registrar llamada
Visible en la barra superior de cualquier página.

```
[Registrar llamada] → buscar por nombre o teléfono → elegir cliente
→ formulario → guardar
```

- Buscador con los clientes **por recuperar** primero.
- Teléfono clicable (`tel:`) en el formulario.
- Foco atrapado y `Esc`.
- Confirmación al guardar.

### 2. Bandeja de llamadas
La pestaña Llamadas ahora tiene:

- **Próximas llamadas**: agenda derivada de `nextCallDate`.
- Llamadas atrasadas resaltadas.
- Botón **Registrar** en cada fila, con el nombre precargado en el buscador.
- CTA directo cuando no hay registros.

### 3. Cierre del ciclo
Si al guardar una llamada se define **fecha de próxima llamada**, el sistema:

1. guarda el registro;
2. actualiza la agenda de Llamadas;
3. alimenta la cola de Prioridades como seguimiento.

### 4. Datos mínimos
El formulario mantiene:
- fecha y hora,
- resultado,
- promoción,
- próxima llamada,
- encargado,
- notas.

La novedad es el contexto: teléfono visible, cliente preseleccionado y retorno
inmediato a la pantalla donde estaba trabajando.

## Métricas para medir

- Tiempo desde “detectar cliente” hasta “llamada guardada”.
- Número de llamadas registradas por día.
- Porcentaje de llamadas con próxima acción definida.
- Seguimientos vencidos.
- Uso del botón global vs. navegación manual.

## Capturas

- [Selector de cliente](screenshots/ux/flow-quick-call.png)
- [Formulario de llamada](screenshots/ux/flow-call-form.png)
- [Bandeja de llamadas](screenshots/ux/flow-calls-inbox.png)
- [Móvil](screenshots/ux/flow-mobile.png)

## Próximos pasos

1. Al guardar una llamada, ofrecer “Marcar la prioridad como resuelta”.
2. Sincronizar automáticamente el estado del cumpleaños cuando la llamada sea
   de esa campaña.
3. Recordatorio de llamadas atrasadas en Centro de acción.
4. Acción masiva para copiar mensajes del día.
5. Asignación de seguimientos por encargado.

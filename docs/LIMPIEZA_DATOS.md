# Limpieza del registro de prueba

## Decisión aplicada

- **Eliminado del sistema:** `ENC-000116` · “Prueba”.
- **Conservado:** `ENC-000051` · “Cliente 01”, por indicación del negocio.
- **No se tocaron** clientes, llamadas ni campañas reales.

## Cómo quedó implementado

El servidor mantiene una lista explícita de IDs de prueba:

```ts
const IGNORED_SURVEY_IDS = new Set(["ENC-000116"]);
```

Al construir la lista de encuestas, ese registro se descarta antes de entrar a:

- Centro de acción,
- Clientes,
- Cumpleaños,
- Voz del cliente,
- Equipo,
- métricas y exportaciones.

Verificación: la app pasó de **112 a 111 registros** y ya no aparece
“Prueba”. “Cliente 01” sigue visible.

## Importante sobre el Google Sheet

La fila original **sigue existiendo en la hoja**. La app no tiene permiso de
escritura sobre Google Sheets, solo de lectura. Por eso se excluye en la capa de
datos.

Para borrarla definitivamente:

1. Abrir el Google Sheet.
2. Buscar `ENC-000116` en la hoja **Encuestas** (fuente), no solo en
   `Encuestas_Limpias` (que se regenera).
3. Eliminar esa fila.
4. Ejecutar **Coronel → Actualizar Encuestas_Limpias** o esperar el trigger.
5. Confirmar que la app sigue mostrando 111 registros.

Si prefieres no borrar la fila, otra opción es marcarla en `Estado Registro`
como “advertencia”; la capa limpia la excluye automáticamente.

## Por qué no se borró automáticamente

- La app es de solo lectura sobre el Sheet.
- Borrar una fila del `Encuestas_Limpias` generado no sirve: se reconstruye.
- Sin confirmación explícita, borrar por nombre podría eliminar un cliente real
  llamado “Prueba”.

## Siguiente limpieza recomendada

- Revisar “Cliente 01”: se conserva.
- Revisar encuestas con comentario vacío.
- Revisar clientes sin teléfono.

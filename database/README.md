# Respaldos y datos

Este directorio contiene los artefactos de migración. **Los archivos de datos no se versionan** porque incluyen información de clientes (nombres, teléfonos, correos, IPs de sesión y auditoría).

| Archivo | ¿Versionado? | Descripción |
|---|---|---|
| `coronel-database.sql` | No | Respaldo lógico original exportado de MySQL/TiDB. |
| `coronel-data.json` | No | Salida de `scripts/convert-mysql-dump.mjs`, insumo de `scripts/import-supabase.mjs`. |

Para reproducir la migración, coloca el respaldo original en este directorio y ejecuta:

```bash
node scripts/convert-mysql-dump.mjs database/coronel-database.sql database/coronel-data.json
pnpm db:import -- --truncate
```

Si el repositorio se clona sin estos archivos, la aplicación funciona igual: la base ya está cargada en Supabase.

# Migración de MySQL/TiDB a Supabase (PostgreSQL)

El respaldo `database/coronel-database.sql` proviene de MySQL/TiDB. La aplicación ahora corre sobre PostgreSQL (Supabase). Esta guía documenta la conversión y la importación.

## 1. Conversión del respaldo

`scripts/convert-mysql-dump.mjs` lee el volcado MySQL y genera un JSON intermedio con el orden de columnas del `CREATE TABLE` de origen:

```bash
node scripts/convert-mysql-dump.mjs database/coronel-database.sql database/coronel-data.json
```

- Ignora `__drizzle_migrations` (el control de migraciones ahora es de Drizzle sobre PostgreSQL).
- Convierte `NULL` a `null`, números a `number`, timestamps a string `YYYY-MM-DD HH:MM:SS`.
- Incluye un reparador de mojibake (UTF-8 leído como cp1252) que solo actúa si la decodificación inversa es UTF-8 válida.
- Reporta tablas sin `INSERT` y filas con columnas inconsistentes.

## 2. Importación a PostgreSQL

`scripts/import-supabase.mjs` inserta los datos con consultas parametrizadas dentro de una transacción:

```bash
# requiere DATABASE_URL en .env y el esquema ya aplicado (pnpm db:push)
pnpm db:import                     # inserta
pnpm db:import -- --truncate       # vacía las tablas antes de insertar
```

Tareas que realiza:

1. Inserta en orden estable (`users` → `session_history` → `call_logs` → …).
2. Sincroniza las secuencias `serial` con `setval(...)` para evitar colisiones de `id`.
3. Vincula el usuario administrador: reemplaza su `openId` de Manus por el UUID de Supabase Auth (`SUPABASE_ADMIN_USER_ID`) y le asigna `role = 'admin'`.

## 3. Resultados de la migración ejecutada

| Tabla | Filas |
|---|---:|
| `admin_audit_log` | 3 |
| `birthday_campaigns` | 1 |
| `call_logs` | 0 |
| `priority_history` | 0 |
| `priority_items` | 2 |
| `promotions` | 8 |
| `responsible_users` | 2 |
| `session_history` | 42 |
| `team_target_history` | 3 |
| `team_targets` | 1 |
| `users` | 2 |
| **Total** | **64** |

## 4. Diferencias respecto al esquema MySQL

| MySQL | PostgreSQL |
|---|---|
| `int AUTO_INCREMENT` | `serial` |
| `enum('a','b')` | `text` (unión de valores validada por Zod y por la capa tRPC) |
| `timestamp ... ON UPDATE CURRENT_TIMESTAMP` | `timestamp DEFAULT now()` + `$onUpdate(() => new Date())` en Drizzle |
| `ON DUPLICATE KEY UPDATE` | `ON CONFLICT (columna) DO UPDATE` |
| `__drizzle_migrations` (tabla manual) | esquema `drizzle` gestionado por `drizzle-kit` |

## 5. Restaurar solo el esquema (sin datos)

```bash
pnpm install
pnpm db:push     # drizzle-kit generate + migrate
```

## 6. Verificación

```bash
node scripts/db-inspect.mjs                # tablas y migraciones aplicadas
node scripts/smoke-test.mjs <url>          # prueba end-to-end
```

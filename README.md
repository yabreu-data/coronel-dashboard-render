# Coronel · Dashboard de Satisfacción

Dashboard analítico de satisfacción del cliente para **Restaurante Coronel**. Consolida encuestas de Google Sheets, permite gestionar llamadas de recuperación, campañas de cumpleaños, metas del equipo, prioridades y auditoría administrativa.

Migrado desde el stack original de Manus (MySQL/TiDB + OAuth de Manus) a:

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 + tRPC 11 |
| Backend | Node.js 22 + Express 4 + tRPC 11 (bundle ESM con esbuild) |
| Base de datos | PostgreSQL (Supabase) + Drizzle ORM |
| Autenticación | Supabase Auth (email + contraseña, JWT Bearer) |
| Datos de encuestas | Google Sheets (CSV público vía `gviz`) |
| Hosting | Render (Web Service · Node) |

## Estructura

```
client/            SPA de React (páginas, componentes, estilos)
  public/manus-storage/logo1_5c69b281.png   logo servido localmente
server/            API Express + tRPC
  _core/           arranque, contexto, auth Supabase, trpc, static
  db.ts            consultas Drizzle (PostgreSQL)
  routers.ts       contrato tRPC + integración Google Sheets
drizzle/           esquema PostgreSQL y migraciones SQL
database/          respaldo MySQL original + datos convertidos a JSON
scripts/           conversión, importación y pruebas de humo
docs/              guías de despliegue y migración
render.yaml        blueprint de Render
```

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Connection string de Supabase (usar **Session pooler**, puerto 5432) |
| `SUPABASE_URL` | `https://<proyecto>.supabase.co` |
| `SUPABASE_ANON_KEY` | Clave pública (validación de tokens en el servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo scripts administrativos (no se usa en el runtime web) |
| `SUPABASE_ADMIN_USER_ID` | UUID del usuario de Supabase Auth con rol administrador |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Inyectadas en el bundle del cliente |
| `GOOGLE_SHEET_ID` | ID del Google Sheet de encuestas |
| `GOOGLE_SHEET_TAB` | Pestaña productiva (por defecto `Encuestas_Limpias`). Si no existe o no tiene encabezados de encuestas, el backend usa automáticamente la pestaña `Encuestas`. |
| `JWT_SECRET` | Reservado para sesiones firmadas propias |
| `ADMIN_PIN` | PIN para acciones administrativas sensibles (por defecto `5956`) |
| `PORT` / `NODE_ENV` | Puerto y entorno (Render los define) |

## Desarrollo local

```bash
pnpm install
cp .env.example .env      # completa credenciales
pnpm db:push              # genera y aplica migraciones en Supabase
pnpm db:import            # (opcional) carga el respaldo convertido
pnpm dev                  # http://localhost:3000
```

## Scripts

| Script | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo con Vite middleware |
| `pnpm build` | Compila la SPA (`dist/public`) y el servidor (`dist/index.js`) |
| `pnpm start` | Servidor de producción (`node dist/index.js`) |
| `pnpm check` | Verificación de tipos (TypeScript) |
| `pnpm test` | Pruebas unitarias (Vitest) |
| `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` | Migraciones Drizzle |
| `pnpm db:import` | Importa `database/coronel-data.json` a PostgreSQL |
| `pnpm keepalive:setup` / `keepalive:test` / `keepalive:remove` | Keep-alive de Render vía `pg_cron` + `pg_net` de Supabase |
| `node scripts/smoke-test.mjs <url>` | Prueba end-to-end contra un servidor desplegado |

## Autenticación

1. El navegador inicia sesión en Supabase Auth con la **anon key**.
2. Supabase devuelve un JWT que el cliente envía como `Authorization: Bearer`.
3. El servidor valida el token contra `/auth/v1/user` (caché de 60 s) y sincroniza el usuario en la tabla `users`, usando el UUID de Supabase como `openId`.
4. Si el UUID coincide con `SUPABASE_ADMIN_USER_ID`, el usuario recibe rol `admin` automáticamente; el resto de permisos se administran desde la pantalla de *Accesos*.

Los usuarios se crean desde **Supabase → Authentication → Users** (o con la Admin API). No hay registro público en la aplicación.

## Despliegue

Ver [`docs/DEPLOY_RENDER_SUPABASE.md`](docs/DEPLOY_RENDER_SUPABASE.md) y [`docs/MIGRACION_BASE_DATOS.md`](docs/MIGRACION_BASE_DATOS.md).

## Keep-alive (plan free de Render)

El servicio free de Render duerme tras 15 min de inactividad. Para evitarlo, Supabase ejecuta un job de `pg_cron` que cada 5 minutos hace `GET /healthz` con `pg_net` (sin depender de tu PC ni de cuentas externas):

```bash
pnpm keepalive:setup   # crea/actualiza el job (idempotente)
pnpm keepalive:test    # dispara un ping y muestra el HTTP status
pnpm keepalive:remove  # elimina el job
```

Detalle, verificación en SQL y alternativas en [`docs/KEEPALIVE_RENDER.md`](docs/KEEPALIVE_RENDER.md).

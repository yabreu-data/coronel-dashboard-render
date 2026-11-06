# Despliegue en Render + Supabase

Arquitectura: **Render Web Service (Node)** sirve la SPA compilada y la API tRPC; **Supabase** aporta PostgreSQL y Auth.

## 1. Base de datos (Supabase)

1. En **Supabase → Project Settings → Database → Connection string → Session pooler** copia la URL:
   `postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres`
   > Usa el *Session pooler* (puerto 5432) porque el runtime usa `pg` con pool persistente; el *Transaction pooler* (6543) no admite sentencias preparadas.

2. Aplica el esquema (desde `coronel-satisfaccion-dashboard/`):

   ```bash
   pnpm install
   pnpm db:push
   ```

3. (Opcional) Carga el respaldo convertido desde MySQL:

   ```bash
   node scripts/convert-mysql-dump.mjs database/coronel-database.sql database/coronel-data.json
   pnpm db:import -- --truncate
   ```

4. Verifica:

   ```bash
   node scripts/db-inspect.mjs
   ```

## 2. Autenticación (Supabase Auth)

1. **Authentication → Providers → Email**: habilitado (por defecto). Desactiva "Allow new users to sign up" si no quieres registros públicos.
2. Crea los usuarios en **Authentication → Users** (email + contraseña, con "Auto Confirm User").
3. Copia el **UUID** del usuario administrador y colócalo en `SUPABASE_ADMIN_USER_ID`. Ese usuario recibirá rol `admin` al iniciar sesión por primera vez.
4. En **Project Settings → API** copia `Project URL`, `anon public` y `service_role` (esta última solo para scripts).

## 3. Render

### Opción A · Blueprint (recomendada)

1. Sube el repositorio a GitHub.
2. En Render: **New → Blueprint**, selecciona el repositorio. Render lee `render.yaml`.
3. Completa las variables marcadas con `sync: false`:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Session pooler de Supabase |
   | `SUPABASE_URL` | `https://<proyecto>.supabase.co` |
   | `SUPABASE_ANON_KEY` | anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role |
   | `SUPABASE_ADMIN_USER_ID` | UUID del administrador |
   | `VITE_SUPABASE_URL` | igual que `SUPABASE_URL` |
   | `VITE_SUPABASE_ANON_KEY` | igual que `SUPABASE_ANON_KEY` |
   | `ADMIN_PIN` | PIN administrativo (por defecto `5956`) |

   `NODE_ENV`, `NODE_VERSION`, `GOOGLE_SHEET_ID` y `GOOGLE_SHEET_TAB` ya vienen definidos en el blueprint.

4. Render ejecuta:
   - **Build**: `pnpm install --prod=false --frozen-lockfile=false && pnpm build`
   - **Start**: `node dist/index.js`
   - **Health check**: `/healthz`

> `--prod=false` es necesario porque el build usa Vite/esbuild (devDependencies). El bundle de producción **no** carga Vite: solo se usa en modo desarrollo.

### Opción B · Web Service manual

- Runtime: **Node** · Plan: **Free** · Región: **Oregon** (misma región que Supabase `us-west-2`)
- Build Command: `pnpm install --prod=false --frozen-lockfile=false && pnpm build`
- Start Command: `node dist/index.js`
- Health Check Path: `/healthz`
- Variables: las mismas de la tabla anterior.

## 4. Verificación posterior

```bash
# Salud del servicio
curl https://<servicio>.onrender.com/healthz

# Prueba integral (Google Sheets, PostgreSQL, Supabase Auth, escritura protegida)
node scripts/smoke-test.mjs https://<servicio>.onrender.com
```

Resultado esperado: `14/14 OK`.

## 5. Notas operativas

- El plan Free de Render suspende la instancia por inactividad: la primera petición tras el reposo tarda unos segundos.
- Supabase exige TLS. El runtime usa `ssl: { rejectUnauthorized: false }`; `drizzle.config.ts` añade `sslmode=no-verify` porque `pg >= 8.20` interpreta `require` como verificación completa.
- Guarda `SUPABASE_SERVICE_ROLE_KEY` solo en Render/entorno local: no se inyecta en el bundle del cliente.
- Tras conectar Render puedes volver privado el repositorio instalando la GitHub App de Render.

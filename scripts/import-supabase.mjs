import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

/**
 * Carga el respaldo de datos convertido desde MySQL (database/coronel-data.json)
 * en la base PostgreSQL de Supabase.
 *
 * Uso:
 *   node scripts/import-supabase.mjs                 # inserta los datos
 *   node scripts/import-supabase.mjs --truncate      # vacía las tablas primero
 *
 * Requiere DATABASE_URL en el entorno (.env) y que el esquema ya exista
 * (`pnpm db:push`).
 */

const DATA_FILE = path.resolve(process.cwd(), "database/coronel-data.json");
const ADMIN_EMAIL = process.env.SUPABASE_ADMIN_EMAIL || "yenniferabreu1112@gmail.com";

// Orden de inserción (sin claves foráneas en el esquema, pero explícito y estable).
const TABLE_ORDER = [
  "users",
  "session_history",
  "call_logs",
  "birthday_campaigns",
  "priority_items",
  "priority_history",
  "promotions",
  "responsible_users",
  "team_target_history",
  "team_targets",
  "admin_audit_log",
];

const truncate = process.argv.includes("--truncate");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no está definido (.env)");
  process.exit(1);
}
if (!fs.existsSync(DATA_FILE)) {
  console.error(`No existe ${DATA_FILE}. Ejecuta primero: node scripts/convert-mysql-dump.mjs`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
const tables = payload.tables ?? {};

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function main() {
  await client.connect();
  console.log("Conectado a PostgreSQL. Iniciando importación…");

  await client.query("BEGIN");

  if (truncate) {
    const list = TABLE_ORDER.map(table => `public.${quoteIdent(table)}`).join(", ");
    await client.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    console.log("Tablas vaciadas (--truncate).");
  }

  const summary = [];
  for (const table of TABLE_ORDER) {
    const data = tables[table];
    if (!data) {
      console.warn(`- ${table}: no está en el respaldo, se omite`);
      continue;
    }
    const { columns, rows } = data;
    const columnSql = columns.map(quoteIdent).join(", ");
    let inserted = 0;

    for (const row of rows) {
      if (row.length !== columns.length) {
        throw new Error(`${table}: fila con ${row.length} valores y ${columns.length} columnas`);
      }
      const placeholders = row.map((_, index) => `$${index + 1}`).join(", ");
      await client.query(`INSERT INTO public.${quoteIdent(table)} (${columnSql}) VALUES (${placeholders})`, row);
      inserted += 1;
    }
    summary.push({ table, inserted });
    console.log(`- ${table}: ${inserted} filas`);
  }

  // Las secuencias deben continuar después del id máximo importado.
  const serialTables = [
    "users",
    "session_history",
    "call_logs",
    "birthday_campaigns",
    "priority_items",
    "priority_history",
    "promotions",
    "responsible_users",
    "team_target_history",
    "admin_audit_log",
  ];
  for (const table of serialTables) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('public.${quoteIdent(table)}', 'id'), COALESCE((SELECT MAX("id") FROM public.${quoteIdent(table)}), 1), true)`
    );
  }
  console.log(`- secuencias sincronizadas (${serialTables.length} tablas)`);

  // El usuario administrador ahora se identifica con su uuid de Supabase Auth.
  const adminUserId = (process.env.SUPABASE_ADMIN_USER_ID || "").trim();
  if (adminUserId) {
    await client.query(`DELETE FROM public."users" WHERE "openId" = $1 AND "email" IS DISTINCT FROM $2`, [adminUserId, ADMIN_EMAIL]);
    const updated = await client.query(
      `UPDATE public."users" SET "openId" = $1, "role" = 'admin', "active" = 1, "loginMethod" = 'supabase' WHERE "email" = $2`,
      [adminUserId, ADMIN_EMAIL]
    );
    if (updated.rowCount === 0) {
      await client.query(
        `INSERT INTO public."users" ("openId", "name", "email", "loginMethod", "role", "active")
         VALUES ($1, $2, $3, 'supabase', 'admin', 1)`,
        [adminUserId, ADMIN_EMAIL, ADMIN_EMAIL]
      );
      console.log(`- usuario admin creado con openId ${adminUserId}`);
    } else {
      console.log(`- usuario admin vinculado a Supabase Auth (${updated.rowCount} fila)`);
    }
  } else {
    console.warn("- SUPABASE_ADMIN_USER_ID vacío: no se vinculó el administrador");
  }

  await client.query("COMMIT");

  const totals = await client.query(`
    SELECT relname AS table, n_live_tup::int AS rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname
  `);
  console.log("\n== Filas por tabla (estimado) ==");
  for (const row of totals.rows) console.log(`${row.table}: ${row.rows}`);

  const admin = await client.query(`SELECT id, "openId", "email", "role", "active" FROM public."users" ORDER BY id`);
  console.log("\n== Usuarios ==");
  console.table(admin.rows);
}

main()
  .then(async () => {
    await client.end();
    console.log("\nImportación completada.");
  })
  .catch(async error => {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end().catch(() => undefined);
    console.error("\nImportación fallida:", error);
    process.exit(1);
  });

import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no está definido");

const client = new pg.Client({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
});

await client.connect();

const tables = await client.query(`
  select table_schema, table_name
  from information_schema.tables
  where table_schema not in ('pg_catalog', 'information_schema')
  order by table_schema, table_name
`);
console.log("== tablas ==");
for (const row of tables.rows) console.log(`${row.table_schema}.${row.table_name}`);

const migrations = await client.query(`
  select id, hash, created_at from drizzle.__drizzle_migrations order by id
`).catch(error => ({ rows: [], error }));
console.log("== drizzle.__drizzle_migrations ==");
if (migrations.error) console.log("(no existe)", migrations.error.message);
else for (const row of migrations.rows) console.log(row.id, row.hash, row.created_at);

await client.end();

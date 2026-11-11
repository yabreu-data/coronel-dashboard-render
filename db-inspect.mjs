import "dotenv/config"; import pg from "pg";
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); await db.connect();
const t=await db.query(`select table_schema, table_name from information_schema.tables where table_schema='public' order by table_name`);
console.log("tables",t.rows.map(r=>r.table_name));
const c=await db.query(`select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`);
console.log("rls",c.rows);
const u=await db.query(`select column_name,data_type from information_schema.columns where table_schema='public' and table_name='users' order by ordinal_position`);
console.log("users",u.rows);
await db.end();

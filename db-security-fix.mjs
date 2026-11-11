import "dotenv/config"; import pg from "pg";
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); await db.connect();
try {
  await db.query("begin");
  await db.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "isOnline" boolean NOT NULL DEFAULT false`);
  const tables=await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`);
  for (const {relname} of tables.rows) {
    const ident=`"public"."${relname.replaceAll('"','""')}"`;
    await db.query(`ALTER TABLE ${ident} ENABLE ROW LEVEL SECURITY`);
    await db.query(`REVOKE ALL ON TABLE ${ident} FROM anon, authenticated`);
  }
  await db.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated`);
  await db.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`);
  await db.query("commit");
  console.log("secured tables", tables.rows.map(r=>r.relname));
} catch (error) { await db.query("rollback"); throw error; } finally { await db.end(); }

import "dotenv/config"; import pg from "pg";
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); await db.connect();
const me=await db.query(`select current_user, session_user, current_setting('is_superuser') as superuser`);
console.log(me.rows);
const roles=await db.query(`select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('anon','authenticated','service_role','postgres') order by rolname`);
console.log(roles.rows);
const grants=await db.query(`select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by grantee, table_name order by table_name, grantee`);
console.log("grants",grants.rows);
await db.end();

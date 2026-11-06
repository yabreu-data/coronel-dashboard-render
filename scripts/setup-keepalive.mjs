import "dotenv/config";
import pg from "pg";

/**
 * Keep-alive de Render usando Supabase (pg_cron + pg_net).
 *
 * El plan free de Render duerme el servicio tras 15 minutos sin peticiones.
 * Este script programa un job de PostgreSQL que cada 5 minutos hace un GET al
 * endpoint /healthz del servicio, manteniéndolo despierto.
 *
 * Uso:
 *   node scripts/setup-keepalive.mjs                 # instala extensiones y programa el job
 *   node scripts/setup-keepalive.mjs --test          # dispara un ping y muestra la respuesta
 *   node scripts/setup-keepalive.mjs --remove        # elimina el job programado
 *   node scripts/setup-keepalive.mjs https://mi-app.onrender.com/healthz
 *
 * Variables opcionales:
 *   KEEPALIVE_URL      URL a pingear (por defecto https://coronel-dashboard.onrender.com/healthz)
 *   KEEPALIVE_CRON     Expresión cron de 5 campos (por defecto "*\/5 * * * *")
 *   DATABASE_URL       Connection string de Supabase (obligatoria)
 */

const DEFAULT_URL = "https://coronel-dashboard.onrender.com/healthz";
const JOB_NAME = "coronel-render-keepalive";
const DEFAULT_SCHEDULE = "*/5 * * * *";

const args = process.argv.slice(2);
const urlFromArgs = args.find(arg => /^https?:\/\//i.test(arg));
const targetUrl = (urlFromArgs || process.env.KEEPALIVE_URL || DEFAULT_URL).trim();
const schedule = (process.env.KEEPALIVE_CRON || DEFAULT_SCHEDULE).trim();
const mode = args.includes("--remove") ? "remove" : args.includes("--test") ? "test" : "setup";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no está definido (.env)");
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function ensureExtensions() {
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_cron");
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_net");
  const installed = await client.query(
    "SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net') ORDER BY extname"
  );
  for (const row of installed.rows) console.log(`- extensión ${row.extname}@${row.extversion} lista`);
  return installed.rows.length === 2;
}

async function removeJob() {
  const result = await client.query(
    "SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1",
    [JOB_NAME]
  );
  console.log(result.rowCount ? `- job "${JOB_NAME}" eliminado` : `- no existía el job "${JOB_NAME}"`);
}

async function scheduleJob() {
  await removeJob();
  const result = await client.query(
    `SELECT cron.schedule($1, $2, $3) AS jobid`,
    [
      JOB_NAME,
      schedule,
      `SELECT net.http_get('${targetUrl.replace(/'/g, "''")}'::text, '{}'::jsonb, '{}'::jsonb, 60000)`,
    ]
  );
  console.log(`- job "${JOB_NAME}" programado (jobid ${result.rows[0].jobid}) con cron "${schedule}" → ${targetUrl}`);
}

async function firePing() {
  const inserted = await client.query(
    "SELECT net.http_get($1::text, '{}'::jsonb, '{}'::jsonb, 60000) AS request_id",
    [targetUrl]
  );
  const requestId = inserted.rows[0].request_id;
  console.log(`- ping enviado (request_id ${requestId}); esperando respuesta…`);

  const deadline = Date.now() + 70_000;
  while (Date.now() < deadline) {
    const response = await client.query(
      "SELECT status_code, error_msg, timed_out, content FROM net._http_response WHERE id = $1",
      [requestId]
    );
    if (response.rowCount > 0) {
      const row = response.rows[0];
      const body = (row.content ?? "").slice(0, 160);
      console.log(`- respuesta HTTP ${row.status_code ?? "sin código"}${row.timed_out ? " (timeout)" : ""}${row.error_msg ? ` · error: ${row.error_msg}` : ""}`);
      if (body) console.log(`  body: ${body}`);
      return row.status_code === 200;
    }
    await sleep(1000);
  }
  console.log("- sin respuesta de pg_net en 70 s (revisa el estado del servicio)");
  return false;
}

async function showStatus() {
  const jobs = await client.query(
    "SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = $1",
    [JOB_NAME]
  );
  if (!jobs.rowCount) {
    console.log("- no hay job programado");
  } else {
    for (const job of jobs.rows) {
      console.log(`- job activo: ${job.jobname} · cron "${job.schedule}" · jobid ${job.jobid}`);
    }
    const runs = await client.query(
      `SELECT status, return_message, start_time FROM cron.job_run_details
       WHERE jobid = $1 ORDER BY start_time DESC LIMIT 3`,
      [jobs.rows[0].jobid]
    );
    if (runs.rowCount) {
      console.log("- últimas ejecuciones del cron:");
      for (const run of runs.rows) console.log(`  ${run.start_time.toISOString()} · ${run.status} · ${run.return_message}`);
    } else {
      console.log("- el cron aún no registra ejecuciones (espera al próximo tick)");
    }
  }

  const responses = await client.query(
    `SELECT status_code, timed_out, created FROM net._http_response ORDER BY id DESC LIMIT 5`
  );
  if (responses.rowCount) {
    console.log("- últimos pings registrados por pg_net:");
    for (const row of responses.rows) {
      console.log(`  ${row.created.toISOString()} · HTTP ${row.status_code ?? "sin código"}${row.timed_out ? " (timeout)" : ""}`);
    }
  }
}

async function main() {
  await client.connect();
  console.log(`\n== Keep-alive Render · ${targetUrl} ==\n`);
  console.log(`modo: ${mode}`);

  if (mode === "remove") {
    await removeJob();
    await showStatus();
    return;
  }

  const ready = await ensureExtensions();
  if (!ready) {
    console.error("No se pudieron habilitar pg_cron/pg_net. Habilítalas en Supabase → Database → Extensions.");
    process.exitCode = 1;
    return;
  }

  if (mode === "test") {
    const ok = await firePing();
    await showStatus();
    if (!ok) process.exitCode = 1;
    return;
  }

  await scheduleJob();
  await showStatus();
  console.log("\nNota: el cron corre en UTC. Con \"*/5 * * * *\" el servicio queda despierto 24/7 (~744 h/mes, dentro de las 750 h gratis de Render).");
  console.log("Para limitarlo a horario de oficina (07:00–23:00 Bogotá = 12:00–04:00 UTC): KEEPALIVE_CRON=\"*/5 12-23,0-3 * * *\".");
}

main()
  .catch(error => {
    console.error("\nError:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => undefined);
  });

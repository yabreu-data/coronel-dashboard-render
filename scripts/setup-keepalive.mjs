import "dotenv/config";
import pg from "pg";

/**
 * Keep-alive de Render usando Supabase (pg_cron + pg_net).
 *
 * El plan free de Render duerme el servicio tras 15 minutos sin peticiones.
 * Este script programa un job de PostgreSQL que cada 5 minutos hace un GET al
 * endpoint /healthz del servicio, manteniéndolo despierto.
 *
 * Por defecto NO se ejecuta entre 01:30 y 06:30 hora de Lima (America/Lima,
 * UTC-5), evaluado dentro de PostgreSQL con `now() AT TIME ZONE`.
 *
 * Uso:
 *   node scripts/setup-keepalive.mjs                 # instala extensiones y programa el job
 *   node scripts/setup-keepalive.mjs --status        # muestra configuración y últimas ejecuciones
 *   node scripts/setup-keepalive.mjs --test          # fuerza un ping ahora y muestra la respuesta
 *   node scripts/setup-keepalive.mjs --remove        # elimina el job programado
 *   node scripts/setup-keepalive.mjs https://mi-app.onrender.com/healthz
 *
 * Variables opcionales:
 *   KEEPALIVE_URL            URL a pingear (por defecto https://coronel-dashboard.onrender.com/healthz)
 *   KEEPALIVE_CRON           Expresión cron de 5 campos (por defecto "*\/5 * * * *")
 *   KEEPALIVE_TZ             Zona horaria de la ventana (por defecto "America/Lima")
 *   KEEPALIVE_BLACKOUT_START Inicio de la ventana sin pings (por defecto "01:30")
 *   KEEPALIVE_BLACKOUT_END   Fin de la ventana sin pings (por defecto "06:30")
 *   KEEPALIVE_BLACKOUT=off   Desactiva la ventana (pings 24/7)
 *   DATABASE_URL             Connection string de Supabase (obligatoria)
 */

const DEFAULT_URL = "https://coronel-dashboard.onrender.com/healthz";
const JOB_NAME = "coronel-render-keepalive";
const DEFAULT_SCHEDULE = "*/5 * * * *";
const DEFAULT_TZ = "America/Lima";
const DEFAULT_BLACKOUT_START = "01:30";
const DEFAULT_BLACKOUT_END = "06:30";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TZ_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

const args = process.argv.slice(2);
const urlFromArgs = args.find(arg => /^https?:\/\//i.test(arg));
const targetUrl = (urlFromArgs || process.env.KEEPALIVE_URL || DEFAULT_URL).trim();
const schedule = (process.env.KEEPALIVE_CRON || DEFAULT_SCHEDULE).trim();
const timeZone = (process.env.KEEPALIVE_TZ || DEFAULT_TZ).trim();
const blackoutEnabled = (process.env.KEEPALIVE_BLACKOUT || "").toLowerCase() !== "off";
const blackoutStart = (process.env.KEEPALIVE_BLACKOUT_START || DEFAULT_BLACKOUT_START).trim();
const blackoutEnd = (process.env.KEEPALIVE_BLACKOUT_END || DEFAULT_BLACKOUT_END).trim();
const mode = args.includes("--remove")
  ? "remove"
  : args.includes("--test")
    ? "test"
    : args.includes("--status")
      ? "status"
      : "setup";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no está definido (.env)");
  process.exit(1);
}
if (!TIME_PATTERN.test(blackoutStart) || !TIME_PATTERN.test(blackoutEnd)) {
  console.error("KEEPALIVE_BLACKOUT_START/END deben tener formato HH:MM (24 h), p. ej. 01:30");
  process.exit(1);
}
if (!TZ_PATTERN.test(timeZone)) {
  console.error("KEEPALIVE_TZ inválida");
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const escapeSql = value => String(value).replace(/'/g, "''");

/** SQL que ejecuta pg_cron: pingea salvo que la hora local esté en la ventana excluida. */
function buildPingCommand() {
  if (!blackoutEnabled) {
    return `SELECT net.http_get('${escapeSql(targetUrl)}'::text, '{}'::jsonb, '{}'::jsonb, 60000)`;
  }
  return [
    "DO $coronel_keepalive$",
    "DECLARE",
    `  lima_time time := (now() AT TIME ZONE '${escapeSql(timeZone)}')::time;`,
    "BEGIN",
    `  IF lima_time >= time '${blackoutStart}' AND lima_time < time '${blackoutEnd}' THEN`,
    "    RETURN;",
    "  END IF;",
    `  PERFORM net.http_get('${escapeSql(targetUrl)}'::text, '{}'::jsonb, '{}'::jsonb, 60000);`,
    "END",
    "$coronel_keepalive$",
  ].join("\n");
}

/** Hora actual en la zona configurada, formato HH:MM (24 h). */
function localTimeNow() {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function isInsideBlackout() {
  if (!blackoutEnabled) return false;
  const now = localTimeNow();
  return now >= blackoutStart && now < blackoutEnd;
}

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
  const result = await client.query("SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1", [JOB_NAME]);
  console.log(result.rowCount ? `- job "${JOB_NAME}" eliminado` : `- no existía el job "${JOB_NAME}"`);
}

async function scheduleJob() {
  await removeJob();
  const command = buildPingCommand();
  const result = await client.query("SELECT cron.schedule($1, $2, $3) AS jobid", [JOB_NAME, schedule, command]);
  console.log(`- job "${JOB_NAME}" programado (jobid ${result.rows[0].jobid}) · cron "${schedule}" · ${targetUrl}`);
  if (blackoutEnabled) {
    console.log(`- ventana sin pings: ${blackoutStart}–${blackoutEnd} (${timeZone}), evaluada en PostgreSQL`);
  } else {
    console.log("- ventana sin pings: desactivada (pings 24/7)");
  }
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
  console.log(`- ahora en ${timeZone}: ${localTimeNow()} → ${isInsideBlackout() ? "DENTRO de la ventana (sin pings)" : "FUERA de la ventana (pings activos)"}`);

  const jobs = await client.query("SELECT jobid, jobname, schedule, active, command FROM cron.job WHERE jobname = $1", [JOB_NAME]);
  if (!jobs.rowCount) {
    console.log("- no hay job programado");
  } else {
    for (const job of jobs.rows) {
      console.log(`- job activo: ${job.jobname} · cron "${job.schedule}" · jobid ${job.jobid} · active=${job.active}`);
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
    "SELECT status_code, timed_out, created FROM net._http_response ORDER BY id DESC LIMIT 5"
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
    console.log("- el ping de prueba se envía siempre, aunque estés dentro de la ventana");
    const ok = await firePing();
    await showStatus();
    if (!ok) process.exitCode = 1;
    return;
  }

  if (mode === "status") {
    await showStatus();
    return;
  }

  await scheduleJob();
  await showStatus();
  console.log("\nNota: pg_cron corre en UTC, pero la ventana se evalúa con fecha/hora de la zona configurada.");
  console.log("Con */5 y la ventana 01:30–06:30 Lima el servicio queda despierto ~19 h/día (~578 h/mes de las 750 h gratuitas).");
}

main()
  .catch(error => {
    console.error("\nError:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => undefined);
  });

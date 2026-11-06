import "dotenv/config";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import pg from "pg";

/**
 * Prueba de humo end-to-end contra un servidor ya levantado (local o Render).
 * Verifica: Google Sheets, lectura pública de BD, autenticación con Supabase
 * Auth, endpoint protegido y escritura/limpieza en PostgreSQL.
 *
 * Uso: node scripts/smoke-test.mjs [baseUrl]
 *   baseUrl por defecto: http://localhost:3000
 */

const BASE_URL = (process.argv[2] || process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
};

const makeClient = token =>
  createTRPCClient({
    links: [
      httpBatchLink({
        url: `${BASE_URL}/api/trpc`,
        transformer: superjson,
        headers: () => (token ? { Authorization: `Bearer ${token}` } : {}),
      }),
    ],
  });

const anonClient = makeClient(null);
const tempEmail = `smoke-test-${Date.now()}@coronel.local`;
const tempPassword = `Smoke-${Math.random().toString(36).slice(2)}-Aa1!`;
let tempUserId = null;

async function supabaseAdmin(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  return response;
}

async function cleanup() {
  if (DATABASE_URL) {
    const client = new pg.Client({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? undefined : { rejectUnauthorized: false },
    });
    await client.connect().catch(() => undefined);
    await client.query(`DELETE FROM public."birthday_campaigns" WHERE "clientKey" LIKE 'SMOKE-TEST%'`).catch(() => undefined);
    if (tempUserId) {
      await client.query(`DELETE FROM public."session_history" WHERE "openId" = $1`, [tempUserId]).catch(() => undefined);
      await client.query(`DELETE FROM public."users" WHERE "openId" = $1`, [tempUserId]).catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
  if (tempUserId) await supabaseAdmin(`/auth/v1/admin/users/${tempUserId}`, { method: "DELETE" }).catch(() => undefined);
}

async function main() {
  console.log(`\n== Prueba de humo · ${BASE_URL} ==\n`);

  // 0. Health check
  try {
    const response = await fetch(`${BASE_URL}/healthz`);
    const health = await response.json();
    record("healthz", response.ok && health.ok === true, JSON.stringify(health));
  } catch (error) {
    record("healthz", false, String(error));
    throw error;
  }

  // 1. Google Sheets (endpoint público)
  try {
    const data = await anonClient.survey.latest.query();
    record("survey.latest (Google Sheets)", data.records.length > 0, `source=${data.source} · ${data.records.length} encuestas · ${data.serverCatalog.length} meseros`);
  } catch (error) {
    record("survey.latest (Google Sheets)", false, error instanceof Error ? error.message : String(error));
  }

  // 2. Lecturas públicas contra PostgreSQL
  for (const [name, call] of [
    ["targets.get", () => anonClient.targets.get.query()],
    ["promotions.list", () => anonClient.promotions.list.query()],
    ["responsibleUsers.list", () => anonClient.responsibleUsers.list.query()],
    ["priorities.list", () => anonClient.priorities.list.query()],
    ["adminAudit.list", () => anonClient.adminAudit.list.query()],
    ["calls.list", () => anonClient.calls.list.query()],
  ]) {
    try {
      const value = await call();
      record(`${name} (PostgreSQL)`, true, Array.isArray(value) ? `${value.length} filas` : JSON.stringify(value));
    } catch (error) {
      record(`${name} (PostgreSQL)`, false, error instanceof Error ? error.message : String(error));
    }
  }

  // 3. Endpoint protegido sin token → UNAUTHORIZED
  try {
    await anonClient.birthdayCampaigns.list.query();
    record("birthdayCampaigns.list sin token → UNAUTHORIZED", false, "devolvió datos sin autenticación");
  } catch (error) {
    const code = error instanceof TRPCClientError ? error.data?.code : null;
    record("birthdayCampaigns.list sin token → UNAUTHORIZED", code === "UNAUTHORIZED", `code=${code}`);
  }

  // 4. Supabase Auth: crear usuario temporal, iniciar sesión y verificar identidad
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    record("Supabase Auth (configuración)", false, "faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const created = await supabaseAdmin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: tempEmail, password: tempPassword, email_confirm: true }),
  });
  const createdPayload = await created.json();
  if (!created.ok) {
    record("Supabase Auth: crear usuario temporal", false, JSON.stringify(createdPayload));
    return;
  }
  tempUserId = createdPayload.id;
  record("Supabase Auth: crear usuario temporal", Boolean(tempUserId), tempEmail);

  const tokenResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: tempEmail, password: tempPassword }),
  });
  const tokenPayload = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    record("Supabase Auth: iniciar sesión", false, JSON.stringify(tokenPayload));
    return;
  }
  const accessToken = tokenPayload.access_token;
  record("Supabase Auth: iniciar sesión", true, `token JWT obtenido (exp ${new Date(tokenPayload.expires_at * 1000).toISOString()})`);

  const authClient = makeClient(accessToken);

  try {
    const me = await authClient.auth.me.query();
    record("auth.me con Bearer token", me?.openId === tempUserId, `openId=${me?.openId} · role=${me?.role} · name=${me?.name}`);
  } catch (error) {
    record("auth.me con Bearer token", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const saved = await authClient.birthdayCampaigns.save.mutate({ clientKey: "SMOKE-TEST-1", clientName: "Prueba despliegue", stage: "week", channel: "llamada" });
    const list = await authClient.birthdayCampaigns.list.query();
    record("birthdayCampaigns.save (protegido, escritura PG)", Boolean(saved) && list.some(item => item.clientKey === "SMOKE-TEST-1"), `total=${list.length}`);
  } catch (error) {
    record("birthdayCampaigns.save (protegido, escritura PG)", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const audit = await authClient.adminAudit.list.query();
    record("adminAudit.list (lectura PG)", Array.isArray(audit), `${audit.length} filas`);
  } catch (error) {
    record("adminAudit.list (lectura PG)", false, error instanceof Error ? error.message : String(error));
  }
}

main()
  .catch(error => {
    console.error("\nError inesperado:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    const failed = results.filter(item => !item.ok);
    console.log(`\n== Resultado: ${results.length - failed.length}/${results.length} OK ==`);
    if (failed.length) process.exitCode = 1;
  });

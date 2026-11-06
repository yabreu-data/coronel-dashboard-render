import "dotenv/config";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import pg from "pg";

/**
 * Prueba de humo del flujo de accesos:
 *   1. Solicitud pública de acceso (sin cuenta)
 *   2. Un administrador la aprueba (crea usuario en Supabase Auth + contraseña temporal)
 *   3. El nuevo usuario inicia sesión y accede a datos
 *   4. Una cuenta de Supabase sin aprobación NO puede entrar
 *   5. Enlace de recuperación de contraseña + cambio de contraseña
 *
 * Uso: node scripts/smoke-access.mjs [baseUrl]
 * Limpia todos los usuarios/registros temporales al terminar.
 */

const BASE_URL = (process.argv[2] || process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const ADMIN_PIN = process.env.ADMIN_PIN || "5956";
const STAMP = Date.now();

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
};

const adminEmail = `smoke-access-admin-${STAMP}@coronel.local`;
const userEmail = `smoke-access-user-${STAMP}@coronel.local`;
const strangerEmail = `smoke-access-stranger-${STAMP}@coronel.local`;
const testPassword = "Coronel-Test-123!";
const newPassword = "Coronel-Renewed-456!";
const createdAuthIds = [];

const db = DATABASE_URL
  ? new pg.Client({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? undefined : { rejectUnauthorized: false },
    })
  : null;

const client = token =>
  createTRPCClient({
    links: [
      httpBatchLink({
        url: `${BASE_URL}/api/trpc`,
        transformer: superjson,
        headers: () => (token ? { Authorization: `Bearer ${token}` } : {}),
      }),
    ],
  });

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
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function createAuthUser(email, password, name) {
  const { response, payload } = await supabaseAdmin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name } }),
  });
  if (!response.ok) throw new Error(`No se pudo crear ${email}: ${JSON.stringify(payload)}`);
  createdAuthIds.push(payload.id);
  return payload;
}

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json();
  return { ok: response.ok, accessToken: payload.access_token, payload };
}

async function cleanup() {
  if (!db) return;
  try {
    await db.query(`DELETE FROM public."access_requests" WHERE "email" LIKE 'smoke-access-%'`);
    await db.query(`DELETE FROM public."admin_audit_log" WHERE "details" LIKE '%smoke-access-%' OR "changedBy" LIKE 'Smoke Admin%'`);
    await db.query(`DELETE FROM public."session_history" WHERE "openId" = ANY($1::text[])`, [createdAuthIds]);
    await db.query(`DELETE FROM public."users" WHERE "email" LIKE 'smoke-access-%' OR "openId" = ANY($1::text[])`, [createdAuthIds]);
  } catch (error) {
    console.warn("[cleanup] error en BD:", error.message);
  }
  for (const id of createdAuthIds) {
    await supabaseAdmin(`/auth/v1/admin/users/${id}`, { method: "DELETE" }).catch(() => undefined);
  }
}

async function main() {
  if (!db) throw new Error("DATABASE_URL no disponible");
  await db.connect();
  console.log(`\n== Prueba de accesos · ${BASE_URL} ==\n`);

  const anon = client(null);

  // 0. Crear administrador temporal (usuario Auth + fila local con rol admin)
  const adminAuth = await createAuthUser(adminEmail, testPassword, "Smoke Admin");
  await db.query(
    `INSERT INTO public."users" ("openId", "name", "email", "loginMethod", "role", "active") VALUES ($1, $2, $3, 'supabase', 'admin', 1)`,
    [adminAuth.id, "Smoke Admin", adminEmail]
  );
  const adminSession = await signIn(adminEmail, testPassword);
  record("admin temporal inicia sesión", adminSession.ok, adminEmail);
  const admin = client(adminSession.accessToken);

  // 1. Solicitud pública
  let requestId = null;
  try {
    await anon.accessRequests.create.mutate({
      name: "Usuario Smoke",
      email: userEmail,
      message: "Solicitud de prueba automatizada",
    });
    const rows = await db.query(`SELECT id, status FROM public."access_requests" WHERE "email" = $1`, [userEmail]);
    requestId = rows.rows[0]?.id ?? null;
    record("solicitud pública creada como pendiente", Boolean(requestId) && rows.rows[0]?.status === "pending", `id=${requestId}`);
  } catch (error) {
    record("solicitud pública creada como pendiente", false, error instanceof Error ? error.message : String(error));
    return;
  }

  // 1b. Duplicado rechazado
  try {
    await anon.accessRequests.create.mutate({ name: "Usuario Smoke", email: userEmail });
    record("solicitud duplicada rechazada", false, "se creó un duplicado");
  } catch (error) {
    record("solicitud duplicada rechazada", error instanceof TRPCClientError && error.data?.code === "CONFLICT", "CONFLICT");
  }

  // 2. Listado admin + aprobación con PIN
  const pending = await admin.accessRequests.list.query();
  record("admin ve la solicitud pendiente", pending.some(item => item.id === requestId), `${pending.length} solicitud(es)`);

  let tempPassword = null;
  try {
    const result = await admin.accessRequests.approve.mutate({ id: requestId, adminPin: ADMIN_PIN });
    tempPassword = result.tempPassword;
    record("aprobación crea usuario de Supabase Auth", Boolean(tempPassword) && tempPassword.length >= 10, `password temporal de ${tempPassword?.length} caracteres`);
  } catch (error) {
    record("aprobación crea usuario de Supabase Auth", false, error instanceof Error ? error.message : String(error));
    return;
  }

  // 2b. PIN incorrecto rechazado
  const secondRequestEmail = `smoke-access-second-${STAMP}@coronel.local`;
  try {
    await anon.accessRequests.create.mutate({ name: "Segundo Smoke", email: secondRequestEmail });
    const rows = await db.query(`SELECT id FROM public."access_requests" WHERE "email" = $1`, [secondRequestEmail]);
    try {
      await admin.accessRequests.approve.mutate({ id: rows.rows[0].id, adminPin: "0000" });
      record("aprobación con PIN incorrecto rechazada", false, "se aprobó con PIN inválido");
    } catch (error) {
      record("aprobación con PIN incorrecto rechazada", error instanceof TRPCClientError && error.data?.code === "FORBIDDEN", "FORBIDDEN");
    }
  } catch (error) {
    record("aprobación con PIN incorrecto rechazada", false, error instanceof Error ? error.message : String(error));
  }

  // 3. El usuario aprobado entra y usa endpoints protegidos
  const userSession = await signIn(userEmail, tempPassword);
  record("usuario aprobado inicia sesión con su contraseña temporal", userSession.ok);
  if (userSession.ok) {
    const userClient = client(userSession.accessToken);
    const me = await userClient.auth.me.query();
    record("auth.me devuelve su cuenta aprobada", Boolean(me) && me.email === userEmail && me.role === "user", `role=${me?.role}`);
    const birthdays = await userClient.birthdayCampaigns.list.query();
    record("usuario aprobado accede a datos protegidos", Array.isArray(birthdays), `${birthdays.length} campañas`);
  }

  // 4. Cuenta de Supabase sin aprobación no puede entrar
  const strangerAuth = await createAuthUser(strangerEmail, testPassword, "Smoke Stranger");
  const strangerSession = await signIn(strangerEmail, testPassword);
  if (strangerSession.ok) {
    const strangerClient = client(strangerSession.accessToken);
    const me = await strangerClient.auth.me.query().catch(() => null);
    record("cuenta sin aprobación queda bloqueada", me === null, "auth.me = null (aprobación requerida)");
    let blocked = false;
    try {
      await strangerClient.birthdayCampaigns.list.query();
    } catch (error) {
      blocked = error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED";
    }
    record("cuenta sin aprobación no accede a datos protegidos", blocked, "UNAUTHORIZED");
    await supabaseAdmin(`/auth/v1/admin/users/${strangerAuth.id}`, { method: "DELETE" });
    createdAuthIds.splice(createdAuthIds.indexOf(strangerAuth.id), 1);
  }

  // 5. Recuperación de contraseña: enlace con redirect correcto + cambio de contraseña
  // El redirect debe pertenecer a la allowlist de Supabase; en pruebas locales
  // se valida contra el dominio de producción.
  const recoveryBase = BASE_URL.startsWith("http://localhost") || BASE_URL.startsWith("http://127.0.0.1")
    ? "https://coronel-dashboard.onrender.com"
    : BASE_URL;
  const link = await supabaseAdmin("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "recovery", email: userEmail, redirect_to: `${recoveryBase}/reset-password` }),
  });
  const actionLink = link.payload?.action_link ?? "";
  let recoveryRedirect = "";
  try {
    recoveryRedirect = new URL(actionLink).searchParams.get("redirect_to") ?? "";
  } catch {
    recoveryRedirect = "";
  }
  record(
    "enlace de recuperación apunta a /reset-password",
    recoveryRedirect.endsWith("/reset-password"),
    recoveryRedirect || actionLink.slice(0, 90)
  );

  if (userSession.ok) {
    try {
      const verify = await fetch(actionLink, { redirect: "manual" });
      const location = verify.headers.get("location") ?? "";
      const params = new URLSearchParams(location.split("#")[1] ?? "");
      const recoveryToken = params.get("access_token");
      if (!recoveryToken) throw new Error(`sin access_token en ${location.slice(0, 120)}`);
      const update = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${recoveryToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      record("cambio de contraseña con enlace de recuperación", update.ok, `HTTP ${update.status}`);
      const renewed = await signIn(userEmail, newPassword);
      record("inicio de sesión con la nueva contraseña", renewed.ok);
    } catch (error) {
      record("cambio de contraseña con enlace de recuperación", false, error instanceof Error ? error.message : String(error));
    }
  }
}

main()
  .catch(error => {
    console.error("\nError inesperado:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    if (db) await db.end().catch(() => undefined);
    const failed = results.filter(item => !item.ok);
    console.log(`\n== Resultado: ${results.length - failed.length}/${results.length} OK ==`);
    if (failed.length) process.exitCode = 1;
  });

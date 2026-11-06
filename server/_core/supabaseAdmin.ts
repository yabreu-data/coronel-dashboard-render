import { randomInt } from "node:crypto";
import { ENV } from "./env";

/**
 * Cliente mínimo de la API administrativa de Supabase Auth (service role).
 * Se usa solo desde el servidor para aprobar solicitudes y restablecer
 * contraseñas; la service role key nunca se expone al navegador.
 */

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword() {
  let random = "";
  for (let index = 0; index < 10; index += 1) random += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  const digits = `${randomInt(10)}${randomInt(10)}`;
  return `Coronel-${random}${digits}!`;
}

function assertConfigured() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
    throw new Error("Supabase Admin API no configurada: faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  }
}

function adminHeaders() {
  return {
    apikey: ENV.supabaseServiceRoleKey,
    Authorization: `Bearer ${ENV.supabaseServiceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function adminFetch(path: string, init: RequestInit = {}) {
  assertConfigured();
  const response = await fetch(`${ENV.supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      ...adminHeaders(),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { response, payload };
}

async function listAllAuthUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { response, payload } = await adminFetch(`/admin/users?page=${page}&per_page=200`);
    if (!response.ok) throw new Error(`No se pudieron listar los usuarios de Supabase (${response.status})`);
    const batch = ((payload?.users as AuthUser[] | undefined) ?? []);
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  const users = await listAllAuthUsers();
  return users.find(user => (user.email ?? "").toLowerCase() === normalized) ?? null;
}

export async function getAuthUserById(id: string): Promise<AuthUser | null> {
  const { response, payload } = await adminFetch(`/admin/users/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`No se pudo leer el usuario ${id} (${response.status})`);
  return payload as AuthUser;
}

/**
 * Crea (o reutiliza) el usuario de Supabase Auth y garantiza que la contraseña
 * temporal sea la indicada. Idempotente: si el correo ya existe, actualiza la
 * contraseña en lugar de fallar.
 */
export async function ensureAuthUser(input: { email: string; password: string; name?: string | null }): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  const metadata = input.name ? { full_name: input.name } : undefined;

  const created = await adminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: input.password, email_confirm: true, user_metadata: metadata }),
  });

  if (created.response.ok) return created.payload as unknown as AuthUser;

  const message = JSON.stringify(created.payload ?? {});
  if (created.response.status === 422 && /already|registered|exists/i.test(message)) {
    const existing = await findAuthUserByEmail(email);
    if (!existing) throw new Error(`El correo ${email} ya existe pero no se pudo recuperar su usuario`);
    const updated = await adminFetch(`/admin/users/${encodeURIComponent(existing.id)}`, {
      method: "PUT",
      body: JSON.stringify({ password: input.password, email_confirm: true, ...(metadata ? { user_metadata: metadata } : {}) }),
    });
    if (!updated.response.ok) throw new Error(`No se pudo actualizar la contraseña del usuario ${email}`);
    return (updated.payload as unknown as AuthUser) ?? existing;
  }

  throw new Error(`No se pudo crear el usuario en Supabase Auth (${created.response.status}): ${message.slice(0, 200)}`);
}

/** Restablece la contraseña de un usuario de Supabase Auth por su uuid (openId). */
export async function setAuthPasswordByUserId(userId: string, password: string): Promise<void> {
  const { response, payload } = await adminFetch(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!response.ok) {
    throw new Error(`No se pudo restablecer la contraseña (${response.status}): ${JSON.stringify(payload)?.slice(0, 200)}`);
  }
}

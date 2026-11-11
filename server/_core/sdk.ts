import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

/**
 * Autenticación con Supabase Auth.
 *
 * El cliente (navegador) inicia sesión contra Supabase con la anon key y envía
 * el access token JWT en `Authorization: Bearer <token>`. El servidor valida el
 * token contra el endpoint `/auth/v1/user` de Supabase y mapea el usuario de
 * Supabase (`openId` = uuid de auth) con la tabla local `users`.
 */

type SupabaseSessionUser = {
  id: string;
  email: string | null;
  name: string | null;
};

const TOKEN_CACHE_TTL_MS = 60_000;
const TOKEN_CACHE_MAX_ENTRIES = 500;
const tokenCache = new Map<string, { user: SupabaseSessionUser; expiresAt: number }>();

function rememberToken(token: string, user: SupabaseSessionUser) {
  if (tokenCache.size >= TOKEN_CACHE_MAX_ENTRIES) tokenCache.clear();
  tokenCache.set(token, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
}

async function verifySupabaseToken(token: string): Promise<SupabaseSessionUser | null> {
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    console.error("[Auth] SUPABASE_URL / SUPABASE_ANON_KEY no están configurados");
    return null;
  }

  try {
    const response = await fetch(`${ENV.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: ENV.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as Record<string, unknown>;
    const id = typeof payload.id === "string" ? payload.id : "";
    if (!id) return null;

    const metadata = (payload.user_metadata ?? {}) as Record<string, unknown>;
    const candidateName = [metadata.full_name, metadata.name, metadata.user_name]
      .find(value => typeof value === "string" && value.trim().length > 0);

    const user: SupabaseSessionUser = {
      id,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof candidateName === "string" ? candidateName : null,
    };
    rememberToken(token, user);
    return user;
  } catch (error) {
    console.error("[Auth] Falló la verificación del token de Supabase:", error);
    return null;
  }
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export type AuthenticatedUser = User;

class SDKServer {
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const token = getBearerToken(req);
    if (!token) throw ForbiddenError("Falta el token de sesión de Supabase");

    const sessionUser = await verifySupabaseToken(token);
    if (!sessionUser) throw ForbiddenError("Sesión de Supabase inválida o expirada");

    let user = await db.getUserByOpenId(sessionUser.id);
    if (!user) {
      // Solo el administrador configurado se auto-registra. Cualquier otra
      // cuenta de Supabase Auth debe haber sido aprobada previamente (lo que
      // crea su fila local con `activateUserFromAuth`).
      if (sessionUser.id !== ENV.supabaseAdminUserId) {
        throw ForbiddenError("Tu acceso todavía no fue aprobado por un administrador.");
      }
      await db.upsertUser({
        openId: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        loginMethod: "supabase",
        lastSignedIn: new Date(),
      });
      user = await db.getUserByOpenId(sessionUser.id);
    }
    if (!user) throw ForbiddenError("No se pudo registrar el usuario de Supabase");
    if (!user.active) throw ForbiddenError("Esta cuenta está desactivada. Solicita su recuperación a un administrador.");

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date(), isOnline: true });
    return user;
  }
}

export const sdk = new SDKServer();

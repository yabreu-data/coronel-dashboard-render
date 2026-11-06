import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Cliente de Supabase Auth para el navegador. La persistencia y la renovación
 * automática del token viven en localStorage; el access token se expone a
 * tRPC mediante el header `Authorization: Bearer`.
 */
export const supabase = createClient(supabaseUrl || "http://127.0.0.1:54321", supabaseAnonKey || "anon-key-not-configured", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

function applySession(session: Session | null) {
  accessToken = session?.access_token ?? null;
}

/** Debe ejecutarse antes de renderizar la app: hidrata el token desde localStorage. */
export async function bootstrapSession() {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      applySession(data.session);
    } catch (error) {
      console.warn("[Supabase] No se pudo recuperar la sesión guardada", error);
    }
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  applySession(data.session);
  return data.session;
}

export async function signOut() {
  accessToken = null;
  await supabase.auth.signOut().catch(() => undefined);
}

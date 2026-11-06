export const LOGIN_PATH = "/login";

/**
 * Pantalla de acceso. La autenticación se realiza contra Supabase Auth
 * (email + contraseña) y el token se envía al backend tRPC.
 */
export const startLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
};

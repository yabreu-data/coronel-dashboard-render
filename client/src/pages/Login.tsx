import { useAuth } from "@/_core/hooks/useAuth";
import { isSupabaseConfigured, signInWithPassword } from "@/lib/supabase";
import { useEffect, useState, type FormEvent } from "react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  border: "1px solid #2a5270",
  borderRadius: 10,
  background: "#0b1a2c",
  color: "#f1f6fc",
  fontSize: 14,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  textAlign: "left",
  marginBottom: 6,
  color: "#c5d3e1",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
};

/**
 * Acceso con Supabase Auth (email + contraseña). Los usuarios se administran en
 * el panel de Supabase (Authentication → Users).
 */
export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) window.location.replace("/");
  }, [loading, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      window.location.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/invalid login credentials/i.test(message)) setError("Correo o contraseña incorrectos.");
      else if (/email not confirmed/i.test(message)) setError("El correo todavía no está confirmado en Supabase.");
      else if (/supabase/i.test(message) && /url|key/i.test(message)) setError("La configuración de Supabase es inválida.");
      else setError(`No se pudo iniciar sesión: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wall">
      <div className="auth-wall-card">
        <img className="loading-logo" src="/manus-storage/logo1_5c69b281.png" alt="Coronel" />
        <span
          style={{
            display: "inline-block",
            padding: "5px 10px",
            borderRadius: 999,
            background: "#123a53",
            border: "1px solid #2a5270",
            color: "#8be7ff",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.12em",
          }}
        >
          ACCESO RESTRINGIDO
        </span>
        <h1>Inicia sesión para continuar</h1>
        <p>El reporte contiene información de clientes, llamadas y desempeño interno. Necesitas una cuenta autorizada para consultar el dashboard.</p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, marginTop: 8 }}>
          <div>
            <label style={labelStyle} htmlFor="email">
              CORREO
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="tu-correo@dominio.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="password">
              CONTRASEÑA
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <p
              role="alert"
              style={{ margin: 0, padding: "10px 12px", borderRadius: 9, border: "1px solid #b25d68", background: "#351b2b", color: "#ffdce0", fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}
            >
              {error}
            </p>
          )}

          <button type="submit" className="auth-wall-button" disabled={submitting} style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? "wait" : "pointer" }}>
            {submitting ? "Verificando…" : "Iniciar sesión"}
          </button>
        </form>

        <p style={{ marginTop: 18, marginBottom: 0, fontSize: 11, color: "#8fa6bd" }}>
          Acceso gestionado con Supabase Auth. Solicita tus credenciales a un administrador.
        </p>
      </div>
    </div>
  );
}

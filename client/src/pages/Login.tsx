import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { isSupabaseConfigured, signInWithPassword, supabase } from "@/lib/supabase";
import PasswordInput from "@/components/PasswordInput";
import { useEffect, useState, type FormEvent } from "react";

type Mode = "login" | "request" | "recovery";

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

const initialMode = (): Mode => {
  if (typeof window === "undefined") return "login";
  const requested = new URLSearchParams(window.location.search).get("mode");
  return requested === "request" ? requested : "login";
};

/**
 * Acceso a Coronel:
 *  - login con Supabase Auth (email + contraseña)
 *  - recuperación de contraseña por correo
 *  - solicitud de acceso que un administrador debe aprobar
 */
export default function Login() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCooldown, setRecoveryCooldown] = useState(() => {
    const until = Number(localStorage.getItem("coronel.recoveryCooldownUntil") || 0);
    return Number.isFinite(until)
      ? Math.max(0, Math.ceil((until - Date.now()) / 1000))
      : 0;
  });
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestAccessMutation = trpc.accessRequests.create.useMutation();

  useEffect(() => {
    if (!loading && user) window.location.replace("/");
  }, [loading, user]);

  useEffect(() => {
    if (!recoveryCooldown) return;
    const timer = window.setInterval(
      () => setRecoveryCooldown(value => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [recoveryCooldown > 0]);

  const changeMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!isSupabaseConfigured) {
      setError("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      const me = await utils.auth.me.fetch().catch(() => null);
      if (!me) {
        await supabase.auth.signOut().catch(() => undefined);
        setError("Tu solicitud de acceso todavía no fue aprobada por un administrador. Te avisaremos cuando tu cuenta esté habilitada.");
        return;
      }
      window.location.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/invalid login credentials/i.test(message)) setError("Correo o contraseña incorrectos.");
      else if (/email not confirmed/i.test(message)) setError("El correo todavía no está confirmado. Pide a un administrador que reactive tu acceso.");
      else setError(`No se pudo iniciar sesión: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await requestAccessMutation.mutateAsync({
        name: requestName.trim(),
        email: requestEmail.trim(),
        message: requestMessage.trim() || undefined,
      });
      setNotice("Solicitud enviada. Un administrador revisará tu pedido y habilitará tu cuenta; luego podrás iniciar sesión con la contraseña temporal que te compartan.");
      setRequestName("");
      setRequestEmail("");
      setRequestMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!isSupabaseConfigured) {
      setError("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.");
      return;
    }
    setSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      console.info("[Auth] Solicitando recuperación de contraseña", {
        email: email.trim(),
        redirectTo,
      });
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (recoveryError) throw recoveryError;
      localStorage.setItem(
        "coronel.recoveryCooldownUntil",
        String(Date.now() + 60_000)
      );
      setRecoveryCooldown(60);
      setNotice(
        "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Auth] Falló la recuperación de contraseña", {
        message,
        timestamp: new Date().toISOString(),
      });
      if (/rate limit|too many|429/i.test(message)) {
        localStorage.setItem(
          "coronel.recoveryCooldownUntil",
          String(Date.now() + 60_000)
        );
        setRecoveryCooldown(60);
        setError(
          "Se enviaron demasiados correos en poco tiempo. Intenta de nuevo en un minuto o pide a un administrador que restablezca tu acceso."
        );
      } else {
        setError(`No se pudo enviar el correo de recuperación: ${message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoveryHelp = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Escribe tu correo para avisar al administrador.");
      return;
    }
    setSubmitting(true);
    try {
      await requestAccessMutation.mutateAsync({
        name: `Recuperación · ${email.trim().split("@")[0] || "usuario"}`.slice(0, 160),
        email: email.trim(),
        message:
          "Solicito apoyo para restablecer mi contraseña porque el correo de recuperación no llegó.",
      });
      setNotice(
        "Aviso enviado al administrador. Podrá generar una clave temporal y compartírtela por un canal privado."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo avisar al administrador."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wall">
      <div className="auth-wall-card">
        <div className="auth-logo-wrap">
          <img className="loading-logo" src="/manus-storage/logo-coronel.png" alt="Coronel · Pollos y Parrillas" />
        </div>
        <span className="auth-brand-caption">Pollos y Parrillas · Sistema de gestión</span>
        <span className="auth-badge">
          {mode === "login"
            ? "PARA EL EQUIPO DE CORONEL"
            : mode === "request"
              ? "SOLICITUD DE ACCESO"
              : "RECUPERAR CONTRASEÑA"}
        </span>

        {mode === "login" && (
          <>
            <h1>Bienvenido a Coronel</h1>
            <p className="auth-lead">Cada cliente cuenta. Entra para cuidar a los tuyos y empezar el día con todo en orden.</p>

            <form onSubmit={handleLogin} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle} htmlFor="email">CORREO</label>
                <input id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="tu-correo@dominio.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="password">CONTRASEÑA</label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="••••••••"
                  inputStyle={inputStyle}
                />
              </div>

              {error && <p role="alert" className="auth-error">{error}</p>}

              <button type="submit" className="auth-wall-button" disabled={submitting} style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? "wait" : "pointer" }}>
                {submitting ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <div className="auth-inline-row" style={{ marginTop: 14 }}>
              <button type="button" className="auth-link" onClick={() => changeMode("request")}>Solicitar acceso</button>
            </div>
            <p className="auth-help" style={{ marginTop: 12 }}>
              Para cambiar tu contraseña, inicia sesión y entra a{" "}
              <b>Mi cuenta → Cambiar mi contraseña</b>.
            </p>
          </>
        )}

        {mode === "recovery" && (
          <>
            <h1>Recuperar contraseña</h1>
            <p>Escribe el correo con el que te dieron acceso y te enviaremos un enlace para crear una nueva contraseña.</p>

            <form onSubmit={handleRecovery} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle} htmlFor="recovery-email">CORREO</label>
                <input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="tu-correo@dominio.com" style={inputStyle} />
              </div>

              {error && <p role="alert" className="auth-error">{error}</p>}
              {notice && <p role="status" className="auth-success">{notice}</p>}

              <button
                type="submit"
                className="auth-wall-button"
                disabled={submitting || recoveryCooldown > 0}
                style={{
                  opacity: submitting || recoveryCooldown > 0 ? 0.7 : 1,
                  cursor:
                    submitting || recoveryCooldown > 0 ? "wait" : "pointer",
                }}
              >
                {submitting
                  ? "Enviando…"
                  : recoveryCooldown > 0
                    ? `Espera ${recoveryCooldown}s para reintentar`
                    : "Enviar enlace de recuperación"}
              </button>
            </form>

            <div className="auth-inline-row" style={{ marginTop: 14 }}>
              <button type="button" className="auth-link" onClick={() => changeMode("login")}>← Volver al inicio de sesión</button>
              <button
                type="button"
                className="auth-link"
                onClick={handleRecoveryHelp}
                disabled={submitting}
              >
                Pedir ayuda al administrador
              </button>
            </div>
          </>
        )}

        {mode === "request" && (
          <>
            <h1>Solicitar acceso</h1>
            <p>Completa tus datos. Un administrador revisará la solicitud y, al aprobarla, te compartirá una contraseña temporal para ingresar.</p>

            <form onSubmit={handleRequest} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle} htmlFor="request-name">NOMBRE COMPLETO</label>
                <input id="request-name" type="text" required minLength={2} maxLength={160} value={requestName} onChange={event => setRequestName(event.target.value)} placeholder="Nombre y apellido" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="request-email">CORREO</label>
                <input id="request-email" type="email" autoComplete="email" required value={requestEmail} onChange={event => setRequestEmail(event.target.value)} placeholder="tu-correo@dominio.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="request-message">AREA / MOTIVO (OPCIONAL)</label>
                <textarea id="request-message" rows={3} maxLength={500} value={requestMessage} onChange={event => setRequestMessage(event.target.value)} placeholder="Ej.: encargada de salón, necesito ver encuestas del turno tarde" style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              {error && <p role="alert" className="auth-error">{error}</p>}
              {notice && <p role="status" className="auth-success">{notice}</p>}

              <button type="submit" className="auth-wall-button" disabled={submitting} style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? "wait" : "pointer" }}>
                {submitting ? "Enviando…" : "Enviar solicitud"}
              </button>
            </form>

            <div className="auth-inline-row" style={{ marginTop: 14 }}>
              <button type="button" className="auth-link" onClick={() => changeMode("login")}>← Volver al inicio de sesión</button>
            </div>
          </>
        )}

        <p className="auth-help">
          Solo para el equipo autorizado de Coronel. Si necesitas acceso, pídelo aquí y un administrador lo aprueba.
        </p>
      </div>
    </div>
  );
}

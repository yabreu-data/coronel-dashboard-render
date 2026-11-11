import { supabase } from "@/lib/supabase";
import PasswordInput from "@/components/PasswordInput";
import { useEffect, useState, type FormEvent } from "react";

type Status = "checking" | "form" | "done" | "expired" | "error";

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

const MIN_PASSWORD_LENGTH = 6;

/**
 * Destino del enlace de recuperación enviado por Supabase Auth.
 * Supabase inyecta la sesión de recuperación en la URL; aquí se valida y se
 * permite definir la nueva contraseña.
 */
export default function ResetPassword() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const errorCode = hash.get("error") ?? query.get("error");
    const errorDescription =
      hash.get("error_description") ?? query.get("error_description");

    if (errorCode || errorDescription) {
      setStatus("error");
      const decoded = decodeURIComponent(
        (errorDescription ?? "El enlace no es válido.").replace(/\+/g, " ")
      );
      setMessage(
        /expired/i.test(decoded)
          ? "El enlace expiró. Solicita uno nuevo desde la pantalla de acceso."
          : decoded
      );
      return;
    }

    let cancelled = false;
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "form" : "expired");
    };
    void checkSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          setStatus("form");
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut().catch(() => undefined);
      setPassword("");
      setConfirmation("");
      setStatus("done");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage(
        /different from the old|same password/i.test(text)
          ? "La nueva contraseña debe ser distinta a la anterior."
          : `No se pudo actualizar la contraseña: ${text}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goToLogin = (mode?: "recovery") => {
    window.location.assign(mode === "recovery" ? "/login?mode=recovery" : "/login");
  };

  return (
    <div className="auth-wall">
      <div className="auth-wall-card">
        <img
          className="loading-logo"
          src="/manus-storage/logo-coronel.png"
          alt="Coronel · Pollos y Parrillas"
        />
        <span className="auth-brand-caption">Sistema de gestión</span>
        <span className="auth-badge">RECUPERAR CONTRASEÑA</span>

        {status === "checking" && (
          <>
            <h1>Validando enlace</h1>
            <p>Estamos verificando tu enlace de recuperación. Un momento…</p>
          </>
        )}

        {(status === "expired" || status === "error") && (
          <>
            <h1>Enlace no válido</h1>
            <p>
              El enlace de recuperación expiró o ya fue utilizado. Puedes pedir
              uno nuevo: llega al correo con el que se creó tu acceso.
            </p>
            {message && <p className="auth-error">{message}</p>}
            <button
              type="button"
              className="auth-wall-button"
              onClick={() => goToLogin("recovery")}
            >
              Solicitar un enlace nuevo
            </button>
            <div className="auth-inline-row" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="auth-link"
                onClick={() => goToLogin()}
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          </>
        )}

        {status === "form" && (
          <>
            <h1>Crea tu nueva contraseña</h1>
            <p>Elige una contraseña segura. Después podrás entrar con ella.</p>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle} htmlFor="new-password">
                  NUEVA CONTRASEÑA
                </label>
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="••••••••"
                  inputStyle={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="confirm-password">
                  REPITE LA CONTRASEÑA
                </label>
                <PasswordInput
                  id="confirm-password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmation}
                  onChange={event => setConfirmation(event.target.value)}
                  placeholder="••••••••"
                  inputStyle={inputStyle}
                />
              </div>

              {message && (
                <p role="alert" className="auth-error">
                  {message}
                </p>
              )}

              <button
                type="submit"
                className="auth-wall-button"
                disabled={submitting}
                style={{
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? "wait" : "pointer",
                }}
              >
                {submitting ? "Guardando…" : "Guardar nueva contraseña"}
              </button>
            </form>
          </>
        )}

        {status === "done" && (
          <>
            <h1>Contraseña actualizada</h1>
            <p>Tu nueva contraseña ya está activa. Inicia sesión para continuar.</p>
            <button
              type="button"
              className="auth-wall-button"
              onClick={() => goToLogin()}
            >
              Ir al inicio de sesión
            </button>
          </>
        )}

        <p className="auth-help">
          El acceso es aprobado por un administrador de Coronel. Si no recibes
          el correo, revisa spam o pide apoyo a un administrador.
        </p>
      </div>
    </div>
  );
}

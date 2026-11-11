import { Eye, EyeOff } from "lucide-react";
import { useState, type CSSProperties, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  inputStyle?: CSSProperties;
  wrapperClassName?: string;
};

/**
 * Campo de contraseña con botón de ojo accesible.
 * Se usa en login, recuperación y cambio de contraseña del perfil.
 */
export default function PasswordInput({
  inputStyle,
  wrapperClassName,
  className,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={`password-field ${wrapperClassName ?? ""}`}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={className}
        style={{ ...inputStyle, paddingRight: 44 }}
      />
      <button
        type="button"
        className="password-eye"
        onClick={() => setVisible(value => !value)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}

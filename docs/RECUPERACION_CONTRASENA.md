# Recuperación de contraseña

## Qué hace la app

La pantalla de login usa `supabase.auth.resetPasswordForEmail()` y redirige a:

```
https://coronel-dashboard.onrender.com/reset-password
```

El código está en `client/src/pages/Login.tsx`.

## Qué se corrigió

- Se agregó mostrar/ocultar contraseña en el inicio de sesión.
- Se agregó un **cooldown de 60 segundos** después de solicitar el correo.
- Si Supabase responde `429 rate limit`, la app lo explica y bloquea el botón durante un minuto.
- Se agregó el acceso directo **Pedir ayuda al administrador**.
- El mensaje recomienda revisar spam y esperar antes de reintentar.

## Por qué puede no llegar el correo

La API de Supabase respondió:

```json
{
  "code": 429,
  "error_code": "over_email_send_rate_limit",
  "msg": "For security purposes, you can only request this after 43 seconds."
}
```

Eso indica que el proyecto está usando el **SMTP integrado de Supabase**, que tiene límites estrictos y baja garantía de entrega. Para producción se recomienda configurar SMTP propio.

## Configuración recomendada en Supabase

1. Entrar a **Authentication → SMTP Settings**.
2. Configurar un proveedor propio:
   - Resend.
   - SendGrid.
   - Amazon SES.
   - SMTP corporativo.
3. Verificar el dominio del remitente.
4. Definir el remitente, por ejemplo:
   `Coronel <no-reply@tudominio.com>`.
5. En **Authentication → URL Configuration**, agregar:
   - Site URL: `https://coronel-dashboard.onrender.com`
   - Redirect URL: `https://coronel-dashboard.onrender.com/reset-password`
6. Probar con un correo real y revisar spam.

## Alternativa inmediata

Un administrador puede restablecer el acceso desde:

**Usuarios y accesos → Restablecer contraseña**

La app genera una contraseña temporal y la muestra para compartirla por un canal seguro.

## Importante

Las credenciales SMTP no están en el repositorio ni en las variables actuales. No es posible activar un proveedor de correo desde el código sin una clave y un remitente verificados.

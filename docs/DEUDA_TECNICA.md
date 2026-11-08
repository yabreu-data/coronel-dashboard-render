# Deuda técnica cerrada — Análisis y Configuración

## 1. PIN unificado

Antes cada pantalla pedía la clave con `window.prompt`. Ahora existe un único
`AdminPinProvider` que muestra un modal consistente:

- Promociones.
- Encargados.
- Cuentas y accesos.
- Metas del equipo.

Ventajas:

- mismo lenguaje y diseño;
- foco atrapado;
- error inline;
- `Enter` confirma, `Esc` cierra;
- ya no se escribe la clave en un cuadro del navegador.

## 2. Metas protegidas en el servidor

`targets.save` era público y no validaba PIN. Ahora:

- exige `adminPin`;
- el servidor valida contra `ADMIN_PIN`;
- el cliente ya no envía `"5956"` hardcodeado tras un prompt;
- se añadió test de PIN incorrecto.

## 3. Guardado de metas corregido

Antes el cliente cambiaba `localStorage` **antes** de validar el PIN. Si el
usuario cancelaba, la UI y el almacenamiento quedaban desincronizados.

Ahora:

1. se pide la clave;
2. se guarda en servidor;
3. solo si responde bien se actualiza el estado local y `localStorage`;
4. se refresca el historial.

## 4. Confirmaciones destructivas

Se eliminaron los `window.confirm` de:

- aprobar/rechazar solicitudes;
- crear clave temporal;
- quitar/devolver acceso;
- guardar permisos.

El propio modal de PIN explica la acción y actúa como confirmación explícita.

## 5. Código muerto

Se eliminó `PromotionManager`, un componente duplicado que ya no se usaba y
todavía contenía un `window.prompt`.

## 6. Pendiente técnico

- Los `window.prompt` de **copiar mensaje/número** siguen como fallback de
  portapapeles. No son administrativos, pero conviene sustituirlos por un toast
  con instrucción.
- El motivo de rechazo de cumpleaños todavía usa un prompt.
- Algunos endpoints de lectura de clientes siguen siendo públicos; revisar
  política de acceso en una fase de seguridad.
- Cuentas y accesos sigue siendo la pantalla más densa en móvil.

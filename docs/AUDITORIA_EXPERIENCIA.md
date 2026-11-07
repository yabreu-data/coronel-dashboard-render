# Auditoría de experiencia — todas las secciones

## Criterio

Dueño o cajera con poca familiaridad digital. Cada pantalla debe responder:

1. ¿Qué es esto?
2. ¿Qué puedo hacer aquí?
3. ¿Cuál es la acción principal?
4. ¿Qué pasa si me equivoco?

## Estado por pantalla

| Pantalla | Estado | Qué se corrigió / qué falta |
|---|---|---|
| Centro de acción | ✅ Sólido | Insights, plan y acciones claras. Falta convertir insight negativo en prioridad con un clic. |
| Cumpleaños | ✅ Sólido | Flujo de saludo y registro. Sigue siendo denso en escritorio; en móvil funciona. |
| Clientes | ✅ Sólido | Segmentos y llamada directa. |
| Prioridades | ✅ Sólido | Cola, PIN y edición. |
| Llamadas | 🟡 Mejorado | Se quitó el CTA duplicado y el lenguaje “CRM/historial”. Faltan filtros más simples. |
| Voz del cliente | ✅ Mejorado | Insights primero; etiquetas más claras. Falta acción directa sobre un insight. |
| Equipo | 🟡 Mejorado | Menos jerga; metas y comparación más claras. Aún hay mucha información por pantalla. |
| Historial de metas | 🟡 Mejorado | “Grupo equipo/mes”, “elegir fechas” y títulos claros. Falta explicar mejor la tabla. |
| Promociones | 🟡 Mejorado | “Tus promociones”, “qué ofreces”, “para quién”. Falta reemplazar el prompt nativo por modal. |
| Encargados | 🟡 Mejorado | Lenguaje de restaurante y formulario claro. Falta modal de PIN. |
| Mi cuenta | ✅ Corregido | Se eliminó el tema oscuro heredado; copy de identidad y contraseña. |
| Cuentas y accesos | 🟡 Mejorado | Números visibles, copy llano y botones del sistema. Quedan prompts nativos y permisos avanzados. |
| PDF / reporte | 🟡 Pendiente | Funciona, pero sigue siendo técnico y largo. |

## Hallazgos críticos corregidos

### 1. Mi cuenta parecía otra aplicación
- Pestañas y tarjeta de avatar en azul oscuro.
- Texto técnico: OAuth, “identidad visual”, “trazabilidad”.
- **Corregido:** superficies marfil, tabs verdes, copy “Mis datos”, “Tu imagen”, “Cómo entras”.

### 2. Los números de Cuentas y accesos eran invisibles
- Blancos sobre fondo claro.
- **Corregido:** resumen con números en verde bosque y cajas cálidas.

### 3. Configuración hablaba en lenguaje de sistema
- “Catálogo persistente”, “roles y capacidades”, “panel protegido”.
- **Corregido:** “Tus promociones”, “Qué puede hacer cada persona”, “Quién puede entrar”.

### 4. Botones primarios invisibles
- El componente compartido usaba variables de tema no definidas.
- **Corregido:** botón verde bosque con texto blanco; outline marfil.

### 5. Llamadas duplicaba acciones
- Dos “Registrar llamada” en el estado vacío.
- **Corregido:** queda una sola agenda y el botón global.

## Convenciones que se están aplicando

- **Una acción principal por pantalla.**
- Nada de “CRM”, “scorecard”, “auditoría”, “catálogo persistente”, “trazabilidad” sin explicación.
- Los números siempre visibles y con período.
- Las tablas y permisos se explican con “qué puede hacer”, no con nombres técnicos.
- Los estados se llaman “Con acceso / Sin acceso”, no “Activa / Desactivada”.
- Las secciones de configuración se llaman como el restaurante: Promociones, Encargados, Cuentas y accesos.

## Navegación

Cambios aplicados:

- **Responsables → Encargados.**
- **Mi perfil → Mi cuenta.**
- **Administración → Cuentas y accesos.**

Motivo: “Responsables” y “Administración” son abstractos; “Encargados” y “Cuentas y accesos” describen la tarea real.

## Backlog priorizado

### P0 — Seguridad y consistencia
1. Reemplazar los `window.prompt` restantes por el modal de PIN:
   - Promociones.
   - Encargados.
   - Cuentas y accesos.
2. Confirmaciones destructivas con modal, no `window.confirm`.
3. Revisar móvil de Promociones, Encargados, Cuentas y accesos y Mi cuenta.

### P1 — Simplificación
1. Permisos “Básico / Avanzado” en Cuentas y accesos.
2. Promociones: nueva promoción arriba y catálogo después.
3. Historial: tabla con columnas explicadas en lenguaje llano.
4. PDF: resumen ejecutivo de una página.
5. Ayuda contextual global.

### P2 — Delight
1. Insight negativo → prioridad con un clic.
2. Onboarding de primer uso.
3. Comparar dos períodos.
4. Roles visuales por tipo de usuario.

## Capturas de la auditoría

- [Centro de acción](screenshots/audit/overview.png)
- [Cumpleaños](screenshots/audit/birthdays.png)
- [Clientes](screenshots/audit/clients.png)
- [Prioridades](screenshots/audit/priorities.png)
- [Llamadas](screenshots/audit/calls.png)
- [Voz del cliente](screenshots/audit/voice.png)
- [Equipo](screenshots/audit/team.png)
- [Historial](screenshots/audit/targetHistory.png)
- [Promociones](screenshots/audit/promotions.png)
- [Encargados](screenshots/audit/responsibles.png)
- [Mi cuenta](screenshots/audit/profile.png)
- [Cuentas y accesos](screenshots/audit/administracion.png)

### Móvil
- [Mi cuenta](screenshots/audit/mobile-profile.png)
- [Promociones](screenshots/audit/mobile-promotions.png)
- [Encargados](screenshots/audit/mobile-responsibles.png)

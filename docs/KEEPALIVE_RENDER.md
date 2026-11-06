# Keep-alive de Render

El plan **Free** de Render suspende el servicio tras **15 minutos sin peticiones**. La primera visita después de dormir tarda entre 30 y 60 s (cold start).

La solución implementada **no depende de tu PC ni de un servicio externo**: Supabase tiene `pg_cron` + `pg_net` habilitados y un job que hace `GET /healthz` cada **5 minutos**.

```
pg_cron (cada 5 min) ──▶ pg_net.http_get ──▶ https://coronel-dashboard.onrender.com/healthz
```

## Estado actual

| Elemento | Valor |
|---|---|
| Extensión | `pg_cron@1.6.4` + `pg_net@0.20.4` (Supabase) |
| Job | `coronel-render-keepalive` (jobid 1) |
| Cron | `*/5 * * * *` (UTC, cada 5 minutos) |
| URL | `https://coronel-dashboard.onrender.com/healthz` |
| Verificación | ejecución `succeeded` + respuesta HTTP 200 registrada en `net._http_response` |

El servicio queda despierto 24/7 ≈ **744 h/mes**, dentro de las **750 h gratuitas** de Render por workspace. Si agregas otro servicio free, reduce la ventana (ver abajo).

## Comandos

```bash
# instalar/actualizar el job (idempotente)
node scripts/setup-keepalive.mjs

# disparar un ping ahora y ver status HTTP
node scripts/setup-keepalive.mjs --test

# quitar el job
node scripts/setup-keepalive.mjs --remove

# apuntar a otra URL o cambiar la frecuencia
node scripts/setup-keepalive.mjs https://otra-app.onrender.com/healthz
KEEPALIVE_CRON="*/5 12-23,0-3 * * *" node scripts/setup-keepalive.mjs
```

También están como scripts de `package.json`:

```bash
pnpm keepalive:setup
pnpm keepalive:test
pnpm keepalive:remove
```

## Limitar el horario de actividad

El cron corre en **UTC**. Ejemplo para mantener despierto solo de **07:00 a 23:00 (Bogotá, UTC-5)** = 12:00–04:00 UTC:

```bash
KEEPALIVE_CRON="*/5 12-23,0-3 * * *" node scripts/setup-keepalive.mjs
```

Eso consume ≈ 488 h/mes y deja margen si despliegas otros servicios free.

## Verificación manual

En Supabase → SQL Editor:

```sql
-- job activo
select jobid, jobname, schedule, active from cron.job where jobname = 'coronel-render-keepalive';

-- últimas ejecuciones
select start_time, status, return_message from cron.job_run_details order by start_time desc limit 5;

-- últimas respuestas HTTP
select status_code, timed_out, created from net._http_response order by id desc limit 5;
```

`/healthz` responde JSON con `ok: true`, `database`, `supabase`, `googleSheets` y `uptime`.

## Alternativas (si no quieres depender de Supabase)

1. **Render Starter (USD 7/mes)**: elimina el spin-down (no hay cold start).
2. **Monitor externo gratis** (UptimeRobot, cron-job.org, healthchecks.io): apunta a `/healthz` cada 5 min desde su infraestructura.
3. **GitHub Actions programado**: `on.schedule` cada 10 min con `curl`; gratis en repos públicos, pero GitHub retrasa o desactiva los schedules tras 60 días sin actividad, por lo que no es la opción más fiable.

La opción implementada (`pg_cron` + `pg_net`) no consume minutos de GitHub ni cuentas adicionales, y sobrevive a reinicios del servicio.

# Keep-alive de Render

El plan **Free** de Render suspende el servicio tras **15 minutos sin peticiones**. La primera visita después de dormir tarda entre 30 y 60 s (cold start).

La solución implementada **no depende de tu PC ni de un servicio externo**: Supabase tiene `pg_cron` + `pg_net` habilitados y un job que hace `GET /healthz` cada **5 minutos**, con una **ventana de silencio de 01:30 a 06:30 hora de Lima**.

```
pg_cron (cada 5 min) ──▶ DO block (evalúa hora America/Lima) ──▶ pg_net.http_get ──▶ /healthz
```

## Estado actual

| Elemento | Valor |
|---|---|
| Extensiones | `pg_cron@1.6.4` + `pg_net@0.20.4` (Supabase) |
| Job | `coronel-render-keepalive` (jobid 5, activo) |
| Cron | `*/5 * * * *` (pg_cron corre en UTC) |
| Zona de evaluación | `America/Lima` (UTC-5, sin horario de verano) |
| Ventana sin pings | **01:30 – 06:30 hora Lima** (equivale a 06:30 – 11:30 UTC) |
| URL | `https://coronel-dashboard.onrender.com/healthz` |
| Cobertura | 19 h/día ≈ **578 h/mes** (de las 750 h gratuitas de Render) |

La ventana se evalúa **dentro de PostgreSQL** con `now() AT TIME ZONE 'America/Lima'`, no con la hora del servidor de Render ni con conversiones manuales. El job del cron se ejecuta cada 5 min, pero **no envía el ping** si la hora local de Lima está entre 01:30 y 06:30.

```sql
-- comando real del job
DO $coronel_keepalive$
DECLARE
  lima_time time := (now() AT TIME ZONE 'America/Lima')::time;
BEGIN
  IF lima_time >= time '01:30' AND lima_time < time '06:30' THEN
    RETURN;
  END IF;
  PERFORM net.http_get('https://coronel-dashboard.onrender.com/healthz', '{}'::jsonb, '{}'::jsonb, 60000);
END
$coronel_keepalive$;
```

## Verificación ejecutada

| Prueba | Resultado |
|---|---|
| Ping manual (`--test`) | HTTP 200 (`ok:true`, `database`, `supabase`, `googleSheets`) |
| Tick del cron **fuera** de la ventana | `succeeded` + ping HTTP 200 registrado en `net._http_response` |
| Tick del cron **dentro** de la ventana (simulada 00:00–23:59) | `succeeded` y **sin ping registrado** (se omitió el `http_get`) |

## Comandos

```bash
pnpm keepalive:setup     # instala/actualiza el job (idempotente)
pnpm keepalive:status    # ventana actual, job, últimas ejecuciones y pings
pnpm keepalive:test      # fuerza un ping ahora (ignora la ventana) y muestra HTTP status
pnpm keepalive:remove    # elimina el job
```

También directo con Node:

```bash
node scripts/setup-keepalive.mjs
node scripts/setup-keepalive.mjs --status
node scripts/setup-keepalive.mjs --test
node scripts/setup-keepalive.mjs --remove
```

## Cambiar la ventana o la frecuencia

```bash
# otra ventana (por ejemplo, silencio de 00:00 a 07:00 Lima)
KEEPALIVE_BLACKOUT_START="00:00" KEEPALIVE_BLACKOUT_END="07:00" node scripts/setup-keepalive.mjs

# otra zona horaria
KEEPALIVE_TZ="America/Bogota" node scripts/setup-keepalive.mjs

# pings 24/7 (sin ventana)
KEEPALIVE_BLACKOUT=off node scripts/setup-keepalive.mjs

# cada 10 minutos en lugar de cada 5
KEEPALIVE_CRON="*/10 * * * *" node scripts/setup-keepalive.mjs
```

> El cron sigue expresándose en UTC porque así funciona `pg_cron`; los ajustes de horario se hacen con la ventana, no con el cron.

## Verificación en Supabase (SQL Editor)

```sql
-- job activo
select jobid, jobname, schedule, active from cron.job where jobname = 'coronel-render-keepalive';

-- últimas ejecuciones del cron
select start_time, status, return_message from cron.job_run_details order by start_time desc limit 5;

-- pings efectivamente enviados
select status_code, timed_out, created from net._http_response order by id desc limit 5;

-- hora local de Lima y estado de la ventana
select now() at time zone 'America/Lima' as hora_lima,
       (now() at time zone 'America/Lima')::time between time '01:30' and time '06:30' as en_ventana;
```

## Alternativas

1. **Render Starter (USD 7/mes)**: elimina el spin-down (no hay cold start ni necesidad de keep-alive).
2. **Monitor externo gratis** (UptimeRobot, cron-job.org): mismo endpoint `/healthz`, con su propia programación de ventana.
3. **GitHub Actions programado**: gratis en repos públicos, pero GitHub retrasa y desactiva los schedules tras 60 días sin actividad.

La opción implementada no consume minutos de GitHub ni cuentas adicionales, y sobrevive a reinicios y redespliegues del servicio.

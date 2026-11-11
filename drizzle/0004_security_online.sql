-- Seguridad de la base de datos de la aplicación Coronel.
-- La app accede con el rol postgres (BYPASSRLS); anon/authenticated no deben
-- poder leer ni modificar tablas directamente desde Supabase.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "isOnline" boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  table_row record;
BEGIN
  FOR table_row IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_row.relname
    );
    EXECUTE format(
      'REVOKE ALL ON TABLE public.%I FROM anon, authenticated',
      table_row.relname
    );
  END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS status_changed_by uuid,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

CREATE OR REPLACE FUNCTION private.requests_track_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_by := auth.uid();
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.requests_track_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS requests_track_status_trigger ON public.requests;
CREATE TRIGGER requests_track_status_trigger
BEFORE UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION private.requests_track_status();

-- Realtime: replica identity + publication membership
ALTER TABLE public.herbarium_specimens REPLICA IDENTITY FULL;
ALTER TABLE public.requests REPLICA IDENTITY FULL;
ALTER TABLE public.request_samples REPLICA IDENTITY FULL;
ALTER TABLE public.specimen_prints REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['herbarium_specimens','requests','request_samples','specimen_prints','notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
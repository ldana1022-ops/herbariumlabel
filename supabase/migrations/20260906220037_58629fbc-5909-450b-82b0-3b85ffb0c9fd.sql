CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Validation: immutable range checks as CHECK constraints
ALTER TABLE public.herbarium_specimens
  ADD CONSTRAINT herbarium_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT herbarium_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  ADD CONSTRAINT herbarium_altitude_range CHECK (altitude_m IS NULL OR (altitude_m >= -500 AND altitude_m <= 9000)),
  ADD CONSTRAINT herbarium_scientific_name_not_blank CHECK (btrim(scientific_name) <> ''),
  ADD CONSTRAINT herbarium_serial_not_blank CHECK (btrim(serial_number) <> '');

-- 2. Time-dependent validation via trigger (CHECK must stay immutable)
CREATE OR REPLACE FUNCTION private.specimen_validate_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.collection_date IS NOT NULL AND NEW.collection_date > (now()::date + 1) THEN
    RAISE EXCEPTION 'collection_date cannot be in the future';
  END IF;
  IF NEW.determination_date IS NOT NULL AND NEW.determination_date > (now()::date + 1) THEN
    RAISE EXCEPTION 'determination_date cannot be in the future';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS specimen_validate_dates_trigger ON public.herbarium_specimens;
CREATE TRIGGER specimen_validate_dates_trigger
  BEFORE INSERT OR UPDATE ON public.herbarium_specimens
  FOR EACH ROW EXECUTE FUNCTION private.specimen_validate_dates();

CREATE OR REPLACE FUNCTION private.request_validate_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.due_date IS NOT NULL AND NEW.due_date < (COALESCE(NEW.created_at, now())::date) THEN
    RAISE EXCEPTION 'due_date cannot be before the request was created';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS request_validate_dates_trigger ON public.requests;
CREATE TRIGGER request_validate_dates_trigger
  BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION private.request_validate_dates();

-- 3. Lookup / foreign-key indexes
CREATE INDEX IF NOT EXISTS idx_herbarium_status ON public.herbarium_specimens (status);
CREATE INDEX IF NOT EXISTS idx_herbarium_created_by ON public.herbarium_specimens (created_by);
CREATE INDEX IF NOT EXISTS idx_herbarium_collection_date ON public.herbarium_specimens (collection_date);
CREATE INDEX IF NOT EXISTS idx_herbarium_updated_at ON public.herbarium_specimens (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_herbarium_serial ON public.herbarium_specimens (serial_number);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON public.requests (assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON public.requests (created_by);
CREATE INDEX IF NOT EXISTS idx_requests_specimen_id ON public.requests (specimen_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests (status);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON public.activity_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_record ON public.activity_log (record_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_specimen_access_user ON public.specimen_access (user_id);

-- 4. Trigram search indexes
CREATE INDEX IF NOT EXISTS idx_herbarium_sci_trgm ON public.herbarium_specimens USING gin (scientific_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbarium_local_trgm ON public.herbarium_specimens USING gin (local_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbarium_local_ar_trgm ON public.herbarium_specimens USING gin (local_name_ar gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbarium_locality_trgm ON public.herbarium_specimens USING gin (locality gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbarium_collectors_trgm ON public.herbarium_specimens USING gin (collectors gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_herbarium_family_trgm ON public.herbarium_specimens USING gin (family gin_trgm_ops);

-- 5. Storage: owner or super admin may replace/delete an image
DROP POLICY IF EXISTS "Update specimen images" ON storage.objects;
DROP POLICY IF EXISTS "Delete specimen images" ON storage.objects;

CREATE POLICY "Update specimen images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'specimen-images'
  AND (owner = auth.uid() OR private.is_super_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'specimen-images'
  AND (owner = auth.uid() OR private.is_super_admin(auth.uid()))
);

CREATE POLICY "Delete specimen images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'specimen-images'
  AND (owner = auth.uid() OR private.is_super_admin(auth.uid()))
);

-- 6. Backend-only throttle table for the public barcode lookup
CREATE TABLE IF NOT EXISTS public.public_access_throttle (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_hash text NOT NULL,
  endpoint text NOT NULL,
  hit_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_hash, endpoint)
);

GRANT ALL ON public.public_access_throttle TO service_role;

ALTER TABLE public.public_access_throttle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to throttle"
ON public.public_access_throttle FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_throttle_window ON public.public_access_throttle (window_start);

DROP TRIGGER IF EXISTS update_public_access_throttle_updated_at ON public.public_access_throttle;
CREATE TRIGGER update_public_access_throttle_updated_at
  BEFORE UPDATE ON public.public_access_throttle
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
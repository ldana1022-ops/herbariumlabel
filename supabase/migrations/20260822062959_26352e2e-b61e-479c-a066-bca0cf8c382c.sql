-- 1) Human-readable request number
CREATE SEQUENCE IF NOT EXISTS public.request_number_seq;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS request_number text;

-- Backfill existing requests in creation order (data untouched otherwise)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.requests WHERE request_number IS NULL ORDER BY created_at LOOP
    UPDATE public.requests
      SET request_number = 'REQ' || lpad(nextval('public.request_number_seq')::text, 6, '0')
      WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.requests
  ALTER COLUMN request_number SET DEFAULT ('REQ' || lpad(nextval('public.request_number_seq')::text, 6, '0'));

UPDATE public.requests SET request_number = 'REQ' || lpad(nextval('public.request_number_seq')::text, 6, '0')
WHERE request_number IS NULL;

ALTER TABLE public.requests ALTER COLUMN request_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS requests_request_number_key ON public.requests (request_number);

-- 2) Visibility helper for request-scoped rows
CREATE OR REPLACE FUNCTION private.can_view_request(_user_id uuid, _request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
      AND (r.assigned_to = _user_id OR r.created_by = _user_id OR private.is_super_admin(_user_id))
  )
$$;

REVOKE ALL ON FUNCTION private.can_view_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_view_request(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.owns_request(_user_id uuid, _request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
      AND (r.created_by = _user_id OR private.is_super_admin(_user_id))
  )
$$;

REVOKE ALL ON FUNCTION private.owns_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.owns_request(uuid, uuid) TO authenticated;

-- 3) Join table
CREATE TABLE IF NOT EXISTS public.request_samples (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  specimen_id uuid NOT NULL REFERENCES public.herbarium_specimens(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT request_samples_unique UNIQUE (request_id, specimen_id)
);

CREATE INDEX IF NOT EXISTS request_samples_request_id_idx ON public.request_samples (request_id);
CREATE INDEX IF NOT EXISTS request_samples_specimen_id_idx ON public.request_samples (specimen_id);

GRANT SELECT, INSERT, DELETE ON public.request_samples TO authenticated;
GRANT ALL ON public.request_samples TO service_role;

ALTER TABLE public.request_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read request samples for related requests" ON public.request_samples;
CREATE POLICY "Read request samples for related requests"
ON public.request_samples FOR SELECT TO authenticated
USING (private.can_view_request(auth.uid(), request_id));

DROP POLICY IF EXISTS "Add request samples as request owner" ON public.request_samples;
CREATE POLICY "Add request samples as request owner"
ON public.request_samples FOR INSERT TO authenticated
WITH CHECK (
  private.owns_request(auth.uid(), request_id)
  AND (private.is_super_admin(auth.uid()) OR private.has_action_permission(auth.uid(), 'send_requests'))
);

DROP POLICY IF EXISTS "Remove request samples as request owner" ON public.request_samples;
CREATE POLICY "Remove request samples as request owner"
ON public.request_samples FOR DELETE TO authenticated
USING (private.owns_request(auth.uid(), request_id));

DROP TRIGGER IF EXISTS update_request_samples_updated_at ON public.request_samples;
CREATE TRIGGER update_request_samples_updated_at
BEFORE UPDATE ON public.request_samples
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Migrate legacy single-specimen links (non-destructive: old column kept)
INSERT INTO public.request_samples (request_id, specimen_id)
SELECT r.id, r.specimen_id
FROM public.requests r
WHERE r.specimen_id IS NOT NULL
ON CONFLICT (request_id, specimen_id) DO NOTHING;
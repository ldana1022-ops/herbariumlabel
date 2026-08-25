-- 1) Anonymous visitors: column-level read access limited to the public summary fields.
REVOKE SELECT ON public.herbarium_specimens FROM anon;
GRANT SELECT (id, serial_number, scientific_name, family, locality, region, status)
  ON public.herbarium_specimens TO anon;

-- 2) Public summary view is read-only for everyone.
REVOKE ALL ON public.specimens_public FROM anon;
REVOKE ALL ON public.specimens_public FROM authenticated;
GRANT SELECT ON public.specimens_public TO anon;
GRANT SELECT ON public.specimens_public TO authenticated;

-- 3) Remove leftover anonymous privileges (RLS already blocked them; defense in depth).
REVOKE ALL ON public.request_samples FROM anon;
REVOKE ALL ON public.user_session_prefs FROM anon;
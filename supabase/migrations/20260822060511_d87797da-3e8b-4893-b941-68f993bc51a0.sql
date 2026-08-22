-- Limit anonymous access to a safe column subset only
REVOKE SELECT ON public.herbarium_specimens FROM anon;
GRANT SELECT (id, serial_number, scientific_name, family, locality, region, status)
  ON public.herbarium_specimens TO anon;

-- The public view must run with the caller's rights so RLS + column grants apply
ALTER VIEW public.specimens_public SET (security_invoker = true);
GRANT SELECT ON public.specimens_public TO anon, authenticated;
-- Public barcode lookup: least-privilege instead of an owner-rights view.
ALTER VIEW public.specimens_public SET (security_invoker = on);

-- Anonymous visitors may read only these columns, only for public specimens.
GRANT SELECT (id, serial_number, scientific_name, family, locality, region, status)
  ON public.herbarium_specimens TO anon;

DROP POLICY IF EXISTS "Anonymous can read public specimen summary" ON public.herbarium_specimens;
CREATE POLICY "Anonymous can read public specimen summary"
ON public.herbarium_specimens FOR SELECT TO anon
USING (visibility = 'everyone');
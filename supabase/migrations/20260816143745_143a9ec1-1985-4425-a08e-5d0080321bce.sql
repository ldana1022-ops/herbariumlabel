-- Sign-in removed from the app: specimens are managed by public (anonymous) visitors.
DROP POLICY IF EXISTS "Authenticated can view specimens" ON public.herbarium_specimens;
DROP POLICY IF EXISTS "Editors can insert specimens" ON public.herbarium_specimens;
DROP POLICY IF EXISTS "Editors can update specimens" ON public.herbarium_specimens;
DROP POLICY IF EXISTS "Admins can delete specimens" ON public.herbarium_specimens;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.herbarium_specimens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.herbarium_specimens TO authenticated;
GRANT ALL ON public.herbarium_specimens TO service_role;

CREATE POLICY "Public can view specimens" ON public.herbarium_specimens
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert specimens" ON public.herbarium_specimens
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update specimens" ON public.herbarium_specimens
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete specimens" ON public.herbarium_specimens
  FOR DELETE TO anon, authenticated USING (true);
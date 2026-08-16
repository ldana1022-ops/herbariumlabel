CREATE TABLE public._rls_verify (id int primary key);
INSERT INTO public._rls_verify VALUES (1);
GRANT SELECT ON public._rls_verify TO anon;
ALTER TABLE public._rls_verify ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verify" ON public._rls_verify FOR SELECT TO anon USING (NOT public.admin_exists());
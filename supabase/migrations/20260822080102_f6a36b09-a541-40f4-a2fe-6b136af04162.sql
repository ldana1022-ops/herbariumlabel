-- 1) session_settings: unused after session management removal; drop it entirely
DROP TABLE IF EXISTS public.session_settings CASCADE;

-- 2) activity_log: make the write path explicit and backend-only
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.activity_log FROM anon, authenticated;
REVOKE ALL ON public.activity_log FROM PUBLIC;
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client inserts to activity log" ON public.activity_log;
CREATE POLICY "No client inserts to activity log"
ON public.activity_log
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "No client updates to activity log" ON public.activity_log;
CREATE POLICY "No client updates to activity log"
ON public.activity_log
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false);

DROP POLICY IF EXISTS "No client deletes from activity log" ON public.activity_log;
CREATE POLICY "No client deletes from activity log"
ON public.activity_log
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);
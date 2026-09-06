-- Ordering helper so the list can be sorted and paged in the database
ALTER TABLE public.herbarium_specimens
  ADD COLUMN IF NOT EXISTS status_rank smallint
  GENERATED ALWAYS AS (
    CASE status
      WHEN 'completed' THEN 0
      WHEN 'printed' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'pending_review' THEN 3
      ELSE 4
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_herbarium_rank_serial
  ON public.herbarium_specimens (status_rank, serial_number);

-- Filter drop-down values, evaluated with the caller's own access rights
CREATE OR REPLACE FUNCTION public.specimen_facets()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'families', COALESCE((SELECT jsonb_agg(DISTINCT family ORDER BY family)
                          FROM public.herbarium_specimens
                          WHERE family IS NOT NULL AND btrim(family) <> ''), '[]'::jsonb),
    'regions', COALESCE((SELECT jsonb_agg(DISTINCT region ORDER BY region)
                         FROM public.herbarium_specimens
                         WHERE region IS NOT NULL AND btrim(region) <> ''), '[]'::jsonb),
    'collectors', COALESCE((
      SELECT jsonb_agg(DISTINCT c ORDER BY c) FROM (
        SELECT btrim(part) AS c
        FROM public.herbarium_specimens s,
             unnest(string_to_array(COALESCE(s.collectors, ''), ';')) AS part
        WHERE btrim(part) <> ''
      ) x), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.specimen_facets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.specimen_facets() TO authenticated;

-- Dashboard aggregates, evaluated with the caller's own access rights
CREATE OR REPLACE FUNCTION public.specimen_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.herbarium_specimens),
    'recent', (SELECT count(*) FROM public.herbarium_specimens
                WHERE created_at >= now() - interval '30 days'),
    'statuses', COALESCE((SELECT jsonb_object_agg(status, n) FROM (
        SELECT status::text AS status, count(*) AS n
        FROM public.herbarium_specimens GROUP BY status) s), '{}'::jsonb),
    'families', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'count', n)
                                            ORDER BY n DESC, name)
                          FROM (SELECT COALESCE(NULLIF(btrim(family), ''), '—') AS name,
                                       count(*) AS n
                                FROM public.herbarium_specimens
                                GROUP BY 1) f), '[]'::jsonb),
    'localities', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                              'locality', locality, 'region', region, 'count', n))
                            FROM (SELECT locality, region, count(*) AS n
                                  FROM public.herbarium_specimens
                                  GROUP BY locality, region) l), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.specimen_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.specimen_dashboard() TO authenticated;

-- Sign-in / sign-out audit entries (the only actions this function accepts)
CREATE OR REPLACE FUNCTION public.log_auth_event(_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _action NOT IN ('login', 'logout') THEN
    RAISE EXCEPTION 'unsupported action';
  END IF;
  INSERT INTO public.activity_log (actor_id, actor_name, action, record_label, record_id, session_info)
  VALUES (auth.uid(), COALESCE(private.actor_name(auth.uid()), 'System'), _action,
          COALESCE(private.actor_name(auth.uid()), 'System'), auth.uid(), 'auth');
END;
$$;

REVOKE ALL ON FUNCTION public.log_auth_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text) TO authenticated;
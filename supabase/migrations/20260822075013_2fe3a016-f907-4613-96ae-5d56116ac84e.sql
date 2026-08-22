-- 1) New status value
ALTER TYPE public.specimen_status ADD VALUE IF NOT EXISTS 'printed';

-- 2) Everyone active can view all specimens
CREATE OR REPLACE FUNCTION private.can_view_specimen(_uid uuid, _specimen_id uuid, _visibility public.specimen_visibility, _created_by uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  RETURN private.is_active_user(_uid);
END;
$function$;

-- 3) Edit permission comes only from an open request assigned to the user
CREATE OR REPLACE FUNCTION private.has_open_request(_uid uuid, _specimen_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL
     AND private.is_active_user(_uid)
     AND EXISTS (
       SELECT 1
       FROM public.requests r
       WHERE r.assigned_to = _uid
         AND r.status IN ('pending', 'in_progress')
         AND (
           r.specimen_id = _specimen_id
           OR EXISTS (
             SELECT 1 FROM public.request_samples rs
             WHERE rs.request_id = r.id AND rs.specimen_id = _specimen_id
           )
         )
     )
$function$;

REVOKE ALL ON FUNCTION private.has_open_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_open_request(uuid, uuid) TO authenticated, service_role;

-- 4) Specimen policies
DROP POLICY IF EXISTS "Update specimens with edit or status permission" ON public.herbarium_specimens;
DROP POLICY IF EXISTS "Delete specimens with delete permission" ON public.herbarium_specimens;
DROP POLICY IF EXISTS "Insert specimens with add permission" ON public.herbarium_specimens;

CREATE POLICY "Update specimens only via open request or admin"
ON public.herbarium_specimens FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) OR private.has_open_request(auth.uid(), id))
WITH CHECK (private.is_super_admin(auth.uid()) OR private.has_open_request(auth.uid(), id));

CREATE POLICY "Delete specimens as admin"
ON public.herbarium_specimens FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()));

CREATE POLICY "Insert specimens with add permission"
ON public.herbarium_specimens FOR INSERT TO authenticated
WITH CHECK (
  private.has_action_permission(auth.uid(), 'add')
  AND ((created_by IS NULL) OR (created_by = auth.uid()) OR private.is_super_admin(auth.uid()))
);

-- 5) Update guard: admin, or assignee of an open request
CREATE OR REPLACE FUNCTION private.specimen_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF private.is_super_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF private.has_open_request(auth.uid(), NEW.id) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PERMISSION_DENIED: you cannot edit specimen data';
END;
$function$;

-- 6) Print log: any active user may record prints; admin may delete
DROP POLICY IF EXISTS "Record prints for accessible specimens" ON public.specimen_prints;
DROP POLICY IF EXISTS "Read print log for accessible specimens" ON public.specimen_prints;
DROP POLICY IF EXISTS "Update prints for accessible specimens" ON public.specimen_prints;

CREATE POLICY "Read print log"
ON public.specimen_prints FOR SELECT TO authenticated
USING (private.is_active_user(auth.uid()));

CREATE POLICY "Record prints"
ON public.specimen_prints FOR INSERT TO authenticated
WITH CHECK (
  private.is_active_user(auth.uid())
  AND ((printed_by IS NULL) OR (printed_by = auth.uid()))
);

CREATE POLICY "Update print log"
ON public.specimen_prints FOR UPDATE TO authenticated
USING (private.is_active_user(auth.uid()))
WITH CHECK (private.is_active_user(auth.uid()));
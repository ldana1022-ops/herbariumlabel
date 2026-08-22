REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.herbarium_specimens FROM anon;
REVOKE ALL ON public.herbarium_specimens FROM PUBLIC;
GRANT SELECT ON public.herbarium_specimens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.herbarium_specimens TO authenticated;
GRANT ALL ON public.herbarium_specimens TO service_role;

CREATE POLICY "Deny anonymous writes to specimens" ON public.herbarium_specimens
  AS RESTRICTIVE FOR ALL TO anon
  USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS "Update specimens with edit or status permission" ON public.herbarium_specimens;
CREATE POLICY "Update specimens with edit or status permission" ON public.herbarium_specimens
  FOR UPDATE TO authenticated
  USING (
    private.can_view_specimen(auth.uid(), id, visibility, created_by)
    AND (private.has_action_permission(auth.uid(), 'edit') OR private.has_action_permission(auth.uid(), 'change_status'))
    AND (private.is_super_admin(auth.uid()) OR created_by = auth.uid() OR created_by IS NULL)
  )
  WITH CHECK (
    (private.has_action_permission(auth.uid(), 'edit') OR private.has_action_permission(auth.uid(), 'change_status'))
    AND (private.is_super_admin(auth.uid()) OR created_by = auth.uid() OR created_by IS NULL)
  );

DROP POLICY IF EXISTS "Delete specimens with delete permission" ON public.herbarium_specimens;
CREATE POLICY "Delete specimens with delete permission" ON public.herbarium_specimens
  FOR DELETE TO authenticated
  USING (
    private.can_view_specimen(auth.uid(), id, visibility, created_by)
    AND private.has_action_permission(auth.uid(), 'delete')
    AND (private.is_super_admin(auth.uid()) OR created_by = auth.uid() OR created_by IS NULL)
  );

DROP POLICY IF EXISTS "Insert specimens with add permission" ON public.herbarium_specimens;
CREATE POLICY "Insert specimens with add permission" ON public.herbarium_specimens
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_action_permission(auth.uid(), 'add')
    AND (created_by IS NULL OR created_by = auth.uid() OR private.is_super_admin(auth.uid()))
  );
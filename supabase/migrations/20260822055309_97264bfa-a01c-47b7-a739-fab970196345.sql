-- 1. Restore EXECUTE on private helper functions used inside RLS policies
GRANT EXECUTE ON FUNCTION private.can_view_specimen(uuid, uuid, specimen_visibility, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_action_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_print_log(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.actor_name(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION private.can_view_specimen(uuid, uuid, specimen_visibility, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.has_action_permission(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.can_access_print_log(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_active_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.actor_name(uuid) TO service_role;

-- 2. serial_number uniqueness already enforced by existing unique index
-- 3. Remove over-broad anonymous write grants (RLS already blocks them; defence in depth)
REVOKE ALL ON public.activity_log FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.requests FROM anon;
REVOKE ALL ON public.specimen_access FROM anon;
REVOKE ALL ON public.specimen_prints FROM anon;
REVOKE ALL ON public.user_permissions FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

-- keep public read of the limited public view / public specimens
GRANT SELECT ON public.specimens_public TO anon;
GRANT SELECT ON public.herbarium_specimens TO anon;
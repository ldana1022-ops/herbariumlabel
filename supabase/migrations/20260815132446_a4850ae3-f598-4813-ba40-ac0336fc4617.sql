REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_exists() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
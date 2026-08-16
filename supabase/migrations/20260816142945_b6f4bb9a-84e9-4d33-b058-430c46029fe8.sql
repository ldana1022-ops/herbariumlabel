REVOKE ALL ON FUNCTION public.admin_exists() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_edit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO service_role;
GRANT EXECUTE ON FUNCTION public.can_edit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
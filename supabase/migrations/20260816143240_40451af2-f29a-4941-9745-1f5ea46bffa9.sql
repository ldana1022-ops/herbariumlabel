DROP TABLE IF EXISTS public._rls_verify;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.can_edit(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','editor'))
$$;

CREATE OR REPLACE FUNCTION private.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_edit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.admin_exists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_edit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_exists() TO authenticated, service_role;

DROP POLICY "Admins can delete roles" ON public.user_roles;
DROP POLICY "Admins can update roles" ON public.user_roles;
DROP POLICY "Users can view own roles" ON public.user_roles;
DROP POLICY "Bootstrap first admin or self viewer" ON public.user_roles;
DROP POLICY "Admins can delete specimens" ON public.herbarium_specimens;
DROP POLICY "Editors can update specimens" ON public.herbarium_specimens;
DROP POLICY "Editors can insert specimens" ON public.herbarium_specimens;
DROP POLICY "Users can view own profile" ON public.profiles;

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Bootstrap first admin or self viewer" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id AND role = 'admin' AND NOT private.admin_exists())
    OR (auth.uid() = user_id AND role = 'viewer' AND private.admin_exists())
    OR private.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins can delete specimens" ON public.herbarium_specimens FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors can update specimens" ON public.herbarium_specimens FOR UPDATE TO authenticated
  USING (private.can_edit(auth.uid()));
CREATE POLICY "Editors can insert specimens" ON public.herbarium_specimens FOR INSERT TO authenticated
  WITH CHECK (private.can_edit(auth.uid()));
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR private.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.can_edit(uuid);
DROP FUNCTION IF EXISTS public.admin_exists();
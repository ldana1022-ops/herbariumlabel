-- =========================================================
-- 1. Types
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.specimen_visibility AS ENUM ('everyone', 'admin_only', 'selected_users');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.data_scope AS ENUM ('all', 'selected', 'own', 'admin_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.request_status AS ENUM ('pending', 'in_progress', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 2. profiles additions
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- =========================================================
-- 3. specimens additions (no existing column touched)
-- =========================================================
ALTER TABLE public.herbarium_specimens
  ADD COLUMN IF NOT EXISTS visibility public.specimen_visibility NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- =========================================================
-- 4. user_permissions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data_scope public.data_scope NOT NULL DEFAULT 'all',
  can_add boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_import boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  can_edit_samples boolean NOT NULL DEFAULT false,
  can_edit_labels boolean NOT NULL DEFAULT false,
  can_change_status boolean NOT NULL DEFAULT false,
  can_send_requests boolean NOT NULL DEFAULT false,
  can_receive_requests boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 5. specimen_access
-- =========================================================
CREATE TABLE IF NOT EXISTS public.specimen_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specimen_id uuid NOT NULL REFERENCES public.herbarium_specimens(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (specimen_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specimen_access TO authenticated;
GRANT ALL ON public.specimen_access TO service_role;
ALTER TABLE public.specimen_access ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 6. notifications
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  record_label text,
  record_id uuid,
  request_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 7. activity_log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  record_label text,
  record_id uuid,
  previous_value jsonb,
  new_value jsonb,
  session_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log (created_at DESC);

GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 8. requests
-- =========================================================
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specimen_id uuid REFERENCES public.herbarium_specimens(id) ON DELETE SET NULL,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type text NOT NULL,
  message text,
  due_date date,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 9. private helper functions (not callable from the API)
-- =========================================================
CREATE OR REPLACE FUNCTION private.is_active_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_active FROM public.profiles WHERE id = _uid), true)
    AND _uid IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.has_role(_uid, 'admin'::public.app_role)
     AND COALESCE((SELECT is_active FROM public.profiles WHERE id = _uid), true);
$$;

CREATE OR REPLACE FUNCTION private.has_action_permission(_uid uuid, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.user_permissions;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF NOT private.is_active_user(_uid) THEN RETURN false; END IF;
  IF private.is_super_admin(_uid) THEN RETURN true; END IF;
  SELECT * INTO p FROM public.user_permissions WHERE user_id = _uid;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN CASE _action
    WHEN 'add' THEN p.can_add
    WHEN 'edit' THEN p.can_edit AND p.can_edit_samples
    WHEN 'delete' THEN p.can_delete
    WHEN 'import' THEN p.can_import
    WHEN 'export' THEN p.can_export
    WHEN 'edit_samples' THEN p.can_edit_samples
    WHEN 'edit_labels' THEN p.can_edit_labels
    WHEN 'change_status' THEN p.can_change_status
    WHEN 'send_requests' THEN p.can_send_requests
    WHEN 'receive_requests' THEN p.can_receive_requests
    ELSE false
  END;
END;
$$;

CREATE OR REPLACE FUNCTION private.can_view_specimen(
  _uid uuid,
  _specimen_id uuid,
  _visibility public.specimen_visibility,
  _created_by uuid
)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _scope public.data_scope; _visible boolean; _in_scope boolean;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF NOT private.is_active_user(_uid) THEN RETURN false; END IF;
  IF private.is_super_admin(_uid) THEN RETURN true; END IF;

  _visible := CASE _visibility
    WHEN 'everyone' THEN true
    WHEN 'admin_only' THEN false
    WHEN 'selected_users' THEN EXISTS (
      SELECT 1 FROM public.specimen_access sa
      WHERE sa.specimen_id = _specimen_id AND sa.user_id = _uid
    )
    ELSE false
  END;
  IF NOT _visible THEN RETURN false; END IF;

  SELECT data_scope INTO _scope FROM public.user_permissions WHERE user_id = _uid;
  IF _scope IS NULL THEN _scope := 'all'; END IF;

  _in_scope := CASE _scope
    WHEN 'all' THEN true
    WHEN 'own' THEN _created_by = _uid
    WHEN 'selected' THEN EXISTS (
      SELECT 1 FROM public.specimen_access sa
      WHERE sa.specimen_id = _specimen_id AND sa.user_id = _uid
    )
    WHEN 'admin_only' THEN false
    ELSE false
  END;

  RETURN _in_scope;
END;
$$;

REVOKE ALL ON FUNCTION private.is_active_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_action_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_view_specimen(uuid, uuid, public.specimen_visibility, uuid) FROM PUBLIC, anon, authenticated;

-- =========================================================
-- 10. logging helpers
-- =========================================================
CREATE OR REPLACE FUNCTION private.actor_name(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(p.full_name, ''), p.email, 'System')
  FROM public.profiles p WHERE p.id = _uid;
$$;
REVOKE ALL ON FUNCTION private.actor_name(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.log_activity(
  _action text, _record_label text, _record_id uuid,
  _previous jsonb, _new jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_log (actor_id, actor_name, action, record_label, record_id, previous_value, new_value)
  VALUES (auth.uid(), COALESCE(private.actor_name(auth.uid()), 'System'), _action, _record_label, _record_id, _previous, _new);
END;
$$;
REVOKE ALL ON FUNCTION private.log_activity(text, text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.notify_admins(
  _action text, _title text, _body text, _record_label text, _record_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, actor_name, action, title, body, record_label, record_id)
  SELECT ur.user_id, auth.uid(), COALESCE(private.actor_name(auth.uid()), 'System'),
         _action, _title, _body, _record_label, _record_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_admins(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.notify_user(
  _user_id uuid, _action text, _title text, _body text,
  _record_label text, _record_id uuid, _request_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, actor_id, actor_name, action, title, body, record_label, record_id, request_id)
  VALUES (_user_id, auth.uid(), COALESCE(private.actor_name(auth.uid()), 'System'),
          _action, _title, _body, _record_label, _record_id, _request_id);
END;
$$;
REVOKE ALL ON FUNCTION private.notify_user(uuid, text, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- =========================================================
-- 11. specimen triggers: audit + notifications + status-only guard
-- =========================================================
CREATE OR REPLACE FUNCTION private.specimen_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prev jsonb := '{}'::jsonb;
  next jsonb := '{}'::jsonb;
  k text;
  old_j jsonb;
  new_j jsonb;
  label text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.log_activity('add', NEW.serial_number, NEW.id, NULL,
      jsonb_build_object('scientific_name', NEW.scientific_name, 'accession_number', NEW.accession_number));
    PERFORM private.notify_admins('add_data', 'Data Added',
      COALESCE(private.actor_name(auth.uid()), 'System') || ' added sample ' || NEW.serial_number,
      NEW.serial_number, NEW.id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM private.log_activity('delete', OLD.serial_number, OLD.id,
      jsonb_build_object('scientific_name', OLD.scientific_name, 'accession_number', OLD.accession_number), NULL);
    PERFORM private.notify_admins('delete_data', 'Data Deleted',
      COALESCE(private.actor_name(auth.uid()), 'System') || ' deleted sample ' || OLD.serial_number,
      OLD.serial_number, OLD.id);
    RETURN OLD;
  END IF;

  old_j := to_jsonb(OLD);
  new_j := to_jsonb(NEW);
  FOR k IN SELECT jsonb_object_keys(new_j) LOOP
    IF k <> 'updated_at' AND COALESCE(old_j -> k, 'null'::jsonb) <> COALESCE(new_j -> k, 'null'::jsonb) THEN
      prev := prev || jsonb_build_object(k, old_j -> k);
      next := next || jsonb_build_object(k, new_j -> k);
    END IF;
  END LOOP;

  IF prev = '{}'::jsonb THEN RETURN NEW; END IF;

  label := NEW.serial_number;
  IF next ? 'status' AND (SELECT count(*) FROM jsonb_object_keys(next)) = 1 THEN
    PERFORM private.log_activity('change_status', label, NEW.id, prev, next);
    PERFORM private.notify_admins('change_status', 'Status Changed',
      COALESCE(private.actor_name(auth.uid()), 'System') || ' changed status of sample ' || label,
      label, NEW.id);
  ELSE
    PERFORM private.log_activity('edit', label, NEW.id, prev, next);
    PERFORM private.notify_admins('edit_data', 'Data Updated',
      COALESCE(private.actor_name(auth.uid()), 'System') || ' updated sample ' || label,
      label, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS specimen_audit_trigger ON public.herbarium_specimens;
CREATE TRIGGER specimen_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.herbarium_specimens
FOR EACH ROW EXECUTE FUNCTION private.specimen_audit();

CREATE OR REPLACE FUNCTION private.specimen_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE only_status boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF private.is_super_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF private.has_action_permission(auth.uid(), 'edit') THEN RETURN NEW; END IF;

  only_status := (
    SELECT count(*) = 0 FROM jsonb_each(to_jsonb(NEW)) e
    WHERE e.key NOT IN ('status', 'updated_at')
      AND COALESCE(e.value, 'null'::jsonb) <> COALESCE(to_jsonb(OLD) -> e.key, 'null'::jsonb)
  );

  IF only_status AND private.has_action_permission(auth.uid(), 'change_status') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PERMISSION_DENIED: you cannot edit specimen data';
END;
$$;

DROP TRIGGER IF EXISTS specimen_update_guard_trigger ON public.herbarium_specimens;
CREATE TRIGGER specimen_update_guard_trigger
BEFORE UPDATE ON public.herbarium_specimens
FOR EACH ROW EXECUTE FUNCTION private.specimen_update_guard();

CREATE OR REPLACE FUNCTION private.specimen_set_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS specimen_set_creator_trigger ON public.herbarium_specimens;
CREATE TRIGGER specimen_set_creator_trigger
BEFORE INSERT ON public.herbarium_specimens
FOR EACH ROW EXECUTE FUNCTION private.specimen_set_creator();

-- permissions change audit
CREATE OR REPLACE FUNCTION private.permissions_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target text;
BEGIN
  target := COALESCE(private.actor_name(NEW.user_id), NEW.user_id::text);
  PERFORM private.log_activity('permission_changed', target, NEW.user_id,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW));
  PERFORM private.notify_admins('permission_changed', 'Permission Changed',
    COALESCE(private.actor_name(auth.uid()), 'System') || ' changed permissions of ' || target,
    target, NEW.user_id);
  PERFORM private.notify_user(NEW.user_id, 'permission_changed', 'Permission Changed',
    'Your permissions were updated', target, NEW.user_id, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS permissions_audit_trigger ON public.user_permissions;
CREATE TRIGGER permissions_audit_trigger
AFTER INSERT OR UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION private.permissions_audit();

-- requests audit + notifications
CREATE OR REPLACE FUNCTION private.requests_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE label text;
BEGIN
  label := COALESCE((SELECT serial_number FROM public.herbarium_specimens WHERE id = NEW.specimen_id), NEW.request_type);
  IF TG_OP = 'INSERT' THEN
    PERFORM private.log_activity('new_request', label, NEW.id, NULL, to_jsonb(NEW));
    PERFORM private.notify_user(NEW.assigned_to, 'new_request', 'New Request',
      COALESCE(private.actor_name(auth.uid()), 'System') || ' sent you a request: ' || NEW.request_type ||
      CASE WHEN label IS NOT NULL THEN ' (' || label || ')' ELSE '' END,
      label, NEW.specimen_id, NEW.id);
    PERFORM private.notify_admins('new_request', 'New Request',
      COALESCE(private.actor_name(auth.uid()), 'System') || ' created request ' || NEW.request_type, label, NEW.specimen_id);
    RETURN NEW;
  END IF;

  IF OLD.status <> NEW.status THEN
    PERFORM private.log_activity('request_' || NEW.status::text, label, NEW.id,
      jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
    PERFORM private.notify_admins('request_' || NEW.status::text,
      'Request ' || NEW.status::text,
      COALESCE(private.actor_name(auth.uid()), 'System') || ' set request ' || NEW.request_type || ' to ' || NEW.status::text,
      label, NEW.specimen_id);
    PERFORM private.notify_user(NEW.created_by, 'request_' || NEW.status::text,
      'Request ' || NEW.status::text,
      COALESCE(private.actor_name(auth.uid()), 'System') || ' set request ' || NEW.request_type || ' to ' || NEW.status::text,
      label, NEW.specimen_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requests_audit_trigger ON public.requests;
CREATE TRIGGER requests_audit_trigger
AFTER INSERT OR UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION private.requests_audit();

-- default permissions row for every new profile
CREATE OR REPLACE FUNCTION private.profile_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id, data_scope)
  VALUES (NEW.id, 'all')
  ON CONFLICT (user_id) DO NOTHING;
  PERFORM private.notify_admins('new_user', 'New User',
    COALESCE(NULLIF(NEW.full_name, ''), NEW.email, 'A user') || ' created an account', NEW.email, NEW.id);
  PERFORM private.log_activity('new_user', COALESCE(NEW.email, NEW.id::text), NEW.id, NULL,
    jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_defaults_trigger ON public.profiles;
CREATE TRIGGER profile_defaults_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.profile_defaults();

-- =========================================================
-- 12. RLS policies
-- =========================================================

-- specimens: replace open public policies with permission-aware ones
DROP POLICY IF EXISTS "Public can view specimens" ON public.herbarium_specimens;
DROP POLICY IF EXISTS "Public can insert specimens" ON public.herbarium_specimens;
DROP POLICY IF EXISTS "Public can update specimens" ON public.herbarium_specimens;
DROP POLICY IF EXISTS "Public can delete specimens" ON public.herbarium_specimens;

CREATE POLICY "Read specimens allowed by permissions"
ON public.herbarium_specimens FOR SELECT TO authenticated
USING (private.can_view_specimen(auth.uid(), id, visibility, created_by));

CREATE POLICY "Insert specimens with add permission"
ON public.herbarium_specimens FOR INSERT TO authenticated
WITH CHECK (private.has_action_permission(auth.uid(), 'add'));

CREATE POLICY "Update specimens with edit or status permission"
ON public.herbarium_specimens FOR UPDATE TO authenticated
USING (
  private.can_view_specimen(auth.uid(), id, visibility, created_by)
  AND (private.has_action_permission(auth.uid(), 'edit')
       OR private.has_action_permission(auth.uid(), 'change_status'))
)
WITH CHECK (
  private.has_action_permission(auth.uid(), 'edit')
  OR private.has_action_permission(auth.uid(), 'change_status')
);

CREATE POLICY "Delete specimens with delete permission"
ON public.herbarium_specimens FOR DELETE TO authenticated
USING (
  private.can_view_specimen(auth.uid(), id, visibility, created_by)
  AND private.has_action_permission(auth.uid(), 'delete')
);

-- limited public view for barcode scanning
CREATE OR REPLACE VIEW public.specimens_public AS
  SELECT id, serial_number, scientific_name, family, locality, region, status
  FROM public.herbarium_specimens
  WHERE visibility = 'everyone';

GRANT SELECT ON public.specimens_public TO anon, authenticated;

-- user_permissions
DROP POLICY IF EXISTS "Users read own permissions" ON public.user_permissions;
CREATE POLICY "Users read own permissions"
ON public.user_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins write permissions" ON public.user_permissions;
CREATE POLICY "Admins write permissions"
ON public.user_permissions FOR INSERT TO authenticated
WITH CHECK (private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update permissions" ON public.user_permissions;
CREATE POLICY "Admins update permissions"
ON public.user_permissions FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()) AND NOT private.has_role(user_id, 'admin'::public.app_role))
WITH CHECK (private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete permissions" ON public.user_permissions;
CREATE POLICY "Admins delete permissions"
ON public.user_permissions FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()) AND NOT private.has_role(user_id, 'admin'::public.app_role));

-- specimen_access
DROP POLICY IF EXISTS "Read own specimen access" ON public.specimen_access;
CREATE POLICY "Read own specimen access"
ON public.specimen_access FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage specimen access" ON public.specimen_access;
CREATE POLICY "Admins manage specimen access"
ON public.specimen_access FOR ALL TO authenticated
USING (private.is_super_admin(auth.uid()))
WITH CHECK (private.is_super_admin(auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Read own notifications" ON public.notifications;
CREATE POLICY "Read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Mark own notifications read" ON public.notifications;
CREATE POLICY "Mark own notifications read"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- activity log: admins read only, nobody writes through the API
DROP POLICY IF EXISTS "Admins read activity log" ON public.activity_log;
CREATE POLICY "Admins read activity log"
ON public.activity_log FOR SELECT TO authenticated
USING (private.is_super_admin(auth.uid()));

-- requests
DROP POLICY IF EXISTS "Read related requests" ON public.requests;
CREATE POLICY "Read related requests"
ON public.requests FOR SELECT TO authenticated
USING (assigned_to = auth.uid() OR created_by = auth.uid() OR private.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Create requests with permission" ON public.requests;
CREATE POLICY "Create requests with permission"
ON public.requests FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND private.has_action_permission(auth.uid(), 'send_requests')
);

DROP POLICY IF EXISTS "Update requests as assignee or admin" ON public.requests;
CREATE POLICY "Update requests as assignee or admin"
ON public.requests FOR UPDATE TO authenticated
USING (
  private.is_super_admin(auth.uid())
  OR (assigned_to = auth.uid() AND private.has_action_permission(auth.uid(), 'receive_requests'))
)
WITH CHECK (
  private.is_super_admin(auth.uid())
  OR (assigned_to = auth.uid() AND private.has_action_permission(auth.uid(), 'receive_requests'))
);

DROP POLICY IF EXISTS "Admins delete requests" ON public.requests;
CREATE POLICY "Admins delete requests"
ON public.requests FOR DELETE TO authenticated
USING (private.is_super_admin(auth.uid()));

-- profiles: admins can manage, users read/update their own
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (private.is_super_admin(auth.uid()))
WITH CHECK (private.is_super_admin(auth.uid()));

-- backfill permissions rows for existing profiles
INSERT INTO public.user_permissions (user_id, data_scope)
SELECT id, 'all' FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
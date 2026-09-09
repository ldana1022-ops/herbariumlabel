-- Ensure the existing super admin account is active with full permissions.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = 'dana11mu@hotmail.com';
  IF v_id IS NULL THEN RETURN; END IF;

  UPDATE public.profiles SET is_active = true WHERE id = v_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_permissions (
    user_id, data_scope, can_add, can_edit, can_delete, can_import, can_export,
    can_edit_samples, can_edit_labels, can_change_status, can_send_requests, can_receive_requests
  ) VALUES (v_id, 'all', true, true, true, true, true, true, true, true, true, true)
  ON CONFLICT (user_id) DO UPDATE SET
    data_scope = 'all', can_add = true, can_edit = true, can_delete = true,
    can_import = true, can_export = true, can_edit_samples = true, can_edit_labels = true,
    can_change_status = true, can_send_requests = true, can_receive_requests = true;
END $$;
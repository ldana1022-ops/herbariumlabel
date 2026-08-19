CREATE OR REPLACE FUNCTION private.profile_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_permissions (user_id, data_scope)
  VALUES (NEW.id, 'all')
  ON CONFLICT (user_id) DO NOTHING;

  IF lower(COALESCE(NEW.email, '')) = 'dana11mu@hotmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  PERFORM private.notify_admins('new_user', 'New User',
    COALESCE(NULLIF(NEW.full_name, ''), NEW.email, 'A user') || ' created an account', NEW.email, NEW.id);
  PERFORM private.log_activity('new_user', COALESCE(NEW.email, NEW.id::text), NEW.id, NULL,
    jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name));
  RETURN NEW;
END;
$function$;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(COALESCE(p.email, '')) = 'dana11mu@hotmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
CREATE TABLE public.session_settings (
  id boolean NOT NULL DEFAULT true PRIMARY KEY,
  idle_timeout_minutes integer NOT NULL DEFAULT 30,
  absolute_timeout_hours integer NOT NULL DEFAULT 12,
  allow_remember_me boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_settings_singleton CHECK (id = true),
  CONSTRAINT session_settings_idle_range CHECK (idle_timeout_minutes >= 0 AND idle_timeout_minutes <= 1440),
  CONSTRAINT session_settings_absolute_range CHECK (absolute_timeout_hours >= 0 AND absolute_timeout_hours <= 720)
);

GRANT SELECT, INSERT, UPDATE ON public.session_settings TO authenticated;
GRANT ALL ON public.session_settings TO service_role;

ALTER TABLE public.session_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read session settings"
  ON public.session_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert session settings"
  ON public.session_settings FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin(auth.uid()));

CREATE POLICY "Admins update session settings"
  ON public.session_settings FOR UPDATE TO authenticated
  USING (private.is_super_admin(auth.uid()))
  WITH CHECK (private.is_super_admin(auth.uid()));

CREATE TRIGGER update_session_settings_updated_at
  BEFORE UPDATE ON public.session_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.session_settings (id) VALUES (true);

CREATE TABLE public.user_session_prefs (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  idle_timeout_minutes integer,
  remember_me boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_session_prefs_idle_range CHECK (idle_timeout_minutes IS NULL OR (idle_timeout_minutes >= 1 AND idle_timeout_minutes <= 1440))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_session_prefs TO authenticated;
GRANT ALL ON public.user_session_prefs TO service_role;

ALTER TABLE public.user_session_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own session prefs"
  ON public.user_session_prefs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_super_admin(auth.uid()));

CREATE POLICY "Insert own session prefs"
  ON public.user_session_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own session prefs"
  ON public.user_session_prefs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own session prefs"
  ON public.user_session_prefs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_user_session_prefs_updated_at
  BEFORE UPDATE ON public.user_session_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
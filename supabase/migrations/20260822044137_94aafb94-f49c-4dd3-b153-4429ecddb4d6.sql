CREATE TABLE public.specimen_prints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  specimen_id uuid NOT NULL REFERENCES public.herbarium_specimens(id) ON DELETE CASCADE,
  serial_number text,
  printed_by uuid,
  first_printed_at timestamp with time zone NOT NULL DEFAULT now(),
  last_printed_at timestamp with time zone NOT NULL DEFAULT now(),
  print_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (specimen_id)
);

GRANT SELECT, INSERT, UPDATE ON public.specimen_prints TO authenticated;
GRANT ALL ON public.specimen_prints TO service_role;

ALTER TABLE public.specimen_prints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read print log" ON public.specimen_prints
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Record prints" ON public.specimen_prints
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update print log" ON public.specimen_prints
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins delete print log" ON public.specimen_prints
  FOR DELETE TO authenticated USING (private.is_super_admin(auth.uid()));

CREATE TRIGGER update_specimen_prints_updated_at
  BEFORE UPDATE ON public.specimen_prints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
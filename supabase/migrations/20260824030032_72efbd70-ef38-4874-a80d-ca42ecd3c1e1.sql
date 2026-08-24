ALTER TABLE public.herbarium_specimens
  ALTER COLUMN serial_number
  SET DEFAULT ('NCVC' || lpad(nextval('specimen_serial_seq'::regclass)::text, 6, '0'));
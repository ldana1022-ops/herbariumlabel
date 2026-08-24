ALTER TABLE public.herbarium_specimens
  ALTER COLUMN serial_number
  SET DEFAULT ('NCVCH'::text || lpad((nextval('specimen_serial_seq'::regclass))::text, 6, '0'::text));
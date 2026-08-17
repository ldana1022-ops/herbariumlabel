CREATE SEQUENCE IF NOT EXISTS public.specimen_serial_seq AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

ALTER TABLE public.herbarium_specimens
  ADD COLUMN IF NOT EXISTS serial_number text;

UPDATE public.herbarium_specimens s
SET serial_number = 'NCVCH' || lpad(nextval('public.specimen_serial_seq')::text, 6, '0')
FROM (
  SELECT id FROM public.herbarium_specimens WHERE serial_number IS NULL ORDER BY created_at, accession_number
) ordered
WHERE s.id = ordered.id AND s.serial_number IS NULL;

ALTER TABLE public.herbarium_specimens
  ALTER COLUMN serial_number SET DEFAULT 'NCVCH' || lpad(nextval('public.specimen_serial_seq')::text, 6, '0');

UPDATE public.herbarium_specimens SET serial_number = 'NCVCH' || lpad(nextval('public.specimen_serial_seq')::text, 6, '0') WHERE serial_number IS NULL;

ALTER TABLE public.herbarium_specimens ALTER COLUMN serial_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS herbarium_specimens_serial_number_key ON public.herbarium_specimens (serial_number);

GRANT USAGE, SELECT ON SEQUENCE public.specimen_serial_seq TO anon, authenticated;
GRANT ALL ON SEQUENCE public.specimen_serial_seq TO service_role;
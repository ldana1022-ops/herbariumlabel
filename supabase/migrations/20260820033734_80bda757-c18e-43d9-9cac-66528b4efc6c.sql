CREATE OR REPLACE FUNCTION private.sync_accession_to_serial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.accession_number := NEW.serial_number;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_accession_to_serial ON public.herbarium_specimens;
CREATE TRIGGER trg_sync_accession_to_serial
BEFORE INSERT OR UPDATE ON public.herbarium_specimens
FOR EACH ROW EXECUTE FUNCTION private.sync_accession_to_serial();

UPDATE public.herbarium_specimens SET accession_number = serial_number
WHERE accession_number IS DISTINCT FROM serial_number;

SELECT setval('public.specimen_serial_seq', 41, true);
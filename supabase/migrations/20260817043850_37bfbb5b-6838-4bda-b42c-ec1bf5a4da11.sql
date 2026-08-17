CREATE TYPE public.specimen_status AS ENUM ('incomplete', 'in_progress', 'pending_review', 'completed');

ALTER TABLE public.herbarium_specimens
  ADD COLUMN status public.specimen_status NOT NULL DEFAULT 'incomplete';

UPDATE public.herbarium_specimens
  SET status = 'completed'
  WHERE determination IS NOT NULL AND btrim(determination) <> '';
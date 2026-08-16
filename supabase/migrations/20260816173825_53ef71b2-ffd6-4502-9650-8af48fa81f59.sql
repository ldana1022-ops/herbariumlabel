ALTER TABLE public.herbarium_specimens ADD COLUMN IF NOT EXISTS local_name_ar text;
ALTER TABLE public.herbarium_specimens ALTER COLUMN family DROP NOT NULL;
ALTER TABLE public.herbarium_specimens ALTER COLUMN locality DROP NOT NULL;
ALTER TABLE public.herbarium_specimens ALTER COLUMN collection_date DROP NOT NULL;
ALTER TABLE public.herbarium_specimens ALTER COLUMN collectors DROP NOT NULL;
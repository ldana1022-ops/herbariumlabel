CREATE TABLE public.herbarium_specimens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accession_number text NOT NULL UNIQUE,
  scientific_name text NOT NULL,
  family text NOT NULL,
  local_name text,
  locality text NOT NULL,
  region text,
  latitude numeric,
  longitude numeric,
  altitude_m numeric,
  collection_date date NOT NULL,
  collectors text NOT NULL,
  determination text,
  determined_by text,
  determination_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.herbarium_specimens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.herbarium_specimens TO authenticated;
GRANT ALL ON public.herbarium_specimens TO service_role;

ALTER TABLE public.herbarium_specimens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view specimens" ON public.herbarium_specimens FOR SELECT USING (true);
CREATE POLICY "Public can insert specimens" ON public.herbarium_specimens FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update specimens" ON public.herbarium_specimens FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete specimens" ON public.herbarium_specimens FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_herbarium_specimens_updated_at
BEFORE UPDATE ON public.herbarium_specimens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_herbarium_family ON public.herbarium_specimens (family);
CREATE INDEX idx_herbarium_region ON public.herbarium_specimens (region);
CREATE INDEX idx_herbarium_scientific_name ON public.herbarium_specimens (scientific_name);

INSERT INTO public.herbarium_specimens
(accession_number, scientific_name, family, local_name, locality, region, latitude, longitude, altitude_m, collection_date, collectors, determination, determined_by, determination_date, notes)
VALUES
('NCVC-2025-0001','Ficus glumosa Delile','Moraceae','Albadh (البدع)','Jazan - Farasan - Al-Husayyin','Jazan',16.7133333,41.9282500,20,'2025-01-16','Faisal Al Easa','Ficus glumosa Delile','Dr. Ahmed Al-Harbi','2025-02-04','Tree ca. 6 m tall, growing on coral limestone.'),
('NCVC-2025-0002','Acacia tortilis (Forssk.) Hayne','Fabaceae','Samr (السمر)','Riyadh - Thadiq National Park','Riyadh',25.2916670,45.4708330,720,'2025-02-03','Faisal Al Easa; Saleh Al-Qahtani',NULL,NULL,NULL,'Dominant tree in wadi bed.'),
('NCVC-2025-0003','Juniperus procera Hochst. ex Endl.','Cupressaceae','Arar (العرعر)','Asir - Al-Souda','Asir',18.2750000,42.3650000,2850,'2025-02-11','Mohammed Al-Shehri','Juniperus procera Hochst. ex Endl.','Dr. Ahmed Al-Harbi','2025-03-01','Montane juniper woodland.'),
('NCVC-2025-0004','Calotropis procera (Aiton) W.T.Aiton','Apocynaceae','Ushar (العشر)','Makkah - Wadi Fatimah','Makkah',21.4833330,39.8500000,180,'2025-02-18','Faisal Al Easa',NULL,NULL,NULL,NULL),
('NCVC-2025-0005','Haloxylon persicum Bunge','Amaranthaceae','Ghada (الغضا)','Al-Qassim - Al-Nafud fringe','Al-Qassim',26.5100000,43.9600000,650,'2025-03-02','Saleh Al-Qahtani','Haloxylon persicum Bunge','Dr. Noura Al-Otaibi','2025-03-20','Sand-dune shrubland.'),
('NCVC-2025-0006','Rhazya stricta Decne.','Apocynaceae','Harmal (الحرمل)','Eastern Province - Al-Ahsa','Eastern Province',25.3833330,49.5833330,140,'2025-03-09','Mohammed Al-Shehri',NULL,NULL,NULL,'Common on disturbed sandy soils.'),
('NCVC-2025-0007','Ziziphus spina-christi (L.) Desf.','Rhamnaceae','Sidr (السدر)','Madinah - Wadi Al-Aqiq','Madinah',24.4166670,39.5666670,600,'2025-03-15','Faisal Al Easa','Ziziphus spina-christi (L.) Desf.','Dr. Ahmed Al-Harbi','2025-04-02',NULL),
('NCVC-2025-0008','Tamarix aphylla (L.) H.Karst.','Tamaricaceae','Athl (الأثل)','Najran - Wadi Najran','Najran',17.5000000,44.1333330,1250,'2025-03-28','Saleh Al-Qahtani',NULL,NULL,NULL,'Planted as windbreak; also naturalized.');
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type Specimen = {
  id: string;
  accession_number: string;
  scientific_name: string;
  family: string;
  local_name: string | null;
  local_name_ar: string | null;
  locality: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude_m: number | null;
  collection_date: string;
  collectors: string;
  determination: string | null;
  determined_by: string | null;
  determination_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  });

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const specimenSchema = z.object({
  accession_number: z.string().trim().min(1, "required").max(60),
  scientific_name: z.string().trim().min(1, "required").max(200),
  family: z.string().trim().min(1, "required").max(120),
  local_name: optionalText,
  locality: z.string().trim().min(1, "required").max(300),
  region: optionalText,
  latitude: optionalNumber.refine(
    (v) => v === null || (!Number.isNaN(v) && v >= -90 && v <= 90),
    "invalidLat",
  ),
  longitude: optionalNumber.refine(
    (v) => v === null || (!Number.isNaN(v) && v >= -180 && v <= 180),
    "invalidLong",
  ),
  altitude_m: optionalNumber.refine(
    (v) => v === null || !Number.isNaN(v),
    "invalidNumber",
  ),
  collection_date: z.string().trim().min(1, "required"),
  collectors: z.string().trim().min(1, "required").max(300),
  determination: optionalText,
  determined_by: optionalText,
  determination_date: optionalDate,
  notes: z.string().trim().max(2000).optional().transform((v) => (v && v.length > 0 ? v : null)),
});

export type SpecimenInput = z.input<typeof specimenSchema>;
export type SpecimenPayload = z.output<typeof specimenSchema>;

export const emptySpecimen: SpecimenInput = {
  accession_number: "",
  scientific_name: "",
  family: "",
  local_name: "",
  locality: "",
  region: "",
  latitude: "",
  longitude: "",
  altitude_m: "",
  collection_date: "",
  collectors: "",
  determination: "",
  determined_by: "",
  determination_date: "",
  notes: "",
};

export const isDetermined = (s: Specimen) => Boolean(s.determination && s.determination.trim());

export function formatDate(value: string | null): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export async function fetchSpecimens(): Promise<Specimen[]> {
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .select("*")
    .order("accession_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Specimen[];
}

export async function fetchSpecimen(id: string): Promise<Specimen | null> {
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Specimen) ?? null;
}

function humanizeError(message: string): string {
  if (message.includes("duplicate key") || message.includes("unique")) {
    return "DUPLICATE_ACCESSION";
  }
  return message;
}

export async function createSpecimen(payload: SpecimenPayload): Promise<Specimen> {
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(humanizeError(error.message));
  return data as Specimen;
}

export async function updateSpecimen(id: string, payload: Partial<SpecimenPayload>): Promise<Specimen> {
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(humanizeError(error.message));
  return data as Specimen;
}

export async function deleteSpecimen(id: string): Promise<void> {
  const { error } = await supabase.from("herbarium_specimens").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function bulkInsertSpecimens(payloads: SpecimenPayload[]): Promise<number> {
  if (payloads.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < payloads.length; i += 200) {
    const chunk = payloads.slice(i, i + 200);
    const { data, error } = await supabase.from("herbarium_specimens").insert(chunk).select("id");
    if (error) throw new Error(humanizeError(error.message));
    inserted += data?.length ?? 0;
  }
  return inserted;
}

export async function bulkUpdateSpecimens(
  updates: { id: string; payload: SpecimenPayload }[],
): Promise<number> {
  let updated = 0;
  for (const item of updates) {
    await updateSpecimen(item.id, item.payload);
    updated += 1;
  }
  return updated;
}
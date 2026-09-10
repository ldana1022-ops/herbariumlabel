import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { SpecimenStatus } from "./specimen-status";

export type Specimen = {
  id: string;
  accession_number: string;
  serial_number: string;
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
  image_url: string | null;
  status: SpecimenStatus;
  created_at: string;
  updated_at: string;
};

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const optionalNumber = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((v) => {
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
  // Auto-generated from the serial number by the database; kept optional for imports.
  accession_number: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v ?? ""),
  scientific_name: z.string().trim().min(1, "required").max(200),
  family: optionalText,
  local_name: optionalText,
  local_name_ar: optionalText,
  locality: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  region: optionalText,
  latitude: optionalNumber.refine(
    (v) => v === null || (!Number.isNaN(v) && v >= -90 && v <= 90),
    "invalidLat",
  ),
  longitude: optionalNumber.refine(
    (v) => v === null || (!Number.isNaN(v) && v >= -180 && v <= 180),
    "invalidLong",
  ),
  altitude_m: optionalNumber.refine((v) => v === null || !Number.isNaN(v), "invalidNumber"),
  collection_date: optionalDate,
  collectors: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  determination: optionalText,
  determined_by: optionalText,
  determination_date: optionalDate,
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
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

export async function updateSpecimenStatus(id: string, status: SpecimenStatus): Promise<void> {
  const { error } = await supabase.from("herbarium_specimens").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

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

/** Rows loaded per page of the specimen database table. */
export const SPECIMENS_PAGE_SIZE = 50;

export type SpecimenFilters = {
  q?: string;
  family?: string;
  region?: string;
  collector?: string;
  status?: SpecimenStatus | "";
  from?: string;
  to?: string;
};

const SEARCH_COLUMNS = [
  "accession_number",
  "serial_number",
  "scientific_name",
  "family",
  "local_name",
  "local_name_ar",
  "locality",
  "region",
  "collectors",
  "determination",
];

/** Strips characters that would break PostgREST's or() filter syntax. */
function safeNeedle(value: string): string {
  return value
    .trim()
    .replace(/[,()%*\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Applies the database-side filters shared by the list, export and select-all. */
function withFilters<T>(query: T, filters: SpecimenFilters): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  const needle = safeNeedle(filters.q ?? "");
  if (needle) {
    q = q.or(SEARCH_COLUMNS.map((c) => `${c}.ilike.%${needle}%`).join(","));
  }
  if (filters.family) q = q.eq("family", filters.family);
  if (filters.region) q = q.eq("region", filters.region);
  if (filters.collector) q = q.ilike("collectors", `%${filters.collector}%`);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.from) q = q.gte("collection_date", filters.from);
  if (filters.to) q = q.lte("collection_date", filters.to);
  return q as T;
}

/** Completed/printed first, then serial order — the same order as before, in SQL. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withOrder(query: any) {
  return query
    .order("status_rank", { ascending: true, nullsFirst: false })
    .order("serial_number", { ascending: true });
}

/** One page of specimens plus the total number of matching rows. */
export async function fetchSpecimensPage(
  filters: SpecimenFilters,
  page = 0,
  pageSize = SPECIMENS_PAGE_SIZE,
): Promise<{ rows: Specimen[]; total: number }> {
  const base = supabase.from("herbarium_specimens").select("*", { count: "exact" });
  const from = page * pageSize;
  const { data, error, count } = await withOrder(withFilters(base, filters)).range(
    from,
    from + pageSize - 1,
  );
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Specimen[], total: count ?? 0 };
}

/** All rows matching the filters, fetched in chunks (used for export). */
export async function fetchAllMatchingSpecimens(filters: SpecimenFilters): Promise<Specimen[]> {
  const chunk = 1000;
  const all: Specimen[] = [];
  for (let page = 0; ; page += 1) {
    const { rows, total } = await fetchSpecimensPage(filters, page, chunk);
    all.push(...rows);
    if (all.length >= total || rows.length === 0) break;
  }
  return all;
}

/** Ids of every row matching the filters (used by "select all"). */
export async function fetchMatchingSpecimenIds(filters: SpecimenFilters): Promise<string[]> {
  const base = supabase.from("herbarium_specimens").select("id");
  const { data, error } = await withOrder(withFilters(base, filters));
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export async function fetchSpecimensByIds(ids: string[]): Promise<Specimen[]> {
  if (ids.length === 0) return [];
  const out: Specimen[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("herbarium_specimens")
      .select("*")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Specimen[]));
  }
  return out;
}

export type SpecimenFacets = { families: string[]; regions: string[]; collectors: string[] };

/** Distinct filter values, computed in the database. */
export async function fetchSpecimenFacets(): Promise<SpecimenFacets> {
  const { data, error } = await supabase.rpc("specimen_facets");
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Partial<SpecimenFacets>;
  return {
    families: raw.families ?? [],
    regions: raw.regions ?? [],
    collectors: raw.collectors ?? [],
  };
}

export type SpecimenDashboard = {
  total: number;
  recent: number;
  statuses: Record<string, number>;
  families: { name: string; count: number }[];
  localities: { locality: string | null; region: string | null; count: number }[];
};

/** Dashboard counters aggregated in the database instead of in the browser. */
export async function fetchSpecimenDashboard(): Promise<SpecimenDashboard> {
  const { data, error } = await supabase.rpc("specimen_dashboard");
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Partial<SpecimenDashboard>;
  return {
    total: raw.total ?? 0,
    recent: raw.recent ?? 0,
    statuses: raw.statuses ?? {},
    families: raw.families ?? [],
    localities: raw.localities ?? [],
  };
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
  // accession_number is overwritten by the database trigger from the generated serial number.
  const insertPayload = { ...payload, accession_number: payload.accession_number || "PENDING" };
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw new Error(humanizeError(error.message));
  return data as Specimen;
}

export async function updateSpecimen(
  id: string,
  payload: Partial<SpecimenPayload>,
): Promise<Specimen> {
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

/** Fields that can be updated for many specimens at once. */
export const BULK_EDITABLE_FIELDS = [
  "family",
  "local_name",
  "local_name_ar",
  "locality",
  "region",
  "collectors",
  "determination",
  "determined_by",
  "determination_date",
  "notes",
] as const;

export type BulkEditableField = (typeof BULK_EDITABLE_FIELDS)[number];

/** Deletes only the given ids; RLS decides which rows are actually removed. */
export async function bulkDeleteSpecimens(ids: string[]): Promise<number> {
  if (ids.length === 0) throw new Error("NO_SELECTION");
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .delete()
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function bulkUpdateStatus(ids: string[], status: SpecimenStatus): Promise<number> {
  if (ids.length === 0) throw new Error("NO_SELECTION");
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .update({ status })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function bulkUpdateField(
  ids: string[],
  field: BulkEditableField,
  value: string,
): Promise<number> {
  if (ids.length === 0) throw new Error("NO_SELECTION");
  const trimmed = value.trim();
  const patch = { [field]: trimmed.length > 0 ? trimmed : null } as Partial<
    Record<BulkEditableField, string | null>
  >;
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .update(patch)
    .in("id", ids)
    .select("id");
  if (error) throw new Error(humanizeError(error.message));
  return data?.length ?? 0;
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
export async function fetchSpecimenBySerial(serial: string): Promise<Specimen | null> {
  const { data, error } = await supabase
    .from("herbarium_specimens")
    .select("*")
    .eq("serial_number", serial.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Specimen) ?? null;
}

export type PublicSpecimen = {
  id: string;
  serial_number: string;
  scientific_name: string;
  family: string | null;
  locality: string | null;
  region: string | null;
  status: SpecimenStatus;
};

/** Limited, publicly readable summary used by the barcode scan page. */
export async function fetchPublicSpecimenBySerial(serial: string): Promise<PublicSpecimen | null> {
  const { data, error } = await supabase
    .from("specimens_public")
    .select("id, serial_number, scientific_name, family, locality, region, status")
    .eq("serial_number", serial.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PublicSpecimen) ?? null;
}

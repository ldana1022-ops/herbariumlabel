import * as XLSX from "xlsx";
import { specimenSchema, type SpecimenPayload } from "./specimens";

export const IMPORT_FIELDS = [
  "accession_number",
  "scientific_name",
  "family",
  "local_name",
  "local_name_ar",
  "locality",
  "region",
  "latitude",
  "longitude",
  "altitude_m",
  "collection_date",
  "collectors",
  "determination",
  "determined_by",
  "determination_date",
  "notes",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/**
 * Column aliases. Matching ignores case, spaces, punctuation and Arabic
 * diacritics, so "up date sci. name", "Update sci. name", "family ",
 * "Family " and "Location" all resolve to the right label field.
 */
const ALIASES: Record<ImportField, string[]> = {
  accession_number: [
    "accession",
    "accessionnumber",
    "accessionno",
    "number",
    "no",
    "رقمالعينة",
    "الرقم",
  ],
  scientific_name: [
    "updatescianame",
    "updatesciname",
    "updatesciencename",
    "updatescientificname",
    "upscianame",
    "scientificname",
    "sciname",
    "scianame",
    "species",
    "taxon",
    "name",
    "الاسمالعلمي",
  ],
  family: ["family", "familyname", "الفصيلة", "العائلة"],
  local_name: ["localname", "vernacularname", "commonname", "الاسمالمحلي"],
  local_name_ar: [
    "localnamearabic",
    "localnamear",
    "arabiclocalname",
    "arabicname",
    "الاسمالمحليبالعربي",
    "الاسمالعربي",
  ],
  locality: ["locality", "location", "site", "الموقع", "موقعالجمع"],
  region: ["region", "province", "area", "المنطقة"],
  latitude: ["latitude", "lat", "latn", "n", "خطالعرض"],
  longitude: ["longitude", "long", "longe", "lon", "lng", "e", "خطالطول"],
  altitude_m: ["altitude", "alt", "altm", "elevation", "altitudem", "الارتفاع"],
  collection_date: [
    "collectiondate",
    "dateofcoll",
    "dateofcollection",
    "datecollected",
    "datecoll",
    "date",
    "تاريخالجمع",
  ],
  collectors: ["collector", "collectors", "collectorss", "leg", "الجامع", "جامعالعينة"],
  determination: ["determination", "det", "determinedas", "التصنيف"],
  determined_by: ["determinedby", "detby", "identifiedby", "المحدد"],
  determination_date: ["determinationdate", "detdate", "تاريخالتحديد"],
  notes: ["notes", "remarks", "comment", "ملاحظات"],
};

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/[\s_\-().:/]/g, "")
    .replace(/[ًٌٍَُِّْ]/g, "");

const isIgnorableColumn = (c: string) => /^unnamed:/i.test(c.trim()) || norm(c).length === 0;

export type ParsedSheet = { columns: string[]; rows: Record<string, unknown>[] };

/** Reads every sheet in the workbook and merges the rows (union of columns). */
export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array", cellDates: true });
  const columns: string[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    if (!sheet) continue;
    const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    for (const row of sheetRows) {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (isIgnorableColumn(key)) continue;
        clean[key] = value;
        if (!columns.includes(key)) columns.push(key);
      }
      // skip fully empty rows
      if (Object.values(clean).some((v) => String(v ?? "").trim().length > 0)) rows.push(clean);
    }
  }
  return { columns, rows };
}

/** Best single column per field (used to pre-fill the mapping UI). */
export function autoMap(columns: string[]): Record<ImportField, string> {
  const mapping = {} as Record<ImportField, string>;
  for (const field of IMPORT_FIELDS) {
    mapping[field] = aliasColumns(columns, field)[0] ?? "";
  }
  return mapping;
}

/** Every column in the file that means this field (handles duplicate variants). */
function aliasColumns(columns: string[], field: ImportField): string[] {
  const candidates = [norm(field), ...ALIASES[field].map(norm)];
  return columns.filter((c) => candidates.includes(norm(c)));
}

function toDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

export type MappedRow = {
  index: number;
  values: Record<ImportField, string>;
  payload: SpecimenPayload | null;
  error: string | null;
};

export function mapRows(
  rows: Record<string, unknown>[],
  mapping: Record<ImportField, string>,
): MappedRow[] {
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const fallbacks = {} as Record<ImportField, string[]>;
  for (const field of IMPORT_FIELDS) fallbacks[field] = aliasColumns(columns, field);

  return rows.map((row, index) => {
    const values = {} as Record<ImportField, string>;
    for (const field of IMPORT_FIELDS) {
      // Prefer the explicitly mapped column, then any other column variant that
      // carries data for the same field (e.g. "up date sci. name" vs "Update sci. name").
      const order = [mapping[field], ...fallbacks[field]].filter(Boolean) as string[];
      let raw: unknown = "";
      for (const col of order) {
        const candidate = String(row[col] ?? "").trim();
        if (candidate.length > 0) {
          raw = candidate;
          break;
        }
      }
      values[field] =
        field === "collection_date" || field === "determination_date"
          ? toDate(raw)
          : String(raw ?? "").trim();
    }
    if (!values.accession_number) values.accession_number = `AUTO-${index + 1}`;
    const result = specimenSchema.safeParse(values);
    return {
      index,
      values,
      payload: result.success ? result.data : null,
      error: result.success ? null : (result.error.issues[0]?.message ?? "invalid"),
    };
  });
}

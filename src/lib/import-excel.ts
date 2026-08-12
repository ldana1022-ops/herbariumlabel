import * as XLSX from "xlsx";
import { specimenSchema, type SpecimenPayload } from "./specimens";

export const IMPORT_FIELDS = [
  "accession_number",
  "scientific_name",
  "family",
  "local_name",
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

const ALIASES: Record<ImportField, string[]> = {
  accession_number: ["accession", "accessionnumber", "accessionno", "number", "no", "رقمالعينة", "الرقم"],
  scientific_name: ["scientificname", "species", "taxon", "name", "الاسمالعلمي"],
  family: ["family", "الفصيلة", "العائلة"],
  local_name: ["localname", "vernacularname", "commonname", "الاسمالمحلي"],
  locality: ["locality", "location", "site", "الموقع", "موقعالجمع"],
  region: ["region", "province", "area", "المنطقة"],
  latitude: ["latitude", "lat", "latn", "خطالعرض"],
  longitude: ["longitude", "long", "lon", "lng", "خطالطول"],
  altitude_m: ["altitude", "alt", "elevation", "altitudem", "الارتفاع"],
  collection_date: ["collectiondate", "datecollected", "date", "تاريخالجمع"],
  collectors: ["collector", "collectors", "collectorss", "leg", "الجامع", "جامعالعينة"],
  determination: ["determination", "det", "determinedas", "التصنيف"],
  determined_by: ["determinedby", "detby", "identifiedby", "المحدد"],
  determination_date: ["determinationdate", "detdate", "تاريخالتحديد"],
  notes: ["notes", "remarks", "comment", "ملاحظات"],
};

const norm = (v: string) => v.toLowerCase().replace(/[\s_\-().:/]/g, "").replace(/[ًٌٍَُِّْ]/g, "");

export type ParsedSheet = { columns: string[]; rows: Record<string, unknown>[] };

export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = book.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };
  const sheet = book.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
  return { columns, rows };
}

export function autoMap(columns: string[]): Record<ImportField, string> {
  const mapping = {} as Record<ImportField, string>;
  for (const field of IMPORT_FIELDS) {
    const candidates = [norm(field), ...ALIASES[field].map(norm)];
    const found = columns.find((c) => candidates.includes(norm(c)));
    mapping[field] = found ?? "";
  }
  return mapping;
}

function toDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
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

export function mapRows(rows: Record<string, unknown>[], mapping: Record<ImportField, string>): MappedRow[] {
  return rows.map((row, index) => {
    const values = {} as Record<ImportField, string>;
    for (const field of IMPORT_FIELDS) {
      const col = mapping[field];
      const raw = col ? row[col] : "";
      values[field] =
        field === "collection_date" || field === "determination_date"
          ? toDate(raw)
          : String(raw ?? "").trim();
    }
    const result = specimenSchema.safeParse(values);
    return {
      index,
      values,
      payload: result.success ? result.data : null,
      error: result.success ? null : (result.error.issues[0]?.message ?? "invalid"),
    };
  });
}

import * as XLSX from "xlsx";
import { isDetermined, type Specimen } from "./specimens";

export function exportSpecimensToExcel(specimens: Specimen[], filename = "herbarium_specimens.xlsx") {
  const rows = specimens.map((s) => ({
    "Accession Number": s.accession_number,
    "Scientific Name": s.scientific_name,
    Family: s.family,
    "Local Name": s.local_name ?? "",
    Locality: s.locality,
    Region: s.region ?? "",
    Latitude: s.latitude ?? "",
    Longitude: s.longitude ?? "",
    Altitude: s.altitude_m ?? "",
    "Collection Date": s.collection_date,
    "Collector(s)": s.collectors,
    Determination: s.determination ?? "",
    "Determined By": s.determined_by ?? "",
    "Determination Date": s.determination_date ?? "",
    Notes: s.notes ?? "",
    Status: isDetermined(s) ? "Determined" : "Undetermined",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    18, 30, 18, 20, 32, 16, 14, 14, 10, 16, 24, 30, 20, 18, 36, 14,
  ].map((w) => ({ wch: w }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Specimens");
  XLSX.writeFile(book, filename);
}
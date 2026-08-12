import { formatDate, type Specimen } from "./specimens";
import { toMm, type LabelSize } from "./label-size";

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function scientificName(name: string) {
  const parts = name.trim().split(/\s+/);
  const binomial = esc(parts.slice(0, 2).join(" "));
  const authority = esc(parts.slice(2).join(" "));
  return `<i>${binomial}</i>${authority ? ` <b>${authority}</b>` : ""}`;
}

function row(key: string, value: string, dots = false) {
  const shown = value && value.trim() ? esc(value) : dots ? "................................................" : "";
  return `<p style="margin:0 0 2pt 0;"><b>${esc(key)}</b> ${shown}</p>`;
}

function labelHtml(s: Specimen, size: LabelSize) {
  const w = toMm(size.width, size.unit);
  const h = toMm(size.height, size.unit);
  const base = 7.8 * size.fontScale;
  const lat = s.latitude ?? ".........";
  const lon = s.longitude ?? ".........";
  const alt = s.altitude_m !== null && s.altitude_m !== undefined ? `${s.altitude_m} m` : "..........m";

  return `
  <table cellspacing="0" cellpadding="0" style="width:${w}mm;border-collapse:collapse;border:2pt solid #000000;font-family:'Times New Roman',serif;font-size:${base}pt;color:#000000;">
    <tr>
      <td style="border-bottom:2pt solid #000000;background:#f0f0f0;padding:4pt;text-align:center;font-family:Arial,sans-serif;">
        <p style="margin:0;font-weight:bold;font-size:${(8.2 * size.fontScale).toFixed(1)}pt;">FLORA OF SAUDIA ARABIA KINGDOM</p>
        <p style="margin:2pt 0 0 0;font-weight:bold;font-size:${(6.6 * size.fontScale).toFixed(1)}pt;">HERBARIUM OF NATIONAL CENTER FOR VEGETATION COVER<br/>DEVELOPMENT AND COMBATING DESERTIFICATION</p>
      </td>
    </tr>
    <tr>
      <td style="height:${Math.max(h - 20, 20)}mm;vertical-align:top;padding:5pt 6pt;">
        <p style="margin:0 0 2pt 0;"><b>Scientific Name:</b> ${scientificName(s.scientific_name)}</p>
        ${row("Family:", s.family)}
        ${row("Local Name:", s.local_name ?? "", true)}
        ${row("Locality:", s.locality)}
        <p style="margin:0 0 2pt 0;"><b>Lat (N):</b> ${esc(lat)} &nbsp;&nbsp; <b>(E):</b> ${esc(lon)} &nbsp;&nbsp; <b>Alt.:</b> ${esc(alt)}</p>
        ${row("Collection Date:", formatDate(s.collection_date))}
        ${row("Collector (s):", s.collectors)}
        ${row("Determined By:", s.determined_by ?? "", true)}
        ${row("Notes:", s.notes ?? "", true)}
        <p style="margin:4pt 0 0 0;text-align:right;font-family:Arial,sans-serif;font-size:${(6 * size.fontScale).toFixed(1)}pt;color:#333333;">${esc(s.accession_number)}</p>
      </td>
    </tr>
  </table>`;
}

export function exportLabelsToWord(specimens: Specimen[], size: LabelSize, filename?: string) {
  if (specimens.length === 0) return;
  const w = toMm(size.width, size.unit);
  const h = toMm(size.height, size.unit);

  const body = specimens
    .map(
      (s, i) =>
        `${labelHtml(s, size)}${i < specimens.length - 1 ? '<br clear="all" style="page-break-before:always" />' : ""}`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" />
<title>Herbarium Labels</title>
<style>
@page { size: ${w}mm ${h + 10}mm; margin: 5mm; mso-page-orientation: portrait; }
body { font-family: 'Times New Roman', serif; }
</style>
</head>
<body>${body}</body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    (specimens.length === 1
      ? `label_${specimens[0]!.accession_number}.doc`
      : `herbarium_labels_${specimens.length}.doc`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

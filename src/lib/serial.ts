/**
 * Accepts what people actually type or scan: full serial, lowercase,
 * spaces/dashes, a bare number, or a scanned URL containing the serial.
 * Returns a canonical NCVCH###### serial, or null when unusable.
 */
export function normalizeSerial(input: string): string | null {
  let value = (input || "").trim().toUpperCase();
  if (!value) return null;
  // A scanned URL such as .../p/NCVCH000001 (legacy NCVC also accepted)
  const fromUrl = value.match(/NCVCH?\s*-?\s*(\d{1,8})/);
  if (fromUrl?.[1]) value = `NCVCH${fromUrl[1]}`;
  value = value.replace(/[\s\-_.]/g, "");
  if (/^\d{1,8}$/.test(value)) value = `NCVCH${value}`;
  const m = value.match(/^NCVCH?(\d{1,8})$/);
  if (!m?.[1]) return null;
  const digits = m[1].length < 6 ? m[1].padStart(6, "0") : m[1];
  return `NCVCH${digits}`;
}

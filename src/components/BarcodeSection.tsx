import { Barcode } from "@/components/Barcode";
import { DEFAULT_BARCODE_SIZE, type BarcodeSize } from "@/lib/barcode-size";

export const HERBARIUM_NAME = "Herbarium of National Center for Vegetation Cover";

/**
 * Barcode block — fully independent from the herbarium label.
 * Order: herbarium name, barcode, then serial number below the barcode.
 */
export function BarcodeSection({
  serial,
  size = DEFAULT_BARCODE_SIZE,
}: {
  serial: string;
  size?: BarcodeSize;
}) {
  if (!serial) return null;
  return (
    <div className="barcode-section" dir="ltr" lang="en">
      <div className="barcode-section-title">{HERBARIUM_NAME}</div>
      <Barcode value={serial} widthMm={size.width} heightMm={size.height} />
      <div className="barcode-section-serial">{serial}</div>
    </div>
  );
}

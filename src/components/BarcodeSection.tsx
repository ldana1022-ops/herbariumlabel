import { Barcode } from "@/components/Barcode";
import { barcodeToMm, DEFAULT_BARCODE_SIZE, type BarcodeSize } from "@/lib/barcode-size";
import {
  DEFAULT_BARCODE_TEXT,
  DEFAULT_BARCODE_TEXT_VALUE,
  type BarcodeTextSettings,
} from "@/lib/barcode-text";

export const HERBARIUM_NAME = DEFAULT_BARCODE_TEXT_VALUE;

/**
 * Barcode block — fully independent from the herbarium label.
 * Order: heading text (configurable), barcode, then serial number below it.
 */
export function BarcodeSection({
  serial,
  size = DEFAULT_BARCODE_SIZE,
  text = DEFAULT_BARCODE_TEXT,
}: {
  serial: string;
  size?: BarcodeSize;
  text?: BarcodeTextSettings;
}) {
  if (!serial) return null;
  const unit = size.unit ?? "mm";
  const heading = text.text?.trim();
  return (
    <div className="barcode-section" dir="ltr" lang="en">
      {text.show && heading ? (
        <div
          className="barcode-section-title"
          style={{
            fontSize: `${text.fontSize}pt`,
            fontWeight: text.bold ? 700 : 400,
            textTransform: text.uppercase ? "uppercase" : "none",
            textAlign:
              text.align === "center" ? "center" : text.align === "start" ? "left" : "right",
            alignSelf:
              text.align === "center"
                ? "center"
                : text.align === "start"
                  ? "flex-start"
                  : "flex-end",
          }}
        >
          {heading}
        </div>
      ) : null}
      <Barcode
        value={serial}
        widthMm={barcodeToMm(size.width, unit)}
        heightMm={barcodeToMm(size.height, unit)}
      />
      <div className="barcode-section-serial">{serial}</div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

const PX_PER_MM = 96 / 25.4;

/** CODE128-B module count for a value (start + data + checksum + stop). */
function moduleCount(value: string) {
  return 11 * (value.length + 2) + 13;
}

type BarcodeProps = {
  value: string;
  /** Target rendered width in millimetres. Bars are sized so no distortion occurs. */
  widthMm?: number;
  /** Bar height in millimetres. */
  heightMm?: number;
  displayValue?: boolean;
  className?: string;
};

/**
 * CODE128 barcode rendered as inline SVG (crisp on screen and in print).
 * The encoded text is the specimen serial number, so any scanner reads it back.
 */
export function Barcode({
  value,
  widthMm = 50,
  heightMm = 14,
  displayValue = false,
  className,
}: BarcodeProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    const targetPx = widthMm * PX_PER_MM;
    const moduleWidth = Math.max(0.6, targetPx / moduleCount(value));
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height: Math.max(8, heightMm * PX_PER_MM),
        width: moduleWidth,
        displayValue,
        fontSize: 12,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
        font: "Arial",
        textMargin: 1,
      });
    } catch {
      /* invalid value — leave empty */
    }
  }, [value, widthMm, heightMm, displayValue]);

  return <svg ref={ref} className={className} role="img" aria-label={value} />;
}

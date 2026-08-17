import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type BarcodeProps = {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
};

/**
 * CODE128 barcode rendered as inline SVG (crisp on screen and in print).
 * The encoded text is the specimen serial number, so any scanner reads it back.
 */
export function Barcode({
  value,
  height = 34,
  width = 1.4,
  fontSize = 12,
  displayValue = true,
  className,
}: BarcodeProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width,
        fontSize,
        displayValue,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
        font: "Arial",
        textMargin: 1,
      });
    } catch {
      /* invalid value — leave empty */
    }
  }, [value, height, width, fontSize, displayValue]);

  return <svg ref={ref} className={className} role="img" aria-label={value} />;
}

import { useCallback, useEffect, useState } from "react";

export const DEFAULT_BARCODE_TEXT_VALUE = "Herbarium of National Center for Vegetation Cover";

export type BarcodeTextSettings = {
  /** text rendered above the barcode */
  text: string;
  /** show or hide the text */
  show: boolean;
  /** font size in points */
  fontSize: number;
  /** bold weight */
  bold: boolean;
  /** uppercase transform */
  uppercase: boolean;
  /** horizontal alignment */
  align: "start" | "center" | "end";
};

export const DEFAULT_BARCODE_TEXT: BarcodeTextSettings = {
  text: DEFAULT_BARCODE_TEXT_VALUE,
  show: true,
  fontSize: 8,
  bold: true,
  uppercase: false,
  align: "center",
};

export const BARCODE_TEXT_LIMITS = { minFont: 4, maxFont: 24 };

export const clampBarcodeText = (s: BarcodeTextSettings): BarcodeTextSettings => ({
  ...s,
  fontSize: Math.min(
    BARCODE_TEXT_LIMITS.maxFont,
    Math.max(BARCODE_TEXT_LIMITS.minFont, Number(s.fontSize) || DEFAULT_BARCODE_TEXT.fontSize),
  ),
});

const KEY = "ncvc-barcode-text";

export function useBarcodeText() {
  const [settings, setSettingsState] = useState<BarcodeTextSettings>(DEFAULT_BARCODE_TEXT);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        setSettingsState(
          clampBarcodeText({ ...DEFAULT_BARCODE_TEXT, ...JSON.parse(raw) } as BarcodeTextSettings),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback((patch: Partial<BarcodeTextSettings>) => {
    setSettingsState((prev) => {
      const next = clampBarcodeText({ ...prev, ...patch });
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => update(DEFAULT_BARCODE_TEXT), [update]);

  return { settings, update, reset };
}

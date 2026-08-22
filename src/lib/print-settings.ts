import { useCallback, useEffect, useState } from "react";

export type PrintMode = "labels" | "barcodes" | "both";
export type PaperUnit = "mm" | "cm";

export const PAPERS: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  A3: { w: 297, h: 420 },
  Letter: { w: 216, h: 279 },
};

export const CUSTOM_PAPER = "custom";

export type PrintSettings = {
  mode: PrintMode;
  /** one of PAPERS keys or CUSTOM_PAPER */
  paper: string;
  /** custom paper size, kept independently from label/barcode sizes */
  customPaper: { width: number; height: number; unit: PaperUnit };
  orientation: "portrait" | "landscape";
  margin: number;
  cols: number;
  gap: number;
  copies: number;
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  mode: "both",
  paper: "A4",
  customPaper: { width: 210, height: 297, unit: "mm" },
  orientation: "portrait",
  margin: 8,
  cols: 2,
  gap: 4,
  copies: 1,
};

export const paperToMm = (value: number, unit: PaperUnit) => (unit === "cm" ? value * 10 : value);

/** Resolved paper dimensions in millimetres for the active selection. */
export function resolvePaperMm(settings: PrintSettings): { w: number; h: number } {
  if (settings.paper === CUSTOM_PAPER) {
    const { width, height, unit } = settings.customPaper;
    return {
      w: Math.max(20, paperToMm(width || 0, unit)),
      h: Math.max(20, paperToMm(height || 0, unit)),
    };
  }
  return PAPERS[settings.paper] ?? PAPERS['A4']!;
}

const STORAGE_KEY = "ncvc-print-settings";

export function usePrintSettings() {
  const [settings, setSettingsState] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PrintSettings>;
        setSettingsState({
          ...DEFAULT_PRINT_SETTINGS,
          ...parsed,
          customPaper: {
            ...DEFAULT_PRINT_SETTINGS.customPaper,
            ...(parsed.customPaper ?? {}),
          },
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback((patch: Partial<PrintSettings>) => {
    setSettingsState((prev) => {
      const next: PrintSettings = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { settings, update };
}
